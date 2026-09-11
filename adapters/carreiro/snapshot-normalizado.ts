/**
 * Snapshot Normalizado da Carga de Inventário
 * Camada: Adapters / Carreiro
 * 100% em Português do Brasil (pt-BR).
 *
 * POR QUE EXISTE:
 * A carga ao vivo no Power BI leva de 8 a 65 segundos e depende de rede. Durante
 * uma apresentação isso é inaceitável em dois sentidos: a espera e, pior, a queda.
 * Já ocorreu `ENOTFOUND api.powerbi.com` em pleno carregamento, e a tela mostrou
 * stack trace ao usuário.
 *
 * Este módulo persiste a RESPOSTA JÁ NORMALIZADA do adaptador (não o payload cru
 * do DAX), com todos os campos que o motor usa. Recarregar dele é instantâneo e
 * não toca a rede.
 *
 * O snapshot é uma REDE DE SEGURANÇA e um acelerador de demonstração — não um
 * substituto do dado vivo. Ele carrega o timestamp da geração para que a interface
 * possa dizer com honestidade de quando é a informação exibida.
 */

import fs from "fs";
import path from "path";
import { Produto, EstoqueFilial, HistoricoVendasFilial } from "@core/dominio";
import {
  RespostaCargaInventario,
  EntradaNFeDoDia,
  ItemSimilarIntercambiavel,
} from "../AdaptadorInventario";

/** Formato serializável: Map vira array de pares. */
interface SnapshotSerializado {
  readonly versao: 1;
  readonly geradoEm: string;
  readonly produtos: readonly Produto[];
  readonly estoques: readonly [string, EstoqueFilial][];
  readonly historicos: readonly [string, HistoricoVendasFilial][];
  readonly entradasHoje: readonly EntradaNFeDoDia[];
  readonly similares: readonly [number, readonly ItemSimilarIntercambiavel[]][];
}

const NOME_ARQUIVO = "inventario-carreiro.json";

/**
 * Caminho do snapshot normalizado. `CARREIRO_SNAPSHOT_DIR` sobrescreve.
 */
export function caminhoSnapshotNormalizado(diretorio?: string): string {
  const base =
    diretorio ??
    process.env.CARREIRO_SNAPSHOT_DIR ??
    path.resolve(process.cwd(), "data", "carreiro");
  return path.join(base, NOME_ARQUIVO);
}

/**
 * Grava a carga normalizada em disco.
 */
export function gravarSnapshotNormalizado(
  carga: RespostaCargaInventario,
  diretorio?: string
): string {
  const caminho = caminhoSnapshotNormalizado(diretorio);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });

  const conteudo: SnapshotSerializado = {
    versao: 1,
    geradoEm: new Date().toISOString(),
    produtos: carga.produtos,
    estoques: [...carga.estoques.entries()],
    historicos: [...carga.historicos.entries()],
    entradasHoje: carga.entradasHoje,
    similares: [...carga.similares.entries()],
  };

  fs.writeFileSync(caminho, JSON.stringify(conteudo), "utf-8");
  return caminho;
}

/**
 * Lê o snapshot normalizado, se existir e for legível.
 * Devolve null em qualquer problema — o chamador decide o que fazer.
 */
export function lerSnapshotNormalizado(
  diretorio?: string
): RespostaCargaInventario | null {
  const caminho = caminhoSnapshotNormalizado(diretorio);
  if (!fs.existsSync(caminho)) return null;

  try {
    const bruto = JSON.parse(fs.readFileSync(caminho, "utf-8")) as SnapshotSerializado;
    if (bruto.versao !== 1 || !Array.isArray(bruto.produtos)) return null;

    const idadeMs = Date.now() - new Date(bruto.geradoEm).getTime();
    const idadeHoras = Number.isFinite(idadeMs) ? idadeMs / 3_600_000 : Number.NaN;

    return {
      produtos: bruto.produtos,
      estoques: new Map(bruto.estoques),
      historicos: new Map(bruto.historicos),
      entradasHoje: bruto.entradasHoje ?? [],
      similares: new Map(bruto.similares ?? []),
      metadados: {
        provedor: "CARREIRO_SNAPSHOT_LOCAL",
        timestampCarga: bruto.geradoEm,
        // Snapshot É modo degradado: o dado não é o de agora, e a interface
        // precisa poder dizer isso a quem está decidindo uma compra.
        emModoDegradado: true,
        totalSkusCarregados: bruto.produtos.length,
        latenciaMs: 0,
        motivoModoDegradado: Number.isFinite(idadeHoras)
          ? `Dados do snapshot local gerado há ${idadeHoras.toFixed(1)}h (${bruto.geradoEm}).`
          : "Dados do snapshot local.",
      },
    };
  } catch {
    return null;
  }
}

/**
 * Captura do snapshot no clique de Exportar — lado do cliente.
 * Camada: Aplicação (src/lib/aprendizado) — seguro para o navegador.
 *
 * REGRAS (herdadas do diário):
 * - Fire-and-forget: a captura NUNCA bloqueia nem quebra o download.
 * - Granularidade por loja: quantidade do comprador e do modelo são ambas da
 *   loja em foco, nunca um total combinado.
 * - Lotes de 500: a rota aceita até 2000; nada é descartado em silêncio.
 */

import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import { quantidadePedidoEfetiva, quantidadeTransferenciaEfetiva } from "@/lib/exportacao/catalogo-colunas";
import type { ItemSnapshotEntrada } from "./repositorio";

const TAMANHO_LOTE = 500;

export function montarItensSnapshot(itens: readonly LinhaCockpitMatriz[]): ItemSnapshotEntrada[] {
  return itens.map((i) => ({
    produtoId: i.produtoId,
    sku: i.codigoSku,
    descricao: i.descricao.slice(0, 200),
    filialId: i.filialFocoId,
    custo: i.precoCusto,
    qtdComprador: quantidadePedidoEfetiva(i),
    qtdTransferenciaComprador: quantidadeTransferenciaEfetiva(i),
    qtdModelo: i.perfilGiro === "SEM_HISTORICO_SUFICIENTE" ? null : i.sugestaoFinalCompra,
    qtdTransferenciaModelo: i.quantidadeTransferenciaSugerida,
    perfil: i.perfilGiro,
    consumoDiario: i.consumoDiario ?? i.consumoMedioDiario180d ?? 0,
    horizonteDias: i.horizonteDiasAplicado,
    margemAplicada: i.margemSegurancaAplicada,
    fatorCalibracao: i.fatorCalibracaoAplicado > 0 ? i.fatorCalibracaoAplicado : 1,
    previsaoBruta: i.previsaoBrutaModelo,
    elegivel: i.perfilGiro !== "SEM_HISTORICO_SUFICIENTE",
    motivoInelegibilidade: i.motivoInelegibilidade,
    sinalGovernanca: null,
  }));
}

export function capturarSnapshotAprendizado(parametros: {
  readonly itens: readonly LinhaCockpitMatriz[];
  readonly filialId: number;
  readonly layoutId: string;
  readonly formato: "csv" | "xlsx" | "pdf";
}): void {
  const itens = montarItensSnapshot(parametros.itens);
  if (itens.length === 0) return;

  try {
    for (let i = 0; i < itens.length; i += TAMANHO_LOTE) {
      const lote = itens.slice(i, i + TAMANHO_LOTE);
      void fetch("/api/aprendizado/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filialId: parametros.filialId,
          layoutId: parametros.layoutId,
          formato: parametros.formato,
          itens: lote,
        }),
        keepalive: lote.length <= 60, // keepalive tem limite de 64KB
      }).catch((erro) => {
        console.warn("[aprendizado] snapshot não capturado:", erro);
      });
    }
  } catch (erro) {
    console.warn("[aprendizado] snapshot não capturado:", erro);
  }
}

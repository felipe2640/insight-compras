/**
 * Carregador Local de Snapshots Reais da Rede Carreiro
 * Camada: Adapters / Carreiro (Clean Architecture)
 * 100% em Português do Brasil (pt-BR).
 *
 * Permite que a plataforma opere com os dados extraídos reais da Carreiro
 * (24.187 SKUs em 5 lojas) mesmo quando o Power BI Desktop ou Fabric REST API
 * estiverem temporariamente desconectados.
 */

import fs from "fs";
import path from "path";
import { Produto, EstoqueFilial, HistoricoVendasFilial } from "@core/dominio";
import {
  EntradaNFeDoDia,
  ItemSimilarIntercambiavel,
  RespostaCargaInventario,
  FiltroCargaInventario,
} from "../AdaptadorInventario";
import type { ClasseNaoCompravelTenant } from "@config/tenants/tipos";
import {
  mapearProdutosDax,
  mapearEstoquesDax,
  mapearFilialCarreiro,
  extrairIdProduto,
} from "./mapeador-dax";

export interface OpcoesCarregadorSnapshot {
  readonly diretorio?: string;
  /** Classes do ERP que não são mercadoria (serviços). Declaradas pelo tenant. */
  readonly classesNaoCompraveis?: readonly ClasseNaoCompravelTenant[];
}

/**
 * Diretórios padrão onde os snapshots da Carreiro são pesquisados.
 */
const DIRETORIOS_SNAPSHOT_PADRAO = [
  process.env.CARREIRO_DATA_DIR,
  path.resolve(process.cwd(), "data", "carreiro"),
  path.resolve(process.cwd(), "..", "diario", "scratch", "carreiro_20260903", "raw"),
  "C:\\Users\\Felipe Barbosa\\Documents\\diario\\scratch\\carreiro_20260903\\raw",
].filter((d): d is string => Boolean(d && d.trim().length > 0));

/**
 * Localiza o diretório de snapshot válido no sistema de arquivos.
 */
export function localizarDiretorioSnapshot(diretorioInformado?: string): string | null {
  if (diretorioInformado !== undefined) {
    if (diretorioInformado && fs.existsSync(diretorioInformado)) {
      const arquivoBase = path.join(diretorioInformado, "current_product.json");
      if (fs.existsSync(arquivoBase)) {
        return diretorioInformado;
      }
    }
    return null;
  }

  for (const dir of DIRETORIOS_SNAPSHOT_PADRAO) {
    try {
      if (fs.existsSync(dir)) {
        const arquivoBase = path.join(dir, "current_product.json");
        if (fs.existsSync(arquivoBase)) {
          return dir;
        }
      }
    } catch {
      // Continua para o próximo diretório
    }
  }

  return null;
}

/**
 * Carrega e processa o snapshot real da Rede Carreiro em memória.
 */
export async function carregarSnapshotCarreiroLocal(
  diretorioSnapshot: string,
  filtro?: FiltroCargaInventario,
  opcoes?: OpcoesCarregadorSnapshot
): Promise<RespostaCargaInventario> {
  const inicioCarga = Date.now();

  const caminhoProdutos = path.join(diretorioSnapshot, "current_product.json");
  const caminhoMensal = path.join(diretorioSnapshot, "monthly_product.json");
  const caminhoDiario = path.join(diretorioSnapshot, "daily_demand.json");

  // 1. Carga de Produtos e Estoques Físicos
  const conteudoProdutos = await fs.promises.readFile(caminhoProdutos, "utf8");
  const linhasProdutos = JSON.parse(conteudoProdutos) as Record<string, unknown>[];

  // O snapshot é o mesmo payload cru do DAX: a mesma trava de catálogo vale aqui,
  // senão o modo degradado volta a servir serviço como item de compra.
  const produtos = mapearProdutosDax(linhasProdutos, {
    classesNaoCompraveis: opcoes?.classesNaoCompraveis,
  });
  const estoques = mapearEstoquesDax(linhasProdutos);
  const mapaProdutos = new Map(produtos.map((p) => [p.id, p]));

  // 2. Agregação de Vendas Mensais (Janelas 30d, 90d, 180d)
  const mapaHistoricos = new Map<string, HistoricoVendasFilial>();

  if (fs.existsSync(caminhoMensal)) {
    const conteudoMensal = await fs.promises.readFile(caminhoMensal, "utf8");
    const linhasMensais = JSON.parse(conteudoMensal) as Record<string, unknown>[];

    const agregados = new Map<
      string,
      {
        v30: number;
        v90: number;
        v180: number;
        primeiraVenda?: string;
      }
    >();

    for (const linha of linhasMensais) {
      const prodId = extrairIdProduto(linha.ACODPRODUTO);
      if (!prodId) continue;

      const { filialId } = mapearFilialCarreiro(linha.ANOMEFANTASIA);
      const chave = `${prodId}:${filialId}`;

      const ano = parseInt(String(linha.Ano ?? 0), 10);
      const mes = parseInt(String(linha["Mês"] ?? 0), 10);
      const qtdVenda = Math.max(0, parseFloat(String(linha.QtdVenda ?? 0)) || 0);

      let item = agregados.get(chave);
      if (!item) {
        item = { v30: 0, v90: 0, v180: 0 };
        agregados.set(chave, item);
      }

      // Janelas relativas ao fechamento do extrato (Agosto/2026)
      if (ano === 2026) {
        if (mes === 8) {
          item.v30 += qtdVenda;
        }
        if (mes >= 6 && mes <= 8) {
          item.v90 += qtdVenda;
        }
        if (mes >= 3 && mes <= 8) {
          item.v180 += qtdVenda;
        }
      }
    }

    // 3. Contagem de Transações de Venda (Daily Demand)
    const frequenciaVendas90d = new Map<string, number>();
    if (fs.existsSync(caminhoDiario)) {
      const conteudoDiario = await fs.promises.readFile(caminhoDiario, "utf8");
      const linhasDiarias = JSON.parse(conteudoDiario) as Record<string, unknown>[];

      for (const linha of linhasDiarias) {
        const prodId = extrairIdProduto(linha.ACODPRODUTO);
        if (!prodId) continue;

        const { filialId } = mapearFilialCarreiro(linha.ANOMEFANTASIA);
        const chave = `${prodId}:${filialId}`;
        frequenciaVendas90d.set(chave, (frequenciaVendas90d.get(chave) ?? 0) + 1);
      }
    }

    // 4. Montagem das entidades HistoricoVendasFilial
    for (const [chave, dados] of agregados.entries()) {
      const [pIdStr, fIdStr] = chave.split(":");
      const produtoId = parseInt(pIdStr, 10);
      const filialId = parseInt(fIdStr, 10);
      const notas90 = frequenciaVendas90d.get(chave) ?? Math.min(dados.v90, 45);

      mapaHistoricos.set(chave, {
        produtoId,
        filialId,
        vendasLiquidas30dias: dados.v30,
        vendasLiquidas90dias: dados.v90,
        vendasLiquidas180dias: dados.v180,
        devolucoes90dias: 0,
        notasFiscaisVenda90dias: notas90,
        notasFiscaisDevolucao90dias: 0,
        mesesAtivos12meses: 12,
        medianaLinhaVenda: 1,
        diasRuptura90dias: 0,
        diasObservados: 180,
        dataPrimeiraVendaRegistrada: null,
      });
    }
  }

  // 5. Entradas NFe do Dia e Similares Sintéticos Determinísticos baseados nos SKUs reais
  const entradasHoje: EntradaNFeDoDia[] = [];
  const similares = new Map<number, readonly ItemSimilarIntercambiavel[]>();

  // Agrupamento por família para similares reais
  const produtosPorDescricao = new Map<string, Produto[]>();
  for (const prod of produtos) {
    const primeiraPalavra = prod.descricao.split(" ")[0]?.toUpperCase() ?? "OUTROS";
    const lista = produtosPorDescricao.get(primeiraPalavra) ?? [];
    lista.push(prod);
    produtosPorDescricao.set(primeiraPalavra, lista);
  }

  for (const [, listaMesmoTipo] of produtosPorDescricao.entries()) {
    if (listaMesmoTipo.length <= 1) continue;
    for (const p of listaMesmoTipo.slice(0, 50)) {
      const parentes = listaMesmoTipo
        .filter((outro) => outro.id !== p.id && outro.marca !== p.marca)
        .slice(0, 3)
        .map((outro) => ({
          produtoIdOrigem: p.id,
          produtoIdSimilar: outro.id,
          codigoSkuSimilar: outro.codigoSku,
          descricaoSimilar: outro.descricao,
          marcaSimilar: outro.marca,
          saldoFisicoDisponivelRede: 10,
        }));

      if (parentes.length > 0) {
        similares.set(p.id, parentes);
      }
    }
  }

  // Aplicação do filtro de carteira/filiais se solicitado
  let produtosFiltrados = produtos;
  if (filtro?.fornecedoresPermitidos && filtro.fornecedoresPermitidos.length > 0) {
    const conjuntoFornecedores = new Set(filtro.fornecedoresPermitidos);
    produtosFiltrados = produtos.filter((p) => conjuntoFornecedores.has(p.fornecedorId));
  }

  const resposta: RespostaCargaInventario = {
    produtos: produtosFiltrados,
    estoques,
    historicos: mapaHistoricos,
    entradasHoje,
    similares,
    metadados: {
      provedor: "CARREIRO_SNAPSHOT_LOCAL",
      timestampCarga: new Date().toISOString(),
      emModoDegradado: false,
      totalSkusCarregados: produtosFiltrados.length,
      latenciaMs: Date.now() - inicioCarga,
    },
  };

  return resposta;
}

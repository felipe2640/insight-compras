/**
 * Montagem da tabela de exportação a partir do layout do cliente.
 * Camada: Aplicação (src/lib/exportacao) — função pura, sem I/O.
 */

import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import {
  CATALOGO_COLUNAS_EXPORTACAO,
  quantidadePedidoEfetiva,
  quantidadeTransferenciaEfetiva,
} from "./catalogo-colunas";
import {
  ColunaExportavel,
  EscopoLinhasExportacao,
  LayoutExportacao,
  TabelaExportacao,
} from "./tipos";

/** Aplica o escopo de linhas do layout. */
export function filtrarPorEscopo(
  itens: readonly LinhaCockpitMatriz[],
  escopo: EscopoLinhasExportacao
): LinhaCockpitMatriz[] {
  switch (escopo) {
    case "compra":
      return itens.filter((i) => quantidadePedidoEfetiva(i) > 0);
    case "transferencia":
      return itens.filter((i) => quantidadeTransferenciaEfetiva(i) > 0);
    case "compra_ou_transferencia":
      return itens.filter(
        (i) => quantidadePedidoEfetiva(i) > 0 || quantidadeTransferenciaEfetiva(i) > 0
      );
    case "todos":
    default:
      return [...itens];
  }
}

/**
 * Resolve a lista de colunas: a seleção do usuário (se houver) restrita à ordem
 * do layout, ignorando IDs que o catálogo não conhece.
 */
export function resolverColunas(
  layout: LayoutExportacao,
  colunasSelecionadas?: ReadonlySet<string> | readonly string[]
): ColunaExportavel[] {
  const selecionadas = colunasSelecionadas
    ? new Set(Array.isArray(colunasSelecionadas) ? colunasSelecionadas : [...colunasSelecionadas])
    : null;

  const resultado: ColunaExportavel[] = [];
  for (const id of layout.colunas) {
    if (selecionadas && !selecionadas.has(id)) continue;
    const coluna = CATALOGO_COLUNAS_EXPORTACAO.get(id);
    if (coluna) resultado.push(coluna);
  }
  return resultado;
}

/** Rótulo final: o do cliente, se personalizado; senão o do catálogo. */
export function rotuloDaColuna(layout: LayoutExportacao, coluna: ColunaExportavel): string {
  return layout.rotulosPersonalizados?.[coluna.id] ?? coluna.rotulo;
}

function normalizarValor(valor: unknown): string | number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  const texto = String(valor);
  return texto.length > 0 ? texto : null;
}

export function montarTabelaExportacao(
  itens: readonly LinhaCockpitMatriz[],
  layout: LayoutExportacao,
  colunasSelecionadas?: ReadonlySet<string> | readonly string[]
): TabelaExportacao {
  const colunas = resolverColunas(layout, colunasSelecionadas);
  const linhasFonte = filtrarPorEscopo(itens, layout.escopo);

  return {
    cabecalhos: colunas.map((c) => rotuloDaColuna(layout, c)),
    tipos: colunas.map((c) => c.tipo),
    linhas: linhasFonte.map((item) => colunas.map((c) => normalizarValor(c.extrair(item)))),
  };
}

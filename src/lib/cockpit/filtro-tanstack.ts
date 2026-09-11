/**
 * Ponte entre o motor de filtro por coluna e o TanStack Table.
 * Camada: Aplicação (src/lib/cockpit).
 *
 * O motor (filtros-coluna) não conhece TanStack e continua testável sozinho.
 * Aqui só se traduz: qual a variante daquela coluna e qual o valor da célula.
 */

import type { Row } from "@tanstack/react-table";
import {
  FiltroColuna,
  VarianteColuna,
  aplicarFiltroColuna,
  filtroEstaCompleto,
} from "./filtros-coluna";

export function varianteDaColuna(meta: unknown): VarianteColuna {
  const variante = (meta as { variante?: unknown } | undefined)?.variante;
  return variante === "numero" || variante === "selecao" || variante === "data"
    ? variante
    : "texto";
}

export function funcaoFiltroColuna<TData>(
  linha: Row<TData>,
  idColuna: string,
  valorFiltro: unknown
): boolean {
  const filtro = valorFiltro as FiltroColuna | undefined;
  if (!filtroEstaCompleto(filtro)) return true;
  const meta = linha.getAllCells().find((c) => c.column.id === idColuna)?.column.columnDef.meta;
  return aplicarFiltroColuna(linha.getValue(idColuna), filtro, varianteDaColuna(meta));
}

/** O TanStack guarda o filtro por coluna; isto lê de volta com tipo. */
export function lerFiltroDaColuna(valor: unknown): FiltroColuna | null {
  if (!valor || typeof valor !== "object") return null;
  const f = valor as FiltroColuna;
  return typeof f.operador === "string" ? f : null;
}

/**
 * Valores distintos de uma coluna, com quantas linhas cada um tem.
 * Usado pelo operador "é um de". Calculado sob demanda pelo TanStack.
 */
export function opcoesFacetadasDaColuna(
  coluna: { getFacetedUniqueValues?: () => Map<unknown, number> },
  limite = 300
): Array<[string, number]> {
  const mapa = coluna.getFacetedUniqueValues?.();
  if (!mapa) return [];
  return Array.from(mapa.entries())
    .filter(([v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([v, n]) => [String(v), n] as [string, number])
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, limite);
}

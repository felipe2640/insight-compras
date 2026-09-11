/**
 * Lógica do construtor central de filtros (o "Filtrar" da barra de menus).
 * Camada: Aplicação (src/lib/cockpit) — puro, sem React e sem TanStack.
 *
 * Portado do diário (data-grid-filter-menu): em vez de caçar coluna por coluna,
 * o comprador monta a pergunta inteira num lugar só — "onde Marca contém X E
 * Custo é maior que Y" — vê tudo o que está filtrando e mexe em qualquer linha.
 *
 * REGRA QUE EVITA FILTRO SEM SENTIDO
 * Trocar a coluna de uma linha troca também o TIPO do dado. "Marca contém"
 * virando "Custo contém" não quer dizer nada. Quando a variante muda, o operador
 * volta ao padrão da nova variante e o valor é descartado — melhor perder o que
 * foi digitado do que aplicar uma comparação que não existe.
 */

import {
  FiltroColuna,
  VarianteColuna,
  filtroEstaCompleto,
  operadorPadraoDaVariante,
  operadorPertenceAVariante,
} from "./filtros-coluna";

export interface ColunaFiltravel {
  readonly id: string;
  readonly rotulo: string;
  readonly variante: VarianteColuna;
}

export interface FiltroAtivo {
  readonly id: string;
  readonly value: FiltroColuna;
}

/** Um filtro por coluna: as já usadas saem da lista, menos a da própria linha. */
export function colunasDisponiveis(
  todas: readonly ColunaFiltravel[],
  ativos: readonly FiltroAtivo[],
  idDaPropriaLinha?: string
): ColunaFiltravel[] {
  const usadas = new Set(ativos.map((f) => f.id));
  return todas.filter((c) => c.id === idDaPropriaLinha || !usadas.has(c.id));
}

/** Primeira coluna livre — é a que o botão "Adicionar filtro" escolhe. */
export function primeiraColunaLivre(
  todas: readonly ColunaFiltravel[],
  ativos: readonly FiltroAtivo[]
): ColunaFiltravel | null {
  return colunasDisponiveis(todas, ativos)[0] ?? null;
}

export function filtroInicialDaColuna(coluna: ColunaFiltravel): FiltroAtivo {
  return {
    id: coluna.id,
    value: { operador: operadorPadraoDaVariante(coluna.variante) },
  };
}

export function adicionarFiltro(
  ativos: readonly FiltroAtivo[],
  todas: readonly ColunaFiltravel[]
): FiltroAtivo[] {
  const livre = primeiraColunaLivre(todas, ativos);
  if (!livre) return [...ativos];
  return [...ativos, filtroInicialDaColuna(livre)];
}

export function removerFiltro(ativos: readonly FiltroAtivo[], id: string): FiltroAtivo[] {
  return ativos.filter((f) => f.id !== id);
}

export function atualizarFiltro(
  ativos: readonly FiltroAtivo[],
  id: string,
  mudancas: Partial<FiltroColuna>
): FiltroAtivo[] {
  return ativos.map((f) => (f.id === id ? { ...f, value: { ...f.value, ...mudancas } } : f));
}

/**
 * Troca a coluna de uma linha. Se a variante mudar, o operador volta ao padrão
 * e o valor é descartado; se for a mesma variante, o que foi digitado sobrevive.
 */
export function trocarColunaDoFiltro(
  ativos: readonly FiltroAtivo[],
  idAntigo: string,
  colunaNova: ColunaFiltravel
): FiltroAtivo[] {
  return ativos.map((f) => {
    if (f.id !== idAntigo) return f;
    const operadorContinuaValido = operadorPertenceAVariante(f.value.operador, colunaNova.variante);
    return operadorContinuaValido
      ? { id: colunaNova.id, value: f.value }
      : filtroInicialDaColuna(colunaNova);
  });
}

/** Quantos filtros de fato filtram — os pela metade não contam no crachá. */
export function contarFiltrosAplicaveis(ativos: readonly FiltroAtivo[]): number {
  return ativos.filter((f) => filtroEstaCompleto(f.value)).length;
}

/** Palavra que liga uma linha à anterior. */
export function conectivoDaLinha(indice: number): "Onde" | "E" {
  return indice === 0 ? "Onde" : "E";
}

/**
 * Motor de Cálculo: Curva ABC por Faturamento Acumulado (Princípio de Pareto)
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 */

import { CurvaABC } from "../dominio/produto";

export interface ItemParaCurvaAbc {
  readonly produtoId: number;
  readonly faturamento: number;
}

export interface ResultadoCurvaAbcItem {
  readonly produtoId: number;
  readonly faturamento: number;
  readonly percentualIndividual: number;
  readonly percentualAcumulado: number;
  readonly curva: CurvaABC;
}

export const LIMITES_CURVA_ABC = {
  LIMITE_A: 0.8, // 80% do faturamento acumulado
  LIMITE_B: 0.95, // 95% do faturamento acumulado (próximos 15%)
} as const;

/**
 * Calcula a classificação Curva ABC para uma lista de produtos ordenados por faturamento.
 * Itens que somam até 80% do faturamento acumulado recebem "A".
 * Itens entre 80% e 95% recebem "B".
 * O restante (até 100%) recebe "C".
 * Caso a receita total seja zero ou todos os itens sejam zero, todos recebem "C".
 */
export function calcularCurvaAbc(
  itens: readonly ItemParaCurvaAbc[]
): Map<number, ResultadoCurvaAbcItem> {
  const mapaResultado = new Map<number, ResultadoCurvaAbcItem>();

  if (!itens || itens.length === 0) {
    return mapaResultado;
  }

  // Clona e ordena decrescente por faturamento
  const itensOrdenados = [...itens].sort((a, b) => b.faturamento - a.faturamento);

  const faturamentoTotal = itensOrdenados.reduce(
    (acum, item) => acum + Math.max(0, item.faturamento),
    0
  );

  if (faturamentoTotal <= 0) {
    for (const item of itensOrdenados) {
      mapaResultado.set(item.produtoId, {
        produtoId: item.produtoId,
        faturamento: item.faturamento,
        percentualIndividual: 0,
        percentualAcumulado: 0,
        curva: "C",
      });
    }
    return mapaResultado;
  }

  let acumulado = 0;

  for (const item of itensOrdenados) {
    const faturamentoItem = Math.max(0, item.faturamento);
    acumulado += faturamentoItem;

    const percentualIndividual = faturamentoItem / faturamentoTotal;
    const percentualAcumulado = Math.min(1, acumulado / faturamentoTotal);

    let curva: CurvaABC = "C";

    // Ponto de corte: se o acumulado anterior já ultrapassou o limite A, não é A.
    // Mas o primeiro item sempre define sua faixa.
    const acumuladoAnterior = (acumulado - faturamentoItem) / faturamentoTotal;

    if (acumuladoAnterior < LIMITES_CURVA_ABC.LIMITE_A) {
      curva = "A";
    } else if (acumuladoAnterior < LIMITES_CURVA_ABC.LIMITE_B) {
      curva = "B";
    } else {
      curva = "C";
    }

    mapaResultado.set(item.produtoId, {
      produtoId: item.produtoId,
      faturamento: faturamentoItem,
      percentualIndividual,
      percentualAcumulado,
      curva,
    });
  }

  return mapaResultado;
}

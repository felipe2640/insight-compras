/**
 * Motor de Cálculo: Consumo Diário e Perfil de Rotatividade
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 *
 * BASE COMUM A TODOS OS CLIENTES (white-label).
 * Tradução fiel de `carreiro_ml/forecasting.py :: classify_profile` e da taxa diária
 * usada no backtest (`rate = soma(janela de 180 dias) / 180`).
 */

import { PerfilRotatividade } from "../dominio/produto";
import { CriteriosElegibilidade } from "./necessidade";

/** Janela padrão de histórico para o cálculo da taxa diária, em dias. */
export const JANELA_PADRAO_CONSUMO_DIAS = 180;

/**
 * Critérios padrão de elegibilidade — espelham `AnalysisConfig.min_notas_12m`
 * e `min_meses_12m` do estudo ML.
 */
export const CRITERIOS_ELEGIBILIDADE_PADRAO: CriteriosElegibilidade = {
  minimoNotasDistintas: 3,
  minimoMesesAtivos: 2,
};

export interface ParametrosDemanda {
  /** Soma das saídas líquidas dentro da janela. */
  readonly vendasLiquidasJanela: number;
  /** Tamanho da janela em dias (denominador fixo). Padrão: 180. */
  readonly diasJanela?: number;
}

/**
 * Verifica se o item atinge a recorrência mínima para ser elegível a compra.
 *
 * ATENÇÃO: o segundo critério é MESES COM MOVIMENTO, não "dias observados".
 * Um item com muitas notas concentradas em um único mês não é recorrente —
 * é uma saída pontual, e o motor não deve comprar por causa dela.
 */
export function verificarElegibilidadeHistorico(
  notasFiscaisDistintas: number,
  mesesAtivos: number,
  criterios: CriteriosElegibilidade = CRITERIOS_ELEGIBILIDADE_PADRAO
): boolean {
  return (
    notasFiscaisDistintas >= criterios.minimoNotasDistintas &&
    mesesAtivos >= criterios.minimoMesesAtivos
  );
}

/**
 * Calcula o consumo diário com denominador FIXO igual ao tamanho da janela.
 *
 * O denominador não é "dias observados": dividir por um período menor que a janela
 * infla artificialmente a taxa de itens novos ou intermitentes.
 */
export function calcularConsumoDiario(parametros: ParametrosDemanda): number {
  const diasJanela = parametros.diasJanela ?? JANELA_PADRAO_CONSUMO_DIAS;
  if (diasJanela <= 0 || parametros.vendasLiquidasJanela <= 0) {
    return 0;
  }
  const consumo = parametros.vendasLiquidasJanela / diasJanela;
  return Number.isFinite(consumo) && consumo > 0 ? consumo : 0;
}

/**
 * Calcula o consumo diário para uma janela arbitrária (ex: 30, 90 ou 180 dias).
 * Usado nas colunas comparativas de cobertura do cockpit.
 */
export function calcularConsumoJanela(
  vendasLiquidas: number,
  diasJanela: number
): number {
  if (vendasLiquidas <= 0 || diasJanela <= 0) {
    return 0;
  }
  const consumo = vendasLiquidas / diasJanela;
  return Number.isFinite(consumo) && consumo > 0 ? consumo : 0;
}

/**
 * Projeta o consumo mensal estimado (30 dias padrão de autopeças).
 */
export function calcularProjecaoMensal(consumoDiario: number): number {
  if (consumoDiario <= 0) return 0;
  return consumoDiario * 30;
}

/**
 * Classifica o perfil de rotatividade do produto:
 * - ALTO_GIRO: >= 6 un/mês
 * - MEDIO_GIRO: >= 2.5 un/mês
 * - BAIXO_GIRO_INTERMITENTE: < 2.5 un/mês
 * - SEM_HISTORICO_SUFICIENTE: não atingiu notas distintas e meses ativos mínimos
 */
export function classificarPerfilGiro(
  consumoDiario: number,
  notasFiscaisDistintas: number,
  mesesAtivos: number,
  criterios: CriteriosElegibilidade = CRITERIOS_ELEGIBILIDADE_PADRAO
): PerfilRotatividade {
  if (!verificarElegibilidadeHistorico(notasFiscaisDistintas, mesesAtivos, criterios)) {
    return "SEM_HISTORICO_SUFICIENTE";
  }

  const projecaoMensal = calcularProjecaoMensal(consumoDiario);

  if (projecaoMensal >= 6) {
    return "ALTO_GIRO";
  }
  if (projecaoMensal >= 2.5) {
    return "MEDIO_GIRO";
  }
  return "BAIXO_GIRO_INTERMITENTE";
}

/**
 * Calcula a mediana das quantidades positivas vendidas por linha.
 * É o piso padrão da previsão (`mediana` em current_engine_forecast).
 */
export function calcularMedianaLinhaVenda(quantidadesPorLinha: readonly number[]): number {
  const positivas = quantidadesPorLinha.filter((q) => Number.isFinite(q) && q > 0).sort((a, b) => a - b);
  if (positivas.length === 0) return 0;
  const meio = Math.floor(positivas.length / 2);
  return positivas.length % 2 === 0
    ? (positivas[meio - 1] + positivas[meio]) / 2
    : positivas[meio];
}

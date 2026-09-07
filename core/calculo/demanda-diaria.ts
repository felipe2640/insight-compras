/**
 * Motor de Cálculo: Demanda Diária e Perfil de Rotatividade
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 */

import { PerfilRotatividade } from "../dominio/produto";

export const CRITERIOS_ELEGIBILIDADE = {
  MINIMO_NOTAS_90D: 3,
  MINIMO_DIAS_HISTORICO: 15,
} as const;

export interface ParametrosDemanda {
  readonly vendasLiquidas180d: number;
  readonly notasFiscais90d: number;
  readonly diasObservados: number;
}

/**
 * Verifica se o item atinge a recorrência mínima para ser considerado elegível a compra.
 * Evita o vício de sugerir compras por saídas acidentais/isoladas.
 */
export function verificarElegibilidadeHistorico(
  notasFiscais90d: number,
  diasObservados: number
): boolean {
  return (
    notasFiscais90d >= CRITERIOS_ELEGIBILIDADE.MINIMO_NOTAS_90D &&
    diasObservados >= CRITERIOS_ELEGIBILIDADE.MINIMO_DIAS_HISTORICO
  );
}

/**
 * Calcula o consumo diário estrito com base nas saídas líquidas e dias observados.
 * Garante resultado estritamente não-negativo e divisão segura por zero.
 */
export function calcularConsumoDiario(parametros: ParametrosDemanda): number {
  if (parametros.diasObservados <= 0 || parametros.vendasLiquidas180d <= 0) {
    return 0;
  }
  const diasBase = Math.min(180, Math.max(1, parametros.diasObservados));
  const consumo = parametros.vendasLiquidas180d / diasBase;
  return Number.isFinite(consumo) && consumo > 0 ? consumo : 0;
}

/**
 * Calcula o consumo diário para uma janela arbitrária (ex: 30, 90 ou 180 dias).
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
 * - SEM_HISTORICO_SUFICIENTE: não atingiu os critérios de elegibilidade
 */
export function classificarPerfilGiro(
  consumoDiario: number,
  notasFiscais90d: number,
  diasObservados: number
): PerfilRotatividade {
  if (!verificarElegibilidadeHistorico(notasFiscais90d, diasObservados)) {
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

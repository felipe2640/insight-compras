/**
 * Trava e Ajustador de Lotes e Múltiplos Físicos de Fábrica
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 *
 * BASE COMUM A TODOS OS CLIENTES (white-label).
 * Este módulo é agnóstico de segmento: não conhece amortecedor, vela nem bateria.
 * A detecção de lote é estatística (histograma das quantidades por linha de venda),
 * espelhando `carreiro_ml/forecasting.py :: detect_lot`.
 *
 * Heurísticas por vocabulário de produto (ex.: "AMORTECEDOR" => par) são
 * conhecimento de domínio do CLIENTE e vivem na camada de adapters —
 * ver `adapters/comum/lote-autopecas.ts`.
 */

export interface ParametrosAjusteLote {
  readonly quantidadeDesejada: number;
  readonly multiploLote: number;
  readonly embalagemMinima?: number;
}

export interface ResultadoAjusteLote {
  readonly quantidadeOriginal: number;
  readonly quantidadeAjustada: number;
  readonly multiploAplicado: number;
  readonly embalagemMinimaAplicada: number;
  readonly motivoAjuste: string | null;
}

/** Lotes candidatos avaliados pela detecção estatística, do maior para o menor. */
export const LOTES_CANDIDATOS = [12, 10, 8, 6, 5, 4, 3, 2] as const;

export interface OpcoesDeteccaoLote {
  /** Mínimo de linhas de venda para a detecção ser confiável. Padrão: 8. */
  readonly minimoLinhas?: number;
  /** Fração das linhas que deve ser múltipla do lote. Padrão: 0.70. */
  readonly dominancia?: number;
}

/**
 * Detecta o lote de fábrica a partir do histograma de quantidades por linha de venda.
 *
 * Se pelo menos `dominancia` das linhas for múltipla de um candidato, ele é aceito;
 * entre os aceitos vence o maior. Sem linhas suficientes, devolve 1 (avulso).
 *
 * Espelha `carreiro_ml/forecasting.py :: detect_lot`.
 */
export function detectarLotePorHistograma(
  quantidadesPorLinha: readonly number[],
  opcoes: OpcoesDeteccaoLote = {}
): number {
  const minimoLinhas = opcoes.minimoLinhas ?? 8;
  const dominancia = opcoes.dominancia ?? 0.7;

  const valores = quantidadesPorLinha
    .filter((q) => Number.isFinite(q) && q > 0)
    .map((q) => Math.round(q));

  if (valores.length < minimoLinhas) {
    return 1;
  }

  const aceitos: number[] = [];
  for (const lote of LOTES_CANDIDATOS) {
    const proporcao = valores.filter((v) => v % lote === 0).length / valores.length;
    if (proporcao >= dominancia) {
      aceitos.push(lote);
    }
  }

  return aceitos.length > 0 ? Math.max(...aceitos) : 1;
}

/**
 * Arredonda a quantidade para o próximo múltiplo inteiro de lote de fábrica.
 * Se quantidadeDesejada <= 0, o retorno é estritamente 0.
 */
export function arredondarParaMultiplo(
  quantidadeDesejada: number,
  multiplo: number
): number {
  if (quantidadeDesejada <= 0) return 0;
  const lote = Math.max(1, Math.floor(multiplo));
  if (lote <= 1) {
    return Math.ceil(quantidadeDesejada);
  }
  return Math.ceil(quantidadeDesejada / lote) * lote;
}

/**
 * Ajusta a quantidade sugerida considerando o lote múltiplo e eventual embalagem mínima.
 */
export function ajustarQuantidadePorLote(
  parametros: ParametrosAjusteLote
): ResultadoAjusteLote {
  const { quantidadeDesejada, multiploLote, embalagemMinima = 1 } = parametros;

  if (quantidadeDesejada <= 0) {
    return {
      quantidadeOriginal: 0,
      quantidadeAjustada: 0,
      multiploAplicado: Math.max(1, Math.floor(multiploLote)),
      embalagemMinimaAplicada: Math.max(1, Math.floor(embalagemMinima)),
      motivoAjuste: null,
    };
  }

  const lote = Math.max(1, Math.floor(multiploLote));
  const embMin = Math.max(1, Math.floor(embalagemMinima));

  // Primeiro aplica a embalagem mínima se a quantidade desejada for positiva
  const baseParaMultiplo = Math.max(quantidadeDesejada, embMin);

  // Depois arredonda para o múltiplo
  const quantidadeAjustada = arredondarParaMultiplo(baseParaMultiplo, lote);

  let motivo: string | null = null;
  if (quantidadeAjustada !== quantidadeDesejada) {
    if (lote > 1) {
      motivo = `Ajustado para múltiplo de embalagem fechada (${lote} un).`;
    } else if (baseParaMultiplo > quantidadeDesejada) {
      motivo = `Ajustado para atingir a embalagem mínima de faturamento (${embMin} un).`;
    }
  }

  return {
    quantidadeOriginal: quantidadeDesejada,
    quantidadeAjustada,
    multiploAplicado: lote,
    embalagemMinimaAplicada: embMin,
    motivoAjuste: motivo,
  };
}

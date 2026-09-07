/**
 * Trava e Ajustador de Lotes e Múltiplos Físicos de Fábrica
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 *
 * REGRAS DE AUTOPEÇAS:
 * - Amortecedores e Discos de Freio: sempre comprados e substituídos em pares (lote = 2).
 * - Velas de Ignição / Cabos: frequentemente em jogos de 4 (lote = 4).
 * - Pneus / Baterias: avulso (lote = 1) ou conforme embalagem industrial.
 * - Caixas de fábrica: múltiplos de embalagem de atacado (ex: 5, 10, 12, 20 un).
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
 * Identifica o lote padrão sugerido a partir da descrição ou categoria da peça,
 * caso o produto não tenha lote configurado no cadastro do ERP.
 */
export function inferirLotePadraoPorCategoria(
  descricaoOuCategoria: string
): number {
  const texto = descricaoOuCategoria.toUpperCase();

  // Pares obrigatórios no setor automotivo (substituição simétrica recomendada por montadoras)
  if (
    texto.includes("AMORTECEDOR") ||
    texto.includes("DISCO DE FREIO") ||
    texto.includes("TAMBOR DE FREIO") ||
    texto.includes("MOLA HELICOIDAL") ||
    texto.includes("SAPATA DE FREIO")
  ) {
    return 2;
  }

  // Jogos de 4 cilindros padrão
  if (
    texto.includes("VELA DE IGNICAO") ||
    texto.includes("VELA IGNICAO") ||
    texto.includes("JOGO DE VELA") ||
    texto.includes("CABO DE VELA")
  ) {
    return 4;
  }

  return 1;
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
    if (lote === 2) {
      motivo = `Ajustado para par (múltiplo de 2 un) conforme especificação de fábrica.`;
    } else if (lote === 4) {
      motivo = `Ajustado para jogo de 4 unidades conforme especificação de fábrica.`;
    } else if (lote > 1) {
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

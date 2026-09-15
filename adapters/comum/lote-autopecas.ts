/**
 * Heurísticas de Lote por Vocabulário de Autopeças
 * Camada: Adapters (conhecimento de domínio do cliente/segmento)
 * 100% em Português do Brasil (pt-BR).
 *
 * POR QUE NÃO FICA NO CORE:
 * O núcleo da plataforma é agnóstico de segmento — ele detecta lote pelo histograma
 * das quantidades vendidas (`detectarLotePorHistograma`), sem saber o que a peça é.
 * O vocabulário abaixo ("AMORTECEDOR" => par, "VELA DE IGNICAO" => jogo de 4) é
 * conhecimento do ramo de autopeças brasileiro e pertence à camada de adapters,
 * onde cada cliente pode substituí-lo pelo cadastro do próprio ERP.
 *
 * ORDEM DE PRECEDÊNCIA RECOMENDADA no adapter:
 *   1. Múltiplo cadastrado no ERP do cliente (fonte de verdade).
 *   2. Lote detectado por histograma no core (evidência estatística).
 *   3. Esta heurística de texto (último recurso, quando não há histórico).
 */

/** Termos cuja substituição é simétrica por eixo — comprados aos pares. */
const TERMOS_PAR = [
  "AMORTECEDOR",
  "DISCO DE FREIO",
  "TAMBOR DE FREIO",
  "MOLA HELICOIDAL",
  "SAPATA DE FREIO",
] as const;

/** Termos vendidos em jogo de 4 (motor 4 cilindros padrão). */
const TERMOS_JOGO_QUATRO = [
  "VELA DE IGNICAO",
  "VELA IGNICAO",
  "JOGO DE VELA",
  "CABO DE VELA",
] as const;

/**
 * Identifica o lote padrão sugerido a partir da descrição ou categoria da peça,
 * quando o produto não tem lote configurado no ERP nem histórico suficiente
 * para a detecção estatística.
 */
export function inferirLotePadraoPorCategoria(
  descricaoOuCategoria: string
): number {
  const texto = (descricaoOuCategoria ?? "").toUpperCase();

  if (TERMOS_PAR.some((termo) => texto.includes(termo))) {
    return 2;
  }

  if (TERMOS_JOGO_QUATRO.some((termo) => texto.includes(termo))) {
    return 4;
  }

  return 1;
}

/**
 * Texto explicativo do ajuste de lote, no vocabulário do comprador de autopeças.
 * O core devolve uma mensagem genérica; o adapter enriquece para a UI do cliente.
 */
export function descreverAjusteLoteAutopecas(lote: number): string | null {
  if (lote === 2) {
    return "Ajustado para par (múltiplo de 2 un) conforme especificação de fábrica.";
  }
  if (lote === 4) {
    return "Ajustado para jogo de 4 unidades conforme especificação de fábrica.";
  }
  if (lote > 1) {
    return `Ajustado para múltiplo de embalagem fechada (${lote} un).`;
  }
  return null;
}

/**
 * Resolve o lote final aplicando a precedência recomendada.
 */
export function resolverLoteAutopecas(parametros: {
  readonly loteConfigurado?: number;
  readonly loteCadastradoErp?: number;
  readonly loteDetectadoHistograma?: number;
  readonly descricao: string;
  readonly usarErp?: boolean;
  readonly usarHistorico?: boolean;
  readonly usarVocabulario?: boolean;
}): { lote: number; origem: "CONFIGURACAO" | "ERP" | "HISTOGRAMA" | "VOCABULARIO" | "PADRAO" } {
  const {
    loteConfigurado = 0,
    loteCadastradoErp = 0,
    loteDetectadoHistograma = 0,
    descricao,
    usarErp = true,
    usarHistorico = true,
    usarVocabulario = true,
  } = parametros;

  if (loteConfigurado >= 1) {
    return { lote: Math.floor(loteConfigurado), origem: "CONFIGURACAO" };
  }
  if (usarErp && loteCadastradoErp > 1) {
    return { lote: Math.floor(loteCadastradoErp), origem: "ERP" };
  }
  if (usarHistorico && loteDetectadoHistograma > 1) {
    return { lote: Math.floor(loteDetectadoHistograma), origem: "HISTOGRAMA" };
  }
  if (usarVocabulario) {
    const lote = inferirLotePadraoPorCategoria(descricao);
    return { lote, origem: "VOCABULARIO" };
  }
  return { lote: 1, origem: "PADRAO" };
}

/**
 * Calibração de Baseline Adaptativo da Máquina (helper de testes)
 *
 * Gates de desempenho que comparam tempo de parede contra um número fixo só
 * valem quando o arquivo roda sozinho. Na suíte cheia, 70+ arquivos dividem CPU
 * e a asserção que estoura muda a cada execução — acusando contenção de máquina
 * como se fosse defeito do código.
 *
 * A saída é medir a máquina AGORA, com um micro-benchmark determinístico, e
 * escalar o teto pelo quanto ela está mais lenta que o nominal. Regressão real de
 * complexidade (uma busca virar O(n²)) continua estourando qualquer teto
 * escalado; ruído de carga, não.
 *
 * Mecanismo originalmente escrito em tests/adapters/estresse-mock-carga.test.ts;
 * extraído para cá quando tests/cockpit/adversarial-stress.test.ts passou a
 * precisar do mesmo tratamento.
 */

/** Duração de referência do micro-benchmark numa máquina ociosa. */
export const TEMPO_NOMINAL_CALIBRACAO_MS = 3.0;

export interface CalibracaoAmbiente {
  readonly duracaoBaseMs: number;
  /** Quantas vezes a máquina está mais lenta que o nominal. Mínimo 1. */
  readonly fatorCarga: number;
}

let cacheCalibracao: CalibracaoAmbiente | null = null;

function executarCargaSintetica(): number {
  const t0 = performance.now();
  const mapa = new Map<number, number>();
  for (let i = 0; i < 100_000; i++) {
    const chave = i % 2000;
    mapa.set(chave, (mapa.get(chave) ?? 0) + (i % 5));
  }
  return performance.now() - t0;
}

/**
 * Mede a carga atual da máquina.
 *
 * `forcarRecalibracao` existe porque a carga muda durante a suíte: a primeira
 * medição pode pegar a máquina calma e ficar defasada minutos depois. Teste que
 * depende do fator deve recalibrar junto da própria medição — custa ~12ms.
 */
export function calibrarAmbienteExecucao(forcarRecalibracao = false): CalibracaoAmbiente {
  if (cacheCalibracao && !forcarRecalibracao) {
    return cacheCalibracao;
  }

  // Aquecimento do motor JIT antes de amostrar.
  executarCargaSintetica();
  const amostras = [
    executarCargaSintetica(),
    executarCargaSintetica(),
    executarCargaSintetica(),
  ].sort((a, b) => a - b);

  const duracaoBaseMs = amostras[1];
  const fatorCarga = Math.max(1.0, duracaoBaseMs / TEMPO_NOMINAL_CALIBRACAO_MS);

  cacheCalibracao = { duracaoBaseMs, fatorCarga };
  return cacheCalibracao;
}

/**
 * Teto de tempo escalado pela carga da máquina.
 * `margemJitterMs` cobre o jitter de agendamento, que não escala linearmente.
 */
export function calcularLimiarAdaptativo(
  limiarNominalMs: number,
  fatorCarga: number,
  margemJitterMs = 60
): number {
  const tetoEscalado = limiarNominalMs * fatorCarga;
  const margem = fatorCarga > 1.0 ? margemJitterMs * Math.min(fatorCarga, 3.0) : 0;
  return Math.ceil(Math.max(limiarNominalMs, tetoEscalado + margem));
}

export interface ResultadoChecagemDesempenho {
  readonly aprovado: boolean;
  readonly limiteEfetivoMs: number;
  readonly mensagem?: string;
}

/** Compara uma duração medida contra o teto adaptativo. */
export function verificarDesempenhoComProtecaoRegressao(
  duracaoRealMs: number,
  limiarNominalMs: number,
  fatorCarga: number,
  nomeOperacao = 'Operação'
): ResultadoChecagemDesempenho {
  const limiteEfetivoMs = calcularLimiarAdaptativo(limiarNominalMs, fatorCarga);
  if (duracaoRealMs > limiteEfetivoMs) {
    return {
      aprovado: false,
      limiteEfetivoMs,
      mensagem: `[Regressão de Desempenho] ${nomeOperacao} levou ${duracaoRealMs.toFixed(1)}ms, excedendo o teto adaptativo de ${limiteEfetivoMs}ms (nominal: ${limiarNominalMs}ms, fator de carga: ${fatorCarga.toFixed(2)}x).`,
    };
  }
  return { aprovado: true, limiteEfetivoMs };
}

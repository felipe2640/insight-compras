/**
 * Ciclo de Aprendizado — Calibração das margens a partir do DESFECHO REAL
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 *
 * BASE COMUM A TODOS OS CLIENTES. Porta as guardas que o diário aprendeu na
 * prática — cada uma tem a razão medida no comentário. A calibração propõe;
 * publicar é decisão de gente, em outra camada.
 *
 * GABARITO: suprimento real = compra + transferência. Transferência entra porque
 * a necessidade existiu e foi atendida — pela loja irmã.
 *
 * O QUE FICA DE FORA:
 * 1. "aguardando" — a janela não fechou; o desfecho ainda não existe.
 * 2. "nao_entrou" — dado CENSURADO. Não se sabe a necessidade real (falta de
 *    verba? fornecedor sem estoque? sugestão errada?). Tratar como "precisou 0"
 *    empurra o modelo para baixo justamente onde nada foi comprado.
 * 3. Linhas em que o PISO manda (demanda contínua m0×H < 1 un). Ali a margem é
 *    irrelevante: quem decide é o lote. Sem esse corte, o baixo giro do diário
 *    pedia +2471% de margem — indivisibilidade, não incerteza de demanda.
 *
 * LIMITE HONESTO: "suprimento real" carrega a decisão de estoque do comprador e o
 * arredondamento de caixa. Por isso o alvo é a MEDIANA (o que tipicamente chega),
 * não um quantil alto: perseguir o q90 copia o comportamento mais agressivo.
 * E toda mudança é limitada por passo.
 */

import { PerfilRotatividade } from "../dominio/produto";
import { StatusConfirmacao } from "./confirmacao-entrada";

export interface LimitesCalibracao {
  /** Amostra mínima por perfil para a proposta valer. */
  readonly minimoAmostra: number;
  /** Quantil-alvo da margem necessária observada (0,5 = mediana). */
  readonly quantilAlvo: number;
  /** Variação máxima por rodada, relativa à margem vigente (0,5 = ±50%). */
  readonly variacaoMaxima: number;
  readonly margemMinima: number;
  readonly margemMaxima: number;
}

export const LIMITES_CALIBRACAO_PADRAO: LimitesCalibracao = {
  minimoAmostra: 200,
  quantilAlvo: 0.5,
  variacaoMaxima: 0.5,
  margemMinima: 0,
  margemMaxima: 2,
};

/** Desfechos em que o suprimento foi OBSERVADO (entra no aprendizado). */
export const STATUS_OBSERVADOS: readonly StatusConfirmacao[] = [
  "confirmado",
  "excedente",
  "parcial",
  "transferencia",
];

export interface LinhaAprendizado {
  readonly perfil: PerfilRotatividade;
  /** Demanda diária central que o modelo usou. */
  readonly consumoDiario: number;
  readonly horizonteDias: number;
  /** Margem que estava valendo quando a sugestão foi feita. */
  readonly margemAplicada: number;
  /** Fator de calibração que estava valendo. */
  readonly fatorCalibracao: number;
  /** compra + transferência. */
  readonly suprimentoReal: number;
  readonly status: StatusConfirmacao;
}

export interface PropostaPerfil {
  readonly perfil: PerfilRotatividade;
  /** Linhas que sobraram após todos os cortes. */
  readonly amostra: number;
  readonly descartadasPiso: number;
  readonly descartadasCensuradas: number;
  readonly margemAtual: number;
  /** Quantis da margem necessária observada — para auditoria. */
  readonly q25: number | null;
  readonly q50: number | null;
  readonly q75: number | null;
  readonly q90: number | null;
  /** % de casos em que a sugestão vigente cobriu o suprimento real. */
  readonly coberturaAtual: number | null;
  /** Já com passo máximo e teto aplicados. null = não aplicável. */
  readonly margemProposta: number | null;
  readonly aplicavel: boolean;
  readonly motivo: string;
}

function quantil(valores: readonly number[], p: number): number | null {
  if (valores.length === 0) return null;
  const ordenado = [...valores].sort((a, b) => a - b);
  return ordenado[Math.min(ordenado.length - 1, Math.floor(ordenado.length * p))];
}

/**
 * Monta a proposta de margem por perfil. NÃO publica nada.
 *
 * Margem necessária de uma linha = suprimentoReal / (m0 × H × fator) − 1:
 * quanto a demanda-base precisaria crescer para cobrir o que de fato chegou.
 */
export function calcularPropostaCalibracao(
  linhas: readonly LinhaAprendizado[],
  limites: LimitesCalibracao = LIMITES_CALIBRACAO_PADRAO
): PropostaPerfil[] {
  const perfis = Array.from(new Set(linhas.map((l) => l.perfil))).filter(
    (p) => p !== "SEM_HISTORICO_SUFICIENTE"
  );
  const saida: PropostaPerfil[] = [];

  for (const perfil of perfis) {
    const doPerfil = linhas.filter((l) => l.perfil === perfil);
    const observadas = doPerfil.filter(
      (l) =>
        STATUS_OBSERVADOS.includes(l.status) &&
        l.consumoDiario > 0 &&
        l.horizonteDias > 0 &&
        l.suprimentoReal > 0
    );
    const descartadasCensuradas = doPerfil.length - observadas.length;

    // Corte do piso: só aprende onde a parte contínua realmente decide.
    const semPiso = observadas.filter((l) => l.consumoDiario * l.horizonteDias >= 1);
    const descartadasPiso = observadas.length - semPiso.length;
    const margemAtual = semPiso[0]?.margemAplicada ?? doPerfil[0]?.margemAplicada ?? 0;

    const necessarias = semPiso.map((l) => {
      const fator = l.fatorCalibracao > 0 ? l.fatorCalibracao : 1;
      return l.suprimentoReal / (l.consumoDiario * l.horizonteDias * fator) - 1;
    });
    const cobertos = semPiso.filter((l) => {
      const fator = l.fatorCalibracao > 0 ? l.fatorCalibracao : 1;
      return l.consumoDiario * l.horizonteDias * (1 + l.margemAplicada) * fator >= l.suprimentoReal;
    }).length;

    const base = {
      perfil,
      amostra: semPiso.length,
      descartadasPiso,
      descartadasCensuradas,
      margemAtual,
      q25: quantil(necessarias, 0.25),
      q50: quantil(necessarias, 0.5),
      q75: quantil(necessarias, 0.75),
      q90: quantil(necessarias, 0.9),
      coberturaAtual: semPiso.length > 0 ? cobertos / semPiso.length : null,
    };

    if (semPiso.length < limites.minimoAmostra) {
      saida.push({
        ...base,
        margemProposta: null,
        aplicavel: false,
        motivo:
          descartadasPiso > 0 && semPiso.length === 0
            ? `todas as ${descartadasPiso} linhas são decididas pelo piso (m0×H < 1 un) — a margem não influencia este perfil`
            : `amostra insuficiente (${semPiso.length} < ${limites.minimoAmostra})`,
      });
      continue;
    }

    const alvo = quantil(necessarias, limites.quantilAlvo) ?? margemAtual;
    // Passo limitado: no máximo ±variacaoMaxima relativo ao valor vigente.
    const piso = margemAtual * (1 - limites.variacaoMaxima);
    const teto = margemAtual * (1 + limites.variacaoMaxima);
    const limitado = Math.min(teto, Math.max(piso, alvo));
    const proposta = Math.min(
      limites.margemMaxima,
      Math.max(limites.margemMinima, Number(limitado.toFixed(4)))
    );
    const bateuLimite = Math.abs(limitado - alvo) > 1e-9;

    saida.push({
      ...base,
      margemProposta: proposta,
      aplicavel: true,
      motivo: bateuLimite
        ? `alvo observado ${(alvo * 100).toFixed(0)}% limitado a ${(proposta * 100).toFixed(0)}% pelo passo máximo de ±${limites.variacaoMaxima * 100}% por rodada`
        : `mediana do suprimento realizado em ${semPiso.length} linhas`,
    });
  }

  return saida.sort((a, b) => b.amostra - a.amostra);
}

/**
 * Aplica a proposta às margens vigentes: só os perfis aplicáveis mudam.
 */
export function aplicarProposta(
  margensVigentes: Readonly<Record<PerfilRotatividade, number>>,
  proposta: readonly PropostaPerfil[]
): Record<PerfilRotatividade, number> {
  const novas = { ...margensVigentes };
  for (const p of proposta) {
    if (p.aplicavel && p.margemProposta !== null) {
      novas[p.perfil] = p.margemProposta;
    }
  }
  return novas;
}

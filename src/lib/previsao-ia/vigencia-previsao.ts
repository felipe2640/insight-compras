/**
 * Vigência da Projeção de Demanda por IA
 * Camada: Aplicação / Previsão IA (src/lib/previsao-ia) — puro, sem I/O.
 * 100% em Português do Brasil (pt-BR).
 *
 * POR QUE A VALIDADE NÃO É UM NÚMERO FIXO
 *
 * O pipeline roda todo dia, mas falha (Actions, credencial, Fabric fora). A
 * pergunta não é "quantos dias a previsão dura", é "o que aconteceu com o item
 * desde que ela foi gerada". Uma validade fixa erra nas duas pontas: é apertada
 * para o item de baixo giro, cuja série não se move em duas semanas, e frouxa
 * para o item que vende todo dia e muda de patamar numa semana.
 *
 * A REGRA
 *
 * 1. Projeção fresca (até VALIDADE_CURTA_DIAS) vale sempre.
 * 2. Passou do teto (VALIDADE_MAXIMA_DIAS): vence, e ponto. Preço, mix e
 *    cadastro mudam demais para confiar num número de mês e meio atrás.
 * 3. No meio, decide o que o item fez:
 *    - VENDEU desde a projeção -> a série se moveu, o número envelheceu.
 *      Cai no motor analítico, que lê o histórico fresco.
 *    - NÃO vendeu -> só é evidência contra a previsão se ela ESPERAVA venda no
 *      período. Item intermitente passar 20 dias sem vender é exatamente o que
 *      o p50 dele projeta; item de alto giro, não. Então comparamos o silêncio
 *      com a demanda que o próprio modelo esperava para esse intervalo.
 *
 * Esta é a razão de a ruptura não entrar na conta. A tentação era exigir "não
 * vendeu E não estava zerado", porque sem estoque não há venda e o silêncio não
 * significaria nada. Só que o teste de compatibilidade já resolve o caso: se o
 * item era de giro e ficou zerado, a demanda esperada no período é alta, o
 * silêncio contradiz a previsão e ela vence — que é o desfecho seguro, já que o
 * motor analítico assume com 180 dias de histórico. E `diasRuptura90dias` só é
 * confiável quando o adapter reconstrói o saldo dia a dia (ver
 * `camposIndisponiveis` em adapters/carreiro/mapeador-dax.ts): pendurar a regra
 * nesse campo a deixaria muda em qualquer fonte que não meça ruptura.
 */

/** Projeção fresca: vale sem nenhuma pergunta. Cobre um fim de semana de falha. */
export const VALIDADE_CURTA_DIAS = 3;

/** Teto duro de idade, mesmo para item que não se moveu nada. */
export const VALIDADE_MAXIMA_DIAS = 45;

/**
 * Demanda esperada no período abaixo da qual o silêncio não diz nada.
 * Menos de uma peça esperada é compatível com não ter vendido nenhuma.
 */
export const TOLERANCIA_SILENCIO_UNIDADES = 1;

/** O mínimo que a regra precisa saber da projeção (evita acoplar ao repositório). */
export interface ProjecaoParaVigencia {
  readonly demandaP50: number;
  readonly horizonteDias: number;
  /** Data da projeção em ISO (YYYY-MM-DD ou timestamp completo). */
  readonly dataPrevisao: string;
}

export type MotivoVigencia =
  | "FRESCA"
  | "SILENCIO_COMPATIVEL"
  | "ITEM_VENDEU"
  | "SILENCIO_CONTRADIZ"
  | "ACIMA_DO_TETO"
  | "DATA_INVALIDA";

export interface AvaliacaoVigencia {
  readonly vigente: boolean;
  /** Idade da projeção em dias. null quando a data não pôde ser lida. */
  readonly idadeDias: number | null;
  readonly motivo: MotivoVigencia;
  /** Demanda que o modelo esperava para o intervalo já decorrido. */
  readonly demandaEsperadaNoPeriodo: number | null;
}

/** Idade da projeção em dias inteiros. null se a data for ilegível. */
export function idadePrevisaoEmDias(dataPrevisao: string, agora: Date = new Date()): number | null {
  const data = new Date(dataPrevisao);
  if (Number.isNaN(data.getTime())) return null;

  const umDiaMs = 24 * 60 * 60 * 1000;
  const idade = Math.floor((agora.getTime() - data.getTime()) / umDiaMs);
  // Projeção com data futura (fuso da publicação) conta como do dia.
  return Math.max(0, idade);
}

/**
 * Decide se uma projeção ainda representa a demanda do item.
 *
 * `diasSemVenda` é por filial e vem do ERP; `null` significa "não vendeu na
 * janela medida ou não medido" — tratado como ausência de venda, e aí quem
 * decide é a compatibilidade com o p50.
 */
export function avaliarVigenciaPrevisao(
  projecao: ProjecaoParaVigencia,
  diasSemVenda: number | null | undefined,
  agora: Date = new Date()
): AvaliacaoVigencia {
  const idadeDias = idadePrevisaoEmDias(projecao.dataPrevisao, agora);

  if (idadeDias === null) {
    return {
      vigente: false,
      idadeDias: null,
      motivo: "DATA_INVALIDA",
      demandaEsperadaNoPeriodo: null,
    };
  }

  if (idadeDias <= VALIDADE_CURTA_DIAS) {
    return {
      vigente: true,
      idadeDias,
      motivo: "FRESCA",
      demandaEsperadaNoPeriodo: null,
    };
  }

  if (idadeDias > VALIDADE_MAXIMA_DIAS) {
    return {
      vigente: false,
      idadeDias,
      motivo: "ACIMA_DO_TETO",
      demandaEsperadaNoPeriodo: null,
    };
  }

  // Vendeu depois de a projeção ser gerada: o histórico fresco vale mais.
  const vendeuDesdeAProjecao =
    diasSemVenda !== null && diasSemVenda !== undefined && diasSemVenda < idadeDias;
  if (vendeuDesdeAProjecao) {
    return {
      vigente: false,
      idadeDias,
      motivo: "ITEM_VENDEU",
      demandaEsperadaNoPeriodo: null,
    };
  }

  const horizonte = projecao.horizonteDias;
  const p50 = projecao.demandaP50;
  if (!Number.isFinite(horizonte) || horizonte <= 0 || !Number.isFinite(p50) || p50 < 0) {
    return {
      vigente: false,
      idadeDias,
      motivo: "DATA_INVALIDA",
      demandaEsperadaNoPeriodo: null,
    };
  }

  const demandaEsperadaNoPeriodo = p50 * (idadeDias / horizonte);
  const compativel = demandaEsperadaNoPeriodo <= TOLERANCIA_SILENCIO_UNIDADES;

  return {
    vigente: compativel,
    idadeDias,
    motivo: compativel ? "SILENCIO_COMPATIVEL" : "SILENCIO_CONTRADIZ",
    demandaEsperadaNoPeriodo,
  };
}

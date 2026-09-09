/**
 * Reconstrução do saldo dia a dia para medir RUPTURA.
 * Camada: Núcleo (core/calculo) — puro, sem dependência de cliente.
 *
 * POR QUE RECONSTRUIR
 * O ERP da Rede Carreiro guarda o saldo ATUAL, não o histórico. A coluna que
 * deveria carregar o saldo de cada movimento (`ESTOQUEATUAL` em MOVESTOQ) está
 * inteiramente vazia — verificado ao vivo em 09/09/2026, zero linhas com valor.
 * O que existe são os MOVIMENTOS: entrada, saída e ajuste, com data e
 * quantidade. Com o saldo de hoje e os movimentos, o saldo de ontem é
 * aritmética: saldo(ontem) = saldo(hoje) − movimentos de hoje.
 *
 * O QUE ISSO CUSTA EM HONESTIDADE
 * A conta assume que MOVESTOQ registra TODO movimento. Se o ERP altera saldo por
 * fora (correção manual em banco, importação), a caminhada para trás desvia — e
 * o desvio cresce quanto mais longe se anda. Por isso a janela é curta (90 dias)
 * e o resultado carrega `confiavel`: quando a reconstrução exige um saldo
 * absurdamente negativo no passado, é sinal de movimento faltando, e quem lê
 * precisa saber disso em vez de receber um número com cara de medição.
 */

/** Movimentos já somados por dia. `delta` positivo entra, negativo sai. */
export interface MovimentoDiarioEstoque {
  /** Dia no formato ISO curto (YYYY-MM-DD). */
  readonly dia: string;
  readonly delta: number;
}

export interface ResultadoRuptura {
  /** Dias da janela em que o saldo estava zerado ou negativo. */
  readonly diasZerados: number;
  /** Denominador efetivamente auditado. */
  readonly diasAnalisados: number;
  /** Dia mais recente em que o item estava zerado. null = não zerou na janela. */
  readonly dataUltimoZeramento: string | null;
  /**
   * false quando a reconstrução pede um saldo passado muito negativo — indício
   * de movimento não registrado. O número continua sendo devolvido, mas quem
   * mostra na tela deve dizer que é estimativa frouxa.
   */
  readonly confiavel: boolean;
}

/** Abaixo disto, a caminhada para trás está claramente perdendo movimento. */
const LIMITE_SALDO_NEGATIVO_IMPLAUSIVEL = -5;

export function diaIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** Soma movimentos soltos em um total por dia. */
export function agruparMovimentosPorDia(
  movimentos: readonly { readonly data: string | Date; readonly delta: number }[]
): MovimentoDiarioEstoque[] {
  const porDia = new Map<string, number>();
  for (const m of movimentos) {
    if (!Number.isFinite(m.delta) || m.delta === 0) continue;
    const bruto = m.data instanceof Date ? m.data : new Date(m.data);
    if (Number.isNaN(bruto.getTime())) continue;
    const dia = diaIso(bruto);
    porDia.set(dia, (porDia.get(dia) ?? 0) + m.delta);
  }
  return Array.from(porDia, ([dia, delta]) => ({ dia, delta })).sort((a, b) =>
    a.dia < b.dia ? -1 : 1
  );
}

/**
 * Caminha do saldo de hoje para trás e conta os dias zerados.
 *
 * O saldo informado é o do FIM do dia de referência. Para cada dia, primeiro se
 * observa o saldo daquele dia, depois se desfazem os movimentos dele para
 * chegar ao dia anterior.
 */
export function calcularDiasEmRuptura(parametros: {
  readonly saldoAtual: number;
  readonly movimentos: readonly MovimentoDiarioEstoque[];
  readonly diasJanela: number;
  readonly hoje: Date;
}): ResultadoRuptura {
  const { saldoAtual, movimentos, diasJanela, hoje } = parametros;

  const janela = Math.max(0, Math.floor(diasJanela));
  if (janela === 0) {
    return { diasZerados: 0, diasAnalisados: 0, dataUltimoZeramento: null, confiavel: true };
  }

  const deltaPorDia = new Map<string, number>();
  for (const m of movimentos) {
    deltaPorDia.set(m.dia, (deltaPorDia.get(m.dia) ?? 0) + m.delta);
  }

  let saldo = Number.isFinite(saldoAtual) ? saldoAtual : 0;
  let diasZerados = 0;
  let dataUltimoZeramento: string | null = null;
  let saldoMinimoReconstruido = saldo;

  const referencia = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());

  for (let i = 0; i < janela; i++) {
    const dia = diaIso(new Date(referencia - i * 86_400_000));

    if (saldo <= 0) {
      diasZerados++;
      // Caminhando de trás para frente, o PRIMEIRO zerado encontrado é o mais
      // recente — é esse que o comprador quer ver.
      if (dataUltimoZeramento === null) dataUltimoZeramento = dia;
    }

    saldo -= deltaPorDia.get(dia) ?? 0;
    if (saldo < saldoMinimoReconstruido) saldoMinimoReconstruido = saldo;
  }

  return {
    diasZerados,
    diasAnalisados: janela,
    dataUltimoZeramento,
    confiavel: saldoMinimoReconstruido >= LIMITE_SALDO_NEGATIVO_IMPLAUSIVEL,
  };
}

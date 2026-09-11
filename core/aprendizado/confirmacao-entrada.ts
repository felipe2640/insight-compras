/**
 * Ciclo de Aprendizado — Confirmação de Entrada
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 *
 * BASE COMUM A TODOS OS CLIENTES.
 * O snapshot registra o que foi EXPORTADO (a intenção). Isso não é o que entrou:
 * o fornecedor pode não ter o item, mandar a mais (caixa fechada) ou a menos.
 * Sem confrontar a entrada real, o modelo aprende contra uma intenção, não
 * contra o fato.
 *
 * A BUSCA das entradas é do adapter (cada cliente tem sua fonte). Esta função só
 * decide o STATUS a partir das quantidades — e por isso é testável sem banco.
 *
 * Janela padrão de 10 dias: no diário, medida em 100 snapshots reais, o p95 de
 * entrega foi 8 dias; janela maior cola o ciclo de compra SEGUINTE e infla o
 * acerto. Cada cliente pode ajustar no tenant.
 *
 * LIMITE HONESTO: o casamento é por (produto, loja, janela), não por pedido.
 * O resultado é um INDICADOR de confirmação, não vínculo contábil.
 */

export const JANELA_CONFIRMACAO = {
  PADRAO_DIAS: 10,
  MIN_DIAS: 1,
  MAX_DIAS: 30,
} as const;

export type StatusConfirmacao =
  | "aguardando"      // a janela ainda não fechou
  | "confirmado"      // entrou o que foi pedido (±10%)
  | "excedente"       // entrou mais que o pedido (caixa fechada, arredondamento)
  | "parcial"         // entrou menos que o pedido
  | "transferencia"   // não comprou, mas veio de outra loja
  | "nao_entrou";     // nada chegou — dado CENSURADO para a calibração

export interface EntradasObservadas {
  /** Compra do fornecedor que deu entrada na loja na janela. */
  readonly qtdEntrada: number;
  /** Transferência recebida de outra loja na janela. */
  readonly qtdTransferida: number;
}

export interface ResultadoConfirmacao {
  readonly status: StatusConfirmacao;
  readonly qtdEntrada: number;
  readonly qtdTransferida: number;
  /** compra + transferência: tudo que chegou para atender a necessidade. */
  readonly suprimentoReal: number;
}

/** Tolerância para considerar "confirmado" (arredondamento de caixa). */
const TOLERANCIA = 0.1;

export function janelaFechou(exportadoEm: Date, agora: Date, janelaDias: number): boolean {
  const limite = exportadoEm.getTime() + janelaDias * 86_400_000;
  return agora.getTime() >= limite;
}

/**
 * Decide o status da confirmação de um item exportado.
 */
export function confirmarEntrada(
  qtdPedida: number,
  entradas: EntradasObservadas,
  janelaFechada: boolean
): ResultadoConfirmacao {
  const qtdEntrada = Math.max(0, entradas.qtdEntrada);
  const qtdTransferida = Math.max(0, entradas.qtdTransferida);
  const suprimentoReal = qtdEntrada + qtdTransferida;

  const base = { qtdEntrada, qtdTransferida, suprimentoReal };

  if (!janelaFechada && suprimentoReal === 0) {
    return { ...base, status: "aguardando" };
  }
  if (suprimentoReal === 0) {
    return { ...base, status: "nao_entrou" };
  }
  if (qtdEntrada === 0 && qtdTransferida > 0) {
    return { ...base, status: "transferencia" };
  }
  if (qtdPedida <= 0) {
    // Comprador não pediu, mas entrou: chegou pedido anterior ou caixa fechada.
    return { ...base, status: "excedente" };
  }
  const razao = suprimentoReal / qtdPedida;
  if (razao >= 1 - TOLERANCIA && razao <= 1 + TOLERANCIA) {
    return { ...base, status: "confirmado" };
  }
  return { ...base, status: razao > 1 ? "excedente" : "parcial" };
}

/**
 * Contratos de Tipagem do Ciclo de Vida de Pedidos
 * Camada: Aplicação / Pedidos (src/lib/pedidos/tipos.ts)
 * 100% em Português do Brasil (pt-BR).
 */

export type StatusPedido = "exportado" | "enviado" | "confirmado" | "recebido";

export const FLUXO_STATUS_PEDIDO: readonly StatusPedido[] = [
  "exportado",
  "enviado",
  "confirmado",
  "recebido",
] as const;

export interface TransicaoPedido {
  readonly de: StatusPedido;
  readonly para: StatusPedido;
  readonly dataHora: string;
  readonly responsavel: string;
  readonly observacao?: string | null;
}

export interface Pedido {
  readonly id: number;
  readonly tenantId: string;
  readonly exportadoEm: string;
  readonly usuario: string | null;
  readonly filialId: number | null;
  readonly modeloId: string;
  readonly formato: string;
  readonly totalItens: number;
  readonly status: StatusPedido;
  readonly enviadoEm?: string | null;
  readonly enviadoPor?: string | null;
  readonly confirmadoEm?: string | null;
  readonly confirmadoPor?: string | null;
  readonly recebidoEm?: string | null;
  readonly recebidoPor?: string | null;
  readonly historico: readonly TransicaoPedido[];
}

export interface ItemPedido {
  readonly id: number;
  readonly sku: string | null;
  readonly descricao: string | null;
  readonly qtdComprador: number;
  readonly qtdTransferencia: number;
  readonly qtdModelo: number | null;
  readonly custo: number | null;
  readonly valorTotal: number;
}

// Aliases para compatibilidade regressiva com a interface anterior
export type PedidoExportado = Pedido;
export type ItemPedidoExportado = ItemPedido;

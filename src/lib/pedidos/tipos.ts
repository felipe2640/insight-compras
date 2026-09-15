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

export type OrigemPedido = "erp" | "exportacao";

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
  readonly origem?: OrigemPedido;
  readonly numeroPedidoERP?: number | string;
  readonly fornecedorId?: number | null;
  readonly fornecedorNome?: string | null;
  readonly cotacaoId?: number | null;
  readonly valorTotal?: number;
  readonly dataEmissao?: string;
  readonly statusERP?: string;
  readonly filialNome?: string;
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
  readonly quantidade?: number;
  readonly valorUnitario?: number | null;
  readonly cotacaoItemId?: number | null;
  readonly cotacaoId?: number | null;
  readonly dataEmissao?: string;
}

export interface CotacaoERP {
  readonly rowId: number;
  readonly codigo: number;
  readonly descricao: string;
  readonly dataHora: string;
  readonly status: string;
  readonly filialId: number;
  readonly filialNome: string;
  readonly totalItens: number;
  readonly totalPropostas: number;
  readonly propostasVencedoras: number;
  readonly menorValorCotado: number;
}

// Aliases para compatibilidade regressiva com a interface anterior
export type PedidoExportado = Pedido;
export type ItemPedidoExportado = ItemPedido;


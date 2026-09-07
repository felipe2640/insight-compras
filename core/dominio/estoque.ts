/**
 * Entidade de domínio: EstoqueFilial
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 */

export interface EstoqueFilial {
  readonly filialId: number;
  readonly nomeFilial: string;
  readonly produtoId: number;
  readonly saldoFisico: number;
  readonly estoqueMinimoSeguranca: number;
  readonly quantidadeJaPedida: number;
  readonly consumoMedioDiarioErp: number;
  readonly dataUltimaVenda: string | null;
  readonly dataUltimaCompra: string | null;
}

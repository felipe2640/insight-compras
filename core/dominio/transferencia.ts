/**
 * Entidade de domínio: TransferenciaRecomendada
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 */

export interface TransferenciaRecomendada {
  readonly produtoId: number;
  readonly codigoSku: string;
  readonly filialOrigemId: number;
  readonly nomeFilialOrigem: string;
  readonly filialDestinoId: number;
  readonly nomeFilialDestino: string;
  readonly quantidadeTransferir: number;
  readonly saldoOrigemAntes: number;
  readonly estoqueMinimoOrigem: number;
  readonly saldoOrigemApos: number;
  readonly necessidadeDestinoAntes: number;
  readonly motivo: string;
}

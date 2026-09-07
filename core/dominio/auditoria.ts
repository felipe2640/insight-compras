/**
 * Entidade de domínio: RegistroAuditoriaPedido
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 */

export type TipoAcaoAuditoria =
  | "CRIACAO_PEDIDO"
  | "AJUSTE_SUGESTAO"
  | "APROVACAO_TRANSFERENCIA"
  | "SOBRECOMPRA_CONFIRMADA";

export interface RegistroAuditoriaPedido {
  readonly id: string;
  readonly timestamp: string;
  readonly usuarioId: string;
  readonly usuarioNome: string;
  readonly tenantId: string;
  readonly tipoAcao: TipoAcaoAuditoria;
  readonly produtoId: number;
  readonly codigoSku: string;
  readonly filialId: number;
  readonly quantidadeSugeridaSistema: number;
  readonly quantidadeDefinidaComprador: number;
  readonly divergenciaJustificativa: string | null;
}

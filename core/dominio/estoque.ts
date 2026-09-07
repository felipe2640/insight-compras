/**
 * Entidade de domínio: EstoqueFilial
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 */

export interface EstoqueFilial {
  readonly filialId: number;
  readonly nomeFilial: string;
  readonly produtoId: number;

  readonly saldoFisico: number;

  /** Estoque mínimo cadastrado no ERP do cliente. */
  readonly estoqueMinimoSeguranca: number;

  /**
   * Quantidade já pedida ao fornecedor e ainda não recebida.
   * Se a fonte não expõe pedidos em aberto, o adapter DEVE declarar o campo em
   * `camposIndisponiveis` — tratar como 0 faz o motor recomprar o que já vem a caminho.
   */
  readonly quantidadeJaPedida: number;

  /** Consumo médio diário calculado pelo próprio ERP do cliente. */
  readonly consumoMedioDiarioErp: number;

  /** Dias decorridos desde a última venda deste item nesta filial. */
  readonly diasSemVenda: number | null;

  readonly dataUltimaVenda: string | null;
  readonly dataUltimaCompra: string | null;

  /** Campos que a fonte do cliente não soube fornecer nesta carga. */
  readonly camposIndisponiveis?: readonly (keyof EstoqueFilial)[];
}

/**
 * Verifica se um campo do estoque foi realmente medido pela fonte do cliente.
 */
export function campoEstoqueDisponivel(
  estoque: EstoqueFilial | undefined,
  campo: keyof EstoqueFilial
): boolean {
  if (!estoque) return false;
  return !(estoque.camposIndisponiveis ?? []).includes(campo);
}

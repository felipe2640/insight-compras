/**
 * Entidade de domínio: HistoricoVendasFilial
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 *
 * Contrato que TODO adapter de cliente precisa preencher. Os campos abaixo são
 * os insumos do motor base — se um cliente não conseguir fornecer algum deles,
 * o adapter deve declarar isso explicitamente em `camposIndisponiveis` em vez de
 * devolver zero silenciosamente (zero é um valor legítimo e não pode ser
 * confundido com "não medido").
 */

export interface HistoricoVendasFilial {
  readonly produtoId: number;
  readonly filialId: number;

  /** Saídas líquidas (vendas - devoluções) por janela. */
  readonly vendasLiquidas30dias: number;
  readonly vendasLiquidas90dias: number;
  readonly vendasLiquidas180dias: number;

  /** Quantidade devolvida na janela de 90 dias (valor positivo). */
  readonly devolucoes90dias: number;

  /**
   * Notas fiscais de venda DISTINTAS que contêm este produto na janela de 90 dias.
   * ATENÇÃO: precisa ser contado na tabela de ITENS da nota, não no cabeçalho —
   * contar no cabeçalho devolve o total de notas da loja, idêntico para todo SKU.
   */
  readonly notasFiscaisVenda90dias: number;

  /**
   * Notas de venda em 180 dias. Serve para compor a janela ANTERIOR de 90 dias
   * (180d menos 90d), que é o termo de comparação da grade.
   */
  readonly notasFiscaisVenda180dias?: number;
  readonly notasFiscaisDevolucao90dias: number;

  /**
   * Meses distintos com movimento na janela de 12 meses.
   * Segundo critério de elegibilidade: recorrência ao longo do tempo, não volume.
   */
  readonly mesesAtivos12meses: number;

  /**
   * Mediana das quantidades positivas por linha de venda.
   * É o piso padrão da previsão de demanda.
   */
  readonly medianaLinhaVenda: number;

  /** Dias com saldo zerado na janela de 90 dias. */
  readonly diasRuptura90dias: number;

  /** Dia mais recente em que o item esteve zerado. null = não zerou na janela. */
  readonly dataUltimoZeramento?: string | null;

  /**
   * false quando a reconstrução do saldo passado exigiu valores implausíveis —
   * sinal de movimento não registrado no ERP. Ver core/calculo/ruptura.
   */
  readonly rupturaConfiavel?: boolean;

  /** Dias efetivamente auditados para o cálculo de ruptura (denominador). */
  readonly diasObservados: number;

  readonly dataPrimeiraVendaRegistrada: string | null;

  /**
   * Campos que a fonte do cliente não soube fornecer nesta carga.
   * O cockpit exibe "—" nas colunas correspondentes em vez de um número falso.
   */
  readonly camposIndisponiveis?: readonly (keyof HistoricoVendasFilial)[];
}

/**
 * Verifica se um campo do histórico foi realmente medido pela fonte do cliente.
 */
export function campoHistoricoDisponivel(
  historico: HistoricoVendasFilial | undefined,
  campo: keyof HistoricoVendasFilial
): boolean {
  if (!historico) return false;
  return !(historico.camposIndisponiveis ?? []).includes(campo);
}

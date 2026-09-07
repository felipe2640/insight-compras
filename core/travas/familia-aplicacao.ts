/**
 * Trava Anti-Encalhe: Cobertura Somada da Família de Aplicação
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 *
 * REGRA MANDATÓRIA:
 * No setor de autopeças, múltiplos SKUs de marcas distintas compartilham a mesma aplicação
 * veicular intercambiável (ex: Filtro de Óleo Gol 1.0 ou Amortecedor Dianteiro Strada).
 * Se o estoque somado de todas as marcas da família cobrir o horizonte de planejamento
 * da rede, qualquer compra externa adicional é sumariamente bloqueada para evitar
 * acúmulo de capital parado em produtos redundantes.
 */

export interface ItemFamiliaAplicacao {
  readonly produtoId: number;
  readonly codigoSku: string;
  readonly marca: string;
  readonly saldoFisico: number;
  readonly quantidadeJaPedida: number;
  readonly consumoDiario: number;
  readonly necessidadeIndividual: number;
}

export interface ResultadoTravaFamiliaItem {
  readonly produtoId: number;
  readonly codigoSku: string;
  readonly sugestaoOriginal: number;
  readonly sugestaoAjustada: number;
  readonly travado: boolean;
  readonly motivo: string | null;
}

export interface ResultadoTravaFamilia {
  readonly familiaId: string;
  readonly estoqueTotalFamilia: number;
  readonly consumoDiarioTotalFamilia: number;
  readonly diasCoberturaFamilia: number;
  readonly horizonteDiasPlanejamento: number;
  readonly familiaCoberta: boolean;
  readonly itens: Map<number, ResultadoTravaFamiliaItem>;
}

/**
 * Aplica a trava de cobertura da família veicular.
 * Calcula a cobertura consolidada da família em dias:
 * diasCobertura = (saldoFisicoTotal + jaPedidoTotal) / consumoDiarioTotal.
 * Se diasCobertura >= horizonteDiasPlanejamento:
 * Todos os itens que tinham sugestão de compra têm sua sugestão reduzida a 0 com trava ativa.
 */
export function aplicarTravaFamiliaAplicacao(
  familiaId: string,
  itensFamilia: readonly ItemFamiliaAplicacao[],
  horizonteDiasPlanejamento: number
): ResultadoTravaFamilia {
  const mapaItens = new Map<number, ResultadoTravaFamiliaItem>();

  if (!itensFamilia || itensFamilia.length === 0) {
    return {
      familiaId,
      estoqueTotalFamilia: 0,
      consumoDiarioTotalFamilia: 0,
      diasCoberturaFamilia: 0,
      horizonteDiasPlanejamento,
      familiaCoberta: false,
      itens: mapaItens,
    };
  }

  const estoqueTotalFamilia = itensFamilia.reduce(
    (acum, item) =>
      acum + Math.max(0, item.saldoFisico) + Math.max(0, item.quantidadeJaPedida),
    0
  );

  const consumoDiarioTotalFamilia = itensFamilia.reduce(
    (acum, item) => acum + Math.max(0, item.consumoDiario),
    0
  );

  let diasCoberturaFamilia: number;
  if (consumoDiarioTotalFamilia <= 0) {
    // Se não há consumo diário mas há estoque, a cobertura é tecnicamente infinita
    diasCoberturaFamilia = estoqueTotalFamilia > 0 ? 9999 : 0;
  } else {
    diasCoberturaFamilia = estoqueTotalFamilia / consumoDiarioTotalFamilia;
  }

  const familiaCoberta = diasCoberturaFamilia >= horizonteDiasPlanejamento;

  for (const item of itensFamilia) {
    const sugestaoOriginal = Math.max(0, item.necessidadeIndividual);

    if (familiaCoberta && sugestaoOriginal > 0) {
      mapaItens.set(item.produtoId, {
        produtoId: item.produtoId,
        codigoSku: item.codigoSku,
        sugestaoOriginal,
        sugestaoAjustada: 0,
        travado: true,
        motivo: `Bloqueio Família/Aplicação: Família "${familiaId}" possui ${Math.round(diasCoberturaFamilia)} dias de cobertura (${estoqueTotalFamilia} un em estoque para consumo diário de ${consumoDiarioTotalFamilia.toFixed(2)} un/dia), superando o horizonte planejado de ${horizonteDiasPlanejamento} dias. Compra redundante bloqueada.`,
      });
    } else {
      mapaItens.set(item.produtoId, {
        produtoId: item.produtoId,
        codigoSku: item.codigoSku,
        sugestaoOriginal,
        sugestaoAjustada: sugestaoOriginal,
        travado: false,
        motivo: null,
      });
    }
  }

  return {
    familiaId,
    estoqueTotalFamilia,
    consumoDiarioTotalFamilia,
    diasCoberturaFamilia,
    horizonteDiasPlanejamento,
    familiaCoberta,
    itens: mapaItens,
  };
}

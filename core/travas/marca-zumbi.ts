/**
 * Trava Anti-Encalhe: Marca Zumbi
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 *
 * REGRA MANDATÓRIA INVIOLÁVEL:
 * Se um SKU possuir saldo físico em estoque (> 0) e registrou ZERO vendas nos últimos
 * 180 dias (vendasLiquidas180d === 0), sua sugestão final de compra é OBRIGATORIAMENTE 0.
 * Isso impede que hábitos empíricos de compradores reabasteçam itens sem tração de mercado.
 */

export interface ParametrosTravaZumbi {
  readonly saldoFisico: number;
  readonly vendasLiquidas180dias: number;
  readonly sugestaoOriginal: number;
  readonly codigoSku?: string;
}

export interface ResultadoTravaZumbi {
  readonly sugestaoAjustada: number;
  readonly travado: boolean;
  readonly motivo: string | null;
}

/**
 * Aplica a trava anti-encalhe para itens zumbis.
 * Se saldoFisico > 0 e vendasLiquidas180dias <= 0:
 * Retorna sugestaoAjustada = 0 e travado = true.
 */
export function aplicarTravaMarcaZumbi(
  parametros: ParametrosTravaZumbi
): ResultadoTravaZumbi {
  const { saldoFisico, vendasLiquidas180dias, sugestaoOriginal, codigoSku } = parametros;

  if (saldoFisico > 0 && vendasLiquidas180dias <= 0) {
    const skuRef = codigoSku ? ` (SKU ${codigoSku})` : "";
    return {
      sugestaoAjustada: 0,
      travado: true,
      motivo: `Bloqueio Marca Zumbi${skuRef}: Item possui saldo de ${saldoFisico} un em estoque com 0 vendas nos últimos 180 dias. Compra externa vedada para evitar imobilização de capital.`,
    };
  }

  return {
    sugestaoAjustada: Math.max(0, sugestaoOriginal),
    travado: false,
    motivo: null,
  };
}

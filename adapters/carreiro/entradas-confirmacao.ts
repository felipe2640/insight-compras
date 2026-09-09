/**
 * Fonte de entradas para a confirmação do aprendizado — Rede Carreiro
 * Camada: Adapters / Carreiro
 *
 * O core decide o STATUS (confirmarEntrada); este módulo só busca, no modelo
 * semântico, o que deu entrada em cada (produto, loja) dentro de uma janela.
 *
 * COMPRA = 'TIPOS_NOTA'[ATIPO] = "02" e 'NOTAS'[TIPO] = "E": a mesma definição da
 * medida [Quantidade Comprada Produto] do próprio cliente.
 *
 * TRANSFERÊNCIA RECEBIDA: no modelo, 'NOTAS'[Tipo Movimentação] = "Transferência"
 * marca a nota de SAÍDA na origem. A entrada correspondente na loja de destino
 * não tem hoje um campo que a distinga de compra de fornecedor. Enquanto o BI do
 * cliente não expuser esse vínculo, `qtdTransferida` sai como 0 e o status
 * "transferencia" não dispara — a transferência aparece dentro de qtdEntrada.
 * Isso subestima um pouco a explicação, mas NÃO falsifica o suprimento real
 * (compra + transferência somam igual). Registrado em `camposIndisponiveis`.
 */

import { ClienteDaxPowerBI } from "./cliente-dax";
import { NOMES_CADEMP_CARREIRO, extrairIdProduto } from "./mapeador-dax";

export interface EntradasPorItem {
  readonly produtoId: number;
  readonly filialId: number;
  readonly qtdEntrada: number;
  readonly qtdTransferida: number;
}

export const CAMPOS_INDISPONIVEIS_CONFIRMACAO = ["qtdTransferida"] as const;

function dataDax(d: Date): string {
  return `DATE(${d.getFullYear()}, ${d.getMonth() + 1}, ${d.getDate()})`;
}

/**
 * Consulta as entradas de compra por produto na loja, entre `inicio` (inclusive)
 * e `fim` (exclusive). Uma chamada por loja, como as demais consultas do adapter.
 */
export function gerarConsultaDaxEntradas(nomeCademp: string, inicio: Date, fim: Date): string {
  const filialSegura = nomeCademp.replace(/["\\]/g, "").trim();
  return `
EVALUATE
FILTER(
    SUMMARIZECOLUMNS(
        'PRODUTOS'[ACODPRODUTO],
        FILTER(ALL('CADEMP'[ANOMEFANTASIA]), 'CADEMP'[ANOMEFANTASIA] = "${filialSegura}"),
        FILTER(
            ALL('dCalendario'[Data]),
            'dCalendario'[Data] >= ${dataDax(inicio)} && 'dCalendario'[Data] < ${dataDax(fim)}
        ),
        "QtdEntrada", [Quantidade Comprada Produto]
    ),
    [QtdEntrada] > 0
)
  `.trim();
}

export async function buscarEntradasCarreiro(
  cliente: ClienteDaxPowerBI,
  parametros: {
    readonly filialId: number;
    readonly inicio: Date;
    readonly fim: Date;
    readonly produtoIds: ReadonlySet<number>;
  }
): Promise<Map<number, EntradasPorItem>> {
  const nomeCademp = NOMES_CADEMP_CARREIRO[parametros.filialId];
  const resultado = new Map<number, EntradasPorItem>();
  if (!nomeCademp) return resultado;

  const linhas = await cliente.executarConsultaDax(
    gerarConsultaDaxEntradas(nomeCademp, parametros.inicio, parametros.fim)
  );

  for (const linha of linhas) {
    const produtoId = extrairIdProduto(linha["PRODUTOS[ACODPRODUTO]"] ?? linha["Produto"]);
    if (!produtoId || !parametros.produtoIds.has(produtoId)) continue;
    const qtd = Number(linha["[QtdEntrada]"] ?? linha["QtdEntrada"] ?? 0) || 0;
    resultado.set(produtoId, {
      produtoId,
      filialId: parametros.filialId,
      qtdEntrada: Math.max(0, qtd),
      qtdTransferida: 0,
    });
  }
  return resultado;
}

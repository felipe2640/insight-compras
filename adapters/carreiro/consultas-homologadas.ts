/**
 * Consultas DAX Homologadas da Rede Carreiro
 * Camada: Adapters / Carreiro
 * 100% em Português do Brasil (pt-BR).
 *
 * Mapeamento das consultas oficiais auditadas no Marco M0 para consumo
 * do modelo semântico "Autopeca multi loja" no Power BI Fabric.
 */

import { FiltroCargaInventario } from "../AdaptadorInventario";

/**
 * Sanitiza e formata uma lista de IDs numéricos para cláusula IN segura no DAX.
 * Previne rigorosamente qualquer injeção de DAX garantindo que todos os tokens sejam inteiros.
 */
export function formatarListaNumericaDax(numeros: readonly number[]): string {
  const numerosValidados = numeros
    .filter((n) => Number.isInteger(n) && n >= 0)
    .map((n) => Math.floor(n));

  if (numerosValidados.length === 0) {
    return "{ -1 }"; // Cláusula vazia/nula segura
  }

  return `{ ${numerosValidados.join(", ")} }`;
}

/**
 * 1. Snapshot de Frescor e Integridade dos Dados (freshness.dax)
 */
export const CONSULTA_DAX_FRESCOR = `
EVALUATE
ROW(
    "UltimaDataNota", MAX('NOTAS'[DENTSAID]),
    "UltimaDataVendaValida", MAXX(FILTER(ALL('dCalendario'[Data]), [Receita Liquida] > 0), 'dCalendario'[Data]),
    "UltimaAtualizacaoProduto", MAX('PRODUTOS'[DULT_ATLZ]),
    "UltimoMovimento", MAX('MOVESTOQ'[DATA_HORA])
)
`.trim();

/**
 * 2. Mapeamento de Lojas da Rede Carreiro (store_map.dax)
 */
export const CONSULTA_DAX_LOJAS = `
EVALUATE
SELECTCOLUMNS(
    FILTER(CADEMP, NOT ISBLANK(CADEMP[ANOMEFANTASIA])),
    "Empresa", CADEMP[ACODEMP],
    "Loja", CADEMP[ANOMEFANTASIA]
)
ORDER BY [Loja]
`.trim();

/**
 * 3. Linha de Base Móvel de 12 Meses por Loja (baseline_store.dax)
 */
export const CONSULTA_DAX_BASELINE_12M = `
EVALUATE
VAR AsOf = TODAY()
VAR Periodo12m =
    FILTER(
        ALL('dCalendario'[Data]),
        'dCalendario'[Data] > EDATE(AsOf, -12) && 'dCalendario'[Data] <= AsOf
    )
RETURN
SUMMARIZECOLUMNS(
    'CADEMP'[ANOMEFANTASIA],
    Periodo12m,
    "Receita12m", CALCULATE([Receita Liquida], KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta")),
    "QtdVendida12m", CALCULATE([Quantidade Vendida Produto], KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta")),
    "Compras12m", [Valor Comprado Produto],
    "QtdComprada12m", [Quantidade Comprada Produto],
    "EstoqueValor", [Estoque Valor Imobilizado (Base)],
    "EstoqueQtd", [Estoque Qtd Atual (Base)]
)
ORDER BY 'CADEMP'[ANOMEFANTASIA]
`.trim();

/**
 * 4. Posição Atual de Produtos, Estoque e Custo ERP (current_product.dax)
 * Suporta injeção de filtro seguro por fornecedores e seção.
 */
export function gerarConsultaDaxProdutosEstoque(filtro?: FiltroCargaInventario): string {
  let clausulaFiltro = "";

  if (filtro?.fornecedoresPermitidos && filtro.fornecedoresPermitidos.length > 0) {
    const listaDax = formatarListaNumericaDax(filtro.fornecedoresPermitidos);
    clausulaFiltro += ` && 'PRODUTOS'[ICODFORN] IN ${listaDax}`;
  }

  if (filtro?.secaoId !== undefined && Number.isInteger(filtro.secaoId)) {
    clausulaFiltro += ` && 'PRODUTOS'[ACLASSE] = ${filtro.secaoId}`;
  }

  if (filtro?.apenasComEstoqueOuVenda) {
    clausulaFiltro += ` && (COALESCE('PRODUTOS'[NESTOQATUAL], 0) <> 0 || NOT ISBLANK('PRODUTOS'[DULTIMAVENDA]))`;
  }

  return `
EVALUATE
SELECTCOLUMNS(
    FILTER(
        PRODUTOS,
        NOT ISBLANK('PRODUTOS'[ACODPRODUTO])${clausulaFiltro}
    ),
    "Empresa", 'PRODUTOS'[ACODEMPRESA],
    "Produto", 'PRODUTOS'[ACODPRODUTO],
    "CodigoBase", 'PRODUTOS'[ACODPRODUTO_BASE],
    "Descricao", 'PRODUTOS'[ADESCRICAO],
    "Marca", 'PRODUTOS'[MARCA],
    "RefFabricante", 'PRODUTOS'[AREFERENCIA],
    "Aplicacao", 'PRODUTOS'[APLICACAO],
    "Secao", 'PRODUTOS'[ACLASSE],
    "Fornecedor", 'PRODUTOS'[ICODFORN],
    "NomeFornecedor", 'PRODUTOS'[Nome Fornecedor],
    "EstoqueQtd", 'PRODUTOS'[NESTOQATUAL],
    "EstoqueMinimo", 'PRODUTOS'[NESTOQUEMIN],
    "PrecoCompraERP", 'PRODUTOS'[NPRECOCOMPRA],
    "PrecoVenda", 'PRODUTOS'[NPRECOVENDA],
    "UltimaVenda", 'PRODUTOS'[DULTIMAVENDA],
    "UltimaCompra", 'PRODUTOS'[DULTIMACOMPRA]
)
ORDER BY [Empresa], [Produto]
  `.trim();
}

/**
 * 5. Histórico Agregado de Vendas Recentes e Rupturas (30d, 90d, 180d)
 */
export function gerarConsultaDaxHistoricoVendas(filtro?: FiltroCargaInventario): string {
  let filtroFornecedores = "";
  if (filtro?.fornecedoresPermitidos && filtro.fornecedoresPermitidos.length > 0) {
    const listaDax = formatarListaNumericaDax(filtro.fornecedoresPermitidos);
    filtroFornecedores = `KEEPFILTERS('PRODUTOS'[ICODFORN] IN ${listaDax}),`;
  }

  return `
EVALUATE
VAR DataLimite = TODAY()
VAR Periodo180d = DATESINPERIOD('dCalendario'[Data], DataLimite, -180, DAY)
RETURN
SUMMARIZECOLUMNS(
    'CADEMP'[ACODEMP],
    'CADEMP'[ANOMEFANTASIA],
    'PRODUTOS'[ACODPRODUTO],
    ${filtroFornecedores}
    Periodo180d,
    "VendasQtd180d", CALCULATE([Quantidade Vendida Produto], KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta")),
    "VendasQtd90d", CALCULATE(
        [Quantidade Vendida Produto],
        KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta"),
        DATESINPERIOD('dCalendario'[Data], DataLimite, -90, DAY)
    ),
    "VendasQtd30d", CALCULATE(
        [Quantidade Vendida Produto],
        KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta"),
        DATESINPERIOD('dCalendario'[Data], DataLimite, -30, DAY)
    ),
    "NotasVenda90d", CALCULATE(
        DISTINCTCOUNT('NOTAS'[DOCUMENTO]),
        KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta"),
        DATESINPERIOD('dCalendario'[Data], DataLimite, -90, DAY)
    ),
    "Devolucoes90d", CALCULATE(
        [Quantidade Comprada Produto],
        DATESINPERIOD('dCalendario'[Data], DataLimite, -90, DAY)
    ),
    "NotasDevolucao90d", 0,
    "DiasRuptura90d", 0,
    "DiasObservados", 180
)
  `.trim();
}

/**
 * 6. Entradas de Notas Fiscais no Dia Atual (NF-e do Dia via MOVESTOQ)
 */
export const CONSULTA_DAX_ENTRADAS_HOJE = `
EVALUATE
FILTER(
    SELECTCOLUMNS(
        FILTER(
            MOVESTOQ,
            'MOVESTOQ'[ATIPOMOV] = "E"
                && 'MOVESTOQ'[DATA_HORA] >= TODAY()
        ),
        "Filial", 'MOVESTOQ'[ACODEMPRESA],
        "Produto", 'MOVESTOQ'[ACODPRODUTO],
        "DataHora", 'MOVESTOQ'[DATA_HORA],
        "Quantidade", 'MOVESTOQ'[NQTDEMOV],
        "Observacao", 'MOVESTOQ'[AOBSERVACAO]
    ),
    NOT ISBLANK([Produto])
)
`.trim();

/**
 * 7. Consulta de Peças Similares Intercambiáveis (TMP_AUDIT_PRODUTOS_SEMELHANTES_20260819)
 */
export const CONSULTA_DAX_SIMILARES = `
EVALUATE
SELECTCOLUMNS(
    TMP_AUDIT_PRODUTOS_SEMELHANTES_20260819,
    "ProdutoOrigem", TMP_AUDIT_PRODUTOS_SEMELHANTES_20260819[ACODPRODUTO],
    "ProdutoSimilar", TMP_AUDIT_PRODUTOS_SEMELHANTES_20260819[ACODPRODUTO_SEMELHANTE],
    "TipoSimilaridade", TMP_AUDIT_PRODUTOS_SEMELHANTES_20260819[TIPO]
)
`.trim();

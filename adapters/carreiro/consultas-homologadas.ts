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

  // Converte a cláusula de FILTER (sintaxe de linha) em filtros de SUMMARIZECOLUMNS.
  const filtroTabela = clausulaFiltro
    ? `FILTER(PRODUTOS, NOT ISBLANK('PRODUTOS'[ACODPRODUTO])${clausulaFiltro}),`
    : "";

  // Somente ATRIBUTOS de cadastro — sem medidas.
  // As medidas de estoque vivem em `gerarConsultaDaxPosicaoEstoque`: misturar as duas
  // coisas quebra o resultado. Verificado ao vivo em 07/09/2026: agrupando por 14
  // colunas de PRODUTOS (incluindo as colunas de data DULTIMAVENDA/DULTIMACOMPRA, que
  // carregam contexto sobre 'dCalendario'), as medidas [Estoque Qtd Atual (Base)] e
  // [Estoque Venda Media Dia 90D] voltam em branco nas 22.473 linhas, enquanto
  // [Estoque Mínimo ERP] e [Estoque Dias sem Venda] continuam corretas — uma
  // inconsistência silenciosa que não gera erro algum.
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
    "PrecoCompraERP", 'PRODUTOS'[NPRECOCOMPRA],
    "PrecoVenda", 'PRODUTOS'[NPRECOVENDA],
    "UltimaVenda", 'PRODUTOS'[DULTIMAVENDA],
    "UltimaCompra", 'PRODUTOS'[DULTIMACOMPRA]
)
ORDER BY [Empresa], [Produto]
  `.trim();
}

/**
 * 4b. Posição de Estoque por Filial (medidas do modelo semântico).
 *
 * Consulta separada e com agrupamento MÍNIMO de propósito: as medidas de estoque
 * só resolvem corretamente com a filial vindo de 'CADEMP' e sem colunas de data de
 * PRODUTOS no agrupamento (ver comentário em `gerarConsultaDaxProdutosEstoque`).
 *
 * Traz os campos que antes o motor recebia como zero fixo:
 * - EstoqueMinimo      -> era 0 em 100% dos itens (7.304 tinham valor real no modelo)
 * - ConsumoMedioDiario -> insumo primário da fórmula homologada
 * - DiasSemVenda       -> classificação de giro
 */
export function gerarConsultaDaxPosicaoEstoque(
  nomeFilial: string,
  filtro?: FiltroCargaInventario
): string {
  // Sanitiza o nome da filial: só aceita o que veio do mapeamento oficial do tenant.
  const filialSegura = nomeFilial.replace(/["\\]/g, "").trim();
  if (!filialSegura) {
    throw new Error("Nome de filial obrigatório para a consulta de posição de estoque.");
  }

  let filtroFornecedores = "";
  if (filtro?.fornecedoresPermitidos && filtro.fornecedoresPermitidos.length > 0) {
    const listaDax = formatarListaNumericaDax(filtro.fornecedoresPermitidos);
    // FILTER(ALL(...)) e NÃO KEEPFILTERS(coluna IN {...}): a segunda forma é rejeitada
    // pelo motor ("A single value for column 'ICODFORN' cannot be determined").
    filtroFornecedores = `FILTER(ALL('PRODUTOS'[ICODFORN]), 'PRODUTOS'[ICODFORN] IN ${listaDax}),`;
  }

  return `
EVALUATE
FILTER(
    SUMMARIZECOLUMNS(
        'PRODUTOS'[ACODPRODUTO],
        FILTER(ALL('CADEMP'[ANOMEFANTASIA]), 'CADEMP'[ANOMEFANTASIA] = "${filialSegura}"),
        ${filtroFornecedores}
        "EstoqueQtd", [Estoque Qtd Atual (Base)],
        "EstoqueMinimo", [Estoque Mínimo ERP],
        "ConsumoMedioDiario", [Estoque Venda Media Dia 90D],
        "DiasSemVenda", [Estoque Dias sem Venda]
    ),
    [EstoqueQtd] <> 0 || [ConsumoMedioDiario] > 0
)
  `.trim();
}

/**
 * Campos que o modelo semântico da Carreiro NÃO consegue fornecer hoje.
 *
 * Declarar é obrigatório: devolver 0 silenciosamente faz o motor tratar
 * "não medido" como "medido e igual a zero", que são coisas diferentes.
 *
 * - quantidadeJaPedida: a tabela 'ITEMSPEDIDO' chegou ao modelo com merge quebrado —
 *   as 185.028 linhas que têm QTDE preenchida estão com TIPO nulo, e as linhas com
 *   TIPO ("C" de compra) estão com QTDE nula. Não há como isolar pedido de compra em
 *   aberto com confiança. IMPACTO: o motor não desconta o que já vem a caminho.
 *   Resolver com o time de BI do cliente antes de liberar a emissão de pedidos.
 *
 * - diasRuptura90dias: não há histórico de saldo diário no modelo. Reconstruir a
 *   partir de MOVESTOQ é possível, mas é trabalho de modelagem, não de consulta.
 */
export const CAMPOS_INDISPONIVEIS_CARREIRO = {
  estoque: ["quantidadeJaPedida"],
  historico: ["diasRuptura90dias"],
} as const;

/**
 * 5. Histórico Agregado de Vendas por Produto e Filial (30d, 90d, 180d, 12m)
 *
 * CORREÇÕES HOMOLOGADAS CONTRA O MODELO VIVO (07/09/2026):
 *
 * - NotasVenda90d agora conta em 'NOTAS_ITEMS'[NOTA_ID], não em 'NOTAS'[DOCUMENTO].
 *   'NOTAS' é a tabela de CABEÇALHO: DISTINCTCOUNT ali não é filtrado por produto e
 *   devolvia o total de notas da LOJA, idêntico para todo SKU (Pedro II: 5.254 em
 *   todos os itens). Medido ao vivo, a inflação mediana era de 1.184x e 100% dos
 *   itens caíam em "Frequência Alta". Com a correção, 0,5% caem em "Alta".
 *
 * - Devolucoes90d agora soma 'NOTAS_ITEMS'[QTDE_DEV] (4.233 unidades reais no modelo).
 *   Antes chamava [Quantidade Comprada Produto], que é COMPRA, não devolução.
 *   Observação: 'NOTAS'[Tipo Movimentação] só tem "Venda Direta", "Transferência" e
 *   nulo — não existe categoria de devolução, então a devolução vem da linha do item.
 *
 * - MesesAtivos12m alimenta o segundo critério de elegibilidade (recorrência).
 *
 * - MedianaLinhaVenda alimenta o piso da previsão de demanda.
 *
 * - DiasRuptura90d NÃO é emitido: o modelo semântico não expõe histórico de saldo
 *   diário. Antes era enviado como constante 0, o que fazia todo SKU aparecer com
 *   0% de ruptura e classificação "Boa". O adapter declara o campo como
 *   indisponível e o cockpit mostra "—" em vez de um número falso.
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
VAR Periodo90d = DATESINPERIOD('dCalendario'[Data], DataLimite, -90, DAY)
VAR Periodo30d = DATESINPERIOD('dCalendario'[Data], DataLimite, -30, DAY)
VAR Periodo365d = DATESINPERIOD('dCalendario'[Data], DataLimite, -365, DAY)
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
        Periodo90d
    ),
    "VendasQtd30d", CALCULATE(
        [Quantidade Vendida Produto],
        KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta"),
        Periodo30d
    ),
    "NotasVenda90d", CALCULATE(
        DISTINCTCOUNT('NOTAS_ITEMS'[NOTA_ID]),
        KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta"),
        Periodo90d
    ),
    "Devolucoes90d", CALCULATE(
        SUM('NOTAS_ITEMS'[QTDE_DEV]),
        KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta"),
        Periodo90d
    ),
    "NotasDevolucao90d", CALCULATE(
        DISTINCTCOUNT('NOTAS_ITEMS'[NOTA_ID]),
        KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta"),
        FILTER('NOTAS_ITEMS', 'NOTAS_ITEMS'[QTDE_DEV] > 0),
        Periodo90d
    ),
    "MesesAtivos12m", CALCULATE(
        SUMX(
            VALUES('dCalendario'[Mês]),
            IF(
                CALCULATE(
                    [Quantidade Vendida Produto],
                    KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta")
                ) > 0,
                1,
                0
            )
        ),
        Periodo365d
    ),
    "MedianaLinhaVenda", CALCULATE(
        MEDIANX(FILTER('NOTAS_ITEMS', 'NOTAS_ITEMS'[NQTDE] > 0), 'NOTAS_ITEMS'[NQTDE]),
        KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta")
    ),
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

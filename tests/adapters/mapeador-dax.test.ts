/**
 * Suíte de Testes do Mapeador DAX & Normalizador de Payloads
 * Camada: Adapters / Carreiro
 * Requisitos: ORIGINAL_REQUEST R1 & PROJECT.md
 */

import { describe, it, expect } from "vitest";
import {
  limparNomeColunaDax,
  normalizarLinhaDax,
} from "@adapters/carreiro/cliente-dax";
import { criarMapaLojasFonte } from "@adapters/comum/mapa-lojas";
import { FILIAIS_FONTE_REAL } from "../ajuda/clientes-teste";
import {
  extrairIdProduto,
  mapearProdutosDax,
  mapearEstoquesDax,
  mapearHistoricoVendasDax,
  mapearEntradasNFeDax,
  mapearSimilaresDax,
} from "@adapters/carreiro/mapeador-dax";
import { formatarListaNumericaDax } from "@adapters/carreiro/consultas-homologadas";

/** Só para deixar as chamadas abaixo legíveis. */
const criarLinhas = (linhas: Record<string, unknown>[]) => linhas;

describe("Mapeador DAX e Normalizador do Power BI Fabric (Marco 2)", () => {
  describe("limparNomeColunaDax e normalizarLinhaDax", () => {
    it("deve remover prefixos de tabela e colchetes dos nomes de colunas retornados pelo DAX", () => {
      expect(limparNomeColunaDax("PRODUTOS[ACODPRODUTO]")).toBe("ACODPRODUTO");
      expect(limparNomeColunaDax("CADEMP[ANOMEFANTASIA]")).toBe("ANOMEFANTASIA");
      expect(limparNomeColunaDax("[Receita Liquida]")).toBe("Receita Liquida");
      expect(limparNomeColunaDax("MOVESTOQ[DATA_HORA]")).toBe("DATA_HORA");
      expect(limparNomeColunaDax("ColunaSimples")).toBe("ColunaSimples");
    });

    it("deve normalizar um objeto de linha com múltiplas colunas do DAX", () => {
      const linhaBruta = {
        "PRODUTOS[ACODPRODUTO]": 1050,
        "PRODUTOS[ADESCRICAO]": "AMORTECEDOR DIANTEIRO FIAT STRADA",
        "[Receita Liquida]": 14500.5,
        "CADEMP[ANOMEFANTASIA]": "Carreiro Pedro II",
      };

      const linhaNormalizada = normalizarLinhaDax(linhaBruta);

      expect(linhaNormalizada).toEqual({
        ACODPRODUTO: 1050,
        ADESCRICAO: "AMORTECEDOR DIANTEIRO FIAT STRADA",
        "Receita Liquida": 14500.5,
        ANOMEFANTASIA: "Carreiro Pedro II",
      });
    });
  });

  describe("mapearFilialCarreiro", () => {
    it("reconhece as lojas pelos identificadores EXATOS declarados no cadastro", () => {
      const mapa = criarMapaLojasFonte(FILIAIS_FONTE_REAL);

      expect(mapa.resolver("1|e2adc241-50f7-4dcd-9527-423080cd8c5c")).toBe(1);
      expect(mapa.resolver("1|cd87703f-0d8c-447e-9bdf-5c1d790f587b")).toBe(2);
      expect(mapa.resolver("1|a5172ddc-0dd0-4f8e-bb0d-5018183d4457")).toBe(3);
      // Caixa e espaço acidental não derrubam a loja.
      expect(mapa.resolver("  1|C9432ABF-AF64-40D2-ABE3-21124F49B2AE ")).toBe(4);
      // O nome declarado também resolve, para o payload que traz só o nome.
      expect(mapa.resolver("LOJA OESTE")).toBe(5);
    });

    it("NÃO adivinha: loja desconhecida é descartada, nunca vira a matriz", () => {
      const mapa = criarMapaLojasFonte(FILIAIS_FONTE_REAL);

      // Uma loja nova no ERP, um GUID truncado e um nome parecido: tudo isto
      // virava filial 1 em silêncio, somando estoque de lojas diferentes.
      expect(mapa.resolver("1|99999999-0000-0000-0000-000000000000")).toBeNull();
      expect(mapa.resolver("e2adc241")).toBeNull();
      expect(mapa.resolver("Matriz da Loja")).toBeNull();
      expect(mapa.resolver("")).toBeNull();
      expect(mapa.resolver(null)).toBeNull();

      mapa.registrarNaoMapeada("1|99999999-0000-0000-0000-000000000000");
      mapa.registrarNaoMapeada("1|99999999-0000-0000-0000-000000000000");
      expect(mapa.naoMapeadas()).toEqual([
        { identificador: "1|99999999-0000-0000-0000-000000000000", linhasDescartadas: 2 },
      ]);
    });

    it("aceita o número da filial só quando ela existe no cadastro", () => {
      const mapa = criarMapaLojasFonte(FILIAIS_FONTE_REAL);
      expect(mapa.resolver(1)).toBe(1);
      expect(mapa.resolver("2")).toBe(2);
      expect(mapa.resolver(42)).toBeNull();
    });
  });

  describe("mapearProdutosDax", () => {
    it("deve converter linhas DAX em entidades Produto puras com inferência de lote de fábrica", () => {
      const linhasDax = [
        {
          "PRODUTOS[ACODPRODUTO]": 101,
          "PRODUTOS[ADESCRICAO]": "AMORTECEDOR DIANTEIRO NAKATA",
          "PRODUTOS[AMARCA]": "NAKATA",
          "PRODUTOS[AFABRICANTE]": "NAKATA IND",
          "PRODUTOS[AREFFABRICA]": "HG31102",
          "PRODUTOS[ASECAO]": 10,
          "PRODUTOS[ACODFORNECEDOR]": 201,
          "PRODUTOS[NPRECOCOMPRA]": 180.5,
        },
        {
          "PRODUTOS[ACODPRODUTO]": 102,
          "PRODUTOS[ADESCRICAO]": "DISCO DE FREIO VENTILADO FREMAX",
          "PRODUTOS[AMARCA]": "FREMAX",
          "PRODUTOS[AFABRICANTE]": "FREMAX",
          "PRODUTOS[AREFFABRICA]": "BD1234",
          "PRODUTOS[ASECAO]": 20,
          "PRODUTOS[ACODFORNECEDOR]": 202,
          "PRODUTOS[NPRECOCOMPRA]": 95.0,
        },
        {
          "PRODUTOS[ACODPRODUTO]": 103,
          "PRODUTOS[ADESCRICAO]": "VELA DE IGNICAO NGK GREEN",
          "PRODUTOS[AMARCA]": "NGK",
          "PRODUTOS[AFABRICANTE]": "NGK",
          "PRODUTOS[AREFFABRICA]": "BKR6E",
          "PRODUTOS[ASECAO]": 30,
          "PRODUTOS[ACODFORNECEDOR]": 203,
          "PRODUTOS[NPRECOCOMPRA]": 15.0,
        },
        {
          "PRODUTOS[ACODPRODUTO]": 104,
          "PRODUTOS[ADESCRICAO]": "FILTRO DE OLEO MANN",
          "PRODUTOS[AMARCA]": "MANN",
          "PRODUTOS[AFABRICANTE]": "MANN",
          "PRODUTOS[AREFFABRICA]": "W712",
          "PRODUTOS[ASECAO]": 40,
          "PRODUTOS[ACODFORNECEDOR]": 204,
          "PRODUTOS[NPRECOCOMPRA]": 22.0,
        },
      ];

      const produtos = mapearProdutosDax(linhasDax);

      expect(produtos).toHaveLength(4);

      // Amortecedor -> Par (lote = 2)
      expect(produtos[0].id).toBe(101);
      expect(produtos[0].loteMultiplo).toBe(2);

      // Disco de Freio -> Par (lote = 2)
      expect(produtos[1].id).toBe(102);
      expect(produtos[1].loteMultiplo).toBe(2);

      // Vela de Ignição -> Jogo de 4 (lote = 4)
      expect(produtos[2].id).toBe(103);
      expect(produtos[2].loteMultiplo).toBe(4);

      // Filtro de Óleo -> Avulso (lote = 1)
      expect(produtos[3].id).toBe(104);
      expect(produtos[3].loteMultiplo).toBe(1);
    });

    it("deve deduplicar SKUs repetidos em múltiplas filiais", () => {
      const linhasRepetidas = [
        { "PRODUTOS[ACODPRODUTO]": 500, "PRODUTOS[ADESCRICAO]": "PASTILHA FRAS-LE", "PRODUTOS[ACODEMPRESA]": 1 },
        { "PRODUTOS[ACODPRODUTO]": 500, "PRODUTOS[ADESCRICAO]": "PASTILHA FRAS-LE", "PRODUTOS[ACODEMPRESA]": 2 },
      ];

      const produtos = mapearProdutosDax(linhasRepetidas);
      expect(produtos).toHaveLength(1);
      expect(produtos[0].id).toBe(500);
    });
  });

  describe("mapearEstoquesDax e mapearHistoricoVendasDax", () => {
    it("deve indexar posições de estoque pela chave produtoId:filialId", () => {
      const linhasEstoque = [
        {
          "PRODUTOS[ACODPRODUTO]": 1001,
          "PRODUTOS[ACODEMPRESA]": "1|e2adc241-50f7-4dcd-9527-423080cd8c5c",
          "PRODUTOS[NESTOQATUAL]": 35,
          "PRODUTOS_ESTOQUE[AESTOQUE_MINIMO]": 10,
          "PRODUTOS[DULTIMAVENDA]": "2026-08-30",
        },
        {
          "PRODUTOS[ACODPRODUTO]": 1001,
          "PRODUTOS[ACODEMPRESA]": "1|cd87703f-0d8c-447e-9bdf-5c1d790f587b",
          "PRODUTOS[NESTOQATUAL]": 8,
          "PRODUTOS_ESTOQUE[AESTOQUE_MINIMO]": 5,
          "PRODUTOS[DULTIMAVENDA]": "2026-08-20",
        },
      ];

      const estoques = mapearEstoquesDax(linhasEstoque, { mapaLojas: criarMapaLojasFonte(FILIAIS_FONTE_REAL) });

      expect(estoques.size).toBe(2);
      expect(estoques.get("1001:1")?.saldoFisico).toBe(35);
      expect(estoques.get("1001:1")?.estoqueMinimoSeguranca).toBe(10);
      expect(estoques.get("1001:2")?.saldoFisico).toBe(8);
      expect(estoques.get("1001:2")?.estoqueMinimoSeguranca).toBe(5);
    });

    it("deve mapear histórico agregado de vendas com janelas comparativas", () => {
      const linhasVenda = [
        {
          "PRODUTOS[ACODPRODUTO]": 2001,
          "CADEMP[ACODEMP]": 1,
          VendasQtd30d: 15,
          VendasQtd60d: 30,
          VendasQtd90d: 45,
          VendasQtd180d: 90,
          NotasVenda90d: 18,
          MesesAtivos12m: 9,
          MedianaLinhaVenda: 3,
        },
      ];

      const historicos = mapearHistoricoVendasDax(linhasVenda, criarMapaLojasFonte(FILIAIS_FONTE_REAL));
      const hist = historicos.get("2001:1");

      expect(hist).toBeDefined();
      expect(hist?.vendasLiquidas30dias).toBe(15);
      expect(hist?.vendasLiquidas60dias).toBe(30);
      expect(hist?.vendasLiquidas90dias).toBe(45);
      expect(hist?.vendasLiquidas180dias).toBe(90);
      expect(hist?.notasFiscaisVenda90dias).toBe(18);
      expect(hist?.mesesAtivos12meses).toBe(9);
      expect(hist?.medianaLinhaVenda).toBe(3);
    });

    it("subtrai as devoluções para obter a saída líquida", () => {
      const historicos = mapearHistoricoVendasDax(criarLinhas([
        {
          "PRODUTOS[ACODPRODUTO]": 2002,
          "CADEMP[ACODEMP]": 1,
          VendasQtd30d: 20,
          VendasQtd90d: 50,
          VendasQtd180d: 100,
          Devolucoes90d: 10,
          NotasVenda90d: 12,
        },
      ]), criarMapaLojasFonte(FILIAIS_FONTE_REAL));
      const hist = historicos.get("2002:1");
      expect(hist?.vendasLiquidas90dias).toBe(40);
      expect(hist?.vendasLiquidas180dias).toBe(90);
      expect(hist?.devolucoes90dias).toBe(10);
    });

    it("declara a ruptura como NÃO MEDIDA em vez de devolver zero silencioso", () => {
      const historicos = mapearHistoricoVendasDax(criarLinhas([
        { "PRODUTOS[ACODPRODUTO]": 2003, "CADEMP[ACODEMP]": 1, VendasQtd90d: 10 },
      ]), criarMapaLojasFonte(FILIAIS_FONTE_REAL));
      const hist = historicos.get("2003:1");
      // Zero aqui significaria "nunca faltou", que seria uma afirmação falsa.
      expect(hist?.camposIndisponiveis).toContain("diasRuptura90dias");
    });
  });

  describe("extrairIdProduto e Chaves Compostas do Power BI", () => {
    it("deve extrair o ID numérico correto de chaves compostas com GUID ou códigos com zeros à esquerda", () => {
      expect(extrairIdProduto("000001|a5172ddc-0dd0-4f8e-bb0d-5018183d4457")).toBe(1);
      expect(extrairIdProduto("000123|e2adc241-50f7-4dcd-9527-423080cd8c5c")).toBe(123);
      expect(extrairIdProduto("4560")).toBe(4560);
      expect(extrairIdProduto(789)).toBe(789);
      expect(extrairIdProduto(null)).toBe(0);
      expect(extrairIdProduto(undefined)).toBe(0);
      expect(extrairIdProduto("")).toBe(0);
    });

    it("deve mapear corretamente linhas DAX brutas com chaves compostas de Produto e Empresa", () => {
      const linhasCompostas = [
        {
          Produto: "000001|a5172ddc-0dd0-4f8e-bb0d-5018183d4457",
          Empresa: "1|a5172ddc-0dd0-4f8e-bb0d-5018183d4457",
          Descricao: "RETENTOR POLIA OPALA",
          EstoqueQtd: "5.0",
          PrecoCompraERP: "45.0",
        },
      ];

      const produtos = mapearProdutosDax(linhasCompostas);
      expect(produtos).toHaveLength(1);
      expect(produtos[0].id).toBe(1);
      expect(produtos[0].codigoSku).toBe("000001");
      expect(produtos[0].descricao).toBe("RETENTOR POLIA OPALA");

      const estoques = mapearEstoquesDax(linhasCompostas, {
        mapaLojas: criarMapaLojasFonte(FILIAIS_FONTE_REAL),
      });
      expect(estoques.get("1:3")).toBeDefined();
      expect(estoques.get("1:3")?.saldoFisico).toBe(5);
    });
  });

  describe("formatarListaNumericaDax", () => {
    it("deve formatar cláusula DAX IN com segurança estrita contra injeção", () => {
      expect(formatarListaNumericaDax([101, 102, 103])).toBe("{ 101, 102, 103 }");
      expect(formatarListaNumericaDax([])).toBe("{ -1 }");
      // Ignora negativos ou não-inteiros
      expect(formatarListaNumericaDax([10, -5, 20.7, 30])).toBe("{ 10, 30 }");
    });
  });
});


/**
 * Trava de catálogo: serviço não é mercadoria.
 *
 * A Rede Carreiro fatura mão de obra (balanceamento, troca de amortecedor) pela
 * MESMA tabela PRODUTOS das peças, com nota de venda tipo 01. Medido ao vivo no
 * modelo do cliente em 15/09/2026: 265 linhas na classe 1107 "SERVICOS MECANICOS"
 * (53 SKUs x 5 lojas), 51 deles com venda nos últimos 180 dias — o balanceamento
 * sozinho com 192 unidades e 72 notas em 12 meses.
 *
 * Para o motor, um serviço é o item perfeito de compra: demanda recorrente
 * comprovada e saldo físico eternamente zero. Ele sugeria comprar 26 balanceamentos.
 * A trava tem de agir na FRONTEIRA DE ENTRADA — serviço não vira Produto —,
 * senão ele continua contando nas KPIs de peças sugeridas e de ruptura.
 */
describe("Catálogo: classes do ERP que não são mercadoria comprável", () => {
  // Códigos reais lidos do modelo semântico da Carreiro em 15/09/2026.
  const CLASSES_NAO_COMPRAVEIS = [
    { codigoBase: 1107, nome: "SERVICOS MECANICOS", motivo: "Mão de obra faturada como produto." },
  ];

  /** Linha de serviço como o DAX devolve (prefixo da loja embutido na classe). */
  const linhaServico = (prefixoLoja: number) => ({
    "[Produto]": `029521|guid-loja-${prefixoLoja}`,
    "[Descricao]": "SERVICO BALANCEAMENTO",
    "[Marca]": "SERVICO MECANICO",
    "[Secao]": prefixoLoja * 1_000_000_000_000 + 1107,
    "[NomeSecao]": "SERVICOS MECANICOS",
    "[Fornecedor]": null,
    "[PrecoCompraERP]": 0,
    "[PrecoVenda]": 12.5,
  });

  const linhaPeca = {
    "[Produto]": "005174|guid-loja-1",
    "[Descricao]": "INFORCA GATO 400X4.80MM",
    "[Marca]": "FRONTEC",
    "[Secao]": 1_000_000_000_260,
    "[NomeSecao]": "ABRACADEIRA ESCAPAMENTO",
    "[Fornecedor]": 98,
    "[PrecoCompraERP]": 0.42,
    "[PrecoVenda]": 1.2,
  };

  it("deve descartar o serviço declarado pelo tenant e preservar a peça", () => {
    const produtos = mapearProdutosDax([linhaServico(1), linhaPeca], {
      classesNaoCompraveis: CLASSES_NAO_COMPRAVEIS,
    });

    expect(produtos.map((p) => p.codigoSku)).toEqual(["005174"]);
  });

  it("deve descartar a classe em TODAS as lojas, apesar do prefixo de empresa no código", () => {
    // O ERP prefixa a classe com a empresa: 1107 chega como 1000000001107 na loja 1
    // e 5000000001107 na loja 5. Comparar o código cru deixaria 4 lojas passarem.
    const linhas = [1, 2, 3, 4, 5].map(linhaServico);
    const produtos = mapearProdutosDax(linhas, { classesNaoCompraveis: CLASSES_NAO_COMPRAVEIS });

    expect(produtos).toHaveLength(0);
  });

  it("não deve descartar nada quando o tenant não declara classe alguma", () => {
    // Sem declaração não há regra: o mapeador NÃO adivinha serviço pela descrição.
    const produtos = mapearProdutosDax([linhaServico(1), linhaPeca], { classesNaoCompraveis: [] });

    expect(produtos).toHaveLength(2);
  });

  it("deve preservar fornecedor cujo nome de classe contém SERVI", () => {
    // "REGENCE VEICULOS PECAS E SERVI" (classe 915) e "PREMIUM CAR SERVICE" (314)
    // são fornecedores de peça de verdade cadastrados como classe. Uma regra por
    // texto os derrubaria junto; a regra é por CÓDIGO declarado.
    const linhaRegence = {
      "[Produto]": "012345|guid-loja-1",
      "[Descricao]": "PARABRISA GOL G5",
      "[Marca]": "REGENCE VEICULOS PECAS E SERVI",
      "[Secao]": 1_000_000_000_915,
      "[NomeSecao]": "REGENCE VEICULOS PECAS E SERVI",
      "[Fornecedor]": 77,
      "[PrecoCompraERP]": 320,
      "[PrecoVenda]": 480,
    };

    const produtos = mapearProdutosDax([linhaRegence, linhaServico(1)], {
      classesNaoCompraveis: CLASSES_NAO_COMPRAVEIS,
    });

    expect(produtos.map((p) => p.codigoSku)).toEqual(["012345"]);
  });
});

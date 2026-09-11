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
import {
  extrairIdProduto,
  mapearFilialCarreiro,
  mapearProdutosDax,
  mapearEstoquesDax,
  mapearHistoricoVendasDax,
  mapearEntradasNFeDax,
  mapearSimilaresDax,
} from "@adapters/carreiro/mapeador-dax";
import { formatarListaNumericaDax } from "@adapters/carreiro/consultas-homologadas";

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
    it("deve reconhecer os GUIDs oficiais das 5 lojas da Rede Carreiro mapeadas no M0", () => {
      // 1. Matriz Pedro II
      const filial1 = mapearFilialCarreiro("1|e2adc241-50f7-4dcd-9527-423080cd8c5c");
      expect(filial1.filialId).toBe(1);
      expect(filial1.nomeFilial).toContain("Pedro II");

      // 2. Melo / Piripiri
      const filial2 = mapearFilialCarreiro("1|cd87703f-0d8c-447e-9bdf-5c1d790f587b");
      expect(filial2.filialId).toBe(2);
      expect(filial2.nomeFilial).toContain("Piripiri");

      // 3. Poranga
      const filial3 = mapearFilialCarreiro("1|a5172ddc-0dd0-4f8e-bb0d-5018183d4457");
      expect(filial3.filialId).toBe(3);
      expect(filial3.nomeFilial).toContain("Poranga");

      // 4. Ceará Auto Peças (Campo Maior)
      const filial4 = mapearFilialCarreiro("1|c9432abf-af64-40d2-abe3-21124f49b2ae");
      expect(filial4.filialId).toBe(4);
      expect(filial4.nomeFilial).toContain("Campo Maior");

      // 5. José de Freitas
      const filial5 = mapearFilialCarreiro("1|d624d502-59a4-4ab2-910b-99ae9bf7462a");
      expect(filial5.filialId).toBe(5);
      expect(filial5.nomeFilial).toContain("José de Freitas");
    });

    it("deve aceitar identificadores numéricos ou nomes parciais", () => {
      expect(mapearFilialCarreiro(1).filialId).toBe(1);
      expect(mapearFilialCarreiro(2).filialId).toBe(2);
      expect(mapearFilialCarreiro("Piripiri").filialId).toBe(2);
      expect(mapearFilialCarreiro("Poranga").filialId).toBe(3);
      expect(mapearFilialCarreiro("Ceará Auto Peças").filialId).toBe(4);
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

      const estoques = mapearEstoquesDax(linhasEstoque);

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
          VendasQtd90d: 45,
          VendasQtd180d: 90,
          NotasVenda90d: 18,
          MesesAtivos12m: 9,
          MedianaLinhaVenda: 3,
        },
      ];

      const historicos = mapearHistoricoVendasDax(linhasVenda);
      const hist = historicos.get("2001:1");

      expect(hist).toBeDefined();
      expect(hist?.vendasLiquidas30dias).toBe(15);
      expect(hist?.vendasLiquidas90dias).toBe(45);
      expect(hist?.vendasLiquidas180dias).toBe(90);
      expect(hist?.notasFiscaisVenda90dias).toBe(18);
      expect(hist?.mesesAtivos12meses).toBe(9);
      expect(hist?.medianaLinhaVenda).toBe(3);
    });

    it("subtrai as devoluções para obter a saída líquida", () => {
      const historicos = mapearHistoricoVendasDax([
        {
          "PRODUTOS[ACODPRODUTO]": 2002,
          "CADEMP[ACODEMP]": 1,
          VendasQtd30d: 20,
          VendasQtd90d: 50,
          VendasQtd180d: 100,
          Devolucoes90d: 10,
          NotasVenda90d: 12,
        },
      ]);
      const hist = historicos.get("2002:1");
      expect(hist?.vendasLiquidas90dias).toBe(40);
      expect(hist?.vendasLiquidas180dias).toBe(90);
      expect(hist?.devolucoes90dias).toBe(10);
    });

    it("declara a ruptura como NÃO MEDIDA em vez de devolver zero silencioso", () => {
      const historicos = mapearHistoricoVendasDax([
        { "PRODUTOS[ACODPRODUTO]": 2003, "CADEMP[ACODEMP]": 1, VendasQtd90d: 10 },
      ]);
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

      const estoques = mapearEstoquesDax(linhasCompostas);
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


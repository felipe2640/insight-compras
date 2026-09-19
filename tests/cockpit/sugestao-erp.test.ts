import { describe, it, expect } from "vitest";
import { mapearSugestoesErpDax } from "@adapters/carreiro/mapeador-dax";
import { ehLinhaAcionavel, contarStatusGrade } from "@/lib/cockpit/escopo-grade";
import { filtrarLinhasCockpit } from "@/hooks/useFiltrosCockpit";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { RespostaCargaInventario } from "@adapters/AdaptadorInventario";

function criarLinhaMock(parciais: Partial<LinhaCockpitMatriz>): LinhaCockpitMatriz {
  return {
    produtoId: 101,
    codigoSku: "SKU-001",
    descricao: "PASTILHA DE FREIO DIANTEIRA",
    marca: "FRAS-LE",
    fabricante: "FRAS-LE",
    referenciaFabricante: "PD/58",
    aplicacaoVeicular: "GOL/VOYAGE",
    secaoId: 1,
    secaoNome: "Freio",
    subgrupo: "Pastilha",
    fornecedorId: 500,
    nomeFornecedor: "DISTRIBUIDORA BRASIL",
    precoCusto: 50.0,
    precoVenda: 90.0,
    curvaAbc: "A",
    perfilGiro: "ALTO_GIRO",
    rupturaDiasAnalisados: 90,
    rupturaDiasZerados: 0,
    rupturaPercentual: 0,
    classificacaoRuptura: "Boa",
    dataUltimoZeramento: null,
    vendaPerdidaEstimadaReais: 0,
    notasVenda90d: 30,
    notasDevolucao90d: 0,
    notasLiquidas90d: 30,
    frequenciaPercentual90d: 33,
    classificacaoFrequencia: "Alta",
    totalPecasVendidas90d: 60,
    extratoFrequencia90d: [],
    vendasLiquidas30d: 20,
    consumoMedioDiario30d: 0.67,
    diasCobertura30d: 15,
    vendasLiquidas90d: 60,
    consumoMedioDiario90d: 0.67,
    diasCobertura90d: 15,
    vendasLiquidas180d: 120,
    consumoMedioDiario180d: 0.67,
    diasCobertura180d: 15,
    tendenciaCobertura: "ESTAVEL",
    isMarcaZumbi: false,
    filialFocoId: 1,
    filialFocoNome: "Loja 01 - Pedro II",
    estoqueLojaFoco: 10,
    estoqueMinimoLojaFoco: 5,
    quantidadeJaPedidaFoco: 0,
    estoqueOutrasLojasRede: 20,
    sugestaoFinalCompra: 0,
    previsaoBrutaModelo: 0,
    horizonteDiasAplicado: 30,
    margemSegurancaAplicada: 1.2,
    fatorCalibracaoAplicado: 1.0,
    motivoInelegibilidade: null,
    statusSugestao: "ESTOQUE_SUFICIENTE",
    motivoDecisao: "Estoque suficiente",
    loteMultiplo: 1,
    embalagemMinima: 1,
    pedidoCustom: 0,
    transferenciaCustom: 0,
    filialOrigemTransferenciaId: null,
    filialOrigemTransferenciaNome: null,
    saldoOrigemTransferencia: 0,
    estoqueMinimoOrigemTransferencia: 0,
    sobraRealOrigemTransferencia: 0,
    necessidadeDestinoTransferencia: 0,
    quantidadeTransferenciaSugerida: 0,
    similares: [],
    entradasHoje: [],
    sugestaoQtdErp: 0,
    temSugestaoErp: false,
    ...parciais,
  };
}

describe("Sugestão Hoje do ERP (SUGESTAO_ERP)", () => {
  describe("Mapeador DAX de Sugestões do ERP", () => {
    it("deve mapear linhas brutas de TBL_SOLICITACOES_COMPRAS para SugestaoCompraERPItem", () => {
      const linhasBrutas = [
        {
          "TBL_SOLICITACOES_COMPRAS[ACODPRODUTO]": "002640",
          "TBL_SOLICITACOES_COMPRAS[ACODEMPRESA]": "1|e2adc241-50f7-4dcd-9527-423080cd8c5c",
          "TBL_SOLICITACOES_COMPRAS[QTD_SOLICITADA]": 15,
          "TBL_SOLICITACOES_COMPRAS[DESCRICAO]": "SOLICITAÇÃO PARA REPOSIÇÃO DE ESTOQUE",
          "TBL_SOLICITACOES_COMPRAS[DH_CRIACAO]": "2026-09-15T08:30:00",
          "TBL_SOLICITACOES_COMPRAS[ORIGEM]": "ERP_REPOSICAO",
          "TBL_SOLICITACOES_COMPRAS[STATUS]": "A",
        },
        {
          "TBL_SOLICITACOES_COMPRAS[ACODPRODUTO]": 3500,
          "TBL_SOLICITACOES_COMPRAS[ACODEMPRESA]": "1|cd87703f-0d8c-447e-9bdf-5c1d790f587b",
          "TBL_SOLICITACOES_COMPRAS[QTD_SOLICITADA]": "8",
          "TBL_SOLICITACOES_COMPRAS[DESCRICAO]": "SOLICITAÇÃO PARA REPOSIÇÃO DE ESTOQUE",
          "TBL_SOLICITACOES_COMPRAS[DH_CRIACAO]": "2026-09-15T09:15:00",
        },
        {
          // Quantidade zerada ou inválida deve ser ignorada
          "TBL_SOLICITACOES_COMPRAS[ACODPRODUTO]": 9999,
          "TBL_SOLICITACOES_COMPRAS[ACODEMPRESA]": "1|e2adc241-50f7-4dcd-9527-423080cd8c5c",
          "TBL_SOLICITACOES_COMPRAS[QTD_SOLICITADA]": 0,
        },
      ];

      const resultado = mapearSugestoesErpDax(linhasBrutas);

      expect(resultado.size).toBe(2);
      expect(resultado.get("2640:1")).toEqual({
        produtoId: 2640,
        filialId: 1,
        quantidadeSugerida: 15,
        origem: "ERP_REPOSICAO",
        descricao: "SOLICITAÇÃO PARA REPOSIÇÃO DE ESTOQUE",
        dataSugestao: "2026-09-15",
        solicitador: undefined,
      });
      expect(resultado.get("3500:2")).toEqual({
        produtoId: 3500,
        filialId: 2,
        quantidadeSugerida: 8,
        origem: "REPOSICAO_ESTOQUE",
        descricao: "SOLICITAÇÃO PARA REPOSIÇÃO DE ESTOQUE",
        dataSugestao: "2026-09-15",
        solicitador: undefined,
      });
    });
  });

  describe("Classificação de Linha Acionável e Contagem de Status", () => {
    it("deve considerar acionável uma linha que possui sugestão do ERP mesmo sem pedido ou transferência", () => {
      const linhaSemAcao = criarLinhaMock({
        sugestaoFinalCompra: 0,
        quantidadeTransferenciaSugerida: 0,
        classificacaoRuptura: "Boa",
        isMarcaZumbi: false,
        sugestaoQtdErp: 0,
        temSugestaoErp: false,
      });
      expect(ehLinhaAcionavel(linhaSemAcao)).toBe(false);

      const linhaComSugestaoErp = criarLinhaMock({
        sugestaoFinalCompra: 0,
        quantidadeTransferenciaSugerida: 0,
        classificacaoRuptura: "Boa",
        isMarcaZumbi: false,
        sugestaoQtdErp: 12,
        temSugestaoErp: true,
      });
      expect(ehLinhaAcionavel(linhaComSugestaoErp)).toBe(true);
    });

    it("deve contabilizar corretamente o status sugestaoErp em contarStatusGrade", () => {
      const linhas = [
        criarLinhaMock({ produtoId: 1, sugestaoFinalCompra: 5 }),
        criarLinhaMock({ produtoId: 2, quantidadeTransferenciaSugerida: 3 }),
        criarLinhaMock({ produtoId: 3, classificacaoRuptura: "Grave" }),
        criarLinhaMock({ produtoId: 4, isMarcaZumbi: true }),
        criarLinhaMock({ produtoId: 5, sugestaoQtdErp: 10, temSugestaoErp: true }),
        criarLinhaMock({ produtoId: 6, sugestaoFinalCompra: 4, sugestaoQtdErp: 4, temSugestaoErp: true }),
      ];

      const contagens = contarStatusGrade(linhas);

      expect(contagens.total).toBe(6);
      expect(contagens.pedir).toBe(2); // ID 1 e ID 6
      expect(contagens.transferir).toBe(1); // ID 2
      expect(contagens.ruptura).toBe(1); // ID 3
      expect(contagens.zumbi).toBe(1); // ID 4
      expect(contagens.sugestaoErp).toBe(2); // ID 5 e ID 6
    });
  });

  describe("Filtragem de Cockpit com StatusFilterOption SUGESTAO_ERP", () => {
    it("deve filtrar exclusivamente linhas com sugestão do ERP quando o filtro for SUGESTAO_ERP", () => {
      const linhas = [
        criarLinhaMock({ produtoId: 1, codigoSku: "SKU-001", sugestaoQtdErp: 0, temSugestaoErp: false }),
        criarLinhaMock({ produtoId: 2, codigoSku: "SKU-002", sugestaoQtdErp: 15, temSugestaoErp: true }),
        criarLinhaMock({ produtoId: 3, codigoSku: "SKU-003", sugestaoQtdErp: 0, temSugestaoErp: false }),
        criarLinhaMock({ produtoId: 4, codigoSku: "SKU-004", sugestaoQtdErp: 2, temSugestaoErp: true }),
      ];

      const filtradas = filtrarLinhasCockpit(linhas, {
        query: "",
        statusFiltro: "SUGESTAO_ERP",
      });

      expect(filtradas).toHaveLength(2);
      expect(filtradas.map((l) => l.produtoId)).toEqual([2, 4]);
    });
  });

  describe("Gerador de Linhas da Matriz com Sugestões do ERP", () => {
    it("deve injetar sugestaoQtdErp, temSugestaoErp e metadados no item da matriz correspondente à filial", () => {
      const respostaCarga = {
        produtos: [
          {
            id: 2640,
            codigoSku: "SKU-2640",
            descricao: "BIELETA DIANTEIRA COROLLA",
            marca: "COFAP",
            fabricante: "COFAP",
            referenciaFabricante: "COF-123",
            aplicacaoVeicular: "COROLLA",
            familiaId: null,
            secaoId: 1,
            nomeSecao: "Suspensão",
            fornecedorId: 500,
            nomeFornecedor: "FORNECEDOR",
            precoCusto: 45.0,
            precoVenda: 80.0,
            loteMultiplo: 1,
          },
          {
            id: 2641,
            codigoSku: "SKU-2641",
            descricao: "TERMINAL DE DIRECAO",
            marca: "TRW",
            fabricante: "TRW",
            referenciaFabricante: "TRW-456",
            aplicacaoVeicular: "COROLLA",
            familiaId: null,
            secaoId: 1,
            nomeSecao: "Direção",
            fornecedorId: 500,
            nomeFornecedor: "FORNECEDOR",
            precoCusto: 35.0,
            precoVenda: 65.0,
            loteMultiplo: 1,
          },
        ],
        estoques: new Map([
          ["2640:1", { filialId: 1, nomeFilial: "Loja 01", produtoId: 2640, saldoFisico: 2, estoqueMinimoSeguranca: 5, quantidadeJaPedida: 0, consumoMedioDiarioErp: 0, diasSemVenda: null, sinalGovernancaCompra: null, usoLimiteCompra: null, margemRealizada: null, margemAlvo: null }],
          ["2640:2", { filialId: 2, nomeFilial: "Loja 02", produtoId: 2640, saldoFisico: 10, estoqueMinimoSeguranca: 3, quantidadeJaPedida: 0, consumoMedioDiarioErp: 0, diasSemVenda: null, sinalGovernancaCompra: null, usoLimiteCompra: null, margemRealizada: null, margemAlvo: null }],
          ["2641:1", { filialId: 1, nomeFilial: "Loja 01", produtoId: 2641, saldoFisico: 10, estoqueMinimoSeguranca: 4, quantidadeJaPedida: 0, consumoMedioDiarioErp: 0, diasSemVenda: null, sinalGovernancaCompra: null, usoLimiteCompra: null, margemRealizada: null, margemAlvo: null }],
          ["2641:2", { filialId: 2, nomeFilial: "Loja 02", produtoId: 2641, saldoFisico: 10, estoqueMinimoSeguranca: 4, quantidadeJaPedida: 0, consumoMedioDiarioErp: 0, diasSemVenda: null, sinalGovernancaCompra: null, usoLimiteCompra: null, margemRealizada: null, margemAlvo: null }],
        ]),
        historicos: new Map(),
        entradasHoje: [],
        similares: new Map(),
        sugestoesErp: new Map([
          [
            "2640:1",
            {
              produtoId: 2640,
              filialId: 1,
              quantidadeSugerida: 24,
              origem: "REPOSICAO AUTOMATICA",
              dataSugestao: "2026-09-15T07:00:00",
            },
          ],
          // Sugestão para filial 2 — não deve contaminar a filial foco 1
          [
            "2641:2",
            {
              produtoId: 2641,
              filialId: 2,
              quantidadeSugerida: 10,
              origem: "REPOSICAO LOJA 2",
              dataSugestao: "2026-09-15T07:00:00",
            },
          ],
        ]),
        metadados: {
          provedor: "POWERBI_FABRIC_DAX" as const,
          timestampCarga: "2026-09-15T12:00:00Z",
          emModoDegradado: false,
          totalSkusCarregados: 2,
          latenciaMs: 150,
        },
      } as unknown as RespostaCargaInventario;

      const linhas = converterParaLinhasCockpit(respostaCarga, { filialFocoId: 1 });

      const linha2640 = linhas.find((l) => l.produtoId === 2640);
      expect(linha2640).toBeDefined();
      expect(linha2640?.sugestaoQtdErp).toBe(24);
      expect(linha2640?.temSugestaoErp).toBe(true);
      expect(linha2640?.origemSugestaoErp).toBe("REPOSICAO AUTOMATICA");
      expect(linha2640?.dataSugestaoErp).toBe("2026-09-15T07:00:00");

      const linha2641 = linhas.find((l) => l.produtoId === 2641);
      expect(linha2641).toBeDefined();
      expect(linha2641?.sugestaoQtdErp).toBeNull();
      expect(linha2641?.temSugestaoErp).toBe(false);
    });

    it("deve ajustar sugestaoQtdErp e pré-preencher Pedido com a quantidade mínima registrada quando a requisição for unitária", () => {
      const carga = {
        produtos: [
          {
            id: 101,
            codigoSku: "SKU-MIN-5",
            descricao: "PASTILHA FREIO DIANT",
            marca: "FRAS-LE",
            fabricante: "FRAS-LE",
            precoCusto: 50.0,
            precoVenda: 100.0,
            loteMultiplo: 1,
          },
          {
            id: 102,
            codigoSku: "SKU-MIN-PAR",
            descricao: "AMORTECEDOR DIANT",
            marca: "COFAP",
            fabricante: "COFAP",
            precoCusto: 120.0,
            precoVenda: 220.0,
            loteMultiplo: 2, // Múltiplo par
          },
          {
            id: 103,
            codigoSku: "SKU-LOT-4",
            descricao: "VELA DE IGNICAO",
            marca: "NGK",
            fabricante: "NGK",
            precoCusto: 15.0,
            precoVenda: 30.0,
            loteMultiplo: 4, // Jogo com 4
          },
        ],
        estoques: new Map([
          // SKU 101: estoque mínimo 5, solicitação ERP de 1 un -> deve virar 5
          ["101:1", { filialId: 1, nomeFilial: "Loja 01", produtoId: 101, saldoFisico: 0, estoqueMinimoSeguranca: 5, quantidadeJaPedida: 0, consumoMedioDiarioErp: 0 }],
          // SKU 102: estoque mínimo 5, múltiplo 2, solicitação ERP de 1 un -> deve virar 6 (múltiplo de 2)
          ["102:1", { filialId: 1, nomeFilial: "Loja 01", produtoId: 102, saldoFisico: 0, estoqueMinimoSeguranca: 5, quantidadeJaPedida: 0, consumoMedioDiarioErp: 0 }],
          // SKU 103: estoque mínimo 0, lote múltiplo 4, solicitação ERP de 1 un -> deve virar 4
          ["103:1", { filialId: 1, nomeFilial: "Loja 01", produtoId: 103, saldoFisico: 0, estoqueMinimoSeguranca: 0, quantidadeJaPedida: 0, consumoMedioDiarioErp: 0 }],
        ]),
        historicos: new Map(),
        entradasHoje: [],
        similares: new Map(),
        sugestoesErp: new Map([
          ["101:1", { produtoId: 101, filialId: 1, quantidadeSugerida: 1, origem: "SOLICITACAO BALCAO" }],
          ["102:1", { produtoId: 102, filialId: 1, quantidadeSugerida: 1, origem: "SOLICITACAO BALCAO" }],
          ["103:1", { produtoId: 103, filialId: 1, quantidadeSugerida: 1, origem: "SOLICITACAO BALCAO" }],
        ]),
        metadados: {
          provedor: "POWERBI_FABRIC_DAX",
          timestampCarga: "2026-09-19T12:00:00Z",
          emModoDegradado: false,
          totalSkusCarregados: 3,
          latenciaMs: 100,
        },
      } as unknown as RespostaCargaInventario;

      const linhas = converterParaLinhasCockpit(carga, { filialFocoId: 1 });

      const l101 = linhas.find((l) => l.produtoId === 101);
      expect(l101?.sugestaoQtdErp).toBe(5);
      expect(l101?.sugestaoCompra).toBe(5);
      expect(l101?.pedidoCustom).toBe(5);
      expect(l101?.statusMovimentacao).toBe("Sugestão ERP");

      const l102 = linhas.find((l) => l.produtoId === 102);
      expect(l102?.sugestaoQtdErp).toBe(6); // 5 arredondado para múltiplo 2
      expect(l102?.sugestaoCompra).toBe(6);
      expect(l102?.pedidoCustom).toBe(6);
      expect(l102?.statusMovimentacao).toBe("Sugestão ERP");

      const l103 = linhas.find((l) => l.produtoId === 103);
      expect(l103?.sugestaoQtdErp).toBe(4); // Lote múltiplo de fábrica
      expect(l103?.sugestaoCompra).toBe(4);
      expect(l103?.pedidoCustom).toBe(4);
      expect(l103?.statusMovimentacao).toBe("Sugestão ERP");
    });
  });
});

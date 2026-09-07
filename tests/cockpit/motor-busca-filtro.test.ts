import { describe, it, expect } from "vitest";
import {
  normalizarTexto,
  preIndexarLinhaMatriz,
  preIndexarListaMatriz,
  filtrarLinhasCockpit,
} from "@/hooks/useFiltrosCockpit";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";

function criarItemMock(parciais: Partial<LinhaCockpitMatriz>): LinhaCockpitMatriz {
  return {
    produtoId: 101,
    codigoSku: "AM-MON-001",
    descricao: "AMORTECEDOR DIANTEIRO COROLLA MONROE",
    marca: "MONROE",
    fabricante: "TENNECO",
    referenciaFabricante: "G7012",
    aplicacaoVeicular: "TOYOTA COROLLA 2015-2022",
    secaoId: 10,
    secaoNome: "Suspensão",
    fornecedorId: 501,
    nomeFornecedor: "DISTRIBUIDORA MONROE",
    precoCusto: 250.0,
    precoVenda: 390.0,
    curvaAbc: "A",
    perfilGiro: "ALTO_GIRO",
    rupturaDiasAnalisados: 90,
    rupturaDiasZerados: 5,
    rupturaPercentual: 5.5,
    classificacaoRuptura: "Atenção",
    dataUltimoZeramento: "01/09/2026",
    vendaPerdidaEstimadaReais: 350.0,
    notasVenda90d: 30,
    notasDevolucao90d: 2,
    notasLiquidas90d: 28,
    frequenciaPercentual90d: 31.1,
    classificacaoFrequencia: "Média",
    totalPecasVendidas90d: 65,
    extratoFrequencia90d: [],
    vendasLiquidas30d: 22,
    consumoMedioDiario30d: 0.73,
    diasCobertura30d: 13.6,
    vendasLiquidas90d: 65,
    consumoMedioDiario90d: 0.72,
    diasCobertura90d: 13.8,
    vendasLiquidas180d: 130,
    consumoMedioDiario180d: 0.72,
    diasCobertura180d: 13.8,
    tendenciaCobertura: "ESTAVEL",
    isMarcaZumbi: false,
    filialFocoId: 1,
    filialFocoNome: "Loja 01 - Trairi",
    estoqueLojaFoco: 10,
    estoqueMinimoLojaFoco: 8,
    quantidadeJaPedidaFoco: 0,
    estoqueOutrasLojasRede: 15,
    sugestaoFinalCompra: 8,
    statusSugestao: "APROVADO_COMPRA",
    motivoDecisao: "Consumo comprovado com risco de ruptura",
    loteMultiplo: 2,
    embalagemMinima: 2,
    pedidoCustom: 8,
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
    ...parciais,
  };
}

describe("Cockpit — Motor de Busca e Filtros em Memória", () => {
  it("deve normalizar texto removendo acentos diacríticos e letras maiúsculas", () => {
    expect(normalizarTexto("Amortecedor Diant. Suspensão")).toBe("amortecedor diant. suspensao");
    expect(normalizarTexto("PÁRA-BRISA TRASEIRO & ILUMINAÇÃO")).toBe("para-brisa traseiro & iluminacao");
    expect(normalizarTexto("")).toBe("");
  });

  it("deve pré-indexar SKU gerando string de busca normalizada com todos os campos relevantes", () => {
    const item = criarItemMock({
      codigoSku: "AM-COF-002",
      descricao: "Amortecedor Traseiro Gol G5",
      marca: "COFAP",
      fabricante: "MAGNETI MARELLI",
      referenciaFabricante: "GB27312",
      aplicacaoVeicular: "VW GOL 2008-2016",
    });

    const indexado = preIndexarLinhaMatriz(item);
    expect(indexado._searchIndex).toContain("am-cof-002");
    expect(indexado._searchIndex).toContain("amortecedor traseiro gol g5");
    expect(indexado._searchIndex).toContain("magneti marelli");
    expect(indexado._searchIndex).toContain("vw gol 2008-2016");
  });

  it("deve buscar por múltiplos tokens em ordem arbitrária (ex: 'amort tras gol')", () => {
    const itens = preIndexarListaMatriz([
      criarItemMock({
        codigoSku: "AM-001",
        descricao: "AMORTECEDOR TRASEIRO VW GOL",
        marca: "COFAP",
      }),
      criarItemMock({
        codigoSku: "AM-002",
        descricao: "AMORTECEDOR DIANTEIRO VW GOL",
        marca: "COFAP",
      }),
      criarItemMock({
        codigoSku: "DISC-001",
        descricao: "DISCO DE FREIO DIANTEIRO COROLLA",
        marca: "FREMAX",
      }),
    ]);

    const resultado = filtrarLinhasCockpit(itens, {
      query: "amort tras gol",
      fornecedoresPermitidos: null,
      marcasDeselecionadas: new Set(),
      secoesDeselecionadas: new Set(),
      curvasDeselecionadas: new Set(),
      statusFiltro: "ALL",
    });

    expect(resultado).toHaveLength(1);
    expect(resultado[0].codigoSku).toBe("AM-001");
  });

  it("deve aplicar restrição estrita de fornecedores da carteira do comprador (RBAC)", () => {
    const itens = preIndexarListaMatriz([
      criarItemMock({ codigoSku: "SKU-MONROE", fornecedorId: 501 }),
      criarItemMock({ codigoSku: "SKU-BOSCH", fornecedorId: 502 }),
      criarItemMock({ codigoSku: "SKU-NAKATA", fornecedorId: 503 }),
    ]);

    // Comprador só tem acesso ao fornecedor 501
    const resultado = filtrarLinhasCockpit(itens, {
      query: "",
      fornecedoresPermitidos: new Set([501]),
      marcasDeselecionadas: new Set(),
      secoesDeselecionadas: new Set(),
      curvasDeselecionadas: new Set(),
      statusFiltro: "ALL",
    });

    expect(resultado).toHaveLength(1);
    expect(resultado[0].codigoSku).toBe("SKU-MONROE");
  });

  it("deve filtrar por marcas deselecionadas em O(1)", () => {
    const itens = preIndexarListaMatriz([
      criarItemMock({ codigoSku: "SKU-1", marca: "MONROE" }),
      criarItemMock({ codigoSku: "SKU-2", marca: "COFAP" }),
      criarItemMock({ codigoSku: "SKU-3", marca: "NAKATA" }),
    ]);

    const marcasDeselecionadas = new Set(["COFAP"]);
    const resultado = filtrarLinhasCockpit(itens, {
      query: "",
      fornecedoresPermitidos: null,
      marcasDeselecionadas,
      secoesDeselecionadas: new Set(),
      curvasDeselecionadas: new Set(),
      statusFiltro: "ALL",
    });

    expect(resultado).toHaveLength(2);
    expect(resultado.map((i) => i.marca)).toEqual(["MONROE", "NAKATA"]);
  });

  it("deve filtrar por status operacional: PEDIR, TRANSFERIR, RUPTURA, ZUMBI", () => {
    const itens = preIndexarListaMatriz([
      criarItemMock({
        codigoSku: "ITEM-PEDIR",
        sugestaoFinalCompra: 10,
        quantidadeTransferenciaSugerida: 0,
        classificacaoRuptura: "Boa",
        isMarcaZumbi: false,
      }),
      criarItemMock({
        codigoSku: "ITEM-TRANSFERIR",
        sugestaoFinalCompra: 0,
        quantidadeTransferenciaSugerida: 4,
        classificacaoRuptura: "Boa",
        isMarcaZumbi: false,
      }),
      criarItemMock({
        codigoSku: "ITEM-RUPTURA",
        sugestaoFinalCompra: 0,
        quantidadeTransferenciaSugerida: 0,
        classificacaoRuptura: "Grave",
        isMarcaZumbi: false,
      }),
      criarItemMock({
        codigoSku: "ITEM-ZUMBI",
        sugestaoFinalCompra: 0,
        quantidadeTransferenciaSugerida: 0,
        classificacaoRuptura: "Boa",
        isMarcaZumbi: true,
      }),
    ]);

    // Filtro PEDIR
    const resPedir = filtrarLinhasCockpit(itens, {
      query: "",
      fornecedoresPermitidos: null,
      marcasDeselecionadas: new Set(),
      secoesDeselecionadas: new Set(),
      curvasDeselecionadas: new Set(),
      statusFiltro: "PEDIR",
    });
    expect(resPedir).toHaveLength(1);
    expect(resPedir[0].codigoSku).toBe("ITEM-PEDIR");

    // Filtro TRANSFERIR
    const resTransf = filtrarLinhasCockpit(itens, {
      query: "",
      fornecedoresPermitidos: null,
      marcasDeselecionadas: new Set(),
      secoesDeselecionadas: new Set(),
      curvasDeselecionadas: new Set(),
      statusFiltro: "TRANSFERIR",
    });
    expect(resTransf).toHaveLength(1);
    expect(resTransf[0].codigoSku).toBe("ITEM-TRANSFERIR");

    // Filtro RUPTURA
    const resRuptura = filtrarLinhasCockpit(itens, {
      query: "",
      fornecedoresPermitidos: null,
      marcasDeselecionadas: new Set(),
      secoesDeselecionadas: new Set(),
      curvasDeselecionadas: new Set(),
      statusFiltro: "RUPTURA",
    });
    expect(resRuptura).toHaveLength(1);
    expect(resRuptura[0].codigoSku).toBe("ITEM-RUPTURA");

    // Filtro ZUMBI
    const resZumbi = filtrarLinhasCockpit(itens, {
      query: "",
      fornecedoresPermitidos: null,
      marcasDeselecionadas: new Set(),
      secoesDeselecionadas: new Set(),
      curvasDeselecionadas: new Set(),
      statusFiltro: "ZUMBI",
    });
    expect(resZumbi).toHaveLength(1);
    expect(resZumbi[0].codigoSku).toBe("ITEM-ZUMBI");
  });
});

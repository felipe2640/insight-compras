import { describe, it, expect } from "vitest";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { PARAMETROS_MOTOR_PADRAO } from "@core/calculo/necessidade";
import { Produto, EstoqueFilial, HistoricoVendasFilial } from "@core/dominio";
import { RespostaCargaInventario } from "@adapters/AdaptadorInventario";

/**
 * Regras de transferência herdadas do diário, agora para N lojas:
 * 1. Pedido e transferência na MESMA linha.
 * 2. Prioridade para a loja que MAIS precisa.
 * 3. A doadora mantém o que a movimentação DELA exige (previsão calibrada),
 *    não o mínimo do ERP.
 * 4. Loja com estoque suficiente não recebe.
 */

const NOMES = { 1: "Pedro II", 2: "Poranga", 3: "Campo Maior" } as const;

function produto(id: number): Produto {
  return {
    id,
    codigoSku: `SKU-${id}`,
    descricao: `PRODUTO ${id}`,
    marca: "M",
    fabricante: "F",
    referenciaFabricante: null,
    aplicacaoVeicular: null,
    familiaId: null,
    secaoId: null,
    nomeSecao: null,
    fornecedorId: 1,
    nomeFornecedor: "Forn",
    precoCusto: 10,
    precoVenda: 20,
    loteMultiplo: 1,
  };
}

function estoque(
  produtoId: number,
  filialId: number,
  saldo: number,
  minErp = 0
): EstoqueFilial {
  return {
    filialId,
    nomeFilial: NOMES[filialId as 1 | 2 | 3],
    produtoId,
    saldoFisico: saldo,
    estoqueMinimoSeguranca: minErp,
    quantidadeJaPedida: 0,
    consumoMedioDiarioErp: 0,
    diasSemVenda: 0,
    sinalGovernancaCompra: null,
    usoLimiteCompra: null,
    margemRealizada: null,
    margemAlvo: null,
    dataUltimaVenda: null,
    dataUltimaCompra: null,
  };
}

/** vendas180 define o consumo: 180 => 1/dia (ALTO_GIRO, previsão 25). */
function historico(produtoId: number, filialId: number, vendas180: number): HistoricoVendasFilial {
  return {
    produtoId,
    filialId,
    vendasLiquidas30dias: vendas180 / 6,
    vendasLiquidas90dias: vendas180 / 2,
    vendasLiquidas180dias: vendas180,
    devolucoes90dias: 0,
    notasFiscaisVenda90dias: 10,
    notasFiscaisDevolucao90dias: 0,
    mesesAtivos12meses: 6,
    medianaLinhaVenda: 1,
    diasRuptura90dias: 0,
    diasObservados: 180,
    dataPrimeiraVendaRegistrada: null,
  };
}

function montarCarga(
  estoques: EstoqueFilial[],
  historicos: HistoricoVendasFilial[]
): RespostaCargaInventario {
  return {
    produtos: [produto(1)],
    estoques: new Map(estoques.map((e) => [`${e.produtoId}:${e.filialId}`, e])),
    historicos: new Map(historicos.map((h) => [`${h.produtoId}:${h.filialId}`, h])),
    entradasHoje: [],
    similares: new Map(),
    metadados: {
      provedor: "MOCK_SINTETICO",
      timestampCarga: new Date().toISOString(),
      emModoDegradado: false,
      totalSkusCarregados: 1,
      latenciaMs: 0,
    },
  };
}

// Fator 1 para os números ficarem redondos: previsão = ceil(cmd × 20 × 1,25).
const MOTOR = { ...PARAMETROS_MOTOR_PADRAO, fatorCalibracao: 1 };
const opcoes = (filialFocoId: number) => ({ filialFocoId, parametrosMotor: MOTOR, nomesFiliais: NOMES });

describe("Balanceamento de rede no gerador de linhas", () => {
  // Cenário base:
  //  Pedro II    saldo 0,  cmd 1,0/dia -> previsão 25, precisa 25
  //  Poranga     saldo 0,  cmd 0,5/dia -> previsão 13, precisa 13
  //  Campo Maior saldo 30, cmd 0,2/dia -> previsão  5, sobra  25
  const carga = montarCarga(
    [estoque(1, 1, 0), estoque(1, 2, 0), estoque(1, 3, 30, /* minErp */ 20)],
    [historico(1, 1, 180), historico(1, 2, 90), historico(1, 3, 36)]
  );

  it("prioriza a loja que MAIS precisa quando a sobra não atende todas", () => {
    const pedroII = converterParaLinhasCockpit(carga, opcoes(1))[0];
    const poranga = converterParaLinhasCockpit(carga, opcoes(2))[0];

    // A sobra de 25 vai inteira para Pedro II (precisa 25 > Poranga 13).
    expect(pedroII.quantidadeTransferenciaSugerida).toBe(25);
    expect(pedroII.sugestaoFinalCompra).toBe(0);
    expect(pedroII.statusSugestao).toBe("COBERTO_POR_TRANSFERENCIA");

    // Poranga não recebe nada e compra os 13 do fornecedor.
    expect(poranga.quantidadeTransferenciaSugerida).toBe(0);
    expect(poranga.sugestaoFinalCompra).toBe(13);
    expect(poranga.statusSugestao).toBe("APROVADO_COMPRA");
  });

  it("a doadora mantém o que a movimentação DELA exige, não o mínimo do ERP", () => {
    const pedroII = converterParaLinhasCockpit(carga, opcoes(1))[0];

    // Campo Maior tem mínimo ERP 20; se esse fosse o piso, doaria só 10.
    // O piso é a previsão da própria loja (5): doa 25 e fica com 5.
    expect(pedroII.filialOrigemTransferenciaNome).toBe("Campo Maior");
    expect(pedroII.estoqueMinimoOrigemTransferencia).toBe(5);
    expect(pedroII.sobraRealOrigemTransferencia).toBe(25);
    expect(pedroII.saldoOrigemTransferencia).toBe(30);
  });

  it("loja com estoque suficiente não recebe transferência", () => {
    const campoMaior = converterParaLinhasCockpit(carga, opcoes(3))[0];
    expect(campoMaior.quantidadeTransferenciaSugerida).toBe(0);
    expect(campoMaior.sugestaoFinalCompra).toBe(0);
    expect(campoMaior.statusSugestao).toBe("ESTOQUE_SUFICIENTE");
  });

  it("transferência parcial e compra do restante vêm na MESMA linha", () => {
    // Campo Maior agora só tem 15: sobra 10. Pedro II precisa 25.
    const cargaParcial = montarCarga(
      [estoque(1, 1, 0), estoque(1, 3, 15)],
      [historico(1, 1, 180), historico(1, 3, 36)]
    );
    const pedroII = converterParaLinhasCockpit(cargaParcial, opcoes(1))[0];

    expect(pedroII.quantidadeTransferenciaSugerida).toBe(10);
    expect(pedroII.sugestaoFinalCompra).toBe(15);
    expect(pedroII.statusSugestao).toBe("APROVADO_COMPRA");
    expect(pedroII.motivoDecisao).toContain("Transferir 10");
    expect(pedroII.motivoDecisao).toContain("comprar 15");
  });

  it("peça parada em uma loja (sem giro) doa tudo para onde vende", () => {
    // Poranga tem 40 un e NENHUMA venda: previsão 0, sobra 40 inteira.
    const cargaParada = montarCarga(
      [estoque(1, 1, 0), estoque(1, 2, 40, /* minErp */ 30)],
      [historico(1, 1, 180), historico(1, 2, 0)]
    );
    const pedroII = converterParaLinhasCockpit(cargaParada, opcoes(1))[0];

    expect(pedroII.quantidadeTransferenciaSugerida).toBe(25);
    expect(pedroII.estoqueMinimoOrigemTransferencia).toBe(0);
    expect(pedroII.sugestaoFinalCompra).toBe(0);
  });

  it("a mesma sobra nunca é prometida a duas lojas", () => {
    // Soma do que cada loja recebe não pode passar da sobra real da doadora.
    const recebido = [1, 2, 3]
      .map((f) => converterParaLinhasCockpit(carga, opcoes(f))[0].quantidadeTransferenciaSugerida)
      .reduce((a, b) => a + b, 0);
    expect(recebido).toBeLessThanOrEqual(25);
  });
});

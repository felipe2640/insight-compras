import { describe, it, expect, beforeEach } from "vitest";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { RespostaCargaInventario } from "@adapters/AdaptadorInventario";
import { PrevisaoDemandaIaItem, carregarMapaPrevisoesIa, limparCachePrevisoesIa } from "@/lib/previsao-ia/repositorio-previsao-ia";
import { PARAMETROS_MOTOR_PADRAO } from "@core/calculo/necessidade";

describe("Integracao do Motor de Demanda por Inteligencia Artificial", () => {
  beforeEach(() => {
    limparCachePrevisoesIa();
  });

  const cargaBase: RespostaCargaInventario = {
    produtos: [
      {
        id: 101,
        codigoSku: "SKU-IA-01",
        descricao: "Bieleta Dianteira Toyota Corolla",
        marca: "Nakata",
        fabricante: "Nakata",
        precoCusto: 50,
        precoVenda: 100,
        loteMultiplo: 2,
      },
      {
        id: 102,
        codigoSku: "SKU-ANALITICO-02",
        descricao: "Amortecedor Traseiro Honda Civic",
        marca: "Cofap",
        fabricante: "Cofap",
        precoCusto: 120,
        precoVenda: 250,
        loteMultiplo: 1,
      },
      {
        id: 103,
        codigoSku: "SKU-ZUMBI-03",
        descricao: "Pastilha Freio Especifica Parada",
        marca: "Fras-le",
        fabricante: "Fras-le",
        precoCusto: 40,
        precoVenda: 90,
        loteMultiplo: 1,
      },
    ],
    estoques: new Map([
      [
        "101:1",
        {
          filialId: 1,
          produtoId: 101,
          saldoFisico: 4,
          estoqueMinimoSeguranca: 0,
          quantidadeJaPedida: 0,
        },
      ],
      [
        "102:1",
        {
          filialId: 1,
          produtoId: 102,
          saldoFisico: 2,
          estoqueMinimoSeguranca: 0,
          quantidadeJaPedida: 0,
        },
      ],
      [
        "103:1",
        {
          filialId: 1,
          produtoId: 103,
          saldoFisico: 10,
          estoqueMinimoSeguranca: 0,
          quantidadeJaPedida: 0,
        },
      ],
    ]),
    historicos: new Map([
      [
        "101:1",
        {
          filialId: 1,
          produtoId: 101,
          vendasLiquidas30dias: 20,
          vendasLiquidas90dias: 60,
          vendasLiquidas180dias: 120,
          diasObservados: 180,
          notasFiscaisVenda90dias: 30,
          notasFiscaisVenda12meses: 60,
          mesesAtivos12meses: 6,
        },
      ],
      [
        "102:1",
        {
          filialId: 1,
          produtoId: 102,
          vendasLiquidas30dias: 10,
          vendasLiquidas90dias: 30,
          vendasLiquidas180dias: 60,
          diasObservados: 180,
          notasFiscaisVenda90dias: 15,
          notasFiscaisVenda12meses: 30,
          mesesAtivos12meses: 5,
        },
      ],
      [
        "103:1",
        {
          filialId: 1,
          produtoId: 103,
          vendasLiquidas30dias: 0,
          vendasLiquidas90dias: 0,
          vendasLiquidas180dias: 0,
          diasObservados: 180,
          notasFiscaisVenda90dias: 0,
          notasFiscaisVenda12meses: 0,
          mesesAtivos12meses: 0,
        },
      ],
    ]),
    entradasHoje: [],
    similares: new Map(),
    metadados: {
      provedor: "MOCK_SINTETICO",
      totalSkusCarregados: 3,
      timestampCarga: new Date().toISOString(),
      emModoDegradado: false,
      latenciaMs: 10,
    },
  };

  it("prioriza o valor medido de demanda por IA (P80/P50) e anota telemetria na linha da matriz", () => {
    const mapaIa = new Map<string, PrevisaoDemandaIaItem>([
      [
        "101:1",
        {
          filialId: 1,
          produtoId: 101,
          sku: "SKU-IA-01",
          previsaoCentral: 22,
          demandaP50: 20,
          demandaP80: 27,
          modeloUtilizado: "Chronos-Bolt (Small)",
          dataPrevisao: "2026-09-14T20:00:00Z",
        },
      ],
    ]);

    const linhas = converterParaLinhasCockpit(cargaBase, {
      filialFocoId: 1,
      parametrosMotor: PARAMETROS_MOTOR_PADRAO,
      mapaPrevisoesIa: mapaIa,
    });

    const linhaIa = linhas.find((l) => l.produtoId === 101);
    expect(linhaIa).toBeDefined();
    expect(linhaIa?.origemPrevisao).toBe("IA");
    expect(linhaIa?.previsaoIaP80).toBe(27);
    expect(linhaIa?.previsaoIaP50).toBe(20);
    // Demanda P80 = 27 -> arredondada para lote 2 = 28.
    // Saldo = 4. Necessidade líquida = 28 - 4 = 24.
    expect(linhaIa?.sugestaoFinalCompra).toBe(24);
    expect(linhaIa?.motivoDecisao).toContain("Demanda prevista (faixa conservadora: 27 un)");

    // Item 102 nao tem IA -> fallback para analitico
    const linhaAnalitica = linhas.find((l) => l.produtoId === 102);
    expect(linhaAnalitica).toBeDefined();
    expect(linhaAnalitica?.origemPrevisao).toBe("ANALITICA");
    expect(linhaAnalitica?.previsaoIaP80).toBeNull();
  });

  it("preserva estritamente a trava de marca zumbi mesmo se houver previsao residual de IA", () => {
    const mapaIa = new Map<string, PrevisaoDemandaIaItem>([
      [
        "103:1",
        {
          filialId: 1,
          produtoId: 103,
          sku: "SKU-ZUMBI-03",
          previsaoCentral: 5,
          demandaP50: 3,
          demandaP80: 8,
          modeloUtilizado: "Chronos-Bolt (Small)",
          dataPrevisao: "2026-09-14T20:00:00Z",
        },
      ],
    ]);

    const linhas = converterParaLinhasCockpit(cargaBase, {
      filialFocoId: 1,
      parametrosMotor: PARAMETROS_MOTOR_PADRAO,
      mapaPrevisoesIa: mapaIa,
    });

    const linhaZumbi = linhas.find((l) => l.produtoId === 103);
    expect(linhaZumbi).toBeDefined();
    expect(linhaZumbi?.isMarcaZumbi).toBe(true);
    expect(linhaZumbi?.statusSugestao).toBe("TRAVADO_MARCA_ZUMBI");
    expect(linhaZumbi?.sugestaoFinalCompra).toBe(0);
    expect(linhaZumbi?.motivoDecisao).toContain("TRAVA MARCA ZUMBI");
  });

  it("limpa cache de previsoes corretamente", async () => {
    limparCachePrevisoesIa();
    const res = await carregarMapaPrevisoesIa("tenant-inexistente");
    expect(res.size).toBe(0);
  });
});

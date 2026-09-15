/**
 * @vitest-environment node
 *
 * Este arquivo não toca no DOM: é motor de cálculo e repositório. Sem esta
 * anotação ele herda o jsdom de `tests/cockpit/**` (vitest.config.ts) e hoje
 * nem chega a executar, porque o jsdom deste ambiente falha ao carregar.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { RespostaCargaInventario } from "@adapters/AdaptadorInventario";
import { PrevisaoDemandaIaItem, carregarMapaPrevisoesIa, limparCachePrevisoesIa } from "@/lib/previsao-ia/repositorio-previsao-ia";
import { PARAMETROS_MOTOR_PADRAO } from "@core/calculo/necessidade";
import { Produto } from "@core/dominio/produto";
import { EstoqueFilial } from "@core/dominio/estoque";
import { HistoricoVendasFilial } from "@core/dominio/historico-vendas";

/** Fixtures completas: o cenário do teste sobrescreve só o que importa. */
function produtoMock(parciais: Partial<Produto>): Produto {
  return {
    id: 0,
    codigoSku: "SKU-0",
    descricao: "Peca de teste",
    marca: "Generica",
    fabricante: "Generica",
    referenciaFabricante: null,
    aplicacaoVeicular: null,
    familiaId: null,
    secaoId: null,
    nomeSecao: null,
    fornecedorId: 1,
    nomeFornecedor: "Fornecedor de teste",
    precoCusto: 0,
    precoVenda: 0,
    loteMultiplo: 1,
    ...parciais,
  };
}

function estoqueMock(parciais: Partial<EstoqueFilial>): EstoqueFilial {
  return {
    filialId: 1,
    nomeFilial: "Filial de teste",
    produtoId: 0,
    saldoFisico: 0,
    estoqueMinimoSeguranca: 0,
    quantidadeJaPedida: 0,
    consumoMedioDiarioErp: 0,
    diasSemVenda: null,
    sinalGovernancaCompra: null,
    usoLimiteCompra: null,
    margemRealizada: null,
    margemAlvo: null,
    dataUltimaVenda: null,
    dataUltimaCompra: null,
    ...parciais,
  };
}

function historicoMock(parciais: Partial<HistoricoVendasFilial>): HistoricoVendasFilial {
  return {
    produtoId: 0,
    filialId: 1,
    vendasLiquidas30dias: 0,
    vendasLiquidas90dias: 0,
    vendasLiquidas180dias: 0,
    devolucoes90dias: 0,
    notasFiscaisVenda90dias: 0,
    notasFiscaisDevolucao90dias: 0,
    mesesAtivos12meses: 0,
    medianaLinhaVenda: 0,
    diasRuptura90dias: 0,
    diasObservados: 180,
    dataPrimeiraVendaRegistrada: null,
    ...parciais,
  };
}

/**
 * Data de projeção com N dias de idade. Relativa de propósito: a vigência
 * depende da idade da projeção, então data fixa no fixture apodreceria.
 */
function dataPrevisaoComIdade(dias: number): string {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe("Integracao do Motor de Demanda por Inteligencia Artificial", () => {
  beforeEach(() => {
    limparCachePrevisoesIa();
  });

  const cargaBase: RespostaCargaInventario = {
    produtos: [
      produtoMock({
        id: 101,
        codigoSku: "SKU-IA-01",
        descricao: "Bieleta Dianteira Toyota Corolla",
        marca: "Nakata",
        fabricante: "Nakata",
        precoCusto: 50,
        precoVenda: 100,
        loteMultiplo: 2,
      }),
      produtoMock({
        id: 102,
        codigoSku: "SKU-ANALITICO-02",
        descricao: "Amortecedor Traseiro Honda Civic",
        marca: "Cofap",
        fabricante: "Cofap",
        precoCusto: 120,
        precoVenda: 250,
        loteMultiplo: 1,
      }),
      produtoMock({
        id: 103,
        codigoSku: "SKU-ZUMBI-03",
        descricao: "Pastilha Freio Especifica Parada",
        marca: "Fras-le",
        fabricante: "Fras-le",
        precoCusto: 40,
        precoVenda: 90,
        loteMultiplo: 1,
      }),
    ],
    estoques: new Map([
      [
        "101:1",
        estoqueMock({
          filialId: 1,
          produtoId: 101,
          saldoFisico: 4,
          estoqueMinimoSeguranca: 0,
          quantidadeJaPedida: 0,
        }),
      ],
      [
        "102:1",
        estoqueMock({
          filialId: 1,
          produtoId: 102,
          saldoFisico: 2,
          estoqueMinimoSeguranca: 0,
          quantidadeJaPedida: 0,
        }),
      ],
      [
        "103:1",
        estoqueMock({
          filialId: 1,
          produtoId: 103,
          saldoFisico: 10,
          estoqueMinimoSeguranca: 0,
          quantidadeJaPedida: 0,
        }),
      ],
    ]),
    historicos: new Map([
      [
        "101:1",
        historicoMock({
          filialId: 1,
          produtoId: 101,
          vendasLiquidas30dias: 20,
          vendasLiquidas90dias: 60,
          vendasLiquidas180dias: 120,
          diasObservados: 180,
          notasFiscaisVenda90dias: 30,
          notasFiscaisVenda12meses: 60,
          mesesAtivos12meses: 6,
        }),
      ],
      [
        "102:1",
        historicoMock({
          filialId: 1,
          produtoId: 102,
          vendasLiquidas30dias: 10,
          vendasLiquidas90dias: 30,
          vendasLiquidas180dias: 60,
          diasObservados: 180,
          notasFiscaisVenda90dias: 15,
          notasFiscaisVenda12meses: 30,
          mesesAtivos12meses: 5,
        }),
      ],
      [
        "103:1",
        historicoMock({
          filialId: 1,
          produtoId: 103,
          vendasLiquidas30dias: 0,
          vendasLiquidas90dias: 0,
          vendasLiquidas180dias: 0,
          diasObservados: 180,
          notasFiscaisVenda90dias: 0,
          notasFiscaisVenda12meses: 0,
          mesesAtivos12meses: 0,
        }),
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
          horizonteDias: 30,
          modeloUtilizado: "Chronos-Bolt (Small)",
          dataPrevisao: dataPrevisaoComIdade(1),
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
    // A faixa do modelo é o total de 30 dias; o item é ALTO_GIRO, cujo horizonte
    // de cobertura é 20 dias. Reescala: 27 * (20/30) = 18 -> lote 2 = 18.
    // Saldo = 4. Necessidade líquida = 18 - 4 = 14.
    // (Sem a reescala eram 24 un: 30 dias de demanda para cobrir 20 dias.)
    expect(linhaIa?.sugestaoFinalCompra).toBe(14);
    expect(linhaIa?.motivoDecisao).toContain("Demanda prevista (faixa conservadora: 27 un/30d)");

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
          horizonteDias: 30,
          modeloUtilizado: "Chronos-Bolt (Small)",
          dataPrevisao: dataPrevisaoComIdade(1),
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

  it("descarta projecao vencida e volta para o motor analitico", () => {
    // Item 101 é de alto giro (p50 de 20 peças em 30 dias). Uma projeção de 20
    // dias atrás esperava ~13 peças vendidas no período; o item não vendeu
    // nenhuma (diasSemVenda 60). O silêncio contradiz a projeção: ela não
    // representa mais o item e a linha volta para a régua analítica.
    const cargaParada: RespostaCargaInventario = {
      ...cargaBase,
      estoques: new Map([
        ...cargaBase.estoques,
        ["101:1", estoqueMock({ filialId: 1, produtoId: 101, saldoFisico: 4, diasSemVenda: 60 })],
      ]),
    };

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
          horizonteDias: 30,
          modeloUtilizado: "Chronos-Bolt (Small)",
          dataPrevisao: dataPrevisaoComIdade(20),
        },
      ],
    ]);

    const linhas = converterParaLinhasCockpit(cargaParada, {
      filialFocoId: 1,
      parametrosMotor: PARAMETROS_MOTOR_PADRAO,
      mapaPrevisoesIa: mapaIa,
    });

    const linha = linhas.find((l) => l.produtoId === 101);
    expect(linha?.origemPrevisao).toBe("ANALITICA");
    // Nem a telemetria pode sugerir que a previsão foi usada.
    expect(linha?.previsaoIaP80).toBeNull();
    expect(linha?.previsaoIaP50).toBeNull();
  });

  it("mantem projecao antiga de item intermitente, cujo silencio e esperado", () => {
    // Item 102: p50 de 10 peças em 30 dias na projeção abaixo -> em 20 dias
    // esperava ~6,7. Para o teste do silêncio compatível precisamos de um p50
    // baixo, então usamos uma projeção intermitente de verdade.
    const mapaIa = new Map<string, PrevisaoDemandaIaItem>([
      [
        "102:1",
        {
          filialId: 1,
          produtoId: 102,
          sku: "SKU-ANALITICO-02",
          previsaoCentral: 1,
          demandaP50: 1,
          demandaP80: 4,
          horizonteDias: 30,
          modeloUtilizado: "Chronos-Bolt (Small)",
          dataPrevisao: dataPrevisaoComIdade(20),
        },
      ],
    ]);

    const linhas = converterParaLinhasCockpit(cargaBase, {
      filialFocoId: 1,
      parametrosMotor: PARAMETROS_MOTOR_PADRAO,
      mapaPrevisoesIa: mapaIa,
    });

    const linha = linhas.find((l) => l.produtoId === 102);
    expect(linha?.origemPrevisao).toBe("IA");
    expect(linha?.previsaoIaP80).toBe(4);
  });

  it("limpa cache de previsoes corretamente", async () => {
    limparCachePrevisoesIa();
    const res = await carregarMapaPrevisoesIa("tenant-inexistente");
    expect(res.size).toBe(0);
  });
});

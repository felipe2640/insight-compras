/**
 * Suíte de Testes: Classificação de Curva ABC por Tenant (White-Label)
 * Valida a Curva ABC por Giro (Carreiro) e Pareto Financeiro (Demonstração/Default)
 */

import { describe, it, expect } from "vitest";
import { TENANT_CARREIRO } from "@config/tenants/carreiro";
import { TENANT_DEMONSTRACAO } from "@config/tenants/demonstracao";
import { montarOpcoesMatriz } from "@/lib/cockpit/opcoes-tenant";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { RespostaCargaInventario } from "@adapters/AdaptadorInventario";
import { Produto, EstoqueFilial, HistoricoVendasFilial } from "@core/dominio";

function criarProdutoMock(id: number, precoVenda: number): Produto {
  return {
    id,
    codigoSku: `SKU-${id}`,
    descricao: `PRODUTO TESTE ${id}`,
    marca: "MARCA",
    fabricante: "FABR",
    referenciaFabricante: null,
    aplicacaoVeicular: null,
    familiaId: null,
    secaoId: 10,
    nomeSecao: "MECANICA",
    fornecedorId: 1,
    nomeFornecedor: "FORN",
    precoCusto: precoVenda * 0.6,
    precoVenda,
    loteMultiplo: 1,
  };
}

function criarEstoqueMock(produtoId: number, saldo: number): EstoqueFilial {
  return {
    produtoId,
    filialId: 1,
    nomeFilial: "Matriz",
    saldoFisico: saldo,
    estoqueMinimoSeguranca: 2,
    quantidadeJaPedida: 0,
    consumoMedioDiarioErp: 1,
    diasSemVenda: 0,
    sinalGovernancaCompra: null,
    usoLimiteCompra: null,
    margemRealizada: 0.4,
    margemAlvo: 0.4,
    dataUltimaVenda: null,
    dataUltimaCompra: null,
  };
}

function criarHistoricoMock(
  produtoId: number,
  vendas180d: number,
  notas12m: number,
  mesesAtivos12m: number
): HistoricoVendasFilial {
  return {
    produtoId,
    filialId: 1,
    vendasLiquidas30dias: Math.round(vendas180d / 6),
    vendasLiquidas90dias: Math.round(vendas180d / 2),
    vendasLiquidas180dias: vendas180d,
    devolucoes90dias: 0,
    notasFiscaisVenda90dias: Math.round(notas12m / 4),
    notasFiscaisVenda12meses: notas12m,
    notasFiscaisDevolucao90dias: 0,
    mesesAtivos12meses: mesesAtivos12m,
    medianaLinhaVenda: 1,
    diasRuptura90dias: 0,
    diasObservados: 180,
    dataPrimeiraVendaRegistrada: null,
  };
}

describe("White-Label: Curva ABC por Tenant", () => {
  it("TENANT_CARREIRO deve estar configurado com método GIRO", () => {
    expect(TENANT_CARREIRO.curvaAbc).toBeDefined();
    expect(TENANT_CARREIRO.curvaAbc?.metodo).toBe("GIRO");
    expect(TENANT_CARREIRO.curvaAbc?.fallbackParaGiroSeErpInvalido).toBe(true);
  });

  it("montarOpcoesMatriz deve propagar configuracaoCurvaAbc do tenant", () => {
    const opcoesCarreiro = montarOpcoesMatriz(1, TENANT_CARREIRO);
    expect(opcoesCarreiro.configuracaoCurvaAbc?.metodo).toBe("GIRO");

    const opcoesDemo = montarOpcoesMatriz(1, TENANT_DEMONSTRACAO);
    expect(opcoesDemo.configuracaoCurvaAbc?.metodo ?? "FATURAMENTO").toBe("FATURAMENTO");
  });

  describe("Cálculo no Cockpit com método 'GIRO' (Carreiro)", () => {
    it("deve classificar item barato com alto giro como Curva A e item caro esporádico como Curva C", () => {
      // Produto 1: Terminal barato (R$ 0,50), vende 60 un/mês (360 em 180d), 50 notas em 12m -> ALTO_GIRO
      const p1 = criarProdutoMock(1, 0.5);
      const est1 = criarEstoqueMock(1, 100);
      const hist1 = criarHistoricoMock(1, 360, 50, 10);

      // Produto 2: Radiador caro (R$ 3.000), vendeu 1 un em 180d, 1 nota em 12m -> SEM_HISTORICO_SUFICIENTE / BAIXO_GIRO
      const p2 = criarProdutoMock(2, 3000);
      const est2 = criarEstoqueMock(2, 1);
      const hist2 = criarHistoricoMock(2, 1, 1, 1);

      // Produto 3: Lâmpada preço médio (R$ 15), vende 4 un/mês (24 em 180d), 15 notas em 12m -> MEDIO_GIRO
      const p3 = criarProdutoMock(3, 15);
      const est3 = criarEstoqueMock(3, 10);
      const hist3 = criarHistoricoMock(3, 24, 15, 6);

      const carga: RespostaCargaInventario = {
        produtos: [p1, p2, p3],
        estoques: new Map([
          ["1:1", est1],
          ["2:1", est2],
          ["3:1", est3],
        ]),
        historicos: new Map([
          ["1:1", hist1],
          ["2:1", hist2],
          ["3:1", hist3],
        ]),
        entradasHoje: [],
        similares: new Map(),
        metadados: {
          provedor: "POWERBI_FABRIC_DAX",
          timestampCarga: new Date().toISOString(),
          emModoDegradado: false,
          totalSkusCarregados: 3,
          latenciaMs: 10,
        },
      };

      // 1. Executa com método GIRO (Carreiro)
      const linhasGiro = converterParaLinhasCockpit(carga, {
        filialFocoId: 1,
        configuracaoCurvaAbc: { metodo: "GIRO" },
      });

      const linhaTerminal = linhasGiro.find((l) => l.produtoId === 1)!;
      const linhaRadiador = linhasGiro.find((l) => l.produtoId === 2)!;
      const linhaLampada = linhasGiro.find((l) => l.produtoId === 3)!;

      // Pelo giro:
      // Terminal: Alto giro -> Curva A (não é rebaixado pelo preço baixo)
      expect(linhaTerminal.perfilGiro).toBe("ALTO_GIRO");
      expect(linhaTerminal.curvaAbc).toBe("A");
      expect(linhaTerminal.curvaAbcSistema).toBe("A");

      // Radiador: 1 venda esporádica -> Curva C (não rouba vaga em A pelo preço alto)
      expect(linhaRadiador.perfilGiro).toBe("SEM_HISTORICO_SUFICIENTE");
      expect(linhaRadiador.curvaAbc).toBe("C");
      expect(linhaRadiador.curvaAbcSistema).toBe("C");

      // Lâmpada: Médio giro -> Curva B
      expect(linhaLampada.perfilGiro).toBe("MEDIO_GIRO");
      expect(linhaLampada.curvaAbc).toBe("B");
      expect(linhaLampada.curvaAbcSistema).toBe("B");

      // 2. Executa com método FATURAMENTO clássico (Pareto puro) para comparar a divergência
      const linhasFaturamento = converterParaLinhasCockpit(carga, {
        filialFocoId: 1,
        configuracaoCurvaAbc: { metodo: "FATURAMENTO" },
      });

      const linhaTerminalFat = linhasFaturamento.find((l) => l.produtoId === 1)!;
      const linhaRadiadorFat = linhasFaturamento.find((l) => l.produtoId === 2)!;

      // No faturamento puro, o Radiador dominava R$ 3.000 e virava A, e o terminal de R$ 90 virava C:
      expect(linhaRadiadorFat.curvaAbc).toBe("A");
      expect(linhaTerminalFat.curvaAbc).toBe("C");
    });
  });
});

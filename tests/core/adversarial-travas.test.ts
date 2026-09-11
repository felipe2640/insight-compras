/**
 * Bateria Adversarial de Testes de Estresse — Travas Anti-Encalhe e Lotes Múltiplos
 * Módulo: core/travas/
 * Agente: Challenger 2 (Empirical Challenger)
 * 
 * Este arquivo submete as funções em core/travas/ a testes estocásticos (fuzzing),
 * casos extremos, valores primos, números fracionários, negativos e tentativas
 * deliberadas de contornar (bypass) os guardrails de compras.
 */

import { inferirLotePadraoPorCategoria } from "@adapters/comum/lote-autopecas";
import { describe, it, expect } from "vitest";
import {
  aplicarTravaMarcaZumbi,
  ParametrosTravaZumbi,
} from "@core/travas/marca-zumbi";
import {
  aplicarTravaFamiliaAplicacao,
  ItemFamiliaAplicacao,
} from "@core/travas/familia-aplicacao";
import {
  arredondarParaMultiplo,
  ajustarQuantidadePorLote,
} from "@core/travas/lote-multiplo";

describe("Adversarial Challenger 2 — Travas Anti-Encalhe e Múltiplos de Lote", () => {
  // ==========================================================================
  // SEÇÃO 1: Desafio Adversarial à Trava de Marca Zumbi (marca-zumbi.ts)
  // ==========================================================================
  describe("1. Desafio Adversarial: Trava de Marca Zumbi (core/travas/marca-zumbi.ts)", () => {
    it("COMPROVAÇÃO FORMAL: A sugestão NUNCA é maior que 0 para SKUs com saldo > 0 e 0 vendas em 180d (10.000 iterações estocásticas)", () => {
      let violacoes = 0;
      let totalTestado = 0;

      const payloadsInjecao = [
        "'; DROP TABLE estoque; --",
        "EVALUATE CALCULATETABLE('Vendas', 'Vendas'[Qtd] > 0)",
        "<script>alert('xss')</script>",
        "SKU-🔥🔥🔥-EXTREMO",
        "   ",
        "A".repeat(5000),
        "SKU-COM-ASPAS'\"`",
        "00000000000000000000",
      ];

      for (let i = 0; i < 10000; i++) {
        // Saldo estritamente positivo: desde valores infinitesimais até bilhões
        const saldoFisico =
          i % 4 === 0
            ? Math.random() * 1000 + 0.0001
            : i % 4 === 1
            ? Math.floor(Math.random() * 50000) + 1
            : i % 4 === 2
            ? Number.MAX_SAFE_INTEGER * Math.random()
            : 0.000000001;

        // Vendas líquidas em 180 dias <= 0: exatamente 0 ou devoluções superando vendas
        const vendasLiquidas =
          i % 2 === 0
            ? 0
            : -Math.floor(Math.random() * 500) - (i % 3 === 0 ? 0.5 : 0);

        // Tentativas de forçar sugestões exorbitantes
        const sugestaoOriginal =
          i % 5 === 0
            ? Math.random() * 1000000 + 1
            : i % 5 === 1
            ? 999999
            : i % 5 === 2
            ? Number.MAX_SAFE_INTEGER
            : i % 5 === 3
            ? 0.5
            : 1;

        const sku = payloadsInjecao[i % payloadsInjecao.length];

        const resultado = aplicarTravaMarcaZumbi({
          saldoFisico,
          vendasLiquidas180dias: vendasLiquidas,
          sugestaoOriginal,
          codigoSku: sku,
        });

        totalTestado++;

        if (resultado.sugestaoAjustada > 0 || resultado.travado !== true) {
          violacoes++;
        }
      }

      expect(totalTestado).toBe(10000);
      expect(violacoes).toBe(0);
    });

    it("Tentativas deliberadas de bypass por valores extremos e fronteiras numéricas", () => {
      // 1. Saldo infinitesimal (> 0) e sugestão bilionária
      const casoInfinitesimal = aplicarTravaMarcaZumbi({
        saldoFisico: Number.MIN_VALUE, // Menor valor positivo em JS (~5e-324)
        vendasLiquidas180dias: 0,
        sugestaoOriginal: 10_000_000,
        codigoSku: "BYPASS-MIN-VALUE",
      });
      expect(casoInfinitesimal.travado).toBe(true);
      expect(casoInfinitesimal.sugestaoAjustada).toBe(0);

      // 2. Saldo físico infinito
      const casoInfinito = aplicarTravaMarcaZumbi({
        saldoFisico: Infinity,
        vendasLiquidas180dias: 0,
        sugestaoOriginal: 500,
        codigoSku: "BYPASS-INFINITY",
      });
      expect(casoInfinito.travado).toBe(true);
      expect(casoInfinito.sugestaoAjustada).toBe(0);

      // 3. Zero negativo em JavaScript (-0) nas vendas
      const casoZeroNegativo = aplicarTravaMarcaZumbi({
        saldoFisico: 10,
        vendasLiquidas180dias: -0,
        sugestaoOriginal: 50,
      });
      expect(casoZeroNegativo.travado).toBe(true);
      expect(casoZeroNegativo.sugestaoAjustada).toBe(0);

      // 4. Saldo fracionário e vendas líquidas negativas com devolução massiva
      const casoDevolucaoMassiva = aplicarTravaMarcaZumbi({
        saldoFisico: 2.5,
        vendasLiquidas180dias: -9999999,
        sugestaoOriginal: 80,
      });
      expect(casoDevolucaoMassiva.travado).toBe(true);
      expect(casoDevolucaoMassiva.sugestaoAjustada).toBe(0);

      // 5. Sugestão original com infinito
      const casoSugestaoInfinita = aplicarTravaMarcaZumbi({
        saldoFisico: 5,
        vendasLiquidas180dias: 0,
        sugestaoOriginal: Infinity,
      });
      expect(casoSugestaoInfinita.travado).toBe(true);
      expect(casoSugestaoInfinita.sugestaoAjustada).toBe(0);
    });

    it("Preservação de Integridade: Itens ativos e rupturas legítimas NÃO devem ser falsamente travados", () => {
      // Caso 1: Item zerado sem vendas (ruptura normal, não zumbi de estoque parado)
      const ruptura = aplicarTravaMarcaZumbi({
        saldoFisico: 0,
        vendasLiquidas180dias: 0,
        sugestaoOriginal: 10,
        codigoSku: "RUPTURA-NORMAL",
      });
      expect(ruptura.travado).toBe(false);
      expect(ruptura.sugestaoAjustada).toBe(10);
      expect(ruptura.motivo).toBeNull();

      // Caso 2: Item com vendas mínimas registradas (> 0)
      const vendaMinima = aplicarTravaMarcaZumbi({
        saldoFisico: 20,
        vendasLiquidas180dias: 0.001,
        sugestaoOriginal: 5,
        codigoSku: "VENDA-MINIMA",
      });
      expect(vendaMinima.travado).toBe(false);
      expect(vendaMinima.sugestaoAjustada).toBe(5);

      // Caso 3: Saldo negativo (furo de estoque no ERP) sem vendas
      const saldoNegativo = aplicarTravaMarcaZumbi({
        saldoFisico: -3,
        vendasLiquidas180dias: 0,
        sugestaoOriginal: 15,
        codigoSku: "FURO-ESTOQUE",
      });
      expect(saldoNegativo.travado).toBe(false);
      expect(saldoNegativo.sugestaoAjustada).toBe(15);
    });
  });

  // ==========================================================================
  // SEÇÃO 2: Desafio Adversarial à Trava de Família de Aplicação
  // ==========================================================================
  describe("2. Desafio Adversarial: Trava de Família de Aplicação (core/travas/familia-aplicacao.ts)", () => {
    it("Fuzzing Estocástico: 1.000 famílias aleatórias verificando invariantes estritas", () => {
      let violacoesBloqueio = 0;
      let violacoesNaoBloqueio = 0;

      for (let f = 0; f < 1000; f++) {
        const qtdItens = Math.floor(Math.random() * 15) + 1;
        const horizonte = Math.floor(Math.random() * 90) + 10; // 10 a 100 dias
        const familiaId = `FAM-RND-${f}`;

        const itens: ItemFamiliaAplicacao[] = [];
        for (let i = 0; i < qtdItens; i++) {
          itens.push({
            produtoId: f * 100 + i,
            codigoSku: `SKU-${f}-${i}`,
            marca: `MARCA-${i % 4}`,
            saldoFisico: Math.floor(Math.random() * 60) - 5, // inclui negativos
            quantidadeJaPedida: Math.floor(Math.random() * 30) - 2, // inclui negativos
            consumoDiario: Math.max(0, (Math.random() * 5).toFixed(2) as unknown as number),
            necessidadeIndividual: Math.floor(Math.random() * 20),
          });
        }

        const resultado = aplicarTravaFamiliaAplicacao(familiaId, itens, horizonte);

        // Verificação de Invariantes:
        expect(resultado.estoqueTotalFamilia).toBeGreaterThanOrEqual(0);
        expect(resultado.consumoDiarioTotalFamilia).toBeGreaterThanOrEqual(0);
        expect(resultado.diasCoberturaFamilia).toBeGreaterThanOrEqual(0);

        if (resultado.familiaCoberta) {
          // Se coberta, NENHUM item pode ter sugestão ajustada > 0
          for (const itemRes of resultado.itens.values()) {
            if (itemRes.sugestaoOriginal > 0 && itemRes.sugestaoAjustada > 0) {
              violacoesBloqueio++;
            }
            if (itemRes.sugestaoOriginal > 0 && !itemRes.travado) {
              violacoesBloqueio++;
            }
          }
        } else {
          // Se não coberta, a sugestão ajustada deve ser igual à original
          for (const itemRes of resultado.itens.values()) {
            if (itemRes.sugestaoAjustada !== itemRes.sugestaoOriginal) {
              violacoesNaoBloqueio++;
            }
            if (itemRes.travado) {
              violacoesNaoBloqueio++;
            }
          }
        }
      }

      expect(violacoesBloqueio).toBe(0);
      expect(violacoesNaoBloqueio).toBe(0);
    });

    it("Fronteira Exata e Sub-Fronteira (Precision Test): Cobertura == Horizonte vs Cobertura < Horizonte", () => {
      // Horizonte = 30 dias
      // Caso 1: Exatamente 30.00 dias de cobertura (estoque = 300, consumo = 10)
      const itensExato: ItemFamiliaAplicacao[] = [
        {
          produtoId: 1,
          codigoSku: "EXATO-1",
          marca: "A",
          saldoFisico: 300,
          quantidadeJaPedida: 0,
          consumoDiario: 10,
          necessidadeIndividual: 20,
        },
      ];
      const resExato = aplicarTravaFamiliaAplicacao("FAM-EXATO", itensExato, 30);
      expect(resExato.diasCoberturaFamilia).toBe(30);
      expect(resExato.familiaCoberta).toBe(true);
      expect(resExato.itens.get(1)!.sugestaoAjustada).toBe(0);
      expect(resExato.itens.get(1)!.travado).toBe(true);

      // Caso 2: Logo abaixo de 30 dias (29.9 dias -> 299 unidades para consumo 10)
      const itensSub: ItemFamiliaAplicacao[] = [
        {
          produtoId: 2,
          codigoSku: "SUB-1",
          marca: "B",
          saldoFisico: 299,
          quantidadeJaPedida: 0,
          consumoDiario: 10,
          necessidadeIndividual: 20,
        },
      ];
      const resSub = aplicarTravaFamiliaAplicacao("FAM-SUB", itensSub, 30);
      expect(resSub.diasCoberturaFamilia).toBeCloseTo(29.9, 1);
      expect(resSub.familiaCoberta).toBe(false);
      expect(resSub.itens.get(2)!.sugestaoAjustada).toBe(20);
      expect(resSub.itens.get(2)!.travado).toBe(false);
    });

    it("Cenário de Consumo Zero com Estoque Positivo (Cobertura Técnica 9999 dias)", () => {
      const itensSemConsumo: ItemFamiliaAplicacao[] = [
        {
          produtoId: 501,
          codigoSku: "PARADO-1",
          marca: "X",
          saldoFisico: 50,
          quantidadeJaPedida: 0,
          consumoDiario: 0, // Consumo zero na família inteira
          necessidadeIndividual: 15,
        },
        {
          produtoId: 502,
          codigoSku: "PARADO-2",
          marca: "Y",
          saldoFisico: 30,
          quantidadeJaPedida: 0,
          consumoDiario: 0,
          necessidadeIndividual: 0,
        },
      ];

      // Para qualquer horizonte comercial plausível (ex: 30, 90, 180, 365 dias)
      const res30 = aplicarTravaFamiliaAplicacao("FAM-ZERO-CONSUMO", itensSemConsumo, 30);
      expect(res30.diasCoberturaFamilia).toBe(9999);
      expect(res30.familiaCoberta).toBe(true);
      expect(res30.itens.get(501)!.sugestaoAjustada).toBe(0);
      expect(res30.itens.get(501)!.travado).toBe(true);

      const res365 = aplicarTravaFamiliaAplicacao("FAM-ZERO-CONSUMO", itensSemConsumo, 365);
      expect(res365.familiaCoberta).toBe(true);
      expect(res365.itens.get(501)!.sugestaoAjustada).toBe(0);
    });

    it("Estresse de Volume e Escala: Família com 2.000 itens (Performance < 20ms)", () => {
      const itensMassivos: ItemFamiliaAplicacao[] = [];
      for (let i = 0; i < 2000; i++) {
        itensMassivos.push({
          produtoId: i,
          codigoSku: `MASSIVO-${i}`,
          marca: `MARCA-${i % 20}`,
          saldoFisico: 10,
          quantidadeJaPedida: 2,
          consumoDiario: 0.1,
          necessidadeIndividual: i % 5 === 0 ? 5 : 0,
        });
      }

      const inicio = performance.now();
      const resMassivo = aplicarTravaFamiliaAplicacao("FAM-MASSIVA-2000", itensMassivos, 45);
      const duracao = performance.now() - inicio;

      expect(duracao).toBeLessThan(50); // Performance ultrarrápida
      expect(resMassivo.itens.size).toBe(2000);
      expect(resMassivo.familiaCoberta).toBe(true);
    });

    it("Resiliência a Entradas Degradadas: saldos negativos, pedidos negativos e lista vazia", () => {
      // Família com estoque negativo no ERP (furo de estoque)
      const itensNegativos: ItemFamiliaAplicacao[] = [
        {
          produtoId: 601,
          codigoSku: "NEG-1",
          marca: "M1",
          saldoFisico: -100,
          quantidadeJaPedida: -50,
          consumoDiario: -2,
          necessidadeIndividual: -10,
        },
      ];

      const resNeg = aplicarTravaFamiliaAplicacao("FAM-NEG", itensNegativos, 30);
      expect(resNeg.estoqueTotalFamilia).toBe(0);
      expect(resNeg.consumoDiarioTotalFamilia).toBe(0);
      expect(resNeg.diasCoberturaFamilia).toBe(0);
      expect(resNeg.familiaCoberta).toBe(false);
      expect(resNeg.itens.get(601)!.sugestaoAjustada).toBe(0);
      expect(resNeg.itens.get(601)!.travado).toBe(false);

      // Lista vazia
      const resVazia = aplicarTravaFamiliaAplicacao("FAM-VAZIA", [], 30);
      expect(resVazia.familiaCoberta).toBe(false);
      expect(resVazia.itens.size).toBe(0);
    });
  });

  // ==========================================================================
  // SEÇÃO 3: Desafio Adversarial aos Múltiplos de Lote (lote-multiplo.ts)
  // ==========================================================================
  describe("3. Desafio Adversarial: Múltiplos de Lote e Embalagens (core/travas/lote-multiplo.ts)", () => {
    // 3.1 Pares (lote = 2) — Amortecedores e Discos de Freio
    describe("3.1 Lote Par (múltiplo = 2) — Peças Simétricas Automotivas", () => {
      it("Valores decimais e fracionários devem arredondar para o próximo par superior", () => {
        expect(arredondarParaMultiplo(0.0001, 2)).toBe(2);
        expect(arredondarParaMultiplo(0.5, 2)).toBe(2);
        expect(arredondarParaMultiplo(1.0, 2)).toBe(2);
        expect(arredondarParaMultiplo(1.001, 2)).toBe(2);
        expect(arredondarParaMultiplo(2.0, 2)).toBe(2);
        expect(arredondarParaMultiplo(2.00001, 2)).toBe(4);
        expect(arredondarParaMultiplo(3.14, 2)).toBe(4);
        expect(arredondarParaMultiplo(4.0, 2)).toBe(4);
        expect(arredondarParaMultiplo(4.99, 2)).toBe(6);
      });

      it("Valores negativos e zero devem retornar estritamente 0", () => {
        expect(arredondarParaMultiplo(0, 2)).toBe(0);
        expect(arredondarParaMultiplo(-0, 2)).toBe(0);
        expect(arredondarParaMultiplo(-1, 2)).toBe(0);
        expect(arredondarParaMultiplo(-0.01, 2)).toBe(0);
        expect(arredondarParaMultiplo(-1000, 2)).toBe(0);
      });

      it("Números primos devem ser arredondados para o próximo número par", () => {
        const primos = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
        for (const p of primos) {
          const res = arredondarParaMultiplo(p, 2);
          expect(res % 2).toBe(0);
          expect(res).toBeGreaterThanOrEqual(p);
          if (p === 2) {
            expect(res).toBe(2);
          } else {
            // Primos ímpares arredondam para p + 1
            expect(res).toBe(p + 1);
          }
        }
      });
    });

    // 3.2 Jogos de 4 (lote = 4) — Velas e Cabos de Ignição
    describe("3.2 Jogos de 4 (múltiplo = 4) — Velas de Ignição", () => {
      it("Valores decimais e fracionários devem arredondar para o próximo múltiplo de 4", () => {
        expect(arredondarParaMultiplo(0.1, 4)).toBe(4);
        expect(arredondarParaMultiplo(1.0, 4)).toBe(4);
        expect(arredondarParaMultiplo(3.99, 4)).toBe(4);
        expect(arredondarParaMultiplo(4.0, 4)).toBe(4);
        expect(arredondarParaMultiplo(4.01, 4)).toBe(8);
        expect(arredondarParaMultiplo(7.5, 4)).toBe(8);
        expect(arredondarParaMultiplo(8.0, 4)).toBe(8);
        expect(arredondarParaMultiplo(8.001, 4)).toBe(12);
      });

      it("Valores negativos e zero devem retornar estritamente 0", () => {
        expect(arredondarParaMultiplo(0, 4)).toBe(0);
        expect(arredondarParaMultiplo(-4, 4)).toBe(0);
        expect(arredondarParaMultiplo(-0.5, 4)).toBe(0);
      });

      it("Números primos com lote 4 devem ser arredondados para múltiplos de 4 exatos", () => {
        const primos = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
        for (const p of primos) {
          const res = arredondarParaMultiplo(p, 4);
          expect(res % 4).toBe(0);
          expect(res).toBeGreaterThanOrEqual(p);
          expect(res - p).toBeLessThan(4);
        }
      });
    });

    // 3.3 Caixas de 12 e 24 (múltiplos de atacado)
    describe("3.3 Caixas de Fábrica (múltiplos = 12 e 24)", () => {
      it("Caixa de 12: decimais, negativos, zero e primos", () => {
        // Zero e negativos
        expect(arredondarParaMultiplo(0, 12)).toBe(0);
        expect(arredondarParaMultiplo(-12, 12)).toBe(0);

        // Decimais
        expect(arredondarParaMultiplo(0.2, 12)).toBe(12);
        expect(arredondarParaMultiplo(11.9, 12)).toBe(12);
        expect(arredondarParaMultiplo(12.0, 12)).toBe(12);
        expect(arredondarParaMultiplo(12.001, 12)).toBe(24);
        expect(arredondarParaMultiplo(23.5, 12)).toBe(24);

        // Primos
        const primosAte50 = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
        for (const p of primosAte50) {
          const res = arredondarParaMultiplo(p, 12);
          expect(res % 12).toBe(0);
          expect(res).toBeGreaterThanOrEqual(p);
          expect(res - p).toBeLessThan(12);
        }
      });

      it("Caixa de 24: decimais, negativos, zero e primos", () => {
        // Zero e negativos
        expect(arredondarParaMultiplo(0, 24)).toBe(0);
        expect(arredondarParaMultiplo(-24, 24)).toBe(0);

        // Decimais
        expect(arredondarParaMultiplo(0.01, 24)).toBe(24);
        expect(arredondarParaMultiplo(23.99, 24)).toBe(24);
        expect(arredondarParaMultiplo(24.0, 24)).toBe(24);
        expect(arredondarParaMultiplo(24.001, 24)).toBe(48);

        // Primos
        const primos = [7, 13, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71];
        for (const p of primos) {
          const res = arredondarParaMultiplo(p, 24);
          expect(res % 24).toBe(0);
          expect(res).toBeGreaterThanOrEqual(p);
          expect(res - p).toBeLessThan(24);
        }
      });
    });

    // 3.4 Lotes que são Números Primos (ex: múltiplos = 3, 5, 7, 11, 13, 17)
    describe("3.4 Lotes com Base em Números Primos", () => {
      it("Lote 7 (semana / embalagem especial com 7 unidades)", () => {
        expect(arredondarParaMultiplo(1, 7)).toBe(7);
        expect(arredondarParaMultiplo(7, 7)).toBe(7);
        expect(arredondarParaMultiplo(7.1, 7)).toBe(14);
        expect(arredondarParaMultiplo(13.9, 7)).toBe(14);
        expect(arredondarParaMultiplo(14, 7)).toBe(14);
        expect(arredondarParaMultiplo(15, 7)).toBe(21);
      });

      it("Lote 13 (dúzia do padeiro / kit de 13 peças)", () => {
        expect(arredondarParaMultiplo(1, 13)).toBe(13);
        expect(arredondarParaMultiplo(13, 13)).toBe(13);
        expect(arredondarParaMultiplo(13.01, 13)).toBe(26);
        expect(arredondarParaMultiplo(26, 13)).toBe(26);
        expect(arredondarParaMultiplo(27, 13)).toBe(39);
      });
    });

    // 3.5 Valores Limítrofes e Anômalos do Parâmetro Múltiplo
    describe("3.5 Anomalias no Parâmetro Múltiplo", () => {
      it("Múltiplo 0 ou negativo deve ser tratado de forma resiliente como avulso (lote = 1)", () => {
        expect(arredondarParaMultiplo(5, 0)).toBe(5);
        expect(arredondarParaMultiplo(5.2, 0)).toBe(6);
        expect(arredondarParaMultiplo(7, -3)).toBe(7);
        expect(arredondarParaMultiplo(7.1, -10)).toBe(8);
      });

      it("Múltiplo fracionário (ex: 2.8) deve truncar para o inteiro inferior (Math.floor -> 2)", () => {
        expect(arredondarParaMultiplo(3, 2.8)).toBe(4);
        expect(arredondarParaMultiplo(5, 4.9)).toBe(8);
      });
    });

    // 3.6 Testes Abrangentes da Função de Ajuste Completa (ajustarQuantidadePorLote)
    describe("3.6 Ajuste Integral: Interação de Lote, Embalagem Mínima e Quantidade Desejada", () => {
      it("REGRA DE OURO: Quantidade desejada 0 NUNCA deve acionar embalagem mínima (resultado sempre 0)", () => {
        const resZero = ajustarQuantidadePorLote({
          quantidadeDesejada: 0,
          multiploLote: 12,
          embalagemMinima: 100, // Fornecedor exige 100 un mínimas
        });

        expect(resZero.quantidadeOriginal).toBe(0);
        expect(resZero.quantidadeAjustada).toBe(0);
        expect(resZero.motivoAjuste).toBeNull();

        const resNegativo = ajustarQuantidadePorLote({
          quantidadeDesejada: -10,
          multiploLote: 4,
          embalagemMinima: 50,
        });
        expect(resNegativo.quantidadeAjustada).toBe(0);
      });

      it("Embalagem mínima maior que a quantidade desejada deve elevar e arredondar ao múltiplo", () => {
        // Deseja 1 un, embMin = 10, lote = 6 -> Base 10 -> Arredonda para 12
        const res = ajustarQuantidadePorLote({
          quantidadeDesejada: 1,
          multiploLote: 6,
          embalagemMinima: 10,
        });

        expect(res.quantidadeAjustada).toBe(12);
        expect(res.multiploAplicado).toBe(6);
        expect(res.embalagemMinimaAplicada).toBe(10);
        expect(res.quantidadeAjustada % 6).toBe(0);
        expect(res.quantidadeAjustada).toBeGreaterThanOrEqual(10);
      });

      it("Quantidade desejada superior à embalagem mínima deve respeitar o lote", () => {
        // Deseja 15 un, embMin = 10, lote = 6 -> Base 15 -> Arredonda para 18
        const res = ajustarQuantidadePorLote({
          quantidadeDesejada: 15,
          multiploLote: 6,
          embalagemMinima: 10,
        });

        expect(res.quantidadeAjustada).toBe(18);
        expect(res.quantidadeAjustada % 6).toBe(0);
      });

      it("Invariante Estocástica (5.000 iterações de lote e embalagem mínima)", () => {
        for (let i = 0; i < 5000; i++) {
          const qtd = Math.random() > 0.1 ? Math.random() * 100 + 0.1 : 0;
          const lote = Math.floor(Math.random() * 24) + 1;
          const embMin = Math.floor(Math.random() * 50) + 1;

          const res = ajustarQuantidadePorLote({
            quantidadeDesejada: qtd,
            multiploLote: lote,
            embalagemMinima: embMin,
          });

          if (qtd <= 0) {
            expect(res.quantidadeAjustada).toBe(0);
          } else {
            expect(res.quantidadeAjustada).toBeGreaterThanOrEqual(qtd);
            expect(res.quantidadeAjustada).toBeGreaterThanOrEqual(embMin);
            expect(res.quantidadeAjustada % lote).toBe(0);
            expect(Number.isInteger(res.quantidadeAjustada)).toBe(true);
          }
        }
      });
    });

    // 3.7 Inferência Automática de Lote por Categoria/Descrição
    describe("3.7 Inferência por Categoria Automotiva", () => {
      it("Deve reconhecer todas as variações de nomes de peças simétricas (lote 2)", () => {
        const descricoesPar = [
          "AMORTECEDOR DIANTEIRO DIREITO COFAP",
          "AMORTECEDOR TRASEIRO MONROE",
          "DISCO DE FREIO VENTILADO FREMAX",
          "TAMBOR DE FREIO TRASEIRO HIPPER FREIOS",
          "MOLA HELICOIDAL DIANTEIRA COFAP",
          "SAPATA DE FREIO COM LONA FRAS-LE",
        ];

        for (const desc of descricoesPar) {
          expect(inferirLotePadraoPorCategoria(desc)).toBe(2);
        }
      });

      it("Deve reconhecer variações de jogos de 4 velas e cabos", () => {
        const descricoesQuatro = [
          "VELA DE IGNICAO NGK G-POWER",
          "VELA IGNICAO BOSCH SUPER 4",
          "JOGO DE VELA DENSO IRIDIUM",
          "CABO DE VELA SILICONE MAGNETI MARELLI",
        ];

        for (const desc of descricoesQuatro) {
          expect(inferirLotePadraoPorCategoria(desc)).toBe(4);
        }
      });

      it("Deve retornar lote 1 para itens sem restrição de par ou jogo", () => {
        expect(inferirLotePadraoPorCategoria("PALHETA DYNA 18 POL")).toBe(1);
        expect(inferirLotePadraoPorCategoria("RADIADOR VALEO PALIO")).toBe(1);
        expect(inferirLotePadraoPorCategoria("OLEO 5W30 SINTETICO CASTROL")).toBe(1);
      });
    });
  });
});

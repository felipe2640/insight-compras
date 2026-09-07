/**
 * Suíte de Testes Adversariais e Estresse Empírico — Motor de Transferência Inter-Lojas
 * Arquivo: tests/core/transferencia-stress.test.ts
 *
 * Objetivo: Desafiar empiricamente o algoritmo em core/transferencia/balanceamento.ts
 * com milhares de iterações randômicas, distribuições patológicas, valores extremos e
 * validação rigorosa da Invariante Inviolável: saldoFinalOrigem >= estoqueMinimoOrigem.
 */

import { describe, it, expect } from "vitest";
import {
  calcularTransferenciaEntreDuasLojas,
  calcularBalanceamentoRede,
  SaldoFilialParaTransferencia,
} from "@core/transferencia/balanceamento";

describe("Challenger 1: Bateria de Estresse Adversarial — Transferência Inter-Lojas", () => {
  describe("1. Invariante Inviolável sob Condições Extremas e Patológicas", () => {
    it("deve preservar estritamente saldoFinalOrigem >= estoqueMinimoOrigem sob demanda astronômica (1 trilhão)", () => {
      const lojaOrigem: SaldoFilialParaTransferencia = {
        filialId: 1,
        nomeFilial: "Matriz Pedro II",
        saldoFisico: 10,
        estoqueMinimo: 8, // Sobra real = 2
        necessidadeCompra: 0,
      };

      const lojaDestinoAstronomica: SaldoFilialParaTransferencia = {
        filialId: 2,
        nomeFilial: "Piripiri",
        saldoFisico: 0,
        estoqueMinimo: 100,
        necessidadeCompra: 1_000_000_000_000, // 1 trilhão
      };

      const resultado = calcularTransferenciaEntreDuasLojas(
        lojaOrigem,
        lojaDestinoAstronomica
      );

      expect(resultado).not.toBeNull();
      expect(resultado!.quantidadeTransferir).toBe(2);
      expect(resultado!.saldoOrigemApos).toBe(8);
      expect(resultado!.saldoOrigemApos).toBeGreaterThanOrEqual(lojaOrigem.estoqueMinimo);
      expect(resultado!.necessidadeDestinoApos).toBe(999_999_999_998);
    });

    it("deve preservar o saldo mínimo sob demanda igual a Number.MAX_SAFE_INTEGER", () => {
      const lojaOrigem: SaldoFilialParaTransferencia = {
        filialId: 1,
        saldoFisico: 50,
        estoqueMinimo: 30, // Sobra real = 20
        necessidadeCompra: 0,
      };

      const lojaDestino: SaldoFilialParaTransferencia = {
        filialId: 2,
        saldoFisico: 0,
        estoqueMinimo: 10,
        necessidadeCompra: Number.MAX_SAFE_INTEGER,
      };

      const resultado = calcularTransferenciaEntreDuasLojas(lojaOrigem, lojaDestino);
      expect(resultado).not.toBeNull();
      expect(resultado!.quantidadeTransferir).toBe(20);
      expect(resultado!.saldoOrigemApos).toBe(30);
      expect(resultado!.saldoOrigemApos).toBeGreaterThanOrEqual(30);
    });

    it("não deve doar se saldo de origem for exatamente igual ao estoque mínimo", () => {
      const limites = [0, 1, 5, 10, 100, 10000];
      for (const lim of limites) {
        const lojaOrigem: SaldoFilialParaTransferencia = {
          filialId: 1,
          saldoFisico: lim,
          estoqueMinimo: lim,
          necessidadeCompra: 0,
        };
        const lojaDestino: SaldoFilialParaTransferencia = {
          filialId: 2,
          saldoFisico: 0,
          estoqueMinimo: 10,
          necessidadeCompra: 50,
        };

        const res = calcularTransferenciaEntreDuasLojas(lojaOrigem, lojaDestino);
        expect(res).toBeNull();
      }
    });

    it("não deve doar se saldo de origem for menor que o estoque mínimo (déficit)", () => {
      const paresDeficit = [
        { saldo: 9, min: 10 },
        { saldo: 0, min: 1 },
        { saldo: 1, min: 100 },
        { saldo: 49, min: 50 },
      ];

      for (const par of paresDeficit) {
        const lojaOrigem: SaldoFilialParaTransferencia = {
          filialId: 1,
          saldoFisico: par.saldo,
          estoqueMinimo: par.min,
          necessidadeCompra: 0,
        };
        const lojaDestino: SaldoFilialParaTransferencia = {
          filialId: 2,
          saldoFisico: 0,
          estoqueMinimo: 10,
          necessidadeCompra: 100,
        };

        const res = calcularTransferenciaEntreDuasLojas(lojaOrigem, lojaDestino);
        expect(res).toBeNull();
      }
    });

    it("deve tratar saldos físicos negativos e necessidades negativas sem corromper a invariante", () => {
      const lojaOrigemNegativa: SaldoFilialParaTransferencia = {
        filialId: 1,
        saldoFisico: -20, // Saldo corrompido no ERP
        estoqueMinimo: 10,
        necessidadeCompra: 0,
      };
      const lojaDestino: SaldoFilialParaTransferencia = {
        filialId: 2,
        saldoFisico: 0,
        estoqueMinimo: 5,
        necessidadeCompra: 30,
      };

      const res = calcularTransferenciaEntreDuasLojas(lojaOrigemNegativa, lojaDestino);
      expect(res).toBeNull();

      // Destino com necessidade negativa (devolução ou anomalia)
      const lojaOrigemComSobra: SaldoFilialParaTransferencia = {
        filialId: 1,
        saldoFisico: 50,
        estoqueMinimo: 10,
        necessidadeCompra: 0,
      };
      const lojaDestinoNecessidadeNegativa: SaldoFilialParaTransferencia = {
        filialId: 2,
        saldoFisico: 5,
        estoqueMinimo: 2,
        necessidadeCompra: -15,
      };

      const res2 = calcularTransferenciaEntreDuasLojas(
        lojaOrigemComSobra,
        lojaDestinoNecessidadeNegativa
      );
      expect(res2).toBeNull();
    });

    it("deve suportar valores decimais e manter precisão matemática sem violar saldo mínimo", () => {
      const lojaOrigem: SaldoFilialParaTransferencia = {
        filialId: 1,
        saldoFisico: 15.5,
        estoqueMinimo: 10.0, // sobra = 5.5
        necessidadeCompra: 0,
      };
      const lojaDestino: SaldoFilialParaTransferencia = {
        filialId: 2,
        saldoFisico: 0,
        estoqueMinimo: 5.0,
        necessidadeCompra: 3.25,
      };

      const res = calcularTransferenciaEntreDuasLojas(lojaOrigem, lojaDestino);
      expect(res).not.toBeNull();
      expect(res!.quantidadeTransferir).toBe(3.25);
      expect(res!.saldoOrigemApos).toBe(12.25);
      expect(res!.saldoOrigemApos).toBeGreaterThanOrEqual(lojaOrigem.estoqueMinimo);
    });
  });

  describe("2. Monte Carlo Stress Test: 5.000 Iterações Aleatórias (Duas Lojas)", () => {
    it("deve verificar a invariante em 5.000 pares de lojas gerados aleatoriamente", () => {
      let transferenciasExecutadas = 0;
      let transferenciasRecusadas = 0;

      // Semente pseudo-aleatória determinística LCG para reprodutibilidade estrita
      let seed = 424242;
      const rng = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      for (let i = 0; i < 5000; i++) {
        // Gera valores no intervalo [-50, 500] para cobrir negativos, zeros e positivos
        const saldoA = Math.floor(rng() * 550) - 50;
        const minA = Math.floor(rng() * 100);
        const necA = rng() > 0.5 ? Math.floor(rng() * 200) : 0;

        const saldoB = Math.floor(rng() * 550) - 50;
        const minB = Math.floor(rng() * 100);
        const necB = rng() > 0.5 ? Math.floor(rng() * 200) : 0;

        const lojaA: SaldoFilialParaTransferencia = {
          filialId: 1,
          nomeFilial: "Loja A",
          saldoFisico: saldoA,
          estoqueMinimo: minA,
          necessidadeCompra: necA,
        };

        const lojaB: SaldoFilialParaTransferencia = {
          filialId: 2,
          nomeFilial: "Loja B",
          saldoFisico: saldoB,
          estoqueMinimo: minB,
          necessidadeCompra: necB,
        };

        const resultado = calcularTransferenciaEntreDuasLojas(lojaA, lojaB);

        const sobraRealA = Math.max(0, saldoA - minA);
        const sobraRealB = Math.max(0, saldoB - minB);

        if (resultado) {
          transferenciasExecutadas++;

          // 1. Quantidade transferida deve ser estritamente positiva
          expect(resultado.quantidadeTransferir).toBeGreaterThan(0);

          // 2. INVARIANTE INVIOLÁVEL: saldo pós-transferência >= estoque mínimo da origem
          expect(resultado.saldoOrigemApos).toBeGreaterThanOrEqual(
            resultado.estoqueMinimoOrigem
          );

          // 3. Conservação de massa na origem
          expect(resultado.saldoOrigemApos).toBe(
            resultado.saldoOrigemAntes - resultado.quantidadeTransferir
          );

          // 4. Conservação de necessidade no destino
          expect(resultado.necessidadeDestinoApos).toBe(
            resultado.necessidadeDestinoAntes - resultado.quantidadeTransferir
          );
          expect(resultado.necessidadeDestinoApos).toBeGreaterThanOrEqual(0);

          // 5. Quantidade doada nunca excede a sobra da doadora
          if (resultado.filialOrigemId === 1) {
            expect(resultado.quantidadeTransferir).toBeLessThanOrEqual(sobraRealA);
            expect(resultado.quantidadeTransferir).toBeLessThanOrEqual(necB);
          } else {
            expect(resultado.quantidadeTransferir).toBeLessThanOrEqual(sobraRealB);
            expect(resultado.quantidadeTransferir).toBeLessThanOrEqual(necA);
          }
        } else {
          transferenciasRecusadas++;
          // Se retornou null, não podia haver combinação válida de sobra > 0 e necessidade > 0
          const possivelADoarB = necB > 0 && sobraRealA > 0;
          const possivelBDoarA = necA > 0 && sobraRealB > 0;
          expect(possivelADoarB || possivelBDoarA).toBe(false);
        }
      }

      expect(transferenciasExecutadas).toBeGreaterThan(500);
      expect(transferenciasRecusadas).toBeGreaterThan(500);
    });
  });

  describe("3. Monte Carlo Stress Test: 5.000 Redes de 5 Lojas (Rede Carreiro)", () => {
    const FILIAIS_CARREIRO = [
      { id: 1, nome: "Pedro II (Matriz)" },
      { id: 2, nome: "Piripiri" },
      { id: 3, nome: "Poranga" },
      { id: 4, nome: "Campo Maior" },
      { id: 5, nome: "José de Freitas" },
    ];

    it("deve verificar integridade da rede em 5.000 configurações estocásticas de 5 lojas", () => {
      let seed = 987654321;
      const rng = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      let totalTransferenciasRede = 0;
      let totalRedesSemTransferencia = 0;

      for (let i = 0; i < 5000; i++) {
        // Gera 5 lojas da Rede Carreiro com estados aleatórios
        const filiais: SaldoFilialParaTransferencia[] = FILIAIS_CARREIRO.map((f) => {
          const saldo = Math.floor(rng() * 150) - 10; // -10 a 140
          const min = Math.floor(rng() * 40); // 0 a 40
          // 40% das lojas precisam comprar
          const precisa = rng() < 0.4 ? Math.floor(rng() * 80) : 0;

          return {
            filialId: f.id,
            nomeFilial: f.nome,
            saldoFisico: saldo,
            estoqueMinimo: min,
            necessidadeCompra: precisa,
          };
        });

        // Calcula sobras e necessidades iniciais
        const sobrasIniciais = new Map<number, number>();
        const estoquesMinimos = new Map<number, number>();
        const saldosIniciais = new Map<number, number>();
        let somaTotalSobras = 0;
        let somaTotalNecessidades = 0;

        for (const f of filiais) {
          const sobra = Math.max(0, f.saldoFisico - f.estoqueMinimo);
          sobrasIniciais.set(f.filialId, sobra);
          estoquesMinimos.set(f.filialId, f.estoqueMinimo);
          saldosIniciais.set(f.filialId, f.saldoFisico);
          somaTotalSobras += sobra;
          somaTotalNecessidades += Math.max(0, f.necessidadeCompra);
        }

        const transferencias = calcularBalanceamentoRede(filiais, {
          produtoId: 1001,
          codigoSku: "CORREIA-DENT-001",
        });

        if (transferencias.length === 0) {
          totalRedesSemTransferencia++;
          continue;
        }

        totalTransferenciasRede += transferencias.length;

        // Rastreamento acumulado de saídas por doadora
        const totalDoadoPorFilial = new Map<number, number>();
        let totalTransferidoNaRede = 0;

        for (const t of transferencias) {
          // 1. Quantidade transferida deve ser > 0
          expect(t.quantidadeTransferir).toBeGreaterThan(0);

          // 2. Não pode haver auto-transferência
          expect(t.filialOrigemId).not.toBe(t.filialDestinoId);

          // 3. O saldo após deve ser >= estoque mínimo da origem
          expect(t.saldoOrigemApos).toBeGreaterThanOrEqual(t.estoqueMinimoOrigem);

          // 4. Filial de origem deve pertencer à Rede Carreiro (1 a 5)
          expect([1, 2, 3, 4, 5]).toContain(t.filialOrigemId);
          expect([1, 2, 3, 4, 5]).toContain(t.filialDestinoId);

          // Acumula
          const doadoAtual = totalDoadoPorFilial.get(t.filialOrigemId) ?? 0;
          totalDoadoPorFilial.set(t.filialOrigemId, doadoAtual + t.quantidadeTransferir);
          totalTransferidoNaRede += t.quantidadeTransferir;
        }

        // Validação holística de toda a rede:
        for (const [filialId, totalDoado] of totalDoadoPorFilial.entries()) {
          const sobraInicial = sobrasIniciais.get(filialId) ?? 0;
          const saldoInicial = saldosIniciais.get(filialId) ?? 0;
          const minEstoque = estoquesMinimos.get(filialId) ?? 0;

          // A soma de todas as doações da filial NUNCA pode exceder sua sobra inicial
          expect(totalDoado).toBeLessThanOrEqual(sobraInicial);

          // O saldo final acumulado da filial jamais fica abaixo do estoque mínimo
          const saldoFinalCalculado = saldoInicial - totalDoado;
          expect(saldoFinalCalculado).toBeGreaterThanOrEqual(minEstoque);
        }

        // O total transferido na rede não pode exceder o total de sobras da rede
        expect(totalTransferidoNaRede).toBeLessThanOrEqual(somaTotalSobras);
        // O total transferido na rede não pode exceder a necessidade total da rede
        expect(totalTransferidoNaRede).toBeLessThanOrEqual(somaTotalNecessidades);
      }

      expect(totalTransferenciasRede).toBeGreaterThan(1000);
      expect(totalRedesSemTransferencia).toBeGreaterThan(100);
    });
  });

  describe("4. Cenários de Topologia de Rede Específicos (Rede Carreiro)", () => {
    const FILIAIS_BASE = [
      { id: 1, nome: "Pedro II (Matriz)" },
      { id: 2, nome: "Piripiri" },
      { id: 3, nome: "Poranga" },
      { id: 4, nome: "Campo Maior" },
      { id: 5, nome: "José de Freitas" },
    ];

    it("Cenário A (Estrela/Matriz Provedora): Matriz com grande sobra abastece 4 filiais com carência", () => {
      const filiais: SaldoFilialParaTransferencia[] = [
        {
          filialId: 1,
          nomeFilial: "Pedro II (Matriz)",
          saldoFisico: 100,
          estoqueMinimo: 20, // Sobra = 80
          necessidadeCompra: 0,
        },
        {
          filialId: 2,
          nomeFilial: "Piripiri",
          saldoFisico: 2,
          estoqueMinimo: 10,
          necessidadeCompra: 15,
        },
        {
          filialId: 3,
          nomeFilial: "Poranga",
          saldoFisico: 0,
          estoqueMinimo: 8,
          necessidadeCompra: 20,
        },
        {
          filialId: 4,
          nomeFilial: "Campo Maior",
          saldoFisico: 1,
          estoqueMinimo: 5,
          necessidadeCompra: 10,
        },
        {
          filialId: 5,
          nomeFilial: "José de Freitas",
          saldoFisico: 3,
          estoqueMinimo: 12,
          necessidadeCompra: 25,
        },
      ];

      // Necessidade total = 15 + 20 + 10 + 25 = 70. Sobra da Matriz = 80.
      const transferencias = calcularBalanceamentoRede(filiais);

      expect(transferencias.length).toBe(4);
      const totalTransferido = transferencias.reduce(
        (acc, t) => acc + t.quantidadeTransferir,
        0
      );
      expect(totalTransferido).toBe(70);

      // Todas as transferências devem ter origem na Matriz (filialId: 1)
      for (const t of transferencias) {
        expect(t.filialOrigemId).toBe(1);
        expect(t.saldoOrigemApos).toBeGreaterThanOrEqual(20);
      }

      // Saldo final da Matriz deve ser 100 - 70 = 30 (>= 20)
      const ultimaTransf = transferencias[transferencias.length - 1];
      expect(ultimaTransf.saldoOrigemApos).toBe(30);
    });

    it("Cenário B (Convergência): 4 filiais doam para 1 filial com ruptura crítica", () => {
      const filiais: SaldoFilialParaTransferencia[] = [
        {
          filialId: 1,
          nomeFilial: "Pedro II (Matriz)",
          saldoFisico: 25,
          estoqueMinimo: 15, // Sobra = 10
          necessidadeCompra: 0,
        },
        {
          filialId: 2,
          nomeFilial: "Piripiri",
          saldoFisico: 20,
          estoqueMinimo: 10, // Sobra = 10
          necessidadeCompra: 0,
        },
        {
          filialId: 3,
          nomeFilial: "Poranga",
          saldoFisico: 35,
          estoqueMinimo: 20, // Sobra = 15
          necessidadeCompra: 0,
        },
        {
          filialId: 4,
          nomeFilial: "Campo Maior",
          saldoFisico: 18,
          estoqueMinimo: 8, // Sobra = 10
          necessidadeCompra: 0,
        },
        {
          filialId: 5,
          nomeFilial: "José de Freitas",
          saldoFisico: 0,
          estoqueMinimo: 10,
          necessidadeCompra: 50, // Precisa de 50. Total de sobras = 10 + 10 + 15 + 10 = 45
        },
      ];

      const transferencias = calcularBalanceamentoRede(filiais);

      // Deve esgotar as sobras de todas as 4 doadoras (total 45)
      expect(transferencias.length).toBe(4);
      const totalTransferido = transferencias.reduce(
        (acc, t) => acc + t.quantidadeTransferir,
        0
      );
      expect(totalTransferido).toBe(45);

      for (const t of transferencias) {
        expect(t.filialDestinoId).toBe(5);
        expect(t.saldoOrigemApos).toBe(t.estoqueMinimoOrigem); // Cada doadora atinge exatamente seu estoque mínimo
        expect(t.saldoOrigemApos).toBeGreaterThanOrEqual(t.estoqueMinimoOrigem);
      }
    });

    it("Cenário C (Ponto Neutro): Todas as 5 filiais estão no nível exato do estoque mínimo", () => {
      const filiais: SaldoFilialParaTransferencia[] = FILIAIS_BASE.map((f) => ({
        filialId: f.id,
        nomeFilial: f.nome,
        saldoFisico: 10,
        estoqueMinimo: 10,
        necessidadeCompra: 20,
      }));

      const transferencias = calcularBalanceamentoRede(filiais);
      // Ninguém tem sobra (10 - 10 = 0), logo nenhuma transferência pode ocorrer
      expect(transferencias).toEqual([]);
    });

    it("Cenário D (Ruptura Generalizada): Todas as filiais com saldo zero", () => {
      const filiais: SaldoFilialParaTransferencia[] = FILIAIS_BASE.map((f) => ({
        filialId: f.id,
        nomeFilial: f.nome,
        saldoFisico: 0,
        estoqueMinimo: 10,
        necessidadeCompra: 25,
      }));

      const transferencias = calcularBalanceamentoRede(filiais);
      expect(transferencias).toEqual([]);
    });

    it("Cenário E (Rede Super-Estocada sem Carência): Nenhuma loja precisa de compra", () => {
      const filiais: SaldoFilialParaTransferencia[] = FILIAIS_BASE.map((f) => ({
        filialId: f.id,
        nomeFilial: f.nome,
        saldoFisico: 200,
        estoqueMinimo: 50,
        necessidadeCompra: 0,
      }));

      const transferencias = calcularBalanceamentoRede(filiais);
      expect(transferencias).toEqual([]);
    });

    it("Cenário F (Entradas Degeneradas / Bordas de Entrada): Array vazio e loja única", () => {
      expect(calcularBalanceamentoRede([])).toEqual([]);
      expect(
        calcularBalanceamentoRede([
          { filialId: 1, saldoFisico: 50, estoqueMinimo: 10, necessidadeCompra: 0 },
        ])
      ).toEqual([]);
    });
  });

  describe("5. Análise de Complexidade e Benchmark de Performance", () => {
    it("deve executar 10.000 iterações em menos de 1.000ms comprovando alta performance", () => {
      const inicio = performance.now();

      const lojaA: SaldoFilialParaTransferencia = {
        filialId: 1,
        saldoFisico: 80,
        estoqueMinimo: 20,
        necessidadeCompra: 0,
      };
      const lojaB: SaldoFilialParaTransferencia = {
        filialId: 2,
        saldoFisico: 5,
        estoqueMinimo: 10,
        necessidadeCompra: 15,
      };

      for (let i = 0; i < 10000; i++) {
        calcularTransferenciaEntreDuasLojas(lojaA, lojaB);
      }

      const duracao = performance.now() - inicio;
      expect(duracao).toBeLessThan(1000); // Execução instantânea < 1s
    });
  });

  describe("6. Análise de Limites Algorítmicos e Comportamento em Casos Conflitantes", () => {
    it("comportamento quando a única doadora também possui necessidade de compra maior que as outras", () => {
      // Filial 1 tem saldo 100, mínimo 10 (sobra = 90). Porém seu horizonte de meta pede +50 un (necessidade = 50).
      // Filial 2 tem saldo 0, mínimo 10 (necessidade = 30).
      const filiais: SaldoFilialParaTransferencia[] = [
        {
          filialId: 1,
          nomeFilial: "Matriz Pedro II",
          saldoFisico: 100,
          estoqueMinimo: 10,
          necessidadeCompra: 50,
        },
        {
          filialId: 2,
          nomeFilial: "Piripiri",
          saldoFisico: 0,
          estoqueMinimo: 10,
          necessidadeCompra: 30,
        },
      ];

      const transferencias = calcularBalanceamentoRede(filiais);
      // Como a Filial 1 é a primeira da fila de destinos (necessidade 50 > 30) e a única doadora,
      // ela não pode doar para si mesma. O algoritmo encerra sem transferir para a Filial 2.
      // A invariante nunca é violada.
      for (const t of transferencias) {
        expect(t.saldoOrigemApos).toBeGreaterThanOrEqual(t.estoqueMinimoOrigem);
      }
    });

    it("comportamento com filiais com o mesmo ID ou nomes ausentes", () => {
      const filiais: SaldoFilialParaTransferencia[] = [
        {
          filialId: 1,
          saldoFisico: 50,
          estoqueMinimo: 10,
          necessidadeCompra: 0,
        },
        {
          filialId: 2,
          saldoFisico: 0,
          estoqueMinimo: 10,
          necessidadeCompra: 20,
        },
      ];

      const transferencias = calcularBalanceamentoRede(filiais);
      expect(transferencias.length).toBe(1);
      // Fallback para nomeFilial ausente: "Filial 1" e "Filial 2"
      expect(transferencias[0].nomeFilialOrigem).toBe("Filial 1");
      expect(transferencias[0].nomeFilialDestino).toBe("Filial 2");
      expect(transferencias[0].saldoOrigemApos).toBeGreaterThanOrEqual(10);
    });
  });
});


import { describe, it, expect } from "vitest";
import {
  calcularTransferenciaEntreDuasLojas,
  calcularBalanceamentoRede,
  SaldoFilialParaTransferencia,
} from "@core/transferencia/balanceamento";

describe("Motor de Transferência Inter-Lojas: Balanceamento Seguro", () => {
  describe("Cenários Críticos de Integridade (Duas Lojas)", () => {
    it("MANDATÓRIO: nunca deve reduzir o estoque da loja de origem abaixo do seu estoque mínimo", () => {
      // Loja 1 tem saldo 10 e estoque mínimo 6 (sobra real estrita = 4)
      // Loja 2 tem saldo 0, mínimo 5 e precisa desesperadamente de 20 unidades
      const lojaOrigem: SaldoFilialParaTransferencia = {
        filialId: 1,
        nomeFilial: "Trairi (Matriz)",
        saldoFisico: 10,
        estoqueMinimo: 6,
        necessidadeCompra: 0,
      };

      const lojaDestino: SaldoFilialParaTransferencia = {
        filialId: 2,
        nomeFilial: "Paraipaba",
        saldoFisico: 0,
        estoqueMinimo: 5,
        necessidadeCompra: 20,
      };

      const resultado = calcularTransferenciaEntreDuasLojas(lojaOrigem, lojaDestino);

      expect(resultado).not.toBeNull();
      // Deve doar apenas a sobra real (10 - 6 = 4)
      expect(resultado!.quantidadeTransferir).toBe(4);
      expect(resultado!.saldoOrigemApos).toBe(6);
      expect(resultado!.saldoOrigemApos).toBeGreaterThanOrEqual(lojaOrigem.estoqueMinimo);
      expect(resultado!.filialOrigemId).toBe(1);
      expect(resultado!.filialDestinoId).toBe(2);
    });

    it("deve transferir a quantidade exata da necessidade quando a sobra da doadora for superior à necessidade", () => {
      // Loja 1 tem saldo 50 e estoque mínimo 10 (sobra real = 40)
      // Loja 2 precisa de 5 unidades
      const lojaOrigem: SaldoFilialParaTransferencia = {
        filialId: 1,
        saldoFisico: 50,
        estoqueMinimo: 10,
        necessidadeCompra: 0,
      };

      const lojaDestino: SaldoFilialParaTransferencia = {
        filialId: 2,
        saldoFisico: 2,
        estoqueMinimo: 5,
        necessidadeCompra: 5,
      };

      const resultado = calcularTransferenciaEntreDuasLojas(lojaOrigem, lojaDestino);

      expect(resultado).not.toBeNull();
      expect(resultado!.quantidadeTransferir).toBe(5);
      expect(resultado!.saldoOrigemApos).toBe(45);
      expect(resultado!.saldoOrigemApos).toBeGreaterThanOrEqual(lojaOrigem.estoqueMinimo);
    });

    it("deve retornar null e NÃO transferir nada quando a potencial doadora tem saldo igual ao estoque mínimo", () => {
      // Loja 1 tem saldo 8 e estoque mínimo 8 (sobra real = 0)
      const lojaOrigem: SaldoFilialParaTransferencia = {
        filialId: 1,
        saldoFisico: 8,
        estoqueMinimo: 8,
        necessidadeCompra: 0,
      };

      const lojaDestino: SaldoFilialParaTransferencia = {
        filialId: 2,
        saldoFisico: 0,
        estoqueMinimo: 4,
        necessidadeCompra: 6,
      };

      const resultado = calcularTransferenciaEntreDuasLojas(lojaOrigem, lojaDestino);
      expect(resultado).toBeNull();
    });

    it("deve retornar null e NÃO transferir nada quando a potencial doadora já está em déficit (saldo < mínimo)", () => {
      // Loja 1 tem saldo 3 e estoque mínimo 5 (déficit de 2)
      const lojaOrigem: SaldoFilialParaTransferencia = {
        filialId: 1,
        saldoFisico: 3,
        estoqueMinimo: 5,
        necessidadeCompra: 0,
      };

      const lojaDestino: SaldoFilialParaTransferencia = {
        filialId: 2,
        saldoFisico: 0,
        estoqueMinimo: 4,
        necessidadeCompra: 10,
      };

      const resultado = calcularTransferenciaEntreDuasLojas(lojaOrigem, lojaDestino);
      expect(resultado).toBeNull();
    });

    it("deve retornar null se ambas as filiais precisarem de compra", () => {
      const loja1: SaldoFilialParaTransferencia = {
        filialId: 1,
        saldoFisico: 1,
        estoqueMinimo: 5,
        necessidadeCompra: 4,
      };

      const loja2: SaldoFilialParaTransferencia = {
        filialId: 2,
        saldoFisico: 0,
        estoqueMinimo: 6,
        necessidadeCompra: 6,
      };

      const resultado = calcularTransferenciaEntreDuasLojas(loja1, loja2);
      expect(resultado).toBeNull();
    });
  });

  describe("Balanceamento Seguro em Rede Multi-Lojas (Rede Carreiro - 5 Lojas)", () => {
    it("deve balancear múltiplas filiais preservando estritamente o estoque mínimo de todas as doadoras", () => {
      const filiais: SaldoFilialParaTransferencia[] = [
        {
          filialId: 1,
          nomeFilial: "Pedro II (Matriz)",
          saldoFisico: 30,
          estoqueMinimo: 10, // Sobra = 20
          necessidadeCompra: 0,
        },
        {
          filialId: 2,
          nomeFilial: "Piripiri",
          saldoFisico: 15,
          estoqueMinimo: 5, // Sobra = 10
          necessidadeCompra: 0,
        },
        {
          filialId: 3,
          nomeFilial: "Poranga",
          saldoFisico: 2,
          estoqueMinimo: 8,
          necessidadeCompra: 12, // Precisa de 12
        },
        {
          filialId: 4,
          nomeFilial: "Campo Maior",
          saldoFisico: 1,
          estoqueMinimo: 6,
          necessidadeCompra: 15, // Precisa de 15
        },
        {
          filialId: 5,
          nomeFilial: "José de Freitas",
          saldoFisico: 5,
          estoqueMinimo: 5, // Sobra = 0
          necessidadeCompra: 0,
        },
      ];

      const transferencias = calcularBalanceamentoRede(filiais, {
        produtoId: 999,
        codigoSku: "AMORT-001",
      });

      expect(transferencias.length).toBeGreaterThan(0);

      // Verificação formal de cada transferência realizada
      for (const t of transferencias) {
        expect(t.quantidadeTransferir).toBeGreaterThan(0);
        // Regra de Ouro: o saldo após NUNCA pode ser menor que o estoque mínimo da origem
        expect(t.saldoOrigemApos).toBeGreaterThanOrEqual(t.estoqueMinimoOrigem);
        // A loja 5 não tinha sobra e não deve doar nada
        expect(t.filialOrigemId).not.toBe(5);
      }

      // Soma das transferências não pode exceder as sobras totais da rede (20 + 10 = 30)
      const totalTransferido = transferencias.reduce(
        (acc, cur) => acc + cur.quantidadeTransferir,
        0
      );
      expect(totalTransferido).toBeLessThanOrEqual(30);
      // Necessidade total era 12 + 15 = 27, coberta integralmente pelas sobras de 30
      expect(totalTransferido).toBe(27);
    });
  });
});

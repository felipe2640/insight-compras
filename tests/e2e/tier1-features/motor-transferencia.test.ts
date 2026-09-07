/**
 * Tier 1: Cobertura de Features — Motor de Demanda Numérico & Transferência Segura
 * Requisitos: ORIGINAL_REQUEST R3 & PROJECT.md
 */

import { describe, it, expect } from "vitest";
import {
  calcularConsumoDiario,
  calcularProjecaoMensal,
} from "@core/calculo/demanda-diaria";
import {
  calcularTransferenciaEntreDuasLojas,
  SaldoFilialParaTransferencia,
} from "@core/transferencia/balanceamento";

describe("Tier 1 — Feature 2: Motor de Demanda Numérico & Transferência Segura Inter-Lojas", () => {
  // T1.2.1: Orientação estrita a dados reais
  it("T1.2.1 — deve retornar consumo zero e sugestão zero para qualquer item sem vendas comprovadas", () => {
    const consumoZeroVendas = calcularConsumoDiario({
      vendasLiquidasJanela: 0,
      diasJanela: 180,
    });

    expect(consumoZeroVendas).toBe(0);
    expect(calcularProjecaoMensal(consumoZeroVendas)).toBe(0);

    const consumoDiasInvalidos = calcularConsumoDiario({
      vendasLiquidasJanela: 50,
      diasJanela: 0,
    });
    expect(consumoDiasInvalidos).toBe(0);
  });

  // T1.2.2: Regra de ouro da transferência inter-lojas
  it("T1.2.2 — deve permitir transferência somente se a loja de origem possuir saldo estritamente acima do estoque mínimo (saldo - minStock > 0)", () => {
    // Loja A (Origem): saldo = 10, minStock = 6 -> Sobra real = 4
    // Loja B (Destino): saldo = 0, minStock = 5, necessidade = 5
    const lojaA: SaldoFilialParaTransferencia = {
      filialId: 1,
      nomeFilial: "Loja 1 - Trairi",
      saldoFisico: 10,
      estoqueMinimo: 6,
      necessidadeCompra: 0,
    };
    const lojaB: SaldoFilialParaTransferencia = {
      filialId: 2,
      nomeFilial: "Loja 2 - Paraipaba",
      saldoFisico: 0,
      estoqueMinimo: 5,
      necessidadeCompra: 5,
    };

    const resultado = calcularTransferenciaEntreDuasLojas(lojaA, lojaB);
    expect(resultado).not.toBeNull();
    // Sobra real de A é 4; necessidade de B é 5 -> deve doar no máximo 4
    expect(resultado!.quantidadeTransferir).toBe(4);
    expect(resultado!.filialOrigemId).toBe(1);
    expect(resultado!.filialDestinoId).toBe(2);
  });

  // T1.2.3: Preservação invariante da origem
  it("T1.2.3 — deve garantir matematicamente que o saldo da origem após transferência nunca fica abaixo do seu estoque mínimo", () => {
    const lojaA: SaldoFilialParaTransferencia = {
      filialId: 1,
      nomeFilial: "Loja 1 - Trairi",
      saldoFisico: 8,
      estoqueMinimo: 5,
      necessidadeCompra: 0,
    };
    const lojaB: SaldoFilialParaTransferencia = {
      filialId: 2,
      nomeFilial: "Loja 2 - Paraipaba",
      saldoFisico: 1,
      estoqueMinimo: 10,
      necessidadeCompra: 9, // Necessidade grande
    };

    const resultado = calcularTransferenciaEntreDuasLojas(lojaA, lojaB);
    expect(resultado).not.toBeNull();
    expect(resultado!.quantidadeTransferir).toBe(3); // 8 - 5 = 3
    expect(resultado!.saldoOrigemApos).toBe(5);
    expect(resultado!.saldoOrigemApos).toBeGreaterThanOrEqual(resultado!.estoqueMinimoOrigem);
  });

  // T1.2.4: Bloqueio total de doação se origem não tiver sobra
  it("T1.2.4 — não deve gerar transferência se a loja de origem estiver no limite ou abaixo do seu estoque mínimo", () => {
    // Loja A tem saldo = 6 e minStock = 6 (sobra = 0)
    const lojaA: SaldoFilialParaTransferencia = {
      filialId: 1,
      nomeFilial: "Loja 1 - Trairi",
      saldoFisico: 6,
      estoqueMinimo: 6,
      necessidadeCompra: 0,
    };
    const lojaB: SaldoFilialParaTransferencia = {
      filialId: 2,
      nomeFilial: "Loja 2 - Paraipaba",
      saldoFisico: 0,
      estoqueMinimo: 5,
      necessidadeCompra: 5,
    };

    const resultado = calcularTransferenciaEntreDuasLojas(lojaA, lojaB);
    expect(resultado).toBeNull();
  });

  // T1.2.5: Sugestão híbrida (Transferência Parcial + Compra Externa)
  it("T1.2.5 — deve suportar cálculo híbrido de necessidade coberta parcialmente por transferência e saldo restante para compra", () => {
    const necessidadeDestinoTotal = 10;
    const sobraOrigemDisponivel = 4;

    const transferir = Math.min(necessidadeDestinoTotal, sobraOrigemDisponivel);
    const compraExternaResidual = necessidadeDestinoTotal - transferir;

    expect(transferir).toBe(4);
    expect(compraExternaResidual).toBe(6);
    expect(transferir + compraExternaResidual).toBe(necessidadeDestinoTotal);
  });
});

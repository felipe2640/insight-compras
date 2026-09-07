/**
 * Tier 1: Cobertura de Features — Travas Anti-Encalhe e Guardrails de Capital
 * Requisitos: ORIGINAL_REQUEST R3 & PROJECT.md
 */

import { describe, it, expect } from "vitest";
import { aplicarTravaMarcaZumbi } from "@core/travas/marca-zumbi";
import {
  aplicarTravaFamiliaAplicacao,
  ItemFamiliaAplicacao,
} from "@core/travas/familia-aplicacao";
import { classificarPerfilGiro } from "@core/calculo/demanda-diaria";

describe("Tier 1 — Feature 3: Travas Anti-Encalhe e Guardrails de Capital", () => {
  // T1.3.1: Bloqueio Mandatório de Marca Zumbi
  it("T1.3.1 — deve travar compulsoriamente a sugestão de compra em ZERO para qualquer SKU com saldo > 0 e 0 vendas em 180 dias", () => {
    const resultado = aplicarTravaMarcaZumbi({
      saldoFisico: 15, // Estoque parado
      vendasLiquidas180dias: 0, // Zero vendas nos últimos 6 meses
      sugestaoOriginal: 10,
      codigoSku: "VEL-NGK-ZUMB",
    });

    expect(resultado.travado).toBe(true);
    expect(resultado.sugestaoAjustada).toBe(0);
    expect(resultado.motivo).toContain("Bloqueio Marca Zumbi");
    expect(resultado.motivo).toContain("0 vendas nos últimos 180 dias");
  });

  // T1.3.2: Item com histórico de vendas não é travado como zumbi
  it("T1.3.2 — não deve travar SKU com saldo positivo que possua vendas comprovadas nos últimos 180 dias", () => {
    const resultado = aplicarTravaMarcaZumbi({
      saldoFisico: 5,
      vendasLiquidas180dias: 24, // Tem saídas comprovadas
      sugestaoOriginal: 8,
      codigoSku: "AM-MON-ATIVO",
    });

    expect(resultado.travado).toBe(false);
    expect(resultado.sugestaoAjustada).toBe(8);
    expect(resultado.motivo).toBeNull();
  });

  // T1.3.3: Trava de Cobertura Somada de Família/Aplicação
  it("T1.3.3 — deve bloquear compra externa se a soma dos estoques das marcas da família cobrir o horizonte planejado", () => {
    // Aplicação: Filtro de Óleo Gol 1.0 (Família FAM-FILTRO-GOL)
    // Horizonte planejado: 45 dias
    // Marca A (Mann): saldo 10, consumo 0.2/dia -> individualmente precisaria de compra
    // Marca B (Tecfil): saldo 30, consumo 0.4/dia
    // Marca C (Fram): saldo 20, consumo 0.2/dia
    // Total estoque: 60 un. Total consumo: 0.8 un/dia -> Cobertura = 60 / 0.8 = 75 dias (supera 45 dias!)
    const itensFamilia: ItemFamiliaAplicacao[] = [
      {
        produtoId: 101,
        codigoSku: "FIL-MANN-GOL",
        marca: "MANN",
        saldoFisico: 10,
        quantidadeJaPedida: 0,
        consumoDiario: 0.2,
        necessidadeIndividual: 6, // Necessidade individual positiva
      },
      {
        produtoId: 102,
        codigoSku: "FIL-TECF-GOL",
        marca: "TECFIL",
        saldoFisico: 30,
        quantidadeJaPedida: 0,
        consumoDiario: 0.4,
        necessidadeIndividual: 0,
      },
      {
        produtoId: 103,
        codigoSku: "FIL-FRAM-GOL",
        marca: "FRAM",
        saldoFisico: 20,
        quantidadeJaPedida: 0,
        consumoDiario: 0.2,
        necessidadeIndividual: 0,
      },
    ];

    const resultado = aplicarTravaFamiliaAplicacao("FAM-FILTRO-GOL", itensFamilia, 45);

    expect(resultado.familiaCoberta).toBe(true);
    expect(resultado.diasCoberturaFamilia).toBe(75);

    // O item que tinha necessidade individual positiva (FIL-MANN-GOL) deve ser travado em 0
    const itemMann = resultado.itens.get(101);
    expect(itemMann).toBeDefined();
    expect(itemMann!.travado).toBe(true);
    expect(itemMann!.sugestaoAjustada).toBe(0);
    expect(itemMann!.motivo).toContain("Bloqueio Família/Aplicação");
  });

  // T1.3.4: Liberação de compra quando a família não atinge o horizonte
  it("T1.3.4 — deve permitir compra se o estoque consolidado da família veicular não cobrir o horizonte planejado", () => {
    // Total estoque = 10 un, consumo diário = 1.0 un/dia -> Cobertura = 10 dias (abaixo do horizonte de 45 dias)
    const itensFamilia: ItemFamiliaAplicacao[] = [
      {
        produtoId: 201,
        codigoSku: "DSC-FREM-COROLLA",
        marca: "FREMAX",
        saldoFisico: 5,
        quantidadeJaPedida: 0,
        consumoDiario: 0.5,
        necessidadeIndividual: 10,
      },
      {
        produtoId: 202,
        codigoSku: "DSC-BOSCH-COROLLA",
        marca: "BOSCH",
        saldoFisico: 5,
        quantidadeJaPedida: 0,
        consumoDiario: 0.5,
        necessidadeIndividual: 10,
      },
    ];

    const resultado = aplicarTravaFamiliaAplicacao("FAM-DISCO-COROLLA", itensFamilia, 45);

    expect(resultado.familiaCoberta).toBe(false);
    expect(resultado.diasCoberturaFamilia).toBe(10);

    const itemFremax = resultado.itens.get(201);
    expect(itemFremax!.travado).toBe(false);
    expect(itemFremax!.sugestaoAjustada).toBe(10);
  });

  // T1.3.5: Guarda de Elegibilidade por Recorrência de Notas
  it("T1.3.5 — deve exigir o mínimo de 3 notas em 90 dias para classificar em alto/médio giro", () => {
    // Produto teve 50 peças vendidas em apenas 1 nota fiscal isolada (compra pontual de frota)
    const perfilComUmaNota = classificarPerfilGiro(1.66, 1, 90);
    expect(perfilComUmaNota).toBe("SEM_HISTORICO_SUFICIENTE");

    // Produto com 4 notas em 90 dias e consumo projetado de 8 un/mês
    const consumoDiarioRegular = 8 / 30; // ~0.266 un/dia
    const perfilComQuatroNotas = classificarPerfilGiro(consumoDiarioRegular, 4, 90);
    expect(perfilComQuatroNotas).toBe("ALTO_GIRO");
  });
});

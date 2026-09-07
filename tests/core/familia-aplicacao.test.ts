import { describe, it, expect } from "vitest";
import {
  aplicarTravaFamiliaAplicacao,
  ItemFamiliaAplicacao,
} from "@core/travas/familia-aplicacao";

describe("Trava Anti-Encalhe: Cobertura Somada da Família de Aplicação", () => {
  it("deve bloquear compra de item individual se a soma dos similares da família cobrir o horizonte planejado", () => {
    // Aplicação: Filtro de Óleo Gol 1.0 Flex (Família intercambiável)
    const itensFamilia: ItemFamiliaAplicacao[] = [
      {
        produtoId: 101,
        codigoSku: "FILTRO-TECFIL",
        marca: "Tecfil",
        saldoFisico: 25,
        quantidadeJaPedida: 0,
        consumoDiario: 0.5,
        necessidadeIndividual: 0,
      },
      {
        produtoId: 102,
        codigoSku: "FILTRO-FRAM",
        marca: "Fram",
        saldoFisico: 20,
        quantidadeJaPedida: 0,
        consumoDiario: 0.5,
        necessidadeIndividual: 0,
      },
      {
        produtoId: 103,
        codigoSku: "FILTRO-WEGA",
        marca: "Wega",
        saldoFisico: 0, // Wega está zerado
        quantidadeJaPedida: 0,
        consumoDiario: 0.2,
        necessidadeIndividual: 10, // Comprador ou cálculo isolado pediria 10 un
      },
    ];

    // Estoque total da família: 25 + 20 + 0 = 45 un
    // Consumo diário total da família: 0.5 + 0.5 + 0.2 = 1.2 un/dia
    // Cobertura da família: 45 / 1.2 = 37.5 dias
    // Horizonte de planejamento: 30 dias (37.5 >= 30 => FAMÍLIA COBERTA)
    const resultado = aplicarTravaFamiliaAplicacao(
      "FILTRO-OLEO-GOL-1.0",
      itensFamilia,
      30
    );

    expect(resultado.familiaCoberta).toBe(true);
    expect(resultado.diasCoberturaFamilia).toBeCloseTo(37.5, 1);

    const itemWega = resultado.itens.get(103);
    expect(itemWega).toBeDefined();
    expect(itemWega!.sugestaoOriginal).toBe(10);
    // Trava mandatória ativada:
    expect(itemWega!.sugestaoAjustada).toBe(0);
    expect(itemWega!.travado).toBe(true);
    expect(itemWega!.motivo).toContain("Bloqueio Família/Aplicação");
    expect(itemWega!.motivo).toContain("38 dias de cobertura");
  });

  it("NÃO deve bloquear e deve permitir compra quando a cobertura somada da família for inferior ao horizonte", () => {
    // Família com estoque baixo na rede
    const itensFamilia: ItemFamiliaAplicacao[] = [
      {
        produtoId: 201,
        codigoSku: "PASTILHA-COBREQ",
        marca: "Cobreq",
        saldoFisico: 4,
        quantidadeJaPedida: 0,
        consumoDiario: 0.5,
        necessidadeIndividual: 8,
      },
      {
        produtoId: 202,
        codigoSku: "PASTILHA-FRASLE",
        marca: "Fras-le",
        saldoFisico: 2,
        quantidadeJaPedida: 0,
        consumoDiario: 0.5,
        necessidadeIndividual: 10,
      },
    ];

    // Estoque total: 6 un | Consumo total: 1.0 un/dia => 6 dias de cobertura
    // Horizonte: 20 dias (6 < 20 => FAMÍLIA NÃO COBERTA)
    const resultado = aplicarTravaFamiliaAplicacao(
      "PASTILHA-STRADA-DIANT",
      itensFamilia,
      20
    );

    expect(resultado.familiaCoberta).toBe(false);
    expect(resultado.diasCoberturaFamilia).toBe(6);

    const cobreq = resultado.itens.get(201);
    const frasle = resultado.itens.get(202);

    expect(cobreq!.travado).toBe(false);
    expect(cobreq!.sugestaoAjustada).toBe(8);

    expect(frasle!.travado).toBe(false);
    expect(frasle!.sugestaoAjustada).toBe(10);
  });

  it("deve considerar quantidades já pedidas na soma do estoque da família", () => {
    const itensFamilia: ItemFamiliaAplicacao[] = [
      {
        produtoId: 301,
        codigoSku: "AMORT-MONROE",
        marca: "Monroe",
        saldoFisico: 5,
        quantidadeJaPedida: 25, // NF a caminho
        consumoDiario: 1,
        necessidadeIndividual: 0,
      },
      {
        produtoId: 302,
        codigoSku: "AMORT-COFAP",
        marca: "Cofap",
        saldoFisico: 0,
        quantidadeJaPedida: 0,
        consumoDiario: 0.5,
        necessidadeIndividual: 10,
      },
    ];

    // Estoque somado (físico + pedido): (5 + 25) + 0 = 30 un
    // Consumo total: 1.5 un/dia => Cobertura = 30 / 1.5 = 20 dias
    // Horizonte = 20 dias (20 >= 20 => COBERTO)
    const resultado = aplicarTravaFamiliaAplicacao("AMORT-STRADA", itensFamilia, 20);

    expect(resultado.familiaCoberta).toBe(true);
    expect(resultado.itens.get(302)!.sugestaoAjustada).toBe(0);
    expect(resultado.itens.get(302)!.travado).toBe(true);
  });

  it("deve lidar com lista vazia sem lançar exceções", () => {
    const resultado = aplicarTravaFamiliaAplicacao("VAZIA", [], 30);
    expect(resultado.familiaCoberta).toBe(false);
    expect(resultado.itens.size).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  calcularCurvaAbc,
  converterPerfilGiroParaCurvaAbc,
  ItemParaCurvaAbc,
} from "@core/calculo/curva-abc";

describe("Motor de Curva ABC por Faturamento Acumulado (Pareto)", () => {
  it("deve classificar itens em A (80%), B (15%) e C (5%) corretamente", () => {
    const itens: ItemParaCurvaAbc[] = [
      { produtoId: 1, faturamento: 50000 }, // 50% -> A
      { produtoId: 2, faturamento: 30000 }, // 30% -> acumula 80% -> A
      { produtoId: 3, faturamento: 10000 }, // 10% -> acumula 90% -> B
      { produtoId: 4, faturamento: 5000 }, // 5% -> acumula 95% -> B
      { produtoId: 5, faturamento: 3000 }, // 3% -> acumula 98% -> C
      { produtoId: 6, faturamento: 2000 }, // 2% -> acumula 100% -> C
    ];

    const resultado = calcularCurvaAbc(itens);

    expect(resultado.size).toBe(6);

    expect(resultado.get(1)!.curva).toBe("A");
    expect(resultado.get(2)!.curva).toBe("A");

    expect(resultado.get(3)!.curva).toBe("B");
    expect(resultado.get(4)!.curva).toBe("B");

    expect(resultado.get(5)!.curva).toBe("C");
    expect(resultado.get(6)!.curva).toBe("C");
  });

  it("deve ordenar os itens decrescente mesmo se fornecidos fora de ordem", () => {
    const itensDesordenados: ItemParaCurvaAbc[] = [
      { produtoId: 10, faturamento: 100 },
      { produtoId: 20, faturamento: 8000 },
      { produtoId: 30, faturamento: 200 },
    ];

    const resultado = calcularCurvaAbc(itensDesordenados);

    expect(resultado.get(20)!.curva).toBe("A");
    expect(resultado.get(30)!.curva).toBe("C");
    expect(resultado.get(10)!.curva).toBe("C");
  });

  it("deve atribuir C a todos os itens se o faturamento total for zero", () => {
    const itensZerados: ItemParaCurvaAbc[] = [
      { produtoId: 1, faturamento: 0 },
      { produtoId: 2, faturamento: 0 },
    ];

    const resultado = calcularCurvaAbc(itensZerados);

    expect(resultado.get(1)!.curva).toBe("C");
    expect(resultado.get(2)!.curva).toBe("C");
  });

  it("deve retornar mapa vazio se lista de itens for vazia", () => {
    const resultado = calcularCurvaAbc([]);
    expect(resultado.size).toBe(0);
  });
});

describe("Conversão Operacional de Perfil de Giro para Curva ABC", () => {
  it("deve classificar ALTO_GIRO como Curva A", () => {
    expect(converterPerfilGiroParaCurvaAbc("ALTO_GIRO")).toBe("A");
  });

  it("deve classificar MEDIO_GIRO como Curva B", () => {
    expect(converterPerfilGiroParaCurvaAbc("MEDIO_GIRO")).toBe("B");
  });

  it("deve classificar BAIXO_GIRO_INTERMITENTE como Curva C", () => {
    expect(converterPerfilGiroParaCurvaAbc("BAIXO_GIRO_INTERMITENTE")).toBe("C");
  });

  it("deve classificar SEM_HISTORICO_SUFICIENTE como Curva C", () => {
    expect(converterPerfilGiroParaCurvaAbc("SEM_HISTORICO_SUFICIENTE")).toBe("C");
  });
});

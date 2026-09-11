import { describe, it, expect } from "vitest";
import {
  aplicarFiltroColuna,
  descreverFiltroColuna,
  filtroEstaCompleto,
  interpretarData,
  interpretarNumero,
  normalizarParaComparacao,
  OPERADORES_POR_VARIANTE,
  operadorPadraoDaVariante,
  operadorPertenceAVariante,
  valorEstaVazio,
} from "@/lib/cockpit/filtros-coluna";

describe("normalização", () => {
  it("compara texto sem acento e sem caixa", () => {
    expect(normalizarParaComparacao("MOLÁ  ")).toBe("mola");
    expect(normalizarParaComparacao("Suspensão")).toBe("suspensao");
    expect(normalizarParaComparacao(null)).toBe("");
    expect(normalizarParaComparacao(42)).toBe("42");
  });

  it("lê número digitado por gente, em pt-BR e em ponto", () => {
    expect(interpretarNumero("1.234,56")).toBe(1234.56);
    expect(interpretarNumero("1234.56")).toBe(1234.56);
    expect(interpretarNumero("12")).toBe(12);
    expect(interpretarNumero(7)).toBe(7);
    expect(interpretarNumero("")).toBeNull();
    expect(interpretarNumero("abc")).toBeNull();
    expect(interpretarNumero(null)).toBeNull();
  });

  it("lê data em ISO e em pt-BR", () => {
    expect(interpretarData("2026-09-09")).toBe(Date.UTC(2026, 8, 9));
    expect(interpretarData("09/09/2026")).toBe(Date.UTC(2026, 8, 9));
    expect(interpretarData(null)).toBeNull();
    expect(interpretarData("nao é data")).toBeNull();
  });

  it("vazio é nulo, indefinido, string em branco e lista vazia", () => {
    expect(valorEstaVazio(null)).toBe(true);
    expect(valorEstaVazio(undefined)).toBe(true);
    expect(valorEstaVazio("   ")).toBe(true);
    expect(valorEstaVazio([])).toBe(true);
    expect(valorEstaVazio(0)).toBe(false);
    expect(valorEstaVazio("x")).toBe(false);
  });
});

describe("operadores por variante", () => {
  it("cada tipo só oferece o que faz sentido para ele", () => {
    expect(operadorPertenceAVariante("maior", "texto")).toBe(false);
    expect(operadorPertenceAVariante("contem", "numero")).toBe(false);
    expect(operadorPertenceAVariante("contem", "texto")).toBe(true);
    expect(operadorPertenceAVariante("entre", "numero")).toBe(true);
    expect(operadorPertenceAVariante("eUmDe", "selecao")).toBe(true);
  });

  it("toda variante tem 'vazio' e 'não vazio' e um padrão válido", () => {
    for (const variante of ["texto", "numero", "selecao", "data"] as const) {
      const ids = OPERADORES_POR_VARIANTE[variante].map((o) => o.id);
      expect(ids).toContain("vazio");
      expect(ids).toContain("naoVazio");
      expect(ids).toContain(operadorPadraoDaVariante(variante));
    }
  });
});

describe("filtro incompleto não esconde linha", () => {
  it("reconhece o que está completo", () => {
    expect(filtroEstaCompleto({ operador: "vazio" })).toBe(true);
    expect(filtroEstaCompleto({ operador: "contem", valor: "" })).toBe(false);
    expect(filtroEstaCompleto({ operador: "contem", valor: "mola" })).toBe(true);
    expect(filtroEstaCompleto({ operador: "entre", valor: 1 })).toBe(false);
    expect(filtroEstaCompleto({ operador: "entre", valor: 1, valor2: 9 })).toBe(true);
    expect(filtroEstaCompleto({ operador: "eUmDe", valores: [] })).toBe(false);
    expect(filtroEstaCompleto({ operador: "eUmDe", valores: ["A"] })).toBe(true);
    expect(filtroEstaCompleto(null)).toBe(false);
  });

  it("no meio da digitação a grade fica inteira", () => {
    expect(aplicarFiltroColuna("qualquer coisa", { operador: "contem", valor: "" })).toBe(true);
    expect(aplicarFiltroColuna(5, { operador: "entre", valor: 10 }, "numero")).toBe(true);
    expect(aplicarFiltroColuna("x", null)).toBe(true);
  });
});

describe("texto", () => {
  const passa = (valor: unknown, f: Parameters<typeof aplicarFiltroColuna>[1]) =>
    aplicarFiltroColuna(valor, f, "texto");

  it("contém, não contém, igual, diferente, começa e termina", () => {
    expect(passa("Mola Dianteira", { operador: "contem", valor: "MOLA" })).toBe(true);
    expect(passa("Mola Dianteira", { operador: "naoContem", valor: "pastilha" })).toBe(true);
    expect(passa("Bosch", { operador: "igual", valor: "bosch" })).toBe(true);
    expect(passa("Bosch", { operador: "diferente", valor: "cofap" })).toBe(true);
    expect(passa("Suspensão traseira", { operador: "comecaCom", valor: "suspensao" })).toBe(true);
    expect(passa("Filtro de óleo", { operador: "terminaCom", valor: "oleo" })).toBe(true);
  });

  it("vazio e não vazio olham a célula, não o texto do filtro", () => {
    expect(passa(null, { operador: "vazio" })).toBe(true);
    expect(passa("  ", { operador: "vazio" })).toBe(true);
    expect(passa("x", { operador: "vazio" })).toBe(false);
    expect(passa("x", { operador: "naoVazio" })).toBe(true);
  });
});

describe("número", () => {
  const passa = (valor: unknown, f: Parameters<typeof aplicarFiltroColuna>[1]) =>
    aplicarFiltroColuna(valor, f, "numero");

  it("compara com os operadores numéricos", () => {
    expect(passa(10, { operador: "igual", valor: "10" })).toBe(true);
    expect(passa(10, { operador: "maior", valor: 5 })).toBe(true);
    expect(passa(10, { operador: "maior", valor: 10 })).toBe(false);
    expect(passa(10, { operador: "maiorOuIgual", valor: 10 })).toBe(true);
    expect(passa(10, { operador: "menor", valor: 20 })).toBe(true);
    expect(passa(10, { operador: "menorOuIgual", valor: 10 })).toBe(true);
    expect(passa(10, { operador: "diferente", valor: 3 })).toBe(true);
  });

  it("entre aceita os limites e a ordem invertida", () => {
    expect(passa(10, { operador: "entre", valor: 5, valor2: 15 })).toBe(true);
    expect(passa(5, { operador: "entre", valor: 5, valor2: 15 })).toBe(true);
    expect(passa(15, { operador: "entre", valor: 5, valor2: 15 })).toBe(true);
    expect(passa(20, { operador: "entre", valor: 5, valor2: 15 })).toBe(false);
    // limites trocados pelo comprador não podem zerar a grade
    expect(passa(10, { operador: "entre", valor: 15, valor2: 5 })).toBe(true);
  });

  it("entende preço em pt-BR e não confunde célula nula com zero", () => {
    expect(passa(1234.56, { operador: "igual", valor: "1.234,56" })).toBe(true);
    expect(passa(null, { operador: "menor", valor: 10 })).toBe(false);
    expect(passa(0, { operador: "menor", valor: 10 })).toBe(true);
    expect(passa(null, { operador: "vazio" })).toBe(true);
  });
});

describe("seleção", () => {
  const passa = (valor: unknown, f: Parameters<typeof aplicarFiltroColuna>[1]) =>
    aplicarFiltroColuna(valor, f, "selecao");

  it("é um de / não é um de, sem acento", () => {
    expect(passa("A", { operador: "eUmDe", valores: ["A", "B"] })).toBe(true);
    expect(passa("C", { operador: "eUmDe", valores: ["A", "B"] })).toBe(false);
    expect(passa("C", { operador: "naoEUmDe", valores: ["A", "B"] })).toBe(true);
    expect(passa("Atenção", { operador: "eUmDe", valores: ["atencao"] })).toBe(true);
  });
});

describe("data", () => {
  const passa = (valor: unknown, f: Parameters<typeof aplicarFiltroColuna>[1]) =>
    aplicarFiltroColuna(valor, f, "data");

  it("antes, depois e entre", () => {
    expect(passa("2026-09-09", { operador: "menor", valor: "2026-10-01" })).toBe(true);
    expect(passa("2026-09-09", { operador: "maior", valor: "2026-01-01" })).toBe(true);
    expect(passa("2026-09-09", { operador: "entre", valor: "2026-09-01", valor2: "2026-09-30" })).toBe(true);
    expect(passa("2026-09-09", { operador: "igual", valor: "09/09/2026" })).toBe(true);
  });

  it("data ausente não passa por comparação, mas passa por 'vazio'", () => {
    expect(passa(null, { operador: "maior", valor: "2020-01-01" })).toBe(false);
    expect(passa(null, { operador: "vazio" })).toBe(true);
  });
});

describe("descrição do chip", () => {
  it("diz em português o que está filtrando", () => {
    expect(descreverFiltroColuna("Marca", { operador: "contem", valor: "bosch" }, "texto"))
      .toBe("Marca contém bosch");
    expect(descreverFiltroColuna("Custo", { operador: "entre", valor: 10, valor2: 50 }, "numero"))
      .toBe("Custo está entre 10 e 50");
    expect(descreverFiltroColuna("Ruptura", { operador: "vazio" }, "texto"))
      .toBe("Ruptura está vazio");
    expect(descreverFiltroColuna("Curva", { operador: "eUmDe", valores: ["A", "B", "C", "D"] }, "selecao"))
      .toBe("Curva é um de A, B +2");
  });
});

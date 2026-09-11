import { describe, it, expect } from "vitest";
import { funcaoFiltroColuna, lerFiltroDaColuna, varianteDaColuna } from "@/lib/cockpit/filtro-tanstack";

/** Linha mínima com a forma que a função usa do TanStack. */
function linhaFalsa(valores: Record<string, unknown>, meta?: unknown) {
  return {
    getValue: (id: string) => valores[id],
    getAllCells: () => Object.keys(valores).map((id) => ({ column: { id, columnDef: { meta } } })),
  } as never;
}

describe("ponte com o TanStack", () => {
  it("lê a variante da meta e cai em texto quando não há", () => {
    expect(varianteDaColuna({ variante: "numero" })).toBe("numero");
    expect(varianteDaColuna({ variante: "selecao" })).toBe("selecao");
    expect(varianteDaColuna({ variante: "data" })).toBe("data");
    expect(varianteDaColuna({ variante: "inventada" })).toBe("texto");
    expect(varianteDaColuna(undefined)).toBe("texto");
    expect(varianteDaColuna({})).toBe("texto");
  });

  it("filtra usando a variante declarada na coluna", () => {
    const linha = linhaFalsa({ custo: 10 }, { variante: "numero" });
    expect(funcaoFiltroColuna(linha, "custo", { operador: "maior", valor: 5 })).toBe(true);
    expect(funcaoFiltroColuna(linha, "custo", { operador: "maior", valor: 50 })).toBe(false);
  });

  it("sem variante, número é comparado como texto — e por isso 'contém' funciona", () => {
    const linha = linhaFalsa({ codigo: "001055" });
    expect(funcaoFiltroColuna(linha, "codigo", { operador: "contem", valor: "1055" })).toBe(true);
  });

  it("filtro ausente ou incompleto deixa a linha passar", () => {
    const linha = linhaFalsa({ marca: "Bosch" });
    expect(funcaoFiltroColuna(linha, "marca", undefined)).toBe(true);
    expect(funcaoFiltroColuna(linha, "marca", { operador: "contem", valor: "" })).toBe(true);
  });

  it("lerFiltroDaColuna só aceita o que tem operador", () => {
    expect(lerFiltroDaColuna({ operador: "contem", valor: "x" })?.operador).toBe("contem");
    expect(lerFiltroDaColuna({ valor: "x" })).toBeNull();
    expect(lerFiltroDaColuna(null)).toBeNull();
    expect(lerFiltroDaColuna("texto")).toBeNull();
  });
});

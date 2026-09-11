import { describe, it, expect } from "vitest";
import { ehLinhaAcionavel, separarAcionaveis, contarStatusGrade } from "@/lib/cockpit/escopo-grade";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";

const linha = (p: Partial<LinhaCockpitMatriz>): LinhaCockpitMatriz =>
  ({
    sugestaoFinalCompra: 0,
    quantidadeTransferenciaSugerida: 0,
    isMarcaZumbi: false,
    classificacaoRuptura: "Saudável",
    ...p,
  }) as LinhaCockpitMatriz;

describe("escopo da grade", () => {
  it("é acionável quem pede compra, transferência, ruptura ou trava", () => {
    expect(ehLinhaAcionavel(linha({ sugestaoFinalCompra: 2 }))).toBe(true);
    expect(ehLinhaAcionavel(linha({ quantidadeTransferenciaSugerida: 1 }))).toBe(true);
    expect(ehLinhaAcionavel(linha({ isMarcaZumbi: true }))).toBe(true);
    expect(ehLinhaAcionavel(linha({ classificacaoRuptura: "Grave" }))).toBe(true);
    expect(ehLinhaAcionavel(linha({ classificacaoRuptura: "Atenção" }))).toBe(true);
  });

  it("estoque suficiente e sem trava não é acionável", () => {
    expect(ehLinhaAcionavel(linha({}))).toBe(false);
  });

  it("separar não perde nem duplica linha", () => {
    const linhas = [
      linha({ sugestaoFinalCompra: 1 }),
      linha({}),
      linha({ isMarcaZumbi: true }),
      linha({}),
    ];
    const { acionaveis, restante } = separarAcionaveis(linhas);
    expect(acionaveis).toHaveLength(2);
    expect(restante).toHaveLength(2);
    expect(acionaveis.length + restante.length).toBe(linhas.length);
  });

  it("contagens dos chips batem com o conjunto completo", () => {
    const linhas = [
      linha({ sugestaoFinalCompra: 3 }),
      linha({ quantidadeTransferenciaSugerida: 5 }),
      linha({ sugestaoFinalCompra: 1, quantidadeTransferenciaSugerida: 2 }), // conta nos dois
      linha({ isMarcaZumbi: true }),
      linha({ classificacaoRuptura: "Grave" }),
      linha({}),
    ];
    expect(contarStatusGrade(linhas)).toEqual({
      total: 6,
      pedir: 2,
      transferir: 2,
      ruptura: 1,
      zumbi: 1,
    });
  });

  it("lista vazia conta zero em tudo", () => {
    expect(contarStatusGrade([])).toEqual({ total: 0, pedir: 0, transferir: 0, ruptura: 0, zumbi: 0 });
  });
});

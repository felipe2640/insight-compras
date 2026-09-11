import { describe, it, expect } from "vitest";
import {
  codificarGradeTabular,
  decodificarGradeTabular,
  ehMesmoCabecalho,
  PAYLOAD_TABULAR_VAZIO,
  VERSAO_PAYLOAD_TABULAR,
} from "@/lib/cockpit/codificacao-tabular";

describe("codificação tabular da grade", () => {
  it("ida e volta devolve exatamente os mesmos objetos", () => {
    const linhas = [
      { sku: "A1", qtd: 3, marca: "Bosch", ativo: true, nota: null },
      { sku: "B2", qtd: 0, marca: "Cofap", ativo: false, nota: "revisar" },
    ];
    const payload = codificarGradeTabular(linhas);
    expect(payload.versao).toBe(VERSAO_PAYLOAD_TABULAR);
    expect(payload.campos).toEqual(["sku", "qtd", "marca", "ativo", "nota"]);
    expect(payload.total).toBe(2);
    expect(decodificarGradeTabular(payload)).toEqual(linhas);
  });

  it("preserva a diferença entre ausente e nulo", () => {
    const linhas: Array<Record<string, unknown>> = [
      { sku: "A", secaoId: 7 },
      { sku: "B", secaoId: null },
      { sku: "C" }, // secaoId AUSENTE
    ];
    const volta = decodificarGradeTabular<Record<string, unknown>>(codificarGradeTabular(linhas));

    expect(volta[0].secaoId).toBe(7);
    expect(volta[1].secaoId).toBeNull();
    expect(volta[2].secaoId).toBeUndefined();
    // a distinção que importa: a chave não existe, não é nula
    expect("secaoId" in volta[1]).toBe(true);
    expect("secaoId" in volta[2]).toBe(false);
    expect(volta).toEqual(linhas);
  });

  it("sobrevive ao JSON (o payload trafega pela rede)", () => {
    const linhas = [
      { sku: "A", secaoId: 1, lista: [1, 2], obj: { a: 1 } },
      { sku: "B", lista: [], obj: null },
    ];
    const payload = codificarGradeTabular(linhas);
    const viaRede = JSON.parse(JSON.stringify(payload));
    expect(decodificarGradeTabular(viaRede)).toEqual(linhas);
  });

  it("campos são a união das chaves, na ordem em que aparecem", () => {
    const payload = codificarGradeTabular([{ a: 1 }, { b: 2 }, { a: 3, c: 4 }]);
    expect(payload.campos).toEqual(["a", "b", "c"]);
    // buracos: {a:1} não tem b,c; {b:2} não tem a,c; {a:3,c:4} não tem b
    expect(payload.buracos.length).toBe(5);
    expect(decodificarGradeTabular(payload)).toEqual([{ a: 1 }, { b: 2 }, { a: 3, c: 4 }]);
  });

  it("lista vazia vira payload vazio e volta vazia", () => {
    expect(codificarGradeTabular([])).toEqual(PAYLOAD_TABULAR_VAZIO);
    expect(decodificarGradeTabular(PAYLOAD_TABULAR_VAZIO)).toEqual([]);
  });

  it("encolhe o payload quando há muitas linhas de muitos campos", () => {
    // Reproduz a forma real: muitos campos de nome longo, muitas linhas.
    const campos = Array.from({ length: 90 }, (_, i) => `campoComNomeRazoavelmenteLongo${i}`);
    const linhas = Array.from({ length: 500 }, (_, l) =>
      Object.fromEntries(campos.map((c, i) => [c, i % 3 === 0 ? `texto ${l}` : i]))
    );
    const comoObjetos = JSON.stringify(linhas).length;
    const comoTabular = JSON.stringify(codificarGradeTabular(linhas)).length;
    expect(comoTabular).toBeLessThan(comoObjetos / 2);
  });

  it("reconhece cabeçalhos iguais e diferentes", () => {
    const a = codificarGradeTabular([{ x: 1, y: 2 }]);
    const b = codificarGradeTabular([{ x: 9, y: 8 }]);
    const c = codificarGradeTabular([{ y: 1, x: 2 }]);
    expect(ehMesmoCabecalho(a, b)).toBe(true);
    expect(ehMesmoCabecalho(a, c)).toBe(false);
  });

  it("payload corrompido ou sem linhas não derruba a decodificação", () => {
    expect(decodificarGradeTabular({ ...PAYLOAD_TABULAR_VAZIO, total: 5 })).toEqual([]);
    expect(decodificarGradeTabular(undefined as never)).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import {
  avaliarVigenciaPrevisao,
  idadePrevisaoEmDias,
  TOLERANCIA_SILENCIO_UNIDADES,
  VALIDADE_CURTA_DIAS,
  VALIDADE_MAXIMA_DIAS,
} from "@/lib/previsao-ia/vigencia-previsao";

const AGORA = new Date("2026-09-15T12:00:00.000Z");

/** Data de projeção com `idade` dias de idade em relação a AGORA. */
function dataComIdade(dias: number): string {
  const d = new Date(AGORA.getTime() - dias * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** Item de alto giro: 30 peças em 30 dias = 1/dia. */
function projecaoAltoGiro(idadeDias: number) {
  return { demandaP50: 30, horizonteDias: 30, dataPrevisao: dataComIdade(idadeDias) };
}

/** Item intermitente: 1,5 peça em 30 dias. */
function projecaoIntermitente(idadeDias: number) {
  return { demandaP50: 1.5, horizonteDias: 30, dataPrevisao: dataComIdade(idadeDias) };
}

describe("Vigência da projeção de demanda por IA", () => {
  describe("idadePrevisaoEmDias", () => {
    it("conta dias inteiros desde a data da projeção", () => {
      expect(idadePrevisaoEmDias(dataComIdade(0), AGORA)).toBe(0);
      expect(idadePrevisaoEmDias(dataComIdade(7), AGORA)).toBe(7);
    });

    it("data futura conta como do dia, não como idade negativa", () => {
      expect(idadePrevisaoEmDias(dataComIdade(-2), AGORA)).toBe(0);
    });

    it("data ilegível devolve null", () => {
      expect(idadePrevisaoEmDias("", AGORA)).toBeNull();
      expect(idadePrevisaoEmDias("ontem", AGORA)).toBeNull();
    });
  });

  it("projeção fresca vale sem perguntar nada do item", () => {
    // Alto giro, vendeu ontem: mesmo assim é fresca demais para questionar.
    const r = avaliarVigenciaPrevisao(projecaoAltoGiro(VALIDADE_CURTA_DIAS), 1, AGORA);
    expect(r.vigente).toBe(true);
    expect(r.motivo).toBe("FRESCA");
  });

  it("acima do teto vence, mesmo com o item completamente parado", () => {
    const r = avaliarVigenciaPrevisao(
      projecaoIntermitente(VALIDADE_MAXIMA_DIAS + 1),
      null,
      AGORA
    );
    expect(r.vigente).toBe(false);
    expect(r.motivo).toBe("ACIMA_DO_TETO");
  });

  it("item que vendeu depois da projeção cai no motor analítico", () => {
    // Projeção de 10 dias, última venda há 2 dias: a série se moveu.
    const r = avaliarVigenciaPrevisao(projecaoIntermitente(10), 2, AGORA);
    expect(r.vigente).toBe(false);
    expect(r.motivo).toBe("ITEM_VENDEU");
  });

  it("silêncio compatível com o p50 mantém a projeção de item intermitente", () => {
    // 1,5 peça/30d -> em 15 dias esperava 0,75: não vender nada é normal.
    const r = avaliarVigenciaPrevisao(projecaoIntermitente(15), 40, AGORA);
    expect(r.vigente).toBe(true);
    expect(r.motivo).toBe("SILENCIO_COMPATIVEL");
    expect(r.demandaEsperadaNoPeriodo).toBeCloseTo(0.75, 2);
  });

  it("silêncio que contradiz o p50 derruba a projeção de item de giro", () => {
    // 30 peças/30d -> em 15 dias esperava 15 e não vendeu nenhuma: o número
    // não representa mais o item.
    const r = avaliarVigenciaPrevisao(projecaoAltoGiro(15), 40, AGORA);
    expect(r.vigente).toBe(false);
    expect(r.motivo).toBe("SILENCIO_CONTRADIZ");
    expect(r.demandaEsperadaNoPeriodo).toBeCloseTo(15, 2);
  });

  it("sem dado de última venda, quem decide é a compatibilidade com o p50", () => {
    expect(avaliarVigenciaPrevisao(projecaoIntermitente(20), null, AGORA).vigente).toBe(true);
    expect(avaliarVigenciaPrevisao(projecaoAltoGiro(20), null, AGORA).vigente).toBe(false);
  });

  it("a validade estendida é proporcional ao giro do item", () => {
    // Mesmo instante, mesma idade: o intermitente sobrevive, o de giro não.
    const idade = 20;
    expect(avaliarVigenciaPrevisao(projecaoIntermitente(idade), 60, AGORA).vigente).toBe(true);
    expect(avaliarVigenciaPrevisao(projecaoAltoGiro(idade), 60, AGORA).vigente).toBe(false);

    // E o intermitente também tem limite: com p50 alto o bastante, vence.
    const quaseNoLimite = {
      demandaP50: TOLERANCIA_SILENCIO_UNIDADES * (30 / idade) + 0.5,
      horizonteDias: 30,
      dataPrevisao: dataComIdade(idade),
    };
    expect(avaliarVigenciaPrevisao(quaseNoLimite, 60, AGORA).vigente).toBe(false);
  });

  it("projeção sem horizonte válido não é aproveitada", () => {
    const r = avaliarVigenciaPrevisao(
      { demandaP50: 5, horizonteDias: 0, dataPrevisao: dataComIdade(10) },
      60,
      AGORA
    );
    expect(r.vigente).toBe(false);
    expect(r.motivo).toBe("DATA_INVALIDA");
  });

  it("data ilegível não é aproveitada", () => {
    const r = avaliarVigenciaPrevisao(
      { demandaP50: 5, horizonteDias: 30, dataPrevisao: "" },
      60,
      AGORA
    );
    expect(r.vigente).toBe(false);
    expect(r.motivo).toBe("DATA_INVALIDA");
    expect(r.idadeDias).toBeNull();
  });
});

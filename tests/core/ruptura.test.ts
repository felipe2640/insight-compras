import { describe, it, expect } from "vitest";
import {
  agruparMovimentosPorDia,
  calcularDiasEmRuptura,
  diaIso,
} from "@core/calculo/ruptura";

const HOJE = new Date("2026-09-09T12:00:00Z");
const dia = (recuo: number) => diaIso(new Date(Date.UTC(2026, 8, 9) - recuo * 86_400_000));

describe("agrupamento de movimentos por dia", () => {
  it("soma o que aconteceu no mesmo dia", () => {
    expect(
      agruparMovimentosPorDia([
        { data: "2026-09-09T08:00:00", delta: 5 },
        { data: "2026-09-09T17:00:00", delta: -2 },
        { data: "2026-09-08T10:00:00", delta: 3 },
      ])
    ).toEqual([
      { dia: "2026-09-08", delta: 3 },
      { dia: "2026-09-09", delta: 3 },
    ]);
  });

  it("descarta movimento sem quantidade e data inválida", () => {
    expect(
      agruparMovimentosPorDia([
        { data: "2026-09-09", delta: 0 },
        { data: "data podre", delta: 5 },
        { data: "2026-09-09", delta: Number.NaN },
      ])
    ).toEqual([]);
  });
});

describe("reconstrução do saldo para medir ruptura", () => {
  it("item com saldo hoje e sem movimento nunca zerou na janela", () => {
    const r = calcularDiasEmRuptura({ saldoAtual: 4, movimentos: [], diasJanela: 90, hoje: HOJE });
    expect(r).toEqual({
      diasZerados: 0,
      diasAnalisados: 90,
      dataUltimoZeramento: null,
      confiavel: true,
    });
  });

  it("item zerado hoje e sem movimento ficou zerado a janela inteira", () => {
    const r = calcularDiasEmRuptura({ saldoAtual: 0, movimentos: [], diasJanela: 90, hoje: HOJE });
    expect(r.diasZerados).toBe(90);
    expect(r.dataUltimoZeramento).toBe(dia(0));
  });

  it("uma entrada recente prova que ANTES dela o item estava zerado", () => {
    // Chegaram 10 peças há 3 dias e nada saiu: hoje tem 10, mas de 3 dias atrás
    // para trás o saldo era 0.
    const r = calcularDiasEmRuptura({
      saldoAtual: 10,
      movimentos: [{ dia: dia(3), delta: 10 }],
      diasJanela: 10,
      hoje: HOJE,
    });
    // Contagem por FIM DE DIA: no dia em que a peça chegou o saldo já era 10,
    // então esse dia não é ruptura. Zerado do recuo 4 ao 9 = 6 dias.
    expect(r.diasZerados).toBe(6);
    expect(r.dataUltimoZeramento).toBe(dia(4));
    expect(r.confiavel).toBe(true);
  });

  it("desfaz saída: quem vendeu ontem tinha mais estoque anteontem", () => {
    // hoje 0, saiu 2 ontem => ontem terminou com 0, anteontem tinha 2
    const r = calcularDiasEmRuptura({
      saldoAtual: 0,
      movimentos: [{ dia: dia(1), delta: -2 }],
      diasJanela: 5,
      hoje: HOJE,
    });
    // recuo 0: saldo 0 (zerado); recuo 1: saldo 0 (zerado); depois vira 2
    expect(r.diasZerados).toBe(2);
    expect(r.dataUltimoZeramento).toBe(dia(0));
  });

  it("o último zeramento é o mais recente, não o primeiro da janela", () => {
    const r = calcularDiasEmRuptura({
      saldoAtual: 5,
      movimentos: [
        { dia: dia(2), delta: 5 }, // entrou há 2 dias
        { dia: dia(8), delta: -3 }, // saiu há 8 dias
        { dia: dia(9), delta: 3 },
      ],
      diasJanela: 12,
      hoje: HOJE,
    });
    // A entrada do recuo 2 fecha aquele dia com saldo; o zerado mais recente é o 3.
    expect(r.dataUltimoZeramento).toBe(dia(3));
  });

  it("marca como não confiável quando a caminhada exige saldo absurdo", () => {
    // Saídas enormes sem entradas: o passado teria que ser muito negativo, o que
    // significa movimento não registrado no ERP.
    const r = calcularDiasEmRuptura({
      saldoAtual: 0,
      movimentos: [{ dia: dia(1), delta: 50 }],
      diasJanela: 5,
      hoje: HOJE,
    });
    expect(r.confiavel).toBe(false);
    expect(r.diasZerados).toBeGreaterThan(0);
  });

  it("saldo negativo por ruído do ERP conta como ruptura", () => {
    const r = calcularDiasEmRuptura({ saldoAtual: -1, movimentos: [], diasJanela: 3, hoje: HOJE });
    expect(r.diasZerados).toBe(3);
  });

  it("janela zero não inventa medição", () => {
    expect(calcularDiasEmRuptura({ saldoAtual: 0, movimentos: [], diasJanela: 0, hoje: HOJE })).toEqual({
      diasZerados: 0,
      diasAnalisados: 0,
      dataUltimoZeramento: null,
      confiavel: true,
    });
  });

  it("movimento fora da janela não muda a contagem dentro dela", () => {
    const dentro = calcularDiasEmRuptura({
      saldoAtual: 3,
      movimentos: [{ dia: dia(200), delta: 99 }],
      diasJanela: 30,
      hoje: HOJE,
    });
    expect(dentro.diasZerados).toBe(0);
  });
});

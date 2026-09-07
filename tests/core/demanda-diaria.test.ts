import { describe, it, expect } from "vitest";
import {
  calcularConsumoDiario,
  calcularConsumoJanela,
  calcularProjecaoMensal,
  classificarPerfilGiro,
  verificarElegibilidadeHistorico,
  CRITERIOS_ELEGIBILIDADE,
} from "@core/calculo/demanda-diaria";

describe("Motor de Demanda Diária e Perfil de Rotatividade", () => {
  describe("calcularConsumoDiario", () => {
    it("deve calcular o consumo diário com precisão para saídas normais em 180 dias", () => {
      const consumo = calcularConsumoDiario({
        vendasLiquidas180d: 180,
        notasFiscais90d: 15,
        diasObservados: 180,
      });
      expect(consumo).toBe(1);
    });

    it("deve calcular o consumo proporcional quando o histórico observado for inferior a 180 dias", () => {
      const consumo = calcularConsumoDiario({
        vendasLiquidas180d: 60,
        notasFiscais90d: 10,
        diasObservados: 60,
      });
      expect(consumo).toBe(1);
    });

    it("deve retornar 0 quando o volume de vendas líquidas for zero", () => {
      const consumo = calcularConsumoDiario({
        vendasLiquidas180d: 0,
        notasFiscais90d: 0,
        diasObservados: 180,
      });
      expect(consumo).toBe(0);
    });

    it("deve retornar 0 quando o volume de vendas líquidas for negativo (devoluções)", () => {
      const consumo = calcularConsumoDiario({
        vendasLiquidas180d: -5,
        notasFiscais90d: 2,
        diasObservados: 90,
      });
      expect(consumo).toBe(0);
    });

    it("deve evitar divisão por zero quando diasObservados for 0 ou negativo", () => {
      const consumoZero = calcularConsumoDiario({
        vendasLiquidas180d: 10,
        notasFiscais90d: 3,
        diasObservados: 0,
      });
      const consumoNegativo = calcularConsumoDiario({
        vendasLiquidas180d: 10,
        notasFiscais90d: 3,
        diasObservados: -30,
      });

      expect(consumoZero).toBe(0);
      expect(consumoNegativo).toBe(0);
    });

    it("deve limitar o divisor a 180 dias no máximo", () => {
      // 360 vendas com 360 dias observados deve usar base 180: 360 / 180 = 2
      const consumo = calcularConsumoDiario({
        vendasLiquidas180d: 360,
        notasFiscais90d: 20,
        diasObservados: 360,
      });
      expect(consumo).toBe(2);
    });
  });

  describe("calcularConsumoJanela e calcularProjecaoMensal", () => {
    it("deve calcular consumo para janelas arbitrárias (30d, 90d)", () => {
      expect(calcularConsumoJanela(30, 30)).toBe(1);
      expect(calcularConsumoJanela(90, 90)).toBe(1);
      expect(calcularConsumoJanela(0, 30)).toBe(0);
      expect(calcularConsumoJanela(15, 0)).toBe(0);
    });

    it("deve calcular a projeção mensal multiplicando consumo diário por 30", () => {
      expect(calcularProjecaoMensal(0.5)).toBe(15);
      expect(calcularProjecaoMensal(0)).toBe(0);
      expect(calcularProjecaoMensal(-2)).toBe(0);
    });
  });

  describe("verificarElegibilidadeHistorico", () => {
    it("deve reprovar itens com menos de 3 notas fiscais nos últimos 90 dias", () => {
      expect(verificarElegibilidadeHistorico(2, 90)).toBe(false);
      expect(verificarElegibilidadeHistorico(0, 90)).toBe(false);
    });

    it("deve reprovar itens com menos de 15 dias de histórico observado", () => {
      expect(verificarElegibilidadeHistorico(5, 14)).toBe(false);
      expect(verificarElegibilidadeHistorico(5, 0)).toBe(false);
    });

    it("deve aprovar itens que cumprem ambos os critérios mínimos", () => {
      expect(
        verificarElegibilidadeHistorico(
          CRITERIOS_ELEGIBILIDADE.MINIMO_NOTAS_90D,
          CRITERIOS_ELEGIBILIDADE.MINIMO_DIAS_HISTORICO
        )
      ).toBe(true);
      expect(verificarElegibilidadeHistorico(10, 90)).toBe(true);
    });
  });

  describe("classificarPerfilGiro", () => {
    it("deve retornar SEM_HISTORICO_SUFICIENTE se os critérios de recorrência não forem atendidos", () => {
      // 1 venda única pontual acidental de 20 unidades em 90 dias (1 nota)
      const perfil = classificarPerfilGiro(20 / 90, 1, 90);
      expect(perfil).toBe("SEM_HISTORICO_SUFICIENTE");
    });

    it("deve classificar como ALTO_GIRO quando a projeção mensal for >= 6 un/mês", () => {
      // Consumo diário de 0.25 un/dia * 30 = 7.5 un/mês
      const perfil = classificarPerfilGiro(0.25, 6, 90);
      expect(perfil).toBe("ALTO_GIRO");
    });

    it("deve classificar como MEDIO_GIRO quando a projeção mensal estiver entre 2.5 e 5.9 un/mês", () => {
      // Consumo diário de 0.10 un/dia * 30 = 3.0 un/mês
      const perfil = classificarPerfilGiro(0.1, 4, 90);
      expect(perfil).toBe("MEDIO_GIRO");
    });

    it("deve classificar como BAIXO_GIRO_INTERMITENTE quando a projeção mensal for < 2.5 un/mês", () => {
      // Consumo diário de 0.05 un/dia * 30 = 1.5 un/mês
      const perfil = classificarPerfilGiro(0.05, 3, 90);
      expect(perfil).toBe("BAIXO_GIRO_INTERMITENTE");
    });
  });
});

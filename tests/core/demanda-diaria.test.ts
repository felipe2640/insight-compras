import { describe, it, expect } from "vitest";
import {
  calcularConsumoDiario,
  calcularConsumoJanela,
  calcularProjecaoMensal,
  calcularMedianaLinhaVenda,
  classificarPerfilGiro,
  verificarElegibilidadeHistorico,
  CRITERIOS_ELEGIBILIDADE_PADRAO,
} from "@core/calculo/demanda-diaria";

describe("Motor de Demanda Diária e Perfil de Rotatividade", () => {
  describe("calcularConsumoDiario", () => {
    it("usa o tamanho da janela como denominador fixo", () => {
      expect(calcularConsumoDiario({ vendasLiquidasJanela: 180, diasJanela: 180 })).toBe(1);
    });

    it("NÃO infla a taxa quando o item tem pouco histórico dentro da janela", () => {
      // 60 unidades numa janela de 180 dias são 0,333/dia — e não 1,0/dia.
      // Dividir por "dias observados" era o que inflava itens novos e intermitentes.
      const consumo = calcularConsumoDiario({ vendasLiquidasJanela: 60, diasJanela: 180 });
      expect(consumo).toBeCloseTo(0.3333, 4);
    });

    it("usa 180 dias como janela padrão", () => {
      expect(calcularConsumoDiario({ vendasLiquidasJanela: 90 })).toBe(0.5);
    });

    it("retorna 0 para vendas zeradas ou negativas", () => {
      expect(calcularConsumoDiario({ vendasLiquidasJanela: 0, diasJanela: 180 })).toBe(0);
      expect(calcularConsumoDiario({ vendasLiquidasJanela: -5, diasJanela: 180 })).toBe(0);
    });

    it("evita divisão por zero", () => {
      expect(calcularConsumoDiario({ vendasLiquidasJanela: 10, diasJanela: 0 })).toBe(0);
      expect(calcularConsumoDiario({ vendasLiquidasJanela: 10, diasJanela: -30 })).toBe(0);
    });
  });

  describe("calcularConsumoJanela", () => {
    it("calcula a taxa de cada janela com o próprio denominador", () => {
      expect(calcularConsumoJanela(30, 30)).toBe(1);
      expect(calcularConsumoJanela(90, 90)).toBe(1);
      expect(calcularConsumoJanela(45, 90)).toBe(0.5);
    });

    it("retorna 0 em entradas inválidas", () => {
      expect(calcularConsumoJanela(0, 90)).toBe(0);
      expect(calcularConsumoJanela(10, 0)).toBe(0);
    });
  });

  describe("calcularProjecaoMensal", () => {
    it("projeta 30 dias", () => {
      expect(calcularProjecaoMensal(1)).toBe(30);
      expect(calcularProjecaoMensal(0)).toBe(0);
    });
  });

  describe("verificarElegibilidadeHistorico", () => {
    it("exige notas distintas E meses ativos", () => {
      expect(verificarElegibilidadeHistorico(3, 2)).toBe(true);
      expect(verificarElegibilidadeHistorico(2, 2)).toBe(false); // notas insuficientes
      expect(verificarElegibilidadeHistorico(3, 1)).toBe(false); // sem recorrência mensal
    });

    it("reprova concentração de notas em um único mês", () => {
      // 40 notas, todas no mesmo mês: volume alto, recorrência nenhuma.
      expect(verificarElegibilidadeHistorico(40, 1)).toBe(false);
    });

    it("aceita critérios customizados do tenant", () => {
      const criterios = { minimoNotasDistintas: 5, minimoMesesAtivos: 3 };
      expect(verificarElegibilidadeHistorico(4, 3, criterios)).toBe(false);
      expect(verificarElegibilidadeHistorico(5, 3, criterios)).toBe(true);
    });

    it("expõe os critérios padrão do estudo (3 notas, 2 meses)", () => {
      expect(CRITERIOS_ELEGIBILIDADE_PADRAO.minimoNotasDistintas).toBe(3);
      expect(CRITERIOS_ELEGIBILIDADE_PADRAO.minimoMesesAtivos).toBe(2);
    });
  });

  describe("classificarPerfilGiro", () => {
    it("classifica pelos limiares de consumo mensal (6 e 2,5)", () => {
      expect(classificarPerfilGiro(6 / 30, 3, 2)).toBe("ALTO_GIRO");
      expect(classificarPerfilGiro(2.5 / 30, 3, 2)).toBe("MEDIO_GIRO");
      expect(classificarPerfilGiro(2.49 / 30, 3, 2)).toBe("BAIXO_GIRO_INTERMITENTE");
    });

    it("marca sem histórico quando falta recorrência, mesmo com consumo alto", () => {
      expect(classificarPerfilGiro(10, 2, 2)).toBe("SEM_HISTORICO_SUFICIENTE");
      expect(classificarPerfilGiro(10, 3, 1)).toBe("SEM_HISTORICO_SUFICIENTE");
    });
  });

  describe("calcularMedianaLinhaVenda", () => {
    it("calcula a mediana apenas das quantidades positivas", () => {
      expect(calcularMedianaLinhaVenda([1, 2, 3])).toBe(2);
      expect(calcularMedianaLinhaVenda([2, 4])).toBe(3);
      expect(calcularMedianaLinhaVenda([0, 0, 4, 4])).toBe(4);
    });

    it("retorna 0 sem quantidades positivas", () => {
      expect(calcularMedianaLinhaVenda([])).toBe(0);
      expect(calcularMedianaLinhaVenda([0, -1])).toBe(0);
    });
  });
});

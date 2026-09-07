import { inferirLotePadraoPorCategoria } from "@adapters/comum/lote-autopecas";
import { describe, it, expect } from "vitest";
import {
  arredondarParaMultiplo,
  detectarLotePorHistograma,
  ajustarQuantidadePorLote,
} from "@core/travas/lote-multiplo";

describe("Ajustador de Lotes e Múltiplos Físicos de Fábrica", () => {
  describe("arredondarParaMultiplo", () => {
    it("deve arredondar para o próximo número par quando lote for 2 (amortecedores/discos)", () => {
      expect(arredondarParaMultiplo(1, 2)).toBe(2);
      expect(arredondarParaMultiplo(2, 2)).toBe(2);
      expect(arredondarParaMultiplo(3, 2)).toBe(4);
      expect(arredondarParaMultiplo(4.1, 2)).toBe(6);
    });

    it("deve arredondar para o próximo múltiplo de 4 quando lote for 4 (jogos de vela)", () => {
      expect(arredondarParaMultiplo(1, 4)).toBe(4);
      expect(arredondarParaMultiplo(4, 4)).toBe(4);
      expect(arredondarParaMultiplo(5, 4)).toBe(8);
      expect(arredondarParaMultiplo(11, 4)).toBe(12);
    });

    it("deve arredondar para caixas de fábrica fechadas (múltiplos de 10, 12, etc.)", () => {
      expect(arredondarParaMultiplo(7, 10)).toBe(10);
      expect(arredondarParaMultiplo(11, 10)).toBe(20);
      expect(arredondarParaMultiplo(13, 12)).toBe(24);
    });

    it("deve retornar 0 quando a quantidade desejada for 0 ou negativa", () => {
      expect(arredondarParaMultiplo(0, 2)).toBe(0);
      expect(arredondarParaMultiplo(-5, 4)).toBe(0);
    });

    it("deve tratar lote 1 ou inferior como avulso arredondado para cima", () => {
      expect(arredondarParaMultiplo(3.2, 1)).toBe(4);
      expect(arredondarParaMultiplo(5, 0)).toBe(5);
    });
  });

  describe("inferirLotePadraoPorCategoria", () => {
    it("deve inferir lote 2 (par) para amortecedores e discos de freio", () => {
      expect(inferirLotePadraoPorCategoria("AMORTECEDOR DIANT DIR STRADA")).toBe(2);
      expect(inferirLotePadraoPorCategoria("DISCO DE FREIO VENTILADO COROLLA")).toBe(2);
      expect(inferirLotePadraoPorCategoria("TAMBOR DE FREIO TRASEIRO GOL")).toBe(2);
      expect(inferirLotePadraoPorCategoria("MOLA HELICOIDAL DIANTEIRA")).toBe(2);
    });

    it("deve inferir lote 4 (jogo) para velas de ignição e cabos", () => {
      expect(inferirLotePadraoPorCategoria("VELA DE IGNICAO NGK BKR6E")).toBe(4);
      expect(inferirLotePadraoPorCategoria("JOGO DE VELA BOSCH PLATINUM")).toBe(4);
      expect(inferirLotePadraoPorCategoria("CABO DE VELA MAGNETI MARELLI")).toBe(4);
    });

    it("deve retornar lote 1 (avulso) para outros itens em geral", () => {
      expect(inferirLotePadraoPorCategoria("OLEO MOTOR 15W40 1L")).toBe(1);
      expect(inferirLotePadraoPorCategoria("FILTRO DE COMBUSTIVEL ONIX")).toBe(1);
      expect(inferirLotePadraoPorCategoria("BATERIA MOURA 60AH")).toBe(1);
    });
  });

  describe("ajustarQuantidadePorLote", () => {
    it("deve respeitar embalagem mínima do fornecedor antes de aplicar o múltiplo", () => {
      const resultado = ajustarQuantidadePorLote({
        quantidadeDesejada: 3,
        multiploLote: 5,
        embalagemMinima: 10,
      });

      // Base mínima 10, que já é múltiplo de 5 => 10
      expect(resultado.quantidadeAjustada).toBe(10);
      expect(resultado.multiploAplicado).toBe(5);
      expect(resultado.embalagemMinimaAplicada).toBe(10);
    });

    it("deve gerar justificativa descritiva do motivo do arredondamento para pares", () => {
      const resultado = ajustarQuantidadePorLote({
        quantidadeDesejada: 3,
        multiploLote: 2,
      });

      expect(resultado.quantidadeAjustada).toBe(4);
      expect(resultado.motivoAjuste).toContain("múltiplo de embalagem fechada (2 un)");
    });

    it("deve retornar quantidade 0 sem alterações quando desejado for 0", () => {
      const resultado = ajustarQuantidadePorLote({
        quantidadeDesejada: 0,
        multiploLote: 4,
      });

      expect(resultado.quantidadeAjustada).toBe(0);
      expect(resultado.motivoAjuste).toBeNull();
    });
  });

  describe("detectarLotePorHistograma", () => {
    it("detecta o lote quando a dominância é atingida (>= 70% das linhas)", () => {
      // 7 linhas múltiplas de 4 em 8 = 87,5% >= 70%
      expect(detectarLotePorHistograma([4, 4, 4, 4, 4, 4, 4, 1])).toBe(4);
    });

    it("devolve 1 sem linhas suficientes (mínimo 8)", () => {
      expect(detectarLotePorHistograma([4, 4, 4])).toBe(1);
      expect(detectarLotePorHistograma([])).toBe(1);
    });

    it("devolve 1 quando nenhum candidato domina", () => {
      expect(detectarLotePorHistograma([1, 3, 5, 7, 9, 11, 13, 17])).toBe(1);
    });

    it("prefere o maior lote entre os candidatos aceitos", () => {
      // todos múltiplos de 12 também são de 6, 4, 3 e 2 — vence 12
      expect(detectarLotePorHistograma([12, 12, 24, 12, 36, 12, 24, 12])).toBe(12);
    });

    it("ignora quantidades zeradas ou negativas", () => {
      expect(detectarLotePorHistograma([2, 2, 2, 2, 2, 2, 2, 2, 0, -5])).toBe(2);
    });

    it("é agnóstico de segmento — decide só pelo número", () => {
      // nenhuma descrição envolvida: só o histograma
      expect(detectarLotePorHistograma([2, 4, 6, 8, 10, 12, 14, 16])).toBe(2);
    });
  });
});

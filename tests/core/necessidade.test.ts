import { describe, it, expect } from "vitest";
import {
  calcularNecessidadeItem,
  calcularEstoqueSeguranca,
  calcularPontoDePedido,
  CONFIGURACAO_PADRAO_PERFIS,
} from "@core/calculo/necessidade";

describe("Motor de Cálculo: Necessidade de Compras e Ponto de Pedido", () => {
  describe("calcularEstoqueSeguranca", () => {
    it("deve calcular o estoque de segurança considerando lead time e margem", () => {
      // 2 un/dia, lead time 5 dias, margem 0.25 => ceil(2 * 5 * 1.25) = ceil(12.5) = 13 un
      const es = calcularEstoqueSeguranca(2, 5, 0.25, 0);
      expect(es).toBe(13);
    });

    it("deve prevalecer o estoque mínimo cadastrado no ERP se for superior ao calculado", () => {
      // Calculado seria 13, mas ERP tem mínimo cadastrado de 20
      const es = calcularEstoqueSeguranca(2, 5, 0.25, 20);
      expect(es).toBe(20);
    });

    it("deve retornar o estoque mínimo cadastrado se o consumo diário for zero", () => {
      const es = calcularEstoqueSeguranca(0, 10, 0.25, 8);
      expect(es).toBe(8);
    });
  });

  describe("calcularPontoDePedido", () => {
    it("deve somar consumo durante o lead time ao estoque de segurança", () => {
      // Consumo 1 un/dia, lead time 7 dias, ES = 10 => ceil(1 * 7) + 10 = 17 un
      const pp = calcularPontoDePedido(1, 7, 10);
      expect(pp).toBe(17);
    });
  });

  describe("calcularNecessidadeItem", () => {
    it("deve retornar necessidade líquida ZERO se o item for SEM_HISTORICO_SUFICIENTE", () => {
      const resultado = calcularNecessidadeItem({
        consumoDiario: 1.5,
        perfilGiro: "SEM_HISTORICO_SUFICIENTE",
        saldoFisico: 0,
        estoqueMinimoCadastrado: 5,
        quantidadeJaPedida: 0,
        leadTimeDias: 7,
      });

      expect(resultado.necessidadeLiquida).toBe(0);
      expect(resultado.necessidadeBruta).toBe(0);
      expect(resultado.demandaHorizonte).toBe(0);
    });

    it("deve retornar necessidade líquida ZERO se o consumo diário for 0", () => {
      const resultado = calcularNecessidadeItem({
        consumoDiario: 0,
        perfilGiro: "ALTO_GIRO",
        saldoFisico: 2,
        estoqueMinimoCadastrado: 5,
        quantidadeJaPedida: 0,
        leadTimeDias: 7,
      });

      expect(resultado.necessidadeLiquida).toBe(0);
      expect(resultado.necessidadeBruta).toBe(0);
    });

    it("deve calcular a necessidade líquida correta para ALTO_GIRO deduzindo saldo físico e pedidos em aberto", () => {
      // ALTO_GIRO padrão: horizonte 20 dias, margem 0.25
      // Consumo: 1 un/dia, lead time: 5 dias, estoqueMin: 0
      // ES = ceil(1 * 5 * 1.25) = 7
      // DemandaHorizonte = ceil(1 * 20 * 1.25) = 25
      // MetaEstoque = 25 + 7 = 32 un
      // SaldoFisico = 4, JaPedido = 10 => EstoqueDisponivel = 14
      // NecessidadeLiquida = 32 - 14 = 18 un
      const resultado = calcularNecessidadeItem({
        consumoDiario: 1,
        perfilGiro: "ALTO_GIRO",
        saldoFisico: 4,
        estoqueMinimoCadastrado: 0,
        quantidadeJaPedida: 10,
        leadTimeDias: 5,
      });

      expect(resultado.horizonteDias).toBe(CONFIGURACAO_PADRAO_PERFIS.ALTO_GIRO.horizonteDias);
      expect(resultado.estoqueSeguranca).toBe(7);
      expect(resultado.demandaHorizonte).toBe(25);
      expect(resultado.metaEstoque).toBe(32);
      expect(resultado.estoqueDisponivel).toBe(14);
      expect(resultado.necessidadeLiquida).toBe(18);
    });

    it("deve retornar necessidade líquida ZERO se o estoque disponível já superar a meta", () => {
      const resultado = calcularNecessidadeItem({
        consumoDiario: 1,
        perfilGiro: "ALTO_GIRO",
        saldoFisico: 40, // Saldo 40 > meta 32
        estoqueMinimoCadastrado: 0,
        quantidadeJaPedida: 0,
        leadTimeDias: 5,
      });

      expect(resultado.necessidadeLiquida).toBe(0);
    });
  });
});

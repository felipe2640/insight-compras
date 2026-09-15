import { describe, it, expect } from "vitest";
import {
  calcularNecessidadeItem,
  calcularPrevisaoDemanda,
  calibrarPrevisao,
  arredondarParaLote,
  calcularEstoqueSeguranca,
  calcularPontoDePedido,
  escalarPrevisaoIaParaHorizonte,
  PARAMETROS_MOTOR_PADRAO,
  CONFIGURACAO_PADRAO_PERFIS,
  ParametrosMotorCompra,
} from "@core/calculo/necessidade";

/** Parâmetros homologados da Rede Carreiro (fator 0,90 vencedor do backtest). */
const MOTOR_CARREIRO: ParametrosMotorCompra = {
  ...PARAMETROS_MOTOR_PADRAO,
  fatorCalibracao: 0.9,
  origemPiso: "MEDIANA_LINHA",
};

describe("Motor de Necessidade de Compra", () => {
  describe("arredondarParaLote", () => {
    it("arredonda para cima até o múltiplo do lote", () => {
      expect(arredondarParaLote(5, 4)).toBe(8);
      expect(arredondarParaLote(8, 4)).toBe(8);
      expect(arredondarParaLote(2.1, 1)).toBe(3);
      expect(arredondarParaLote(0, 4)).toBe(0);
    });
  });

  describe("calibrarPrevisao", () => {
    it("aplica o fator e arredonda para cima", () => {
      expect(calibrarPrevisao(10, 0.9)).toBe(9);
      expect(calibrarPrevisao(10, 0.85)).toBe(9);
    });

    it("nunca zera uma previsão positiva", () => {
      expect(calibrarPrevisao(1, 0.6)).toBe(1);
      expect(calibrarPrevisao(1, 0.05)).toBe(1);
    });

    it("mantém zero em zero", () => {
      expect(calibrarPrevisao(0, 0.9)).toBe(0);
    });

    it("fator inválido não altera a previsão", () => {
      expect(calibrarPrevisao(10, 0)).toBe(10);
      expect(calibrarPrevisao(10, Number.NaN)).toBe(10);
    });
  });

  describe("calcularPrevisaoDemanda", () => {
    it("aplica o piso com max, NUNCA somando à demanda", () => {
      // demanda = ceil(0,1 * 20 * 1,25) = 3 ; piso (mediana) = 4 => resultado 4, não 7.
      const r = calcularPrevisaoDemanda(0.1, 20, 0.25, 1, 4);
      expect(r.demandaHorizonte).toBe(3);
      expect(r.pisoAplicado).toBe(4);
      expect(r.previsaoBruta).toBe(4);
    });

    it("reproduz o current_engine_forecast do estudo (lote 4, mediana 4)", () => {
      const r = calcularPrevisaoDemanda(0.1, 20, 0.25, 4, 4);
      expect(r.previsaoBruta).toBe(4);
    });

    it("a demanda vence quando é maior que o piso", () => {
      const r = calcularPrevisaoDemanda(1, 20, 0.25, 1, 2);
      expect(r.demandaHorizonte).toBe(25);
      expect(r.previsaoBruta).toBe(25);
    });

    it("sem consumo não há demanda", () => {
      expect(calcularPrevisaoDemanda(0, 20, 0.25, 1, 5).previsaoBruta).toBe(0);
    });
  });

  describe("calcularNecessidadeItem", () => {
    it("sem histórico suficiente a necessidade é estritamente 0", () => {
      const r = calcularNecessidadeItem({
        consumoDiario: 5,
        perfilGiro: "SEM_HISTORICO_SUFICIENTE",
        saldoFisico: 0,
        quantidadeJaPedida: 0,
        parametrosMotor: MOTOR_CARREIRO,
      });
      expect(r.necessidadeLiquida).toBe(0);
      expect(r.previsaoCalibrada).toBe(0);
    });

    it("consumo zero produz necessidade 0 mesmo com estoque zerado", () => {
      const r = calcularNecessidadeItem({
        consumoDiario: 0,
        perfilGiro: "ALTO_GIRO",
        saldoFisico: 0,
        quantidadeJaPedida: 0,
        parametrosMotor: MOTOR_CARREIRO,
      });
      expect(r.necessidadeLiquida).toBe(0);
    });

    it("calcula a cadeia demanda -> piso -> calibração -> desconto de estoque", () => {
      // cmd 1/dia, ALTO_GIRO: horizonte 20, margem 0,25
      // demanda = ceil(1 * 20 * 1,25) = 25 ; piso mediana 2 => bruta 25
      // calibrada = ceil(25 * 0,9) = 23 ; saldo 10 + pedidos 4 = 14 => líquida 9
      const r = calcularNecessidadeItem({
        consumoDiario: 1,
        perfilGiro: "ALTO_GIRO",
        saldoFisico: 10,
        quantidadeJaPedida: 4,
        medianaLinhaVenda: 2,
        parametrosMotor: MOTOR_CARREIRO,
      });
      expect(r.demandaHorizonte).toBe(25);
      expect(r.previsaoBruta).toBe(25);
      expect(r.previsaoCalibrada).toBe(23);
      expect(r.estoqueDisponivel).toBe(14);
      expect(r.necessidadeLiquida).toBe(9);
      expect(r.necessidadeBruta).toBe(13); // sem descontar pedidos em aberto
    });

    it("o estoque de segurança NÃO entra na meta (é só diagnóstico)", () => {
      const r = calcularNecessidadeItem({
        consumoDiario: 1,
        perfilGiro: "ALTO_GIRO",
        saldoFisico: 0,
        quantidadeJaPedida: 0,
        estoqueMinimoCadastrado: 50,
        leadTimeDias: 7,
        parametrosMotor: MOTOR_CARREIRO,
      });
      // Com origemPiso = MEDIANA_LINHA, o mínimo do ERP não infla a meta.
      expect(r.previsaoCalibrada).toBe(23);
      expect(r.necessidadeLiquida).toBe(23);
      // mas continua disponível como referência para o comprador
      expect(r.estoqueSegurancaDiagnostico).toBeGreaterThan(0);
      expect(r.pontoDePedidoDiagnostico).toBeGreaterThan(0);
    });

    it("origemPiso ESTOQUE_MINIMO_ERP usa o mínimo como piso, não como parcela", () => {
      const r = calcularNecessidadeItem({
        consumoDiario: 0.1,
        perfilGiro: "ALTO_GIRO",
        saldoFisico: 0,
        quantidadeJaPedida: 0,
        estoqueMinimoCadastrado: 10,
        parametrosMotor: { ...MOTOR_CARREIRO, origemPiso: "ESTOQUE_MINIMO_ERP" },
      });
      // demanda = 3, piso = 10 => bruta 10, calibrada ceil(9) = 9
      expect(r.demandaHorizonte).toBe(3);
      expect(r.pisoAplicado).toBe(10);
      expect(r.previsaoBruta).toBe(10);
      expect(r.previsaoCalibrada).toBe(9);
    });

    it("o fator de calibração do tenant muda o resultado", () => {
      const base = {
        consumoDiario: 1,
        perfilGiro: "ALTO_GIRO" as const,
        saldoFisico: 0,
        quantidadeJaPedida: 0,
      };
      const semCalibracao = calcularNecessidadeItem({
        ...base,
        parametrosMotor: { ...PARAMETROS_MOTOR_PADRAO, fatorCalibracao: 1 },
      });
      const comCarreiro = calcularNecessidadeItem({ ...base, parametrosMotor: MOTOR_CARREIRO });
      expect(semCalibracao.necessidadeLiquida).toBe(25);
      expect(comCarreiro.necessidadeLiquida).toBe(23);
    });

    it("respeita o lote de fábrica no arredondamento", () => {
      const r = calcularNecessidadeItem({
        consumoDiario: 0.1,
        perfilGiro: "ALTO_GIRO",
        saldoFisico: 0,
        quantidadeJaPedida: 0,
        loteMultiplo: 4,
        medianaLinhaVenda: 4,
        parametrosMotor: MOTOR_CARREIRO,
      });
      expect(r.previsaoBruta).toBe(4);
    });

    it("mantém os horizontes e margens do estudo", () => {
      expect(CONFIGURACAO_PADRAO_PERFIS.ALTO_GIRO).toEqual({ horizonteDias: 20, margemSeguranca: 0.25 });
      expect(CONFIGURACAO_PADRAO_PERFIS.MEDIO_GIRO).toEqual({ horizonteDias: 15, margemSeguranca: 0.45 });
      expect(CONFIGURACAO_PADRAO_PERFIS.BAIXO_GIRO_INTERMITENTE).toEqual({ horizonteDias: 7, margemSeguranca: 0.8 });
    });
  });

  describe("diagnósticos (fora da meta de compra)", () => {
    it("estoque de segurança respeita o mínimo do ERP como piso", () => {
      expect(calcularEstoqueSeguranca(2, 5, 0.25, 0)).toBe(13);
      expect(calcularEstoqueSeguranca(2, 5, 0.25, 20)).toBe(20);
      expect(calcularEstoqueSeguranca(0, 10, 0.25, 8)).toBe(8);
    });

    it("ponto de pedido soma consumo do lead time ao estoque de segurança", () => {
      expect(calcularPontoDePedido(1, 7, 10)).toBe(17);
    });
  });

  describe("escalarPrevisaoIaParaHorizonte", () => {
    const projecao30Dias = { demandaP50: 18, demandaP80: 30, horizonteDiasPrevisao: 30 };

    it("converte o total do modelo para o horizonte do item", () => {
      // 30 peças em 30 dias -> 20 dias de cobertura = 20 peças
      expect(escalarPrevisaoIaParaHorizonte(projecao30Dias, 20, 1)).toBe(20);
      expect(escalarPrevisaoIaParaHorizonte(projecao30Dias, 7, 1)).toBe(7);
      // Horizonte maior que o do modelo extrapola na mesma proporção
      expect(escalarPrevisaoIaParaHorizonte(projecao30Dias, 60, 1)).toBe(60);
    });

    it("arredonda o resultado para o múltiplo do lote", () => {
      expect(escalarPrevisaoIaParaHorizonte(projecao30Dias, 20, 8)).toBe(24);
    });

    it("devolve null quando a projeção não é utilizável", () => {
      expect(escalarPrevisaoIaParaHorizonte(null, 20, 1)).toBeNull();
      expect(escalarPrevisaoIaParaHorizonte(undefined, 20, 1)).toBeNull();
      // p80 não positivo
      expect(escalarPrevisaoIaParaHorizonte({ ...projecao30Dias, demandaP80: 0 }, 20, 1)).toBeNull();
      // sem horizonte de origem não há como dar escala ao número
      expect(
        escalarPrevisaoIaParaHorizonte({ ...projecao30Dias, horizonteDiasPrevisao: 0 }, 20, 1)
      ).toBeNull();
      expect(
        escalarPrevisaoIaParaHorizonte({ ...projecao30Dias, demandaP80: Number.NaN }, 20, 1)
      ).toBeNull();
      expect(escalarPrevisaoIaParaHorizonte(projecao30Dias, 0, 1)).toBeNull();
    });
  });

  describe("integração com previsão probabilística por IA", () => {
    /** Projeção publicada pelo pipeline: total de 30 dias. */
    const PROJECAO_IA = {
      demandaP50: 18,
      demandaP80: 23,
      horizonteDiasPrevisao: 30,
      modelo: "Chronos-Bolt (Small)",
    };

    it("substitui a taxa estática pela projeção do modelo reescalada ao horizonte", () => {
      const comIa = calcularNecessidadeItem({
        consumoDiario: 1,
        perfilGiro: "ALTO_GIRO",
        saldoFisico: 5,
        quantidadeJaPedida: 0,
        loteMultiplo: 5,
        medianaLinhaVenda: 0,
        parametrosMotor: {
          ...PARAMETROS_MOTOR_PADRAO,
          fatorCalibracao: 0.90,
        },
        previsaoDemandaIA: PROJECAO_IA,
      });

      // p80 de 30 dias reescalado para 20 dias: 23 * (20/30) = 15,33 -> lote 5 = 20
      expect(comIa.demandaHorizonte).toBe(20);
      expect(comIa.previsaoBruta).toBe(20);
      // A calibração de 0,90 do tenant NÃO incide sobre a projeção da IA: ela
      // corrige o viés da régua estática, e o p80 do modelo não tem esse viés.
      expect(comIa.fatorCalibracao).toBe(1);
      expect(comIa.previsaoCalibrada).toBe(20);
      // Necessidade líquida: 20 - saldo(5) = 15
      expect(comIa.necessidadeLiquida).toBe(15);
    });

    it("mantém a calibração do tenant no caminho analítico", () => {
      const parametros = {
        consumoDiario: 1,
        perfilGiro: "ALTO_GIRO",
        saldoFisico: 5,
        quantidadeJaPedida: 0,
        loteMultiplo: 5,
        medianaLinhaVenda: 0,
        parametrosMotor: { ...PARAMETROS_MOTOR_PADRAO, fatorCalibracao: 0.90 },
      } as const;

      const semIa = calcularNecessidadeItem(parametros);

      // Régua estática: 1 * 20 * 1,25 = 25 -> lote 5 = 25; calibrado: ceil(25 * 0,90) = 23
      expect(semIa.origemPrevisao).toBe("ANALITICA");
      expect(semIa.fatorCalibracao).toBe(0.90);
      expect(semIa.previsaoCalibrada).toBe(23);

      // Mesmo item, agora com projeção de IA: o fator deixa de incidir.
      const comIa = calcularNecessidadeItem({ ...parametros, previsaoDemandaIA: PROJECAO_IA });
      expect(comIa.origemPrevisao).toBe("IA");
      expect(comIa.fatorCalibracao).toBe(1);
    });

    it("a mesma projeção pesa menos em item de baixo giro (horizonte de 7 dias)", () => {
      const comum = {
        consumoDiario: 1,
        saldoFisico: 0,
        quantidadeJaPedida: 0,
        loteMultiplo: 1,
        parametrosMotor: PARAMETROS_MOTOR_PADRAO,
        previsaoDemandaIA: PROJECAO_IA,
      } as const;

      const altoGiro = calcularNecessidadeItem({ ...comum, perfilGiro: "ALTO_GIRO" });
      const baixoGiro = calcularNecessidadeItem({
        ...comum,
        perfilGiro: "BAIXO_GIRO_INTERMITENTE",
      });

      // 23 * (20/30) = 15,33 -> 16 | 23 * (7/30) = 5,37 -> 6
      expect(altoGiro.demandaHorizonte).toBe(16);
      expect(baixoGiro.demandaHorizonte).toBe(6);
      // O número cru do modelo (23) nunca vira meta de um horizonte de 7 dias
      expect(baixoGiro.demandaHorizonte).toBeLessThan(PROJECAO_IA.demandaP80);
    });

    it("cai no baseline quando a projeção vem sem horizonte de origem", () => {
      const res = calcularNecessidadeItem({
        consumoDiario: 1,
        perfilGiro: "ALTO_GIRO",
        saldoFisico: 0,
        quantidadeJaPedida: 0,
        loteMultiplo: 1,
        parametrosMotor: PARAMETROS_MOTOR_PADRAO,
        previsaoDemandaIA: { ...PROJECAO_IA, horizonteDiasPrevisao: 0 },
      });

      // Motor estático: 1 * 20 dias * (1 + 0,25) = 25
      expect(res.demandaHorizonte).toBe(25);
    });

    it("ignora previsão de IA se o produto não tiver histórico comprovado", () => {
      const res = calcularNecessidadeItem({
        consumoDiario: 0,
        perfilGiro: "SEM_HISTORICO_SUFICIENTE",
        saldoFisico: 0,
        quantidadeJaPedida: 0,
        previsaoDemandaIA: {
          demandaP50: 10,
          demandaP80: 15,
          horizonteDiasPrevisao: 30,
        },
      });
      expect(res.necessidadeLiquida).toBe(0);
    });
  });
});

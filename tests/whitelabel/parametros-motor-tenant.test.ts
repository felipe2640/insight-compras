import { describe, it, expect } from "vitest";
import { TENANT_CARREIRO } from "@config/tenants/carreiro";
import { montarOpcoesMatriz, montarNomesFiliais } from "@/lib/cockpit/opcoes-tenant";
import { calcularNecessidadeItem, PARAMETROS_MOTOR_PADRAO } from "@core/calculo/necessidade";
import {
  inferirLotePadraoPorCategoria,
  resolverLoteAutopecas,
  descreverAjusteLoteAutopecas,
} from "@adapters/comum/lote-autopecas";

describe("White-Label — parâmetros de motor por tenant", () => {
  describe("calibração homologada da Carreiro", () => {
    it("mantém o fator 0,90 vencedor do backtest", () => {
      expect(TENANT_CARREIRO.parametrosMotor.motor.fatorCalibracao).toBe(0.9);
    });

    it("registra a procedência da calibração para auditoria", () => {
      const p = TENANT_CARREIRO.parametrosMotor.procedenciaCalibracao;
      expect(p.modeloVencedor).toBe("current_engine_calibrated_90");
      expect(p.seriesElegiveis).toBe(8998);
      expect(p.comparacoesPorModelo).toBe(69900);
    });

    it("herda os horizontes e margens da base comum", () => {
      const motor = TENANT_CARREIRO.parametrosMotor.motor;
      expect(motor.horizontes).toEqual(PARAMETROS_MOTOR_PADRAO.horizontes);
      expect(motor.margens).toEqual(PARAMETROS_MOTOR_PADRAO.margens);
    });

    it("usa a mediana da linha como piso, não o mínimo do ERP", () => {
      expect(TENANT_CARREIRO.parametrosMotor.motor.origemPiso).toBe("MEDIANA_LINHA");
    });
  });

  describe("injeção das opções no gerador", () => {
    it("entrega os parâmetros calibrados, não o baseline", () => {
      const opcoes = montarOpcoesMatriz();
      expect(opcoes.parametrosMotor?.fatorCalibracao).toBe(0.9);
      expect(opcoes.leadTimePadraoDias).toBe(7);
      expect(opcoes.filialFocoId).toBe(1);
    });

    it("monta os nomes das 5 filiais a partir do cadastro do tenant", () => {
      const nomes = montarNomesFiliais(TENANT_CARREIRO);
      expect(Object.keys(nomes)).toHaveLength(5);
      expect(nomes[1]).toContain("Pedro II");
      expect(nomes[5]).toContain("José de Freitas");
    });

    it("permite sobrescrever a filial em foco", () => {
      expect(montarOpcoesMatriz(3).filialFocoId).toBe(3);
    });
  });

  describe("mesma lógica, valores diferentes", () => {
    it("dois tenants com fatores distintos produzem sugestões distintas", () => {
      const entrada = {
        consumoDiario: 1,
        perfilGiro: "ALTO_GIRO" as const,
        saldoFisico: 0,
        quantidadeJaPedida: 0,
      };

      const carreiro = calcularNecessidadeItem({
        ...entrada,
        parametrosMotor: TENANT_CARREIRO.parametrosMotor.motor,
      });
      const clienteConservador = calcularNecessidadeItem({
        ...entrada,
        parametrosMotor: { ...PARAMETROS_MOTOR_PADRAO, fatorCalibracao: 0.6 },
      });

      // Mesma fórmula, calibrações diferentes.
      expect(carreiro.demandaHorizonte).toBe(clienteConservador.demandaHorizonte);
      expect(carreiro.necessidadeLiquida).toBe(23);
      expect(clienteConservador.necessidadeLiquida).toBe(15);
    });

    it("horizonte customizado do cliente é respeitado", () => {
      const r = calcularNecessidadeItem({
        consumoDiario: 1,
        perfilGiro: "ALTO_GIRO",
        saldoFisico: 0,
        quantidadeJaPedida: 0,
        parametrosMotor: {
          ...PARAMETROS_MOTOR_PADRAO,
          horizontes: { ...PARAMETROS_MOTOR_PADRAO.horizontes, ALTO_GIRO: 10 },
        },
      });
      expect(r.horizonteDias).toBe(10);
      expect(r.demandaHorizonte).toBe(13); // ceil(1 * 10 * 1,25)
    });
  });

  describe("vocabulário de autopeças vive no adapter, não no core", () => {
    it("infere par e jogo pelo texto", () => {
      expect(inferirLotePadraoPorCategoria("AMORTECEDOR DIANT DIR STRADA")).toBe(2);
      expect(inferirLotePadraoPorCategoria("VELA DE IGNICAO NGK")).toBe(4);
      expect(inferirLotePadraoPorCategoria("OLEO MOTOR 15W40 1L")).toBe(1);
    });

    it("respeita a precedência ERP > histograma > vocabulário", () => {
      expect(
        resolverLoteAutopecas({ loteCadastradoErp: 6, loteDetectadoHistograma: 4, descricao: "AMORTECEDOR" })
      ).toEqual({ lote: 6, origem: "ERP" });

      expect(
        resolverLoteAutopecas({ loteDetectadoHistograma: 4, descricao: "AMORTECEDOR" })
      ).toEqual({ lote: 4, origem: "HISTOGRAMA" });

      expect(resolverLoteAutopecas({ descricao: "AMORTECEDOR" })).toEqual({
        lote: 2,
        origem: "VOCABULARIO",
      });
    });

    it("descreve o ajuste no vocabulário do comprador", () => {
      expect(descreverAjusteLoteAutopecas(2)).toContain("par");
      expect(descreverAjusteLoteAutopecas(4)).toContain("jogo de 4");
      expect(descreverAjusteLoteAutopecas(1)).toBeNull();
    });
  });
});

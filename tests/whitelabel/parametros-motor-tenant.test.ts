import { describe, it, expect } from "vitest";
import { TENANT_CARREIRO } from "@config/tenants/carreiro";
import { montarOpcoesMatriz, montarNomesFiliais } from "@/lib/cockpit/opcoes-tenant";
import {
  calcularNecessidadeItem,
  calcularFatorReducaoPorMargem,
  PARAMETROS_MOTOR_PADRAO,
} from "@core/calculo/necessidade";
import {
  inferirLotePadraoPorCategoria,
  resolverLoteAutopecas,
  descreverAjusteLoteAutopecas,
} from "@adapters/comum/lote-autopecas";
import { normalizarDecisaoCompraCarreiro } from "@adapters/carreiro/mapeador-dax";

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

describe("Governança de compra do processo do cliente", () => {
  it("PAUSAR zera a sugestão mesmo com demanda real", () => {
    const base = {
      consumoDiario: 1,
      perfilGiro: "ALTO_GIRO" as const,
      saldoFisico: 0,
      quantidadeJaPedida: 0,
      parametrosMotor: TENANT_CARREIRO.parametrosMotor.motor,
    };
    const semSinal = calcularNecessidadeItem(base);
    const pausado = calcularNecessidadeItem({ ...base, sinalGovernanca: "PAUSAR" });

    expect(semSinal.necessidadeLiquida).toBe(23);
    expect(pausado.necessidadeAntesGovernanca).toBe(23);
    expect(pausado.necessidadeLiquida).toBe(0);
  });

  it("REDUZIR corta proporcionalmente ao buraco de margem", () => {
    const base = {
      consumoDiario: 1,
      perfilGiro: "ALTO_GIRO" as const,
      saldoFisico: 0,
      quantidadeJaPedida: 0,
      parametrosMotor: TENANT_CARREIRO.parametrosMotor.motor,
      sinalGovernanca: "REDUZIR" as const,
      margemAlvo: 0.3,
    };

    // Margem na meta: nada a cortar.
    expect(calcularNecessidadeItem({ ...base, margemRealizada: 0.3 }).necessidadeLiquida).toBe(23);

    // Margem 27% -> fator 0,90 -> floor(23 * 0,9) = 20
    const quase = calcularNecessidadeItem({ ...base, margemRealizada: 0.27 });
    expect(quase.fatorReducaoAplicado).toBeCloseTo(0.9, 5);
    expect(quase.necessidadeLiquida).toBe(20);

    // Margem 15% -> fator 0,50 -> floor(23 * 0,5) = 11
    const ruim = calcularNecessidadeItem({ ...base, margemRealizada: 0.15 });
    expect(ruim.fatorReducaoAplicado).toBeCloseTo(0.5, 5);
    expect(ruim.necessidadeLiquida).toBe(11);

    // Prejuízo -> piso 0,25 -> floor(23 * 0,25) = 5
    const prejuizo = calcularNecessidadeItem({ ...base, margemRealizada: -0.34 });
    expect(prejuizo.fatorReducaoAplicado).toBe(0.25);
    expect(prejuizo.necessidadeLiquida).toBe(5);

    // Quanto pior a margem, menor a compra — monotonicidade.
    expect(quase.necessidadeLiquida).toBeGreaterThan(ruim.necessidadeLiquida);
    expect(ruim.necessidadeLiquida).toBeGreaterThan(prejuizo.necessidadeLiquida);
  });

  it("sem margem apurada usa o fator declarado do tenant", () => {
    const r = calcularNecessidadeItem({
      consumoDiario: 1,
      perfilGiro: "ALTO_GIRO",
      saldoFisico: 0,
      quantidadeJaPedida: 0,
      parametrosMotor: TENANT_CARREIRO.parametrosMotor.motor,
      sinalGovernanca: "REDUZIR",
      margemRealizada: null,
    });
    expect(r.fatorReducaoAplicado).toBe(0.5);
    expect(r.necessidadeLiquida).toBe(11);
  });

  it("REDUZIR nunca zera uma necessidade positiva", () => {
    const r = calcularNecessidadeItem({
      consumoDiario: 0.05,
      perfilGiro: "BAIXO_GIRO_INTERMITENTE",
      saldoFisico: 0,
      quantidadeJaPedida: 0,
      medianaLinhaVenda: 1,
      parametrosMotor: TENANT_CARREIRO.parametrosMotor.motor,
      sinalGovernanca: "REDUZIR",
      margemRealizada: -1,
    });
    expect(r.necessidadeAntesGovernanca).toBeGreaterThan(0);
    expect(r.necessidadeLiquida).toBeGreaterThanOrEqual(1);
  });

  it("o fator isolado é monotônico e respeitado nos limites", () => {
    const p = TENANT_CARREIRO.parametrosMotor.motor.reducaoGovernanca;
    expect(calcularFatorReducaoPorMargem(0.5, 0.3, p)).toBe(1);
    expect(calcularFatorReducaoPorMargem(0.3, 0.3, p)).toBe(1);
    expect(calcularFatorReducaoPorMargem(0.24, 0.3, p)).toBeCloseTo(0.8, 5);
    expect(calcularFatorReducaoPorMargem(0, 0.3, p)).toBe(p.pisoFator);
    expect(calcularFatorReducaoPorMargem(-5, 0.3, p)).toBe(p.pisoFator);
    // margem acima de 100% é ruído de custo não lançado, não item saudável demais
    expect(calcularFatorReducaoPorMargem(5, 0.3, p)).toBe(1);
  });

  it("MANTER e ausência de sinal não alteram nada", () => {
    const base = {
      consumoDiario: 1,
      perfilGiro: "ALTO_GIRO" as const,
      saldoFisico: 0,
      quantidadeJaPedida: 0,
      parametrosMotor: TENANT_CARREIRO.parametrosMotor.motor,
    };
    expect(calcularNecessidadeItem({ ...base, sinalGovernanca: "MANTER" }).necessidadeLiquida).toBe(23);
    expect(calcularNecessidadeItem({ ...base, sinalGovernanca: null }).necessidadeLiquida).toBe(23);
  });

  it("governança não cria compra onde não havia demanda", () => {
    const r = calcularNecessidadeItem({
      consumoDiario: 0,
      perfilGiro: "SEM_HISTORICO_SUFICIENTE",
      saldoFisico: 0,
      quantidadeJaPedida: 0,
      parametrosMotor: TENANT_CARREIRO.parametrosMotor.motor,
      sinalGovernanca: "MANTER",
    });
    expect(r.necessidadeLiquida).toBe(0);
  });

  it("normaliza o vocabulário da Carreiro para o enum da plataforma", () => {
    expect(normalizarDecisaoCompraCarreiro("PAUSAR COMPRAS")).toBe("PAUSAR");
    expect(normalizarDecisaoCompraCarreiro("REDUZIR COMPRAS")).toBe("REDUZIR");
    expect(normalizarDecisaoCompraCarreiro("MANTER COMPRAS")).toBe("MANTER");
    // avisos não bloqueiam a compra
    expect(normalizarDecisaoCompraCarreiro("ATENCAO - ESTOQUE ACIMA DO LIMITE")).toBe("MANTER");
    expect(normalizarDecisaoCompraCarreiro(null)).toBeNull();
    expect(normalizarDecisaoCompraCarreiro("")).toBeNull();
  });
});

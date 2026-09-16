import { describe, it, expect } from "vitest";
import {
  classificarDivergencia,
  motivoValido,
  MOTIVOS_DIVERGENCIA,
  confirmarEntrada,
  janelaFechou,
  calcularPropostaCalibracao,
  aplicarProposta,
  LIMITES_CALIBRACAO_PADRAO,
  LinhaAprendizado,
} from "@core/aprendizado";

describe("Ciclo de aprendizado — base comum", () => {
  describe("divergência", () => {
    it("classifica comprador × modelo", () => {
      expect(classificarDivergencia(5, 5)).toBe("igual");
      expect(classificarDivergencia(8, 5)).toBe("comprador_maior");
      expect(classificarDivergencia(2, 5)).toBe("comprador_menor");
      expect(classificarDivergencia(0, 5)).toBe("so_modelo");
      expect(classificarDivergencia(3, null)).toBe("sem_sugestao");
    });

    it("valida motivos pela taxonomia", () => {
      expect(motivoValido("sem_verba")).toBe(true);
      expect(motivoValido("promocao_fornecedor")).toBe(true);
      expect(motivoValido("decisao_interna")).toBe(true);
      expect(motivoValido("qualquer")).toBe(false);

      const motivosComerciais = MOTIVOS_DIVERGENCIA.filter((m) => m.grupo === "comercial");
      expect(motivosComerciais.every((m) => !m.afetaCalibracao)).toBe(true);

      expect(MOTIVOS_DIVERGENCIA.filter((m) => m.afetaCalibracao).map((m) => m.id)).toEqual([
        "modelo_superestimou",
        "modelo_subestimou",
        "quantidade_errada",
        "item_obsoleto",
        "item_errado",
        "concordo_com_modelo",
      ]);
    });
  });

  describe("confirmação de entrada", () => {
    const fechada = true;
    it("aguardando enquanto a janela não fecha e nada entrou", () => {
      expect(confirmarEntrada(10, { qtdEntrada: 0, qtdTransferida: 0 }, false).status).toBe("aguardando");
    });
    it("nao_entrou quando a janela fechou e nada chegou (dado censurado)", () => {
      expect(confirmarEntrada(10, { qtdEntrada: 0, qtdTransferida: 0 }, fechada).status).toBe("nao_entrou");
    });
    it("confirmado dentro da tolerância de ±10%", () => {
      expect(confirmarEntrada(10, { qtdEntrada: 10, qtdTransferida: 0 }, fechada).status).toBe("confirmado");
      expect(confirmarEntrada(10, { qtdEntrada: 11, qtdTransferida: 0 }, fechada).status).toBe("confirmado");
      expect(confirmarEntrada(10, { qtdEntrada: 9, qtdTransferida: 0 }, fechada).status).toBe("confirmado");
    });
    it("excedente e parcial fora da tolerância", () => {
      expect(confirmarEntrada(10, { qtdEntrada: 20, qtdTransferida: 0 }, fechada).status).toBe("excedente");
      expect(confirmarEntrada(10, { qtdEntrada: 4, qtdTransferida: 0 }, fechada).status).toBe("parcial");
    });
    it("transferência quando nada foi comprado mas veio da loja irmã", () => {
      const r = confirmarEntrada(10, { qtdEntrada: 0, qtdTransferida: 6 }, fechada);
      expect(r.status).toBe("transferencia");
      expect(r.suprimentoReal).toBe(6);
    });
    it("compra + transferência somam no suprimento real", () => {
      const r = confirmarEntrada(10, { qtdEntrada: 6, qtdTransferida: 4 }, fechada);
      expect(r.status).toBe("confirmado");
      expect(r.suprimentoReal).toBe(10);
    });
    it("janela de 10 dias fecha no 10º dia", () => {
      const exp = new Date(2026, 8, 1);
      expect(janelaFechou(exp, new Date(2026, 8, 10), 10)).toBe(false);
      expect(janelaFechou(exp, new Date(2026, 8, 11), 10)).toBe(true);
    });
  });

  describe("calibração pelo desfecho real", () => {
    const linha = (s: Partial<LinhaAprendizado>): LinhaAprendizado => ({
      perfil: "ALTO_GIRO",
      consumoDiario: 1,
      horizonteDias: 20,
      margemAplicada: 0.25,
      fatorCalibracao: 1,
      suprimentoReal: 25,
      status: "confirmado",
      ...s,
    });
    const muitas = (n: number, s: Partial<LinhaAprendizado>) => Array.from({ length: n }, () => linha(s));

    it("amostra abaixo do mínimo não propõe nada", () => {
      const p = calcularPropostaCalibracao(muitas(50, {}));
      expect(p[0].aplicavel).toBe(false);
      expect(p[0].margemProposta).toBeNull();
      expect(p[0].motivo).toContain("amostra insuficiente");
    });

    it("dado censurado (nao_entrou) e aguardando ficam fora", () => {
      const p = calcularPropostaCalibracao([
        ...muitas(250, {}),
        ...muitas(100, { status: "nao_entrou", suprimentoReal: 0 }),
        ...muitas(50, { status: "aguardando", suprimentoReal: 0 }),
      ]);
      expect(p[0].amostra).toBe(250);
      expect(p[0].descartadasCensuradas).toBe(150);
    });

    it("corte do piso: onde m0×H < 1 a margem não aprende", () => {
      const p = calcularPropostaCalibracao([
        ...muitas(250, {}),
        ...muitas(300, { perfil: "BAIXO_GIRO_INTERMITENTE", consumoDiario: 0.02, horizonteDias: 7, margemAplicada: 0.8, suprimentoReal: 4 }),
      ]);
      const baixo = p.find((x) => x.perfil === "BAIXO_GIRO_INTERMITENTE")!;
      expect(baixo.descartadasPiso).toBe(300);
      expect(baixo.aplicavel).toBe(false);
      expect(baixo.motivo).toContain("decididas pelo piso");
    });

    it("alvo é a mediana do que chegou, limitado ao passo de ±50%", () => {
      // suprimento 40 com m0×H=20 => margem necessária 100%; vigente 25%.
      // Passo máximo: 25% × 1,5 = 37,5%.
      const p = calcularPropostaCalibracao(muitas(250, { suprimentoReal: 40 }));
      expect(p[0].q50).toBeCloseTo(1, 5);
      expect(p[0].margemProposta).toBeCloseTo(0.375, 4);
      expect(p[0].motivo).toContain("limitado");
    });

    it("quando a mediana cabe no passo, propõe a mediana", () => {
      // suprimento 26 => necessária 30%; vigente 25% (passo permite 12,5%..37,5%)
      const p = calcularPropostaCalibracao(muitas(250, { suprimentoReal: 26 }));
      expect(p[0].margemProposta).toBeCloseTo(0.3, 4);
      expect(p[0].motivo).toContain("mediana");
    });

    it("o fator vigente é descontado da margem necessária", () => {
      // com fator 0,9: base efetiva 18 => suprimento 25 exige +38,9%
      const p = calcularPropostaCalibracao(muitas(250, { fatorCalibracao: 0.9, suprimentoReal: 25 }));
      expect(p[0].q50).toBeCloseTo(25 / 18 - 1, 4);
    });

    it("cobertura atual mede quantos casos a sugestão vigente cobriu", () => {
      const p = calcularPropostaCalibracao([
        ...muitas(150, { suprimentoReal: 20 }), // 25 cobre
        ...muitas(100, { suprimentoReal: 30 }), // 25 não cobre
      ]);
      expect(p[0].coberturaAtual).toBeCloseTo(0.6, 5);
    });

    it("respeita teto absoluto e nunca propõe abaixo do mínimo", () => {
      const p = calcularPropostaCalibracao(muitas(250, { margemAplicada: 1.9, suprimentoReal: 200 }), {
        ...LIMITES_CALIBRACAO_PADRAO,
        margemMaxima: 2,
      });
      expect(p[0].margemProposta).toBe(2);
    });

    it("aplicarProposta muda só os perfis aplicáveis", () => {
      const vigentes = { ALTO_GIRO: 0.25, MEDIO_GIRO: 0.45, BAIXO_GIRO_INTERMITENTE: 0.8, SEM_HISTORICO_SUFICIENTE: 0 } as const;
      const proposta = calcularPropostaCalibracao([
        ...muitas(250, { suprimentoReal: 26 }),
        ...muitas(20, { perfil: "MEDIO_GIRO", horizonteDias: 15, margemAplicada: 0.45 }),
      ]);
      const novas = aplicarProposta(vigentes, proposta);
      expect(novas.ALTO_GIRO).toBeCloseTo(0.3, 4);
      expect(novas.MEDIO_GIRO).toBe(0.45);
      expect(novas.SEM_HISTORICO_SUFICIENTE).toBe(0);
    });
  });
});

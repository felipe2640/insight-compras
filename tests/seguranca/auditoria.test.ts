/**
 * Suíte de Testes Automatizados: Trilha Imutável de Auditoria de Pedidos e Tamper-Evident Chain
 * Requisitos: ORIGINAL_REQUEST R4, PROJECT.md Feature #24
 * 100% em Português do Brasil (pt-BR).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ServicoAuditoria,
  RepositorioAuditoriaEmMemoria,
  validarCadeiaAuditoria,
  calcularHashRegistro,
  AuditoriaPedido,
} from "@/lib/auditoria";
import { UsuarioAutenticado } from "@/lib/rbac";

describe("Auditoria Server-Side — Trilha Imutável, Sobrecompras e Tamper-Evident SHA-256", () => {
  let repositorio: RepositorioAuditoriaEmMemoria;
  let servico: ServicoAuditoria;

  const compradorCarlos: UsuarioAutenticado = {
    id: "usr-comp-01",
    nome: "Carlos Suspensão",
    email: "carlos@carreiro.com.br",
    role: "COMPRADOR",
    allowedSupplierIds: [501],
    tenantId: "carreiro",
  };

  const compradorAna: UsuarioAutenticado = {
    id: "usr-comp-02",
    nome: "Ana Freios",
    email: "ana@carreiro.com.br",
    role: "COMPRADOR",
    allowedSupplierIds: [502],
    tenantId: "carreiro",
  };

  beforeEach(() => {
    repositorio = new RepositorioAuditoriaEmMemoria();
    servico = new ServicoAuditoria(repositorio);
  });

  // ==========================================================================
  // 1. CLASSIFICAÇÃO DE DIVERGÊNCIAS E SOBRECOMPRAS
  // ==========================================================================
  describe("1. Classificação Matemática de Divergências e Sobrecompras", () => {
    it("deve classificar como CONFORME_SUGESTAO quando a quantidade digitada for igual à sugerida", async () => {
      const reg = await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1001,
        codigoSku: "AM-MON-001",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 10,
        quantidadeDigitada: 10,
        precoCusto: 150.0,
      });

      expect(reg.classificacaoDivergencia).toBe("CONFORME_SUGESTAO");
      expect(reg.tipoAcao).toBe("CRIACAO_PEDIDO");
      expect(reg.divergenciaQuantidade).toBe(0);
      expect(reg.divergenciaPercentual).toBe(0);
      expect(reg.impactoFinanceiroDivergencia).toBe(0);
    });

    it("deve classificar como SOBRECOMPRA e calcular impacto em R$ quando digitado > sugerido", async () => {
      // Sugerido = 4, Digitado = 10 (+6 un). Preço de custo = R$ 120,00
      const reg = await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1002,
        codigoSku: "AM-MON-002",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 4,
        quantidadeDigitada: 10,
        precoCusto: 120.0,
      });

      expect(reg.classificacaoDivergencia).toBe("SOBRECOMPRA");
      expect(reg.tipoAcao).toBe("SOBRECOMPRA_CONFIRMADA");
      expect(reg.divergenciaQuantidade).toBe(6);
      expect(reg.divergenciaPercentual).toBe(150); // ((10-4)/4)*100 = 150%
      expect(reg.impactoFinanceiroDivergencia).toBe(720.0); // 6 * 120 = 720
      expect(reg.justificativaOverride).toContain("Sobrecompra manual de +6 un");
    });

    it("deve classificar como SUBCOMPRA quando digitado < sugerido mas positivo", async () => {
      const reg = await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1003,
        codigoSku: "AM-MON-003",
        fornecedorId: 501,
        filialId: 2,
        quantidadeSugerida: 12,
        quantidadeDigitada: 6,
        precoCusto: 80.0,
      });

      expect(reg.classificacaoDivergencia).toBe("SUBCOMPRA");
      expect(reg.tipoAcao).toBe("AJUSTE_SUGESTAO");
      expect(reg.divergenciaQuantidade).toBe(-6);
      expect(reg.divergenciaPercentual).toBe(-50);
      expect(reg.impactoFinanceiroDivergencia).toBe(-480.0);
    });

    it("deve classificar como ZERAMENTO_MANUAL quando o comprador zera um item sugerido", async () => {
      const reg = await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1004,
        codigoSku: "AM-MON-004",
        fornecedorId: 501,
        filialId: 3,
        quantidadeSugerida: 8,
        quantidadeDigitada: 0,
        precoCusto: 50.0,
      });

      expect(reg.classificacaoDivergencia).toBe("ZERAMENTO_MANUAL");
      expect(reg.tipoAcao).toBe("AJUSTE_SUGESTAO");
      expect(reg.divergenciaQuantidade).toBe(-8);
      expect(reg.divergenciaPercentual).toBe(-100);
    });

    it("deve preservar a justificativa manual digitada pelo comprador", async () => {
      const reg = await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1005,
        codigoSku: "AM-MON-005",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 2,
        quantidadeDigitada: 10,
        precoCusto: 200.0,
        justificativaOverride: "Campanha promocional de amortecedores autorizada pela gerência",
      });

      expect(reg.justificativaOverride).toBe(
        "Campanha promocional de amortecedores autorizada pela gerência"
      );
    });
  });

  // ==========================================================================
  // 2. IMUTABILIDADE E ENCADEAMENTO CRIPTOGRÁFICO (TAMPER-EVIDENT LOG)
  // ==========================================================================
  describe("2. Imutabilidade e Cadeia de Integridade SHA-256", () => {
    it("deve congelar os objetos com Object.freeze no repositório para impedir mutações em runtime", async () => {
      const reg = await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1001,
        codigoSku: "AM-MON-001",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 6,
        quantidadeDigitada: 6,
        precoCusto: 100.0,
      });

      expect(Object.isFrozen(reg)).toBe(true);

      // Tentativa de mutação direta deve falhar em modo estrito
      expect(() => {
        // @ts-expect-error - Forçando mutação para teste de runtime
        reg.quantidadeDigitadaComprador = 999;
      }).toThrow();
    });

    it("o primeiro registro deve possuir hashAnterior 'GENESIS_HASH'", async () => {
      const primeiro = await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1001,
        codigoSku: "AM-MON-001",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 10,
        quantidadeDigitada: 10,
        precoCusto: 100.0,
      });

      expect(primeiro.hashRegistroAnterior).toBe("GENESIS_HASH");
      expect(primeiro.hashIntegridade).toHaveLength(64); // Hash SHA-256
    });

    it("registros subsequentes devem encadear no hash do registro anterior", async () => {
      const reg1 = await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1001,
        codigoSku: "AM-MON-001",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 5,
        quantidadeDigitada: 5,
        precoCusto: 100.0,
      });

      const reg2 = await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1002,
        codigoSku: "AM-MON-002",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 5,
        quantidadeDigitada: 8,
        precoCusto: 100.0,
      });

      expect(reg2.hashRegistroAnterior).toBe(reg1.hashIntegridade);

      const todos = await repositorio.obterTodos("carreiro");
      const validacao = validarCadeiaAuditoria(todos);
      expect(validacao.valida).toBe(true);
    });

    it("deve detectar adulteração de dados em qualquer registro da cadeia", async () => {
      await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1001,
        codigoSku: "AM-MON-001",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 5,
        quantidadeDigitada: 5,
        precoCusto: 100.0,
      });

      await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1002,
        codigoSku: "AM-MON-002",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 5,
        quantidadeDigitada: 10,
        precoCusto: 100.0,
      });

      const todos = await repositorio.obterTodos("carreiro");
      const registrosClonados: AuditoriaPedido[] = JSON.parse(JSON.stringify(todos));

      // Atacante tenta reduzir a quantidade digitada de 10 para 5 no registro intermediário
      const registroAdulterado: AuditoriaPedido = {
        ...registrosClonados[1],
        quantidadeDigitadaComprador: 5,
      };
      registrosClonados[1] = registroAdulterado;

      const validacao = validarCadeiaAuditoria(registrosClonados);
      expect(validacao.valida).toBe(false);
      expect(validacao.indiceInvalido).toBe(1);
      expect(validacao.motivo).toContain("Hash inválido");
    });

    it("deve detectar quebra de cadeia caso um registro seja removido ou substituído", async () => {
      const reg1 = await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1001,
        codigoSku: "AM-MON-001",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 5,
        quantidadeDigitada: 5,
        precoCusto: 100.0,
      });

      const reg2 = await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1002,
        codigoSku: "AM-MON-002",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 5,
        quantidadeDigitada: 5,
        precoCusto: 100.0,
      });

      const reg3 = await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1003,
        codigoSku: "AM-MON-003",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 5,
        quantidadeDigitada: 5,
        precoCusto: 100.0,
      });

      // Se remover o registro 2, reg3 não apontará para reg1
      const cadeiaSemReg2 = [reg1, reg3];
      const validacao = validarCadeiaAuditoria(cadeiaSemReg2);
      expect(validacao.valida).toBe(false);
      expect(validacao.indiceInvalido).toBe(1);
      expect(validacao.motivo).toContain("Quebra de cadeia");
    });
  });

  // ==========================================================================
  // 3. CONSULTAS FILTRADAS E KPIS GERENCIAIS
  // ==========================================================================
  describe("3. Consultas e Painel Gerencial de Auditoria", () => {
    beforeEach(async () => {
      // Carlos registra 2 pedidos (1 conforme e 1 sobrecompra)
      await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1001,
        codigoSku: "AM-MON-001",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 10,
        quantidadeDigitada: 10,
        precoCusto: 100.0,
      });

      await servico.registrarDecisao({
        usuario: compradorCarlos,
        produtoId: 1002,
        codigoSku: "AM-MON-002",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 5,
        quantidadeDigitada: 10, // +5 un
        precoCusto: 200.0, // Impacto R$ 1.000,00
      });

      // Ana registra 1 pedido (subcompra)
      await servico.registrarDecisao({
        usuario: compradorAna,
        produtoId: 2001,
        codigoSku: "DISCO-COFAP-01",
        fornecedorId: 502,
        filialId: 2,
        quantidadeSugerida: 10,
        quantidadeDigitada: 4, // -6 un
        precoCusto: 50.0,
      });
    });

    it("deve filtrar trilha de auditoria por comprador", async () => {
      const registrosCarlos = await servico.consultarTrilha({
        tenantId: "carreiro",
        compradorId: "usr-comp-01",
      });

      expect(registrosCarlos).toHaveLength(2);
      expect(registrosCarlos.every((r) => r.compradorId === "usr-comp-01")).toBe(true);

      const registrosAna = await servico.consultarTrilha({
        tenantId: "carreiro",
        compradorId: "usr-comp-02",
      });

      expect(registrosAna).toHaveLength(1);
      expect(registrosAna[0].codigoSku).toBe("DISCO-COFAP-01");
    });

    it("deve filtrar trilha apenas por sobrecompras", async () => {
      const sobrecompras = await servico.consultarTrilha({
        tenantId: "carreiro",
        apenasSobrecompras: true,
      });

      expect(sobrecompras).toHaveLength(1);
      expect(sobrecompras[0].classificacaoDivergencia).toBe("SOBRECOMPRA");
      expect(sobrecompras[0].divergenciaQuantidade).toBe(5);
    });

    it("deve calcular corretamente os KPIs gerenciais de auditoria", async () => {
      const kpis = await servico.calcularKpisGerenciais("carreiro");

      expect(kpis.totalRegistros).toBe(3);
      expect(kpis.totalConformes).toBe(1);
      expect(kpis.totalSobrecompras).toBe(1);
      expect(kpis.totalSubcompras).toBe(1);
      // 1 conforme em 3 registros = 33.33%
      expect(kpis.taxaAderenciaMotorPercentual).toBe(33.33);
      // Impacto da sobrecompra: +5 * 200 = R$ 1.000,00
      expect(kpis.impactoFinanceiroTotalSobrecompra).toBe(1000.0);
    });

    it("deve retornar KPIs neutros para tenant sem registros", async () => {
      const kpis = await servico.calcularKpisGerenciais("tenant-vazio");
      expect(kpis.totalRegistros).toBe(0);
      expect(kpis.taxaAderenciaMotorPercentual).toBe(100);
      expect(kpis.impactoFinanceiroTotalSobrecompra).toBe(0);
    });
  });
});

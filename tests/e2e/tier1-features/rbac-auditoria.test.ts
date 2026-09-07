/**
 * Tier 1: Cobertura de Features — RBAC, Carteira de Fornecedores, Auditoria & Cibersegurança
 * Requisitos: ORIGINAL_REQUEST R4 & PROJECT.md
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  UsuarioAutenticado,
  LinhaMatrizDecisaoE2E,
  gerarCatalogoSintetico,
} from "../harness/contexto-teste";
import {
  executarBuscaEFiltroEmMemoria,
  criarRegistroAuditoria,
} from "../harness/runner-opaque";

// Schema Zod para sanitização estrita de parâmetros de entrada contra injeção DAX/SQL
const SchemaConsultaInventario = z.object({
  filialId: z.number().int().positive(),
  queryBusca: z
    .string()
    .max(100)
    .regex(/^[^'";\-\-/*]*$/, "Caracteres de injeção DAX/SQL proibidos")
    .optional(),
  fornecedoresPermitidos: z.array(z.number().int().positive()).nonempty(),
});

describe("Tier 1 — Feature 5: RBAC, Carteira de Fornecedores, Auditoria & Cibersegurança", () => {
  const compradorSuspensao: UsuarioAutenticado = {
    id: "usr-comp-01",
    nome: "Carlos Comprador Suspensão",
    email: "carlos.compras@carreiro.com.br",
    role: "COMPRADOR",
    allowedSupplierIds: new Set([501]), // Apenas DISTRIBUIDORA MONROE BRASIL
    tenantId: "carreiro",
  };

  const gestorGeral: UsuarioAutenticado = {
    id: "usr-gest-01",
    nome: "Mariana Gestora Geral",
    email: "mariana.diretoria@carreiro.com.br",
    role: "GESTOR",
    allowedSupplierIds: new Set([501, 502, 503, 504, 505]),
    tenantId: "carreiro",
  };

  const catalogoMock = gerarCatalogoSintetico(100);

  // T1.5.1: Filtragem estrita por carteira de fornecedor (RBAC)
  it("T1.5.1 — deve restringir a visão do comprador estritamente aos fornecedores da sua carteira", () => {
    const resultado = executarBuscaEFiltroEmMemoria(catalogoMock, {}, compradorSuspensao);

    expect(resultado.itensFiltrados.length).toBeGreaterThan(0);
    // 100% dos itens devem pertencer ao fornecedor 501
    const todosDoFornecedorAutorizado = resultado.itensFiltrados.every(
      (item) => item.fornecedorId === 501
    );
    expect(todosDoFornecedorAutorizado).toBe(true);

    // Não deve conter nenhum item do fornecedor 502 (Cofap) ou 504 (Bosch)
    const contemOutrosFornecedores = resultado.itensFiltrados.some(
      (item) => item.fornecedorId !== 501
    );
    expect(contemOutrosFornecedores).toBe(false);
  });

  // T1.5.2: Visão consolidada para Gestor
  it("T1.5.2 — deve conceder visão consolidada da rede inteira e de todos os fornecedores para o perfil Gestor", () => {
    const resultado = executarBuscaEFiltroEmMemoria(catalogoMock, {}, gestorGeral);

    // Gestor vê itens de múltiplos fornecedores
    const fornecedoresDistintos = new Set(resultado.itensFiltrados.map((i) => i.fornecedorId));
    expect(fornecedoresDistintos.size).toBeGreaterThan(1);
    expect(resultado.totalLinhas).toBe(100);
  });

  // T1.5.3: Trilha imutável de auditoria de pedidos
  it("T1.5.3 — deve gerar registro imutável de auditoria contendo autor, timestamp e dados da ordem", () => {
    const registro = criarRegistroAuditoria(
      compradorSuspensao,
      "AM-MON-001",
      1001,
      1,
      6,
      6,
      "CRIACAO_PEDIDO"
    );

    expect(registro.id).toContain("AUD-");
    expect(registro.usuarioId).toBe("usr-comp-01");
    expect(registro.usuarioNome).toBe("Carlos Comprador Suspensão");
    expect(registro.tenantId).toBe("carreiro");
    expect(registro.codigoSku).toBe("AM-MON-001");
    expect(registro.quantidadeSugeridaSistema).toBe(6);
    expect(registro.quantidadeDefinidaComprador).toBe(6);
    expect(registro.divergenciaJustificativa).toBeNull();
  });

  // T1.5.4: Registro de divergência e sobrecompra manual na auditoria
  it("T1.5.4 — deve registrar divergência e classificar como sobrecompra quando o comprador excede a sugestão", () => {
    // Sistema sugeriu 4, mas o comprador forçou 10 (+6 un)
    const registroSobrecompra = criarRegistroAuditoria(
      compradorSuspensao,
      "AM-MON-001",
      1001,
      1,
      4,
      10
    );

    expect(registroSobrecompra.tipoAcao).toBe("SOBRECOMPRA_CONFIRMADA");
    expect(registroSobrecompra.divergenciaJustificativa).toContain("Sobrecompra manual de +6 un");
    expect(registroSobrecompra.divergenciaJustificativa).toContain("sugestão do motor (4 un)");
  });

  // T1.5.5: Sanitização de entrada contra injeção DAX/SQL via Zod
  it("T1.5.5 — deve sanitizar entradas de busca e barrar injeção maliciosa de DAX e SQL com schema Zod", () => {
    // Tentativa de injeção DAX/SQL
    const inputMalicioso = {
      filialId: 1,
      queryBusca: "AMORTECEDOR'; DROP TABLE PRODUTOS; --",
      fornecedoresPermitidos: [501],
    };

    const resultadoValidacao = SchemaConsultaInventario.safeParse(inputMalicioso);
    expect(resultadoValidacao.success).toBe(false);
    if (!resultadoValidacao.success) {
      expect(resultadoValidacao.error.issues[0].message).toContain("Caracteres de injeção DAX/SQL proibidos");
    }

    // Input legítimo
    const inputLegitimo = {
      filialId: 1,
      queryBusca: "AMORTECEDOR COROLLA",
      fornecedoresPermitidos: [501],
    };
    const validacaoLegitima = SchemaConsultaInventario.safeParse(inputLegitimo);
    expect(validacaoLegitima.success).toBe(true);
  });
});

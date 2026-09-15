/**
 * Suíte de Testes Automatizados: Controle de Acesso RBAC Server-Side e Carteiras de Comprador
 * Requisitos: ORIGINAL_REQUEST R4, PROJECT.md Feature #23
 * 100% em Português do Brasil (pt-BR).
 */

import { describe, it, expect } from "vitest";
import {
  UsuarioAutenticado,
  ErroAcessoNegado,
  ErroViolacaoTenant,
  ErroNaoAutenticado,
  normalizarSetFornecedores,
  verificarAcessoFornecedor,
  aplicarGuardrailInventarioServerSide,
  validarItensPedidoServerSide,
  validarTenantContexto,
  garantirAcessoGerencial,
} from "@/lib/rbac";

describe("RBAC Server-Side — Carteira de Compradores e Controle de Acesso", () => {
  const compradorMonroe: UsuarioAutenticado = {
    id: "usr-comp-01",
    nome: "Carlos Suspensão",
    email: "carlos@carreiro.com.br",
    role: "COMPRADOR",
    allowedSupplierIds: [501], // Apenas Monroe
    tenantId: "carreiro",
  };

  const compradorMultiFornecedor: UsuarioAutenticado = {
    id: "usr-comp-02",
    nome: "Ana Freios",
    email: "ana@carreiro.com.br",
    role: "COMPRADOR",
    allowedSupplierIds: new Set([501, 502]), // Monroe e Cofap
    tenantId: "carreiro",
  };

  const compradorSemFornecedores: UsuarioAutenticado = {
    id: "usr-comp-03",
    nome: "João Estagiário",
    email: "joao@carreiro.com.br",
    role: "COMPRADOR",
    allowedSupplierIds: [],
    tenantId: "carreiro",
  };

  const gestorGeral: UsuarioAutenticado = {
    id: "usr-gest-01",
    nome: "Mariana Diretoria",
    email: "mariana@carreiro.com.br",
    role: "GESTOR",
    allowedSupplierIds: null, // Acesso universal
    tenantId: "carreiro",
  };

  const adminSistema: UsuarioAutenticado = {
    id: "usr-adm-01",
    nome: "Admin TI",
    email: "admin@carreiro.com.br",
    role: "ADMIN",
    allowedSupplierIds: null,
    tenantId: "carreiro",
  };

  // ==========================================================================
  // 1. NORMALIZAÇÃO E CONSULTA O(1) DE FORNECEDORES
  // ==========================================================================
  describe("1. Normalização de Carteira e Consulta O(1)", () => {
    it("deve converter array em Set para consultas em tempo constante", () => {
      const set = normalizarSetFornecedores([501, 502, 503]);
      expect(set).toBeInstanceOf(Set);
      expect(set?.has(501)).toBe(true);
      expect(set?.has(999)).toBe(false);
    });

    it("deve retornar o mesmo Set caso já seja uma instância de Set", () => {
      const original = new Set([501]);
      const normalizado = normalizarSetFornecedores(original);
      expect(normalizado).toBe(original);
    });

    it("deve retornar null se a entrada for nula ou indefinida", () => {
      expect(normalizarSetFornecedores(null)).toBeNull();
      expect(normalizarSetFornecedores(undefined)).toBeNull();
    });

    it("verificarAcessoFornecedor deve autorizar comprador para fornecedor de sua carteira", () => {
      expect(verificarAcessoFornecedor(compradorMonroe, 501)).toBe(true);
      expect(verificarAcessoFornecedor(compradorMonroe, 502)).toBe(false);
      expect(verificarAcessoFornecedor(compradorMultiFornecedor, 502)).toBe(true);
    });

    it("verificarAcessoFornecedor deve autorizar Gestor e Admin para qualquer fornecedor", () => {
      expect(verificarAcessoFornecedor(gestorGeral, 501)).toBe(true);
      expect(verificarAcessoFornecedor(gestorGeral, 999)).toBe(true);
      expect(verificarAcessoFornecedor(adminSistema, 888)).toBe(true);
    });
  });

  // ==========================================================================
  // 2. GUARDRAIL DE CARGA DE INVENTÁRIO (SERVER-SIDE)
  // ==========================================================================
  describe("2. Guardrail de Inventário Server-Side", () => {
    it("deve forçar a carteira homologada do comprador quando nenhum filtro for especificado", () => {
      const filtro = aplicarGuardrailInventarioServerSide(compradorMonroe, {});
      expect(filtro.fornecedoresPermitidos).toEqual([501]);
    });

    it("deve aceitar quando o comprador solicita um subconjunto válido de sua carteira", () => {
      const filtro = aplicarGuardrailInventarioServerSide(compradorMultiFornecedor, {
        fornecedoresPermitidos: [501],
      });
      expect(filtro.fornecedoresPermitidos).toEqual([501]);
    });

    it("deve rejeitar com 403 Forbidden quando o comprador tenta burlar solicitando fornecedor fora de sua carteira", () => {
      expect(() => {
        aplicarGuardrailInventarioServerSide(compradorMonroe, {
          fornecedoresPermitidos: [502], // Cofap fora de alçada
        });
      }).toThrow(ErroAcessoNegado);

      try {
        aplicarGuardrailInventarioServerSide(compradorMonroe, {
          fornecedoresPermitidos: [501, 502],
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ErroAcessoNegado);
        const erro = err as ErroAcessoNegado;
        expect(erro.statusCode).toBe(403);
        expect(erro.codigoErro).toBe("FORBIDDEN");
        expect(erro.fornecedorSolicitado).toBe(502);
      }
    });

    it("deve rejeitar com 403 se o comprador não possuir nenhum fornecedor cadastrado", () => {
      expect(() => {
        aplicarGuardrailInventarioServerSide(compradorSemFornecedores, {});
      }).toThrow(ErroAcessoNegado);
    });

    it("deve permitir que o Gestor consulte sem filtro (null) ou filtre qualquer fornecedor", () => {
      const filtroUniversal = aplicarGuardrailInventarioServerSide(gestorGeral, {});
      expect(filtroUniversal.fornecedoresPermitidos).toBeNull();

      const filtroEspecifico = aplicarGuardrailInventarioServerSide(gestorGeral, {
        fornecedoresPermitidos: [504],
      });
      expect(filtroEspecifico.fornecedoresPermitidos).toEqual([504]);
    });
  });

  // ==========================================================================
  // 3. VALIDAÇÃO DE ITENS DE PEDIDO SERVER-SIDE
  // ==========================================================================
  describe("3. Validação de Itens de Pedido Server-Side", () => {
    it("deve aprovar itens quando todos pertencerem à carteira do comprador", () => {
      const itensValidos = [
        { fornecedorId: 501, codigoSku: "AM-MON-001" },
        { fornecedorId: 501, codigoSku: "AM-MON-002" },
      ];

      expect(() => {
        validarItensPedidoServerSide(compradorMonroe, itensValidos);
      }).not.toThrow();
    });

    it("deve barrar com 403 se qualquer item pertencer a fornecedor fora da carteira", () => {
      const itensComInvasao = [
        { fornecedorId: 501, codigoSku: "AM-MON-001" },
        { fornecedorId: 504, codigoSku: "VELA-BOSCH-01" }, // Fora de alçada
      ];

      expect(() => {
        validarItensPedidoServerSide(compradorMonroe, itensComInvasao);
      }).toThrow(ErroAcessoNegado);

      try {
        validarItensPedidoServerSide(compradorMonroe, itensComInvasao);
      } catch (err) {
        const erro = err as ErroAcessoNegado;
        expect(erro.statusCode).toBe(403);
        expect(erro.message).toContain("VELA-BOSCH-01");
        expect(erro.message).toContain("504");
      }
    });

    it("deve permitir que Gestor crie pedidos com itens de múltiplos fornecedores", () => {
      const itensMultiplos = [
        { fornecedorId: 501, codigoSku: "AM-MON-001" },
        { fornecedorId: 504, codigoSku: "VELA-BOSCH-01" },
      ];

      expect(() => {
        validarItensPedidoServerSide(gestorGeral, itensMultiplos);
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // 4. ISOLAMENTO MULTI-TENANT E GUARDA GERENCIAL
  // ==========================================================================
  describe("4. Isolamento Multi-Tenant e Guarda Gerencial", () => {
    it("validarTenantContexto deve permitir acesso quando o tenant confere", () => {
      expect(() => {
        validarTenantContexto(compradorMonroe, "carreiro");
      }).not.toThrow();
    });

    it("validarTenantContexto deve lançar ErroViolacaoTenant (403) quando houver divergência", () => {
      expect(() => {
        validarTenantContexto(compradorMonroe, "outro-cliente");
      }).toThrow(ErroViolacaoTenant);

      try {
        validarTenantContexto(compradorMonroe, "outro-cliente");
      } catch (err) {
        const erro = err as ErroViolacaoTenant;
        expect(erro.statusCode).toBe(403);
        expect(erro.codigoErro).toBe("TENANT_MISMATCH");
      }
    });

    it("garantirAcessoGerencial deve bloquear compradores com 403 Forbidden", () => {
      expect(() => {
        garantirAcessoGerencial(compradorMonroe);
      }).toThrow(ErroAcessoNegado);
    });

    it("garantirAcessoGerencial deve autorizar Gestores e Administradores", () => {
      expect(() => {
        garantirAcessoGerencial(gestorGeral);
      }).not.toThrow();

      expect(() => {
        garantirAcessoGerencial(adminSistema);
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // 6. HIERARQUIA DE CLASSES DE ERRO DE SEGURANÇA
  // ==========================================================================
  describe("6. Classes de Erro Padronizadas", () => {
    it("ErroNaoAutenticado deve possuir status 401 e código UNAUTHORIZED", () => {
      const err = new ErroNaoAutenticado();
      expect(err.statusCode).toBe(401);
      expect(err.codigoErro).toBe("UNAUTHORIZED");
      expect(err.name).toBe("ErroNaoAutenticado");
    });

    it("ErroAcessoNegado deve possuir status 403 e código FORBIDDEN", () => {
      const err = new ErroAcessoNegado("Sem permissão", 502, [501]);
      expect(err.statusCode).toBe(403);
      expect(err.codigoErro).toBe("FORBIDDEN");
      expect(err.fornecedorSolicitado).toBe(502);
      expect(err.fornecedoresPermitidos).toEqual([501]);
    });
  });
});

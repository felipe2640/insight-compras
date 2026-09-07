/**
 * Desafio Adversarial de Penetração — Injeção DAX/SQL e Escalação de Privilégios RBAC
 * Marco M4: Cibersegurança, RBAC Multi-Tenant e Sanitização Estrita
 * Camada: tests/seguranca/desafio-dax-rbac.test.ts
 * 100% em Português do Brasil (pt-BR).
 *
 * Agente: challenger_m4_1 (critic / specialist)
 * Requisitos: ORIGINAL_REQUEST.md (R4), PROJECT.md (Features #23 e #25)
 *
 * Bateria de Testes de Ataque Agressivo:
 * 1. Injeção DAX Avançada com Case-Mixing (EvAlUaTe, CaLcUlAtE, etc.)
 * 2. Comentários Embutidos e Caracteres de Quebra (--coment, //coment, /*teste*\/, \n, \r\n, \0)
 * 3. Aspas Desbalanceadas, Tautologias DAX Complexas e Operadores Lógicos (&&, ||, IN)
 * 4. Blindagem do Construtor de Consultas DAX e Escape de Literais
 * 5. Manipulação de Payload e Bypass de Tipos no Perímetro Zod
 * 6. Defesa contra Prototype Pollution (__proto__, constructor)
 * 7. Escalação de Privilégios RBAC e Tentativas de Violação de Carteira Server-Side
 */

import { describe, it, expect } from "vitest";
import {
  SchemaFornecedorId,
  SchemaFornecedoresPermitidos,
  SchemaFilialId,
  SchemaSecaoId,
  SchemaCodigoSku,
  SchemaNomeFilial,
  SchemaDataFiltro,
  SchemaTermoBusca,
  SchemaRequisicaoComprasApi,
  SchemaRequisicaoDetalhesItemApi,
  SchemaItemPedidoCriacao,
  SchemaPayloadPedido,
  SchemaRequisicaoPedidoCompraApi,
  sanitizarListaIdsParaDax,
  escaparLiteralTextoDax,
} from "@/lib/seguranca";
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

describe("Desafio Adversarial M4: Injeção DAX/SQL e Escalação de Privilégios RBAC", () => {
  // ==========================================================================
  // SUÍTE 1: INJEÇÃO DAX AVANÇADA COM CASE-MIXING
  // ==========================================================================
  describe("1. Bateria de Injeção DAX com Case-Mixing e Evasão de Filtro", () => {
    const PAYLOADS_CASE_MIXING = [
      { comando: "EVALUATE", payload: "EvAlUaTe 'PRODUTOS'" },
      { comando: "CALCULATE", payload: "501) || CaLcUlAtE(1=1)" },
      { comando: "CALCULATETABLE", payload: "cAlCuLaTeTaBlE(PRODUTOS)" },
      { comando: "DEFINE VAR", payload: "dEfInE vAr X = 1 rEtUrN X" },
      { comando: "FILTER", payload: "fIlTeR('PRODUTOS', 1=1)" },
      { comando: "ALL", payload: "aLl('PRODUTOS')" },
      { comando: "ALLEXCEPT", payload: "aLlExCePt(PRODUTOS, 'PRODUTOS'[ID])" },
      { comando: "ALLNOBLANKROW", payload: "aLlNoBlAnKrOw('PRODUTOS')" },
      { comando: "REMOVEFILTERS", payload: "rEmOvEfIlTeRs('PRODUTOS'[FORN])" },
      { comando: "KEEPFILTERS", payload: "kEePfIlTeRs('NOTAS'[TIPO] = 1)" },
      { comando: "USERNAME", payload: "uSeRnAmE()" },
      { comando: "USERPRINCIPALNAME", payload: "uSeRpRiNcIpAlNaMe()" },
      { comando: "CROSSJOIN", payload: "cRoSsJoIn(ALL(A), ALL(B))" },
      { comando: "SUMMARIZECOLUMNS", payload: "sUmMaRiZeCoLuMnS('PRODUTOS'[NOME])" },
      { comando: "SELECTCOLUMNS", payload: "sElEcTcOlUmNs(PRODUTOS, 'A', 1)" },
      { comando: "ADDCOLUMNS", payload: "aDdCoLuMnS(PRODUTOS, 'B', 2)" },
      { comando: "ERROR", payload: "eRrOr('Injeção Forçada')" },
    ];

    PAYLOADS_CASE_MIXING.forEach(({ comando, payload }) => {
      it(`deve bloquear case-mixing de [${comando}] em Termo de Busca`, () => {
        const resultado = SchemaTermoBusca.safeParse(payload);
        expect(resultado.success).toBe(false);
      });

      it(`deve bloquear case-mixing de [${comando}] em Código SKU`, () => {
        const resultado = SchemaCodigoSku.safeParse(payload);
        expect(resultado.success).toBe(false);
      });

      it(`deve bloquear case-mixing de [${comando}] em Nome de Filial`, () => {
        const resultado = SchemaNomeFilial.safeParse(payload);
        expect(resultado.success).toBe(false);
      });

      it(`deve bloquear case-mixing de [${comando}] em Justificativa de Divergência de Pedido`, () => {
        const resultado = SchemaRequisicaoPedidoCompraApi.safeParse({
          produtoId: 100,
          codigoSku: "AM-MON-001",
          filialId: 1,
          fornecedorId: 501,
          quantidadeSugeridaSistema: 10,
          quantidadeDefinidaComprador: 20,
          justificativaDivergencia: `Ajuste manual ${payload}`,
        });
        expect(resultado.success).toBe(false);
      });
    });
  });

  // ==========================================================================
  // SUÍTE 2: COMENTÁRIOS EMBUTIDOS, QUEBRAS DE LINHA E CARACTERES NULOS
  // ==========================================================================
  describe("2. Bateria de Comentários Embutidos, Quebras de Linha e Nulos", () => {
    const ATAQUES_COMENTARIOS_E_QUEBRAS = [
      { nome: "Comentário de linha SQL/DAX com traço-traço e espaço", payload: "-- coment" },
      { nome: "Comentário de bypass pós traço", payload: "-- bypass rls" },
      { nome: "Comentário C++ / DAX barra-barra", payload: "//coment" },
      { nome: "Comentário barra-barra no meio de instrução", payload: "AM-01 // bypass" },
      { nome: "Comentário de bloco clássico /* */", payload: "/*teste*/" },
      { nome: "Comentário de bloco contendo quebra de linha", payload: "/*\ncomentario\n*/" },
      { nome: "Comentário de bloco interpolado em SKU", payload: "AM/*injeção*/01" },
      { nome: "Quebra de linha CRLF injetando comando", payload: "AM-01\r\nEVALUATE PRODUTOS" },
      { nome: "Quebra de linha LF isolada em SKU", payload: "AM-01\n002" },
      { nome: "Caractere Nulo (Null Byte) em SKU", payload: "AM-01\0INJECTION" },
      { nome: "Caractere Nulo Unicode em SKU", payload: "AM-01\u0000MALICIOUS" },
    ];

    ATAQUES_COMENTARIOS_E_QUEBRAS.forEach(({ nome, payload }) => {
      it(`deve rejeitar ataque de comentário/quebra [${nome}] em Código SKU`, () => {
        expect(SchemaCodigoSku.safeParse(payload).success).toBe(false);
      });

      it(`deve rejeitar ataque de comentário/quebra [${nome}] em Termo de Busca`, () => {
        expect(SchemaTermoBusca.safeParse(payload).success).toBe(false);
      });
    });

    it("deve rejeitar comentário de linha traço-traço colado em Termo de Busca", () => {
      expect(SchemaTermoBusca.safeParse("--coment").success).toBe(false);
    });

    it("deve rejeitar quebra de linha e injeção de comandos DAX em Nome de Filial", () => {
      expect(SchemaNomeFilial.safeParse("Loja 1\nEVALUATE").success).toBe(false);
      expect(SchemaNomeFilial.safeParse("Loja 1\r\nCALCULATE").success).toBe(false);
      expect(SchemaNomeFilial.safeParse("Loja 1;\r\nDROP TABLE").success).toBe(false);
      expect(SchemaNomeFilial.safeParse("Loja 1/*coment*/").success).toBe(false);
      expect(SchemaNomeFilial.safeParse("Loja 1//coment").success).toBe(false);
      expect(SchemaNomeFilial.safeParse("Loja 1\" OR 1=1").success).toBe(false);
    });

    it("deve rejeitar quebra de linha ou comentários em SchemaDataFiltro", () => {
      expect(SchemaDataFiltro.safeParse("2026-09-06\n").success).toBe(false);
      expect(SchemaDataFiltro.safeParse("2026-09-06--").success).toBe(false);
      expect(SchemaDataFiltro.safeParse("2026-09-06/*coment*/").success).toBe(false);
    });
  });

  // ==========================================================================
  // SUÍTE 3: ASPAS DESBALANCEADAS, TAUTOLOGIAS E OPERADORES LÓGICOS DAX (&&, ||, IN)
  // ==========================================================================
  describe("3. Bateria de Aspas Desbalanceadas, Tautologias DAX e Operadores Lógicos", () => {
    const ATAQUES_TAUTOLOGIAS_E_OPERADORES = [
      { nome: "Aspas duplas desbalanceada única", payload: '"' },
      { nome: "Três aspas duplas consecutivas", payload: '"""' },
      { nome: "Aspas duplas com tautologia clássica", payload: '" OR 1=1 --' },
      { nome: "Tautologia DAX com CALCULATE e parênteses desbalanceados", payload: '") || CALCULATE(1=1) || ("' },
      { nome: "Tautologia SQL com aspas simples", payload: "' OR '1'='1" },
      { nome: "Tautologia DAX com função TRUE()", payload: '" || TRUE() || "' },
      { nome: "Tautologia DAX com função FALSE()", payload: '") && FALSE() || ("' },
      { nome: "Operador lógico DAX pipe duplo ||", payload: "501 || 1=1" },
      { nome: "Operador lógico DAX e-comercial duplo &&", payload: "501 && 1=1" },
      { nome: "Operador DAX IN com bypass de filtro", payload: '") || \'PRODUTOS\'[ACODFORNECEDOR] IN { 501, 502 } || ("' },
      { nome: "Operador DAX IN com comentário stacked", payload: "IN { 501 } -- bypass" },
      { nome: "Operador DAX IN com comentário de bloco", payload: "IN { 501 } /* bypass */" },
      { nome: "Operador DAX IN com aspas duplas", payload: '" IN { 501 }' },
      { nome: "Operador DAX IN com tautologia", payload: "IN (501, 502) || 1=1" },
      { nome: "Operador DAX IN com aspas simples", payload: "' IN { '501' }" },
    ];

    ATAQUES_TAUTOLOGIAS_E_OPERADORES.forEach(({ nome, payload }) => {
      it(`deve bloquear tautologia/operador [${nome}] em Termo de Busca`, () => {
        expect(SchemaTermoBusca.safeParse(payload).success).toBe(false);
      });

      it(`deve bloquear tautologia/operador [${nome}] em Código SKU`, () => {
        expect(SchemaCodigoSku.safeParse(payload).success).toBe(false);
      });
    });

    it("deve rejeitar operador IN quando injetado como FornecedorId", () => {
      expect(SchemaFornecedorId.safeParse("IN { 501 }").success).toBe(false);
      expect(SchemaFornecedorId.safeParse("501 IN { 501, 502 }").success).toBe(false);
    });

    it("deve rejeitar operador IN quando injetado em lista de FornecedoresPermitidos", () => {
      expect(SchemaFornecedoresPermitidos.safeParse(["IN { 501 }"]).success).toBe(false);
      expect(SchemaFornecedoresPermitidos.safeParse([501, "IN", 502]).success).toBe(false);
    });

    it("deve rejeitar payload de API contendo injeção com operador IN", () => {
      const payloadInjetado = {
        fornecedoresPermitidos: ["501 IN { 501, 502 }"] as unknown as number[],
        secaoId: 10,
      };
      expect(SchemaRequisicaoComprasApi.safeParse(payloadInjetado).success).toBe(false);
    });
  });

  // ==========================================================================
  // SUÍTE 4: BLINDAGEM DO CONSTRUTOR DE CONSULTAS DAX E ESCAPE DE LITERAIS
  // ==========================================================================
  describe("4. Construtor de Consultas DAX e Neutralização de Literais", () => {
    it("sanitizarListaIdsParaDax deve neutralizar arrays contendo strings de injeção", () => {
      const entradaMaliciosa = [
        "501) || 1=1",
        "IN { 501, 502 }",
        "--coment",
        "/*teste*/",
        501,
      ] as unknown as number[];

      // Deve aceitar apenas o número legítimo 501
      const resultado = sanitizarListaIdsParaDax(entradaMaliciosa);
      expect(resultado).toBe("{ 501 }");
    });

    it("sanitizarListaIdsParaDax deve retornar '{ -1 }' se todos os itens forem maliciosos ou vazios", () => {
      const entradaPuroAtaque = [
        "EVALUATE PRODUTOS",
        "CALCULATE(1=1)",
        NaN,
        -501,
        0,
        null,
      ] as unknown as number[];

      expect(sanitizarListaIdsParaDax(entradaPuroAtaque)).toBe("{ -1 }");
      expect(sanitizarListaIdsParaDax([])).toBe("{ -1 }");
      expect(sanitizarListaIdsParaDax(null)).toBe("{ -1 }");
      expect(sanitizarListaIdsParaDax(undefined)).toBe("{ -1 }");
    });

    it("escaparLiteralTextoDax deve neutralizar quebras de linha e caracteres nulos", () => {
      const textoSujo = "Linha1\nLinha2\r\nLinha3\0Fim";
      const escapado = escaparLiteralTextoDax(textoSujo);

      expect(escapado).not.toContain("\n");
      expect(escapado).not.toContain("\r");
      expect(escapado).not.toContain("\0");
      expect(escapado).toBe('"Linha1Linha2Linha3Fim"');
    });

    it("escaparLiteralTextoDax deve neutralizar aspas duplas desbalanceadas duplicando-as", () => {
      expect(escaparLiteralTextoDax('AM"01')).toBe('"AM""01"');
      expect(escaparLiteralTextoDax('") || CALCULATE(1=1) || ("')).toBe('""") || CALCULATE(1=1) || ("""');
    });
  });

  // ==========================================================================
  // SUÍTE 5: MANIPULAÇÃO DE PAYLOAD E BYPASS DE TIPOS NO PERÍMETRO ZOD
  // ==========================================================================
  describe("5. Manipulação de Payload e Bypass de Tipos Numéricos", () => {
    it("deve rejeitar strings contendo números (sem coerção permissiva)", () => {
      expect(SchemaFornecedorId.safeParse("501").success).toBe(false);
      expect(SchemaFilialId.safeParse("1").success).toBe(false);
      expect(SchemaSecaoId.safeParse("10").success).toBe(false);
    });

    it("deve rejeitar floats, números negativos e zero para IDs de entidade", () => {
      expect(SchemaFornecedorId.safeParse(501.42).success).toBe(false);
      expect(SchemaFornecedorId.safeParse(-501).success).toBe(false);
      expect(SchemaFornecedorId.safeParse(0).success).toBe(false);

      expect(SchemaFilialId.safeParse(1.5).success).toBe(false);
      expect(SchemaFilialId.safeParse(-1).success).toBe(false);
      expect(SchemaFilialId.safeParse(0).success).toBe(false);
    });

    it("deve rejeitar valores não numéricos primitivos (booleanos, null, objetos)", () => {
      expect(SchemaFornecedorId.safeParse(true).success).toBe(false);
      expect(SchemaFornecedorId.safeParse(false).success).toBe(false);
      expect(SchemaFornecedorId.safeParse(null).success).toBe(false);
      expect(SchemaFornecedorId.safeParse({ id: 501 }).success).toBe(false);
      expect(SchemaFornecedorId.safeParse([501]).success).toBe(false);
    });

    it("deve rejeitar arrays vazios em listas de fornecedores permitidos (teto mínimo 1)", () => {
      const resultado = SchemaFornecedoresPermitidos.safeParse([]);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.errors[0].message).toContain("não pode ser vazia");
      }
    });

    it("deve rejeitar arrays aninhados em lista de fornecedores", () => {
      expect(SchemaFornecedoresPermitidos.safeParse([[501]] as unknown as number[]).success).toBe(false);
    });

    it("deve rejeitar pedido com array de itens vazio", () => {
      const pedidoVazio = {
        tenantId: "carreiro",
        itens: [],
      };
      const resultado = SchemaPayloadPedido.safeParse(pedidoVazio);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.errors[0].message).toContain("pelo menos um item");
      }
    });
  });

  // ==========================================================================
  // SUÍTE 6: DEFESA CONTRA PROTOTYPE POLLUTION (__proto__, constructor)
  // ==========================================================================
  describe("6. Defesa contra Prototype Pollution e Injeção de Propriedades", () => {
    const compradorBase: UsuarioAutenticado = {
      id: "usr-comp-proto",
      nome: "Carlos Hacker",
      email: "carlos@carreiro.com.br",
      role: "COMPRADOR",
      allowedSupplierIds: [501], // Apenas Monroe
      tenantId: "carreiro",
    };

    it("não deve permitir escalação de alçada injetando role GESTOR via __proto__", () => {
      const payloadPoluido = JSON.parse(
        '{"id": "usr-comp-proto", "nome": "Carlos", "email": "c@c.com", "role": "COMPRADOR", "allowedSupplierIds": [501], "tenantId": "carreiro", "__proto__": {"role": "GESTOR"}}'
      );

      expect(payloadPoluido.role).toBe("COMPRADOR");
      expect(verificarAcessoFornecedor(payloadPoluido, 502)).toBe(false);

      expect(() => {
        aplicarGuardrailInventarioServerSide(payloadPoluido, {
          fornecedoresPermitidos: [502],
        });
      }).toThrow(ErroAcessoNegado);
    });

    it("não deve permitir bypass de carteira injetando allowedSupplierIds irrestrito no prototype", () => {
      const compradorComProto = Object.create({ allowedSupplierIds: null, role: "ADMIN" });
      compradorComProto.id = "usr-01";
      compradorComProto.nome = "Comprador";
      compradorComProto.email = "comp@carreiro.com.br";
      compradorComProto.role = "COMPRADOR";
      compradorComProto.allowedSupplierIds = [501];
      compradorComProto.tenantId = "carreiro";

      // Acesso ao fornecedor 502 (Cofap) deve ser estritamente falso
      expect(verificarAcessoFornecedor(compradorComProto, 502)).toBe(false);

      // Tentativa de carregar 502 deve lançar ErroAcessoNegado (403)
      expect(() => {
        aplicarGuardrailInventarioServerSide(compradorComProto, {
          fornecedoresPermitidos: [502],
        });
      }).toThrow(ErroAcessoNegado);
    });

    it("não deve permitir bypass de Set.has substituindo o protótipo do Set", () => {
      const fornecedoresSet = new Set([501]);
      const comprador: UsuarioAutenticado = {
        ...compradorBase,
        allowedSupplierIds: fornecedoresSet,
      };

      expect(verificarAcessoFornecedor(comprador, 502)).toBe(false);
      expect(verificarAcessoFornecedor(comprador, 501)).toBe(true);
    });
  });

  // ==========================================================================
  // SUÍTE 7: ESCALAÇÃO DE PRIVILÉGIOS RBAC E VIOLAÇÃO DE CARTEIRA SERVER-SIDE
  // ==========================================================================
  describe("7. Tentativas de Escalação de Privilégios e Violação de Carteira Server-Side", () => {
    const compradorRestrito: UsuarioAutenticado = {
      id: "usr-comp-restrito",
      nome: "Marcos Comprador Monroe",
      email: "marcos@carreiro.com.br",
      role: "COMPRADOR",
      allowedSupplierIds: [501], // Homologado exclusivamente para Monroe (501)
      tenantId: "carreiro",
    };

    const compradorSemFornecedor: UsuarioAutenticado = {
      id: "usr-comp-bloqueado",
      nome: "Novato Sem Alçada",
      email: "novato@carreiro.com.br",
      role: "COMPRADOR",
      allowedSupplierIds: [],
      tenantId: "carreiro",
    };

    it("deve bloquear comprador tentando carregar fornecedor de outro colega (403 Forbidden)", () => {
      try {
        aplicarGuardrailInventarioServerSide(compradorRestrito, {
          fornecedoresPermitidos: [502], // Fornecedor Cofap não autorizado
        });
        expect.fail("Deveria ter lançado ErroAcessoNegado");
      } catch (err) {
        expect(err).toBeInstanceOf(ErroAcessoNegado);
        const erro = err as ErroAcessoNegado;
        expect(erro.statusCode).toBe(403);
        expect(erro.codigoErro).toBe("FORBIDDEN");
        expect(erro.fornecedorSolicitado).toBe(502);
      }
    });

    it("deve bloquear comprador tentando solicitar mix de fornecedor próprio com terceiro", () => {
      expect(() => {
        aplicarGuardrailInventarioServerSide(compradorRestrito, {
          fornecedoresPermitidos: [501, 504], // 501 autorizado, 504 (Bosch) proibido
        });
      }).toThrow(ErroAcessoNegado);
    });

    it("deve forçar automaticamente a carteira homologada se o comprador enviar array vazio de fornecedores", () => {
      // Quando envia array vazio, o guardrail ignora o bypass e restringe estritamente aos fornecedores homologados
      const filtro = aplicarGuardrailInventarioServerSide(compradorRestrito, {
        fornecedoresPermitidos: [],
      });
      expect(filtro.fornecedoresPermitidos).toEqual([501]);
    });

    it("deve lançar 403 se o comprador não tiver nenhum fornecedor associado à sua carteira", () => {
      expect(() => {
        aplicarGuardrailInventarioServerSide(compradorSemFornecedor, {});
      }).toThrow(ErroAcessoNegado);
    });

    it("deve bloquear comprador tentando salvar pedido contendo SKU de outro fornecedor (403)", () => {
      const itensPedidoAtaque = [
        { fornecedorId: 501, codigoSku: "AM-MON-001" }, // Autorizado
        { fornecedorId: 502, codigoSku: "PA-COF-002" }, // Proibido (Cofap)
      ];

      try {
        validarItensPedidoServerSide(compradorRestrito, itensPedidoAtaque);
        expect.fail("Deveria ter bloqueado pedido com item de fornecedor fora de alçada");
      } catch (err) {
        expect(err).toBeInstanceOf(ErroAcessoNegado);
        const erro = err as ErroAcessoNegado;
        expect(erro.statusCode).toBe(403);
        expect(erro.message).toContain("PA-COF-002");
        expect(erro.message).toContain("502");
      }
    });

    it("deve bloquear comprador tentando acessar rotas ou painéis gerenciais (403 Forbidden)", () => {
      expect(() => {
        garantirAcessoGerencial(compradorRestrito);
      }).toThrow(ErroAcessoNegado);

      try {
        garantirAcessoGerencial(compradorRestrito);
      } catch (err) {
        const erro = err as ErroAcessoNegado;
        expect(erro.statusCode).toBe(403);
        expect(erro.codigoErro).toBe("FORBIDDEN");
      }
    });

    it("deve bloquear comprador tentando operar em tenant divergente (403 Tenant Mismatch)", () => {
      expect(() => {
        validarTenantContexto(compradorRestrito, "outro-tenant");
      }).toThrow(ErroViolacaoTenant);

      try {
        validarTenantContexto(compradorRestrito, "empresa-invasora");
      } catch (err) {
        const erro = err as ErroViolacaoTenant;
        expect(erro.statusCode).toBe(403);
        expect(erro.codigoErro).toBe("TENANT_MISMATCH");
      }
    });
  });
});

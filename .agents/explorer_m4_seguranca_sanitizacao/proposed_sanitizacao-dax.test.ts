/**
 * Bateria de Testes de Penetração e Sanitização de Segurança contra Injeção DAX/SQL
 * Proposta de Implementação para: tests/seguranca/sanitizacao-dax.test.ts
 * 100% em Português do Brasil (pt-BR).
 *
 * Valida a eficácia dos Esquemas Zod e Formatadores contra:
 * 1. Payloads maliciosos de Injeção DAX (EVALUATE, DEFINE, VAR, CALCULATE, ALL, REMOVEFILTERS, etc.)
 * 2. Injeções de comentários (-- e //) e delimitadores de strings (aspas duplas e simples)
 * 3. Injeções clássicas de SQL (' OR 1=1, UNION, DROP TABLE)
 * 4. Tentativas de XSS e Path Traversal em campos de texto
 * 5. Type Juggling, overflows e adulteração de tipos numéricos
 * 6. Validação estrita de datas gregorianas e nomes de filial
 * 7. Blindagem do construtor de consultas DAX (formatarListaNumericaDax)
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
  SchemaRequisicaoPedidoCompraApi,
  sanitizarListaIdsParaDax,
  escaparLiteralTextoDax,
} from "./proposed_esquemas-seguranca";

describe("Bateria de Penetração e Sanitização: Injeção DAX, SQL e Segurança de Parâmetros", () => {
  // ==========================================================================
  // 1. INJEÇÃO DE OPERADORES E PALAVRAS-CHAVE DAX
  // ==========================================================================
  describe("1. Rejeição Estrita de Payloads de Injeção DAX", () => {
    const PAYLOADS_DAX_MALICIOSOS = [
      { nome: "Multi-statement EVALUATE", payload: "EVALUATE 'PRODUTOS'" },
      { nome: "Declaração DEFINE VAR", payload: "DEFINE VAR X = 1 RETURN X" },
      { nome: "Bypass de filtro com CALCULATE e ALL", payload: "501) || CALCULATE(1=1, ALL('PRODUTOS'))" },
      { nome: "Quebra de RLS com REMOVEFILTERS", payload: "501) || CALCULATE(1=1, REMOVEFILTERS('PRODUTOS'[ACODFORNECEDOR]))" },
      { nome: "Manipulação de contexto com CALCULATETABLE", payload: "CALCULATETABLE(PRODUTOS, ALL('CADEMP'))" },
      { nome: "Extração com SUMMARIZECOLUMNS", payload: "SUMMARIZECOLUMNS('PRODUTOS'[ACODPRODUTO])" },
      { nome: "Exfiltração de usuário com USERNAME()", payload: "USERNAME()" },
      { nome: "Exfiltração de Service Principal com USERPRINCIPALNAME()", payload: "USERPRINCIPALNAME()" },
      { nome: "Ataque de DoS por explosão cartesiana CROSSJOIN", payload: "CROSSJOIN(ALL('NOTAS'), ALL('PRODUTOS'))" },
      { nome: "Disparo intencional de erro com ERROR()", payload: 'ERROR("Dados Confidenciais")' },
    ];

    PAYLOADS_DAX_MALICIOSOS.forEach(({ nome, payload }) => {
      it(`deve rejeitar payload DAX em Termo de Busca: [${nome}]`, () => {
        const resultado = SchemaTermoBusca.safeParse(payload);
        expect(resultado.success).toBe(false);
      });

      it(`deve rejeitar payload DAX em Código SKU: [${nome}]`, () => {
        const resultado = SchemaCodigoSku.safeParse(payload);
        expect(resultado.success).toBe(false);
      });

      it(`deve rejeitar payload DAX em Nome de Filial: [${nome}]`, () => {
        const resultado = SchemaNomeFilial.safeParse(payload);
        expect(resultado.success).toBe(false);
      });
    });
  });

  // ==========================================================================
  // 2. DELIMITADORES, ASPAS E COMENTÁRIOS DE DAX / SQL
  // ==========================================================================
  describe("2. Rejeição de Aspas, Delimitadores e Comentários (-- // /*)", () => {
    const PAYLOADS_DELIMITADORES = [
      { nome: "Aspas duplas com tautologia", payload: '" OR 1=1 --' },
      { nome: "Quebra de string com pipe lógico", payload: 'AM-01" || 1=1 || "' },
      { nome: "Comentário de linha SQL/DAX (--)", payload: "501 -- bypass filtro" },
      { nome: "Comentário de linha C++/DAX (//)", payload: "501 // bypass filtro" },
      { nome: "Comentário de bloco (/* */)", payload: "501 /* comentario */" },
      { nome: "Ponto e vírgula stacked query", payload: "501; EVALUATE PRODUTOS" },
      { nome: "Aspas simples clássica SQL", payload: "AMORTECEDOR' OR '1'='1" },
      { nome: "Barra invertida de escape", payload: "PROD\\\" OR 1=1" },
      { nome: "Crase e interpolação", payload: "` OR 1=1`" },
    ];

    PAYLOADS_DELIMITADORES.forEach(({ nome, payload }) => {
      it(`deve rejeitar delimitador malicioso no Termo de Busca: [${nome}]`, () => {
        const resultado = SchemaTermoBusca.safeParse(payload);
        expect(resultado.success).toBe(false);
      });

      it(`deve rejeitar delimitador malicioso no Código SKU: [${nome}]`, () => {
        const resultado = SchemaCodigoSku.safeParse(payload);
        expect(resultado.success).toBe(false);
      });
    });
  });

  // ==========================================================================
  // 3. INJEÇÃO CLÁSSICA DE SQL
  // ==========================================================================
  describe("3. Rejeição de Injeção SQL Tradicional", () => {
    const PAYLOADS_SQL = [
      "' OR '1'='1",
      "'; DROP TABLE PRODUTOS; --",
      "1 UNION SELECT * FROM USUARIOS --",
      "admin'--",
      "' OR 1=1#",
      "1' WAITFOR DELAY '0:0:5'--",
    ];

    PAYLOADS_SQL.forEach((payload) => {
      it(`deve barrar injeção SQL [${payload}] em busca e SKU`, () => {
        expect(SchemaTermoBusca.safeParse(payload).success).toBe(false);
        expect(SchemaCodigoSku.safeParse(payload).success).toBe(false);
      });
    });
  });

  // ==========================================================================
  // 4. XSS E PATH TRAVERSAL
  // ==========================================================================
  describe("4. Rejeição de XSS e Path Traversal", () => {
    const PAYLOADS_XSS_TRAVERSAL = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert(1)>",
      "javascript:void(0)",
      "../../../../etc/passwd",
      "..\\..\\windows\\win.ini",
      "file:///etc/shadow",
    ];

    PAYLOADS_XSS_TRAVERSAL.forEach((payload) => {
      it(`deve barrar payload malicioso [${payload}]`, () => {
        expect(SchemaTermoBusca.safeParse(payload).success).toBe(false);
        expect(SchemaCodigoSku.safeParse(payload).success).toBe(false);
        expect(SchemaNomeFilial.safeParse(payload).success).toBe(false);
      });
    });
  });

  // ==========================================================================
  // 5. TYPE JUGGLING, INTEGRIDADE NUMÉRICA E LIMITES
  // ==========================================================================
  describe("5. Type Juggling e Limites Numéricos Estritos", () => {
    it("deve rejeitar ID de fornecedor negativo", () => {
      expect(SchemaFornecedorId.safeParse(-1).success).toBe(false);
      expect(SchemaFornecedorId.safeParse(-501).success).toBe(false);
    });

    it("deve rejeitar ID de fornecedor fracionário / float", () => {
      expect(SchemaFornecedorId.safeParse(501.5).success).toBe(false);
      expect(SchemaFornecedorId.safeParse(10.0001).success).toBe(false);
    });

    it("deve rejeitar NaN e Infinity", () => {
      expect(SchemaFornecedorId.safeParse(NaN).success).toBe(false);
      expect(SchemaFornecedorId.safeParse(Infinity).success).toBe(false);
      expect(SchemaFornecedorId.safeParse(-Infinity).success).toBe(false);
    });

    it("deve rejeitar números que excedem o limite de 32 bits (overflow)", () => {
      expect(SchemaFornecedorId.safeParse(3_000_000_000).success).toBe(false);
      expect(SchemaFornecedorId.safeParse(999999999999999).success).toBe(false);
    });

    it("deve rejeitar fornecedor passado como string numérica sem coerção", () => {
      expect(SchemaFornecedorId.safeParse("501").success).toBe(false);
      expect(SchemaFornecedorId.safeParse("501 OR 1=1").success).toBe(false);
    });

    it("deve rejeitar lista com mais de 1000 fornecedores (proteção contra DoS)", () => {
      const listaGigante = Array.from({ length: 1001 }, (_, i) => i + 1);
      expect(SchemaFornecedoresPermitidos.safeParse(listaGigante).success).toBe(false);
    });

    it("deve rejeitar lista de fornecedores com IDs duplicados", () => {
      expect(SchemaFornecedoresPermitidos.safeParse([501, 502, 501]).success).toBe(false);
    });

    it("deve validar com sucesso IDs numéricos válidos e listas legítimas", () => {
      expect(SchemaFornecedorId.safeParse(501).success).toBe(true);
      expect(SchemaFornecedoresPermitidos.safeParse([501, 502, 503]).success).toBe(true);
      expect(SchemaFilialId.safeParse(1).success).toBe(true);
      expect(SchemaSecaoId.safeParse(10).success).toBe(true);
    });
  });

  // ==========================================================================
  // 6. VALIDAÇÃO ESTRITA DE DATAS GREGORIANAS (ISO 8601)
  // ==========================================================================
  describe("6. Validação Estrita de Datas (Anti-Injeção e Validade Calendárica)", () => {
    it("deve aceitar datas válidas no formato ISO YYYY-MM-DD dentro da faixa operacional", () => {
      expect(SchemaDataFiltro.safeParse("2026-09-06").success).toBe(true);
      expect(SchemaDataFiltro.safeParse("2024-02-29").success).toBe(true); // Ano bissexto válido
    });

    it("deve rejeitar tentativas de injeção em campo de data", () => {
      expect(SchemaDataFiltro.safeParse("2026-09-06' OR 1=1 --").success).toBe(false);
      expect(SchemaDataFiltro.safeParse('2026-09-06" || TRUE()').success).toBe(false);
    });

    it("deve rejeitar datas inexistentes no calendário gregoriano", () => {
      expect(SchemaDataFiltro.safeParse("2026-02-31").success).toBe(false); // 31 de fevereiro
      expect(SchemaDataFiltro.safeParse("2026-04-31").success).toBe(false); // 31 de abril
      expect(SchemaDataFiltro.safeParse("2023-02-29").success).toBe(false); // Não bissexto
      expect(SchemaDataFiltro.safeParse("2026-13-01").success).toBe(false); // Mês 13
    });

    it("deve rejeitar datas fora da faixa permitida (2020 a 2050)", () => {
      expect(SchemaDataFiltro.safeParse("1970-01-01").success).toBe(false);
      expect(SchemaDataFiltro.safeParse("2099-12-31").success).toBe(false);
    });

    it("deve rejeitar formatos não ISO (DD/MM/YYYY)", () => {
      expect(SchemaDataFiltro.safeParse("06/09/2026").success).toBe(false);
    });
  });

  // ==========================================================================
  // 7. VALIDAÇÃO DE CÓDIGOS SKU E NOMES DE FILIAL
  // ==========================================================================
  describe("7. Validação de Códigos SKU e Filiais", () => {
    it("deve aceitar códigos SKU autênticos de autopeças", () => {
      expect(SchemaCodigoSku.safeParse("AM-MON-001").success).toBe(true);
      expect(SchemaCodigoSku.safeParse("BD.9012").success).toBe(true);
      expect(SchemaCodigoSku.safeParse("PF_440").success).toBe(true);
      expect(SchemaCodigoSku.safeParse("COFAP123").success).toBe(true);
    });

    it("deve aceitar nomes de filial com acentuação brasileira legítima", () => {
      expect(SchemaNomeFilial.safeParse("Loja 1 - Trairi").success).toBe(true);
      expect(SchemaNomeFilial.safeParse("Loja 2 - Paraipaba").success).toBe(true);
      expect(SchemaNomeFilial.safeParse("Filial São Luís do Maranhão").success).toBe(true);
    });

    it("deve rejeitar códigos SKU com espaços ou caracteres maliciosos", () => {
      expect(SchemaCodigoSku.safeParse("AM MON 001").success).toBe(false);
      expect(SchemaCodigoSku.safeParse("AM'MON").success).toBe(false);
      expect(SchemaCodigoSku.safeParse("SKU;DROP").success).toBe(false);
    });
  });

  // ==========================================================================
  // 8. ESQUEMAS INTEGRADOS DE ROTAS DE API
  // ==========================================================================
  describe("8. Validação de Payloads de API (/api/compras e /api/pedidos)", () => {
    it("deve validar payload legítimo de carga de inventário", () => {
      const payloadValido = {
        fornecedoresPermitidos: [501, 502],
        secaoId: 10,
        filialId: 1,
        apenasComEstoqueOuVenda: true,
        termoBusca: "Amortecedor Monroe",
        dataCorte: "2026-09-06",
      };

      const resultado = SchemaRequisicaoComprasApi.safeParse(payloadValido);
      expect(resultado.success).toBe(true);
    });

    it("deve permitir fornecedoresPermitidos nulo apenas para perfis Gestor/Admin", () => {
      const payloadGestor = {
        fornecedoresPermitidos: null,
        secaoId: 10,
      };

      const resultado = SchemaRequisicaoComprasApi.safeParse(payloadGestor);
      expect(resultado.success).toBe(true);
    });

    it("deve barrar injeção maliciosa camuflada em campo de justificativa do pedido", () => {
      const payloadAtaque = {
        produtoId: 1001,
        codigoSku: "AM-MON-001",
        filialId: 1,
        fornecedorId: 501,
        quantidadeSugeridaSistema: 4,
        quantidadeDefinidaComprador: 10,
        justificativaDivergencia: 'Ajuste manual EVALUATE ALL("USUARIOS")',
      };

      const resultado = SchemaRequisicaoPedidoCompraApi.safeParse(payloadAtaque);
      expect(resultado.success).toBe(false);
    });
  });

  // ==========================================================================
  // 9. BLINDAGEM DOS FORMATADORES ESTRUTURADOS DE CONSULTA DAX
  // ==========================================================================
  describe("9. Teste de Blindagem dos Construtores de Consulta DAX", () => {
    it("sanitizarListaIdsParaDax deve retornar '{ -1 }' para arrays vazios, nulos ou indefinidos", () => {
      expect(sanitizarListaIdsParaDax([])).toBe("{ -1 }");
      expect(sanitizarListaIdsParaDax(null)).toBe("{ -1 }");
      expect(sanitizarListaIdsParaDax(undefined)).toBe("{ -1 }");
    });

    it("sanitizarListaIdsParaDax deve descartar floats, negativos e NaNs com segurança", () => {
      const entradaSujos = [501, -2, 502.99, NaN, 503];
      // Apenas 501 e 503 devem ser aceitos (inteiros positivos)
      expect(sanitizarListaIdsParaDax(entradaSujos as unknown as number[])).toBe("{ 501, 503 }");
    });

    it("sanitizarListaIdsParaDax deve formatar corretamente lista de números válidos", () => {
      expect(sanitizarListaIdsParaDax([501, 502, 504])).toBe("{ 501, 502, 504 }");
    });

    it("escaparLiteralTextoDax deve neutralizar aspas duplas duplicando-as no padrão DAX", () => {
      expect(escaparLiteralTextoDax('AM-01" OR 1=1')).toBe('"AM-01"" OR 1=1"');
      expect(escaparLiteralTextoDax("Texto Normal")).toBe('"Texto Normal"');
      expect(escaparLiteralTextoDax("")).toBe('""');
    });

    it("escaparLiteralTextoDax deve remover caracteres nulos e de controle", () => {
      const textoComNulo = "SKU\u0000123";
      expect(escaparLiteralTextoDax(textoComNulo)).toBe('"SKU123"');
    });
  });
});

/**
 * Suíte de Testes Adversariais: Integridade Criptográfica de Auditoria e Resolução Edge Middleware
 * Desafio M4: Challenger m4_2 (Empirical Challenger)
 * Requisitos: ORIGINAL_REQUEST R4/R5, PROJECT.md Features #24, #26, #27
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
import {
  sanitizarParametroTenant,
  extrairSubdominioDeHost,
  processarRequisicaoTenant,
} from "@/lib/middleware-tenant";
import { middleware, NextRequestLike } from "@/middleware";
import { CABECALHOS_SEGURANCA_HTTP } from "@/lib/seguranca/headers";
import { TENANT_CARREIRO, TENANT_PADRAO } from "@config/tenants";

describe("Desafio Adversarial Gate M4 — Criptografia de Auditoria & Edge Middleware", () => {
  // ==========================================================================
  // PARTE 1: DESAFIO DE INTEGRIDADE CRIPTOGRÁFICA DA TRILHA DE AUDITORIA
  // ==========================================================================
  describe("1. Desafio de Integridade Criptográfica da Trilha de Auditoria (Tamper-Evident Chain)", () => {
    let repositorio: RepositorioAuditoriaEmMemoria;
    let servico: ServicoAuditoria;

    const compradorPrincipal: UsuarioAutenticado = {
      id: "usr-comp-01",
      nome: "Carlos Suspensão",
      email: "carlos@carreiro.com.br",
      role: "COMPRADOR",
      allowedSupplierIds: [501, 502],
      tenantId: "carreiro",
    };

    const compradorSecundario: UsuarioAutenticado = {
      id: "usr-comp-02",
      nome: "Ana Freios",
      email: "ana@carreiro.com.br",
      role: "COMPRADOR",
      allowedSupplierIds: [503],
      tenantId: "carreiro",
    };

    beforeEach(() => {
      repositorio = new RepositorioAuditoriaEmMemoria();
      servico = new ServicoAuditoria(repositorio);
    });

    /**
     * Função auxiliar para gerar uma cadeia determinística e íntegra de N pedidos
     */
    async function criarCadeiaAuditoriaValida(qtdRegistros = 10): Promise<readonly AuditoriaPedido[]> {
      for (let i = 0; i < qtdRegistros; i++) {
        const usuario = i % 2 === 0 ? compradorPrincipal : compradorSecundario;
        await servico.registrarDecisao({
          usuario,
          produtoId: 1000 + i,
          codigoSku: `SKU-AUTO-${(1000 + i).toString()}`,
          descricaoProduto: `Peça de Autopeça Linha ${(i + 1).toString()}`,
          fornecedorId: Array.isArray(usuario.allowedSupplierIds)
            ? usuario.allowedSupplierIds[0]
            : 501,
          nomeFornecedor: "Fornecedor Homologado",
          filialId: (i % 5) + 1,
          filialNome: `Loja ${(i % 5) + 1}`,
          quantidadeSugerida: 10 + i,
          quantidadeDigitada: 10 + i + (i % 3 === 0 ? 5 : 0), // Alterna sobrecompras e conformes
          precoCusto: 50.0 + i * 10,
          justificativaOverride: i % 3 === 0 ? "Ajuste de estoque de segurança" : null,
        });
      }
      return repositorio.obterTodos("carreiro");
    }

    it("deve criar uma cadeia íntegra de 10 registros com hash gênesis e encadeamento SHA-256 perfeito", async () => {
      const cadeia = await criarCadeiaAuditoriaValida(10);

      expect(cadeia).toHaveLength(10);
      expect(cadeia[0].hashRegistroAnterior).toBe("GENESIS_HASH");

      // Verifica encadeamento consecutivo de todos os nós
      for (let i = 1; i < cadeia.length; i++) {
        expect(cadeia[i].hashRegistroAnterior).toBe(cadeia[i - 1].hashIntegridade);
        expect(cadeia[i].hashIntegridade).toMatch(/^[a-f0-9]{64}$/); // Hash SHA-256 válido
      }

      // Validação estrita do oráculo criptográfico
      const resultado = validarCadeiaAuditoria(cadeia);
      expect(resultado.valida).toBe(true);
      expect(resultado.indiceInvalido).toBeUndefined();
      expect(resultado.motivo).toBeUndefined();
    });

    it("Ataque 1: deve detectar 100% de adulteração maliciosa em quantidade digitada e apontar o índice exato", async () => {
      const cadeiaOriginal = await criarCadeiaAuditoriaValida(10);
      const cloneCadeia: AuditoriaPedido[] = JSON.parse(JSON.stringify(cadeiaOriginal));

      const indiceAlvo = 4;
      const valorOriginal = cloneCadeia[indiceAlvo].quantidadeDigitadaComprador;

      // Atacante altera a quantidade digitada para omitir uma sobrecompra
      cloneCadeia[indiceAlvo] = {
        ...cloneCadeia[indiceAlvo],
        quantidadeDigitadaComprador: valorOriginal - 5,
      };

      const resultado = validarCadeiaAuditoria(cloneCadeia);
      expect(resultado.valida).toBe(false);
      expect(resultado.indiceInvalido).toBe(indiceAlvo);
      expect(resultado.motivo).toContain("Hash inválido");
      expect(resultado.motivo).toContain(cloneCadeia[indiceAlvo].id);
    });

    it("Ataque 2: deve detectar 100% de adulteração maliciosa em timestamp e apontar o índice exato", async () => {
      const cadeiaOriginal = await criarCadeiaAuditoriaValida(10);
      const cloneCadeia: AuditoriaPedido[] = JSON.parse(JSON.stringify(cadeiaOriginal));

      const indiceAlvo = 2;

      // Atacante retroage o timestamp para forjar ordem de compra passada
      cloneCadeia[indiceAlvo] = {
        ...cloneCadeia[indiceAlvo],
        timestamp: "2020-01-01T00:00:00.000Z",
      };

      const resultado = validarCadeiaAuditoria(cloneCadeia);
      expect(resultado.valida).toBe(false);
      expect(resultado.indiceInvalido).toBe(indiceAlvo);
      expect(resultado.motivo).toContain("Hash inválido");
    });

    it("Ataque 3: deve detectar 100% de adulteração maliciosa em SKU e apontar o índice exato", async () => {
      const cadeiaOriginal = await criarCadeiaAuditoriaValida(10);
      const cloneCadeia: AuditoriaPedido[] = JSON.parse(JSON.stringify(cadeiaOriginal));

      const indiceAlvo = 7;

      // Atacante troca o SKU auditado por outra peça
      cloneCadeia[indiceAlvo] = {
        ...cloneCadeia[indiceAlvo],
        codigoSku: "SKU-HACKEADO-999",
      };

      const resultado = validarCadeiaAuditoria(cloneCadeia);
      expect(resultado.valida).toBe(false);
      expect(resultado.indiceInvalido).toBe(indiceAlvo);
      expect(resultado.motivo).toContain("Hash inválido");
    });

    it("Ataque 4: deve detectar 100% de adulteração em divergência calculada ou quantidade sugerida", async () => {
      const cadeiaOriginal = await criarCadeiaAuditoriaValida(8);
      const cloneCadeia: AuditoriaPedido[] = JSON.parse(JSON.stringify(cadeiaOriginal));

      const indiceAlvo = 3;

      // Atacante tenta mascarar a divergência de quantidade
      cloneCadeia[indiceAlvo] = {
        ...cloneCadeia[indiceAlvo],
        divergenciaQuantidade: 0,
      };

      const resultado = validarCadeiaAuditoria(cloneCadeia);
      expect(resultado.valida).toBe(false);
      expect(resultado.indiceInvalido).toBe(indiceAlvo);
      expect(resultado.motivo).toContain("Hash inválido");
    });

    it("Ataque 5: deve detectar remoção maliciosa de registro intermediário e apontar a quebra de cadeia", async () => {
      const cadeiaOriginal = await criarCadeiaAuditoriaValida(10);
      const cloneCadeia: AuditoriaPedido[] = JSON.parse(JSON.stringify(cadeiaOriginal));

      // Atacante remove o registro no índice 5
      const registroRemovido = cloneCadeia.splice(5, 1)[0];
      expect(registroRemovido).toBeDefined();

      // Agora a cadeia tem 9 registros; o antigo índice 6 passou a ser o índice 5
      const resultado = validarCadeiaAuditoria(cloneCadeia);
      expect(resultado.valida).toBe(false);
      expect(resultado.indiceInvalido).toBe(5);
      expect(resultado.motivo).toContain("Quebra de cadeia");
    });

    it("Ataque 6: deve detectar reordenação maliciosa de registros na cadeia", async () => {
      const cadeiaOriginal = await criarCadeiaAuditoriaValida(6);
      const cloneCadeia: AuditoriaPedido[] = JSON.parse(JSON.stringify(cadeiaOriginal));

      // Atacante inverte os registros 2 e 3
      const temp = cloneCadeia[2];
      cloneCadeia[2] = cloneCadeia[3];
      cloneCadeia[3] = temp;

      const resultado = validarCadeiaAuditoria(cloneCadeia);
      expect(resultado.valida).toBe(false);
      expect(resultado.indiceInvalido).toBe(2);
      expect(resultado.motivo).toContain("Quebra de cadeia");
    });

    it("Ataque 7: deve detectar corrupção do bloco gênesis (índice 0)", async () => {
      const cadeiaOriginal = await criarCadeiaAuditoriaValida(5);

      // Cenário 7.1: Atacante altera hashRegistroAnterior sem recalcular hash próprio
      const clone1: AuditoriaPedido[] = JSON.parse(JSON.stringify(cadeiaOriginal));
      clone1[0] = {
        ...clone1[0],
        hashRegistroAnterior: "FAKE_GENESIS_HASH",
      };
      const res1 = validarCadeiaAuditoria(clone1);
      expect(res1.valida).toBe(false);
      expect(res1.indiceInvalido).toBe(0);
      expect(res1.motivo).toContain("Hash inválido");

      // Cenário 7.2: Atacante forja um bloco inicial recalculando hash mas sem hash gênesis
      const clone2: AuditoriaPedido[] = JSON.parse(JSON.stringify(cadeiaOriginal));
      const { hashIntegridade: _, ...semHash } = clone2[0];
      const dadosComFakeGenesis = {
        ...semHash,
        hashRegistroAnterior: "FAKE_GENESIS_HASH",
      };
      const novoHash = calcularHashRegistro(dadosComFakeGenesis);
      clone2[0] = {
        ...dadosComFakeGenesis,
        hashIntegridade: novoHash,
      };

      const res2 = validarCadeiaAuditoria(clone2);
      expect(res2.valida).toBe(false);
      expect(res2.indiceInvalido).toBe(0);
      expect(res2.motivo).toBe("Registro inicial não possui o hash gênesis correto.");
    });

    it("Ataque 8: deve detectar ataque sofisticado de recálculo isolado do próprio hash sem propagação", async () => {
      const cadeiaOriginal = await criarCadeiaAuditoriaValida(6);
      const cloneCadeia: AuditoriaPedido[] = JSON.parse(JSON.stringify(cadeiaOriginal));

      const indiceAlvo = 2;

      // Atacante adultera a quantidade digitada no índice 2
      const registroAdulterado = {
        ...cloneCadeia[indiceAlvo],
        quantidadeDigitadaComprador: 9999,
      };

      // Atacante recalcula o hash próprio do registro 2 para tentar enganar a validação do nó
      const novoHashIntegridade = calcularHashRegistro(registroAdulterado);
      cloneCadeia[indiceAlvo] = {
        ...registroAdulterado,
        hashIntegridade: novoHashIntegridade,
      };

      // O registro 2 agora tem um hash SHA-256 matematicamente compatível com seu novo conteúdo.
      // Porém, o registro 3 ainda aponta para o hash ANTIGO do registro 2!
      const resultado = validarCadeiaAuditoria(cloneCadeia);
      expect(resultado.valida).toBe(false);
      expect(resultado.indiceInvalido).toBe(3); // Falha apontada no sucessor imediato
      expect(resultado.motivo).toContain("Quebra de cadeia");
      expect(resultado.motivo).toContain(`o registro ${cloneCadeia[3].id} não aponta para o hash do registro ${cloneCadeia[2].id}`);
    });

    it("Ataque 9: deve detectar inversão completa da cadeia de auditoria", async () => {
      const cadeiaOriginal = await criarCadeiaAuditoriaValida(5);
      const cadeiaInvertida = [...cadeiaOriginal].reverse();

      const resultado = validarCadeiaAuditoria(cadeiaInvertida);
      expect(resultado.valida).toBe(false);
      expect(resultado.indiceInvalido).toBe(0);
      expect(resultado.motivo).toBe("Registro inicial não possui o hash gênesis correto.");
    });
  });

  // ==========================================================================
  // PARTE 2: TESTES DE IMUTABILIDADE EM RUNTIME (OBJECT.FREEZE)
  // ==========================================================================
  describe("2. Testes de Imutabilidade em Runtime (Object.freeze no Repositório e Serviço)", () => {
    let repositorio: RepositorioAuditoriaEmMemoria;
    let servico: ServicoAuditoria;

    const comprador: UsuarioAutenticado = {
      id: "usr-comp-01",
      nome: "Carlos Suspensão",
      email: "carlos@carreiro.com.br",
      role: "COMPRADOR",
      allowedSupplierIds: [501],
      tenantId: "carreiro",
    };

    beforeEach(() => {
      repositorio = new RepositorioAuditoriaEmMemoria();
      servico = new ServicoAuditoria(repositorio);
    });

    it("deve congelar os objetos retornados por registrarDecisao com Object.freeze", async () => {
      const registro = await servico.registrarDecisao({
        usuario: comprador,
        produtoId: 1001,
        codigoSku: "AM-MON-001",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 10,
        quantidadeDigitada: 12,
        precoCusto: 150.0,
      });

      expect(Object.isFrozen(registro)).toBe(true);

      // Tentativa de alterar propriedade existente deve disparar TypeError
      expect(() => {
        // @ts-expect-error - Teste adversarial de mutação em runtime
        registro.quantidadeDigitadaComprador = 999;
      }).toThrow(TypeError);

      // Tentativa de alterar hashIntegridade
      expect(() => {
        // @ts-expect-error - Teste adversarial de mutação em runtime
        registro.hashIntegridade = "tampered";
      }).toThrow(TypeError);

      // Tentativa de alterar divergência
      expect(() => {
        // @ts-expect-error - Teste adversarial de mutação em runtime
        registro.divergenciaQuantidade = 0;
      }).toThrow(TypeError);

      // Tentativa de adicionar nova propriedade
      expect(() => {
        // @ts-expect-error - Teste adversarial de mutação em runtime
        registro.novaPropriedadeInjetada = "hacker";
      }).toThrow(TypeError);

      // Tentativa de deletar propriedade
      expect(() => {
        delete (registro as any).codigoSku;
      }).toThrow(TypeError);
    });

    it("deve garantir que consultas no repositório retornam registros congelados", async () => {
      await servico.registrarDecisao({
        usuario: comprador,
        produtoId: 1001,
        codigoSku: "AM-MON-001",
        fornecedorId: 501,
        filialId: 1,
        quantidadeSugerida: 5,
        quantidadeDigitada: 5,
        precoCusto: 100.0,
      });

      const registros = await repositorio.consultar({ tenantId: "carreiro" });
      expect(registros).toHaveLength(1);
      expect(Object.isFrozen(registros[0])).toBe(true);

      expect(() => {
        // @ts-expect-error - Teste adversarial de mutação em runtime
        registros[0].quantidadeDigitadaComprador = 0;
      }).toThrow(TypeError);
    });
  });

  // ==========================================================================
  // PARTE 3: DESAFIO DE SANITIZAÇÃO DE TENANT E EDGE MIDDLEWARE
  // ==========================================================================
  describe("3. Desafio Adversarial de Resolução de Tenant e Edge Middleware", () => {
    describe("3.1 Sanitização Rigorosa de Parâmetro (sanitizarParametroTenant)", () => {
      it("deve rejeitar e neutralizar tentativas de Path Traversal", () => {
        const ataques = [
          "../../",
          "..\\..\\",
          "/etc/passwd",
          "....//",
          "../carreiro",
          "..\\carreiro",
          "carreiro/../../admin",
          "%2e%2e%2f",
          "%2e%2e/",
          "..%2f",
        ];

        for (const ataque of ataques) {
          expect(sanitizarParametroTenant(ataque)).toBeNull();
        }
      });

      it("deve rejeitar e neutralizar caracteres nulos e truncamentos (Null Bytes)", () => {
        const ataques = [
          "%00",
          "\0",
          "carreiro\0admin",
          "carreiro%00.insightd.com.br",
          "tenant\x00",
          "carreiro\u0000",
        ];

        for (const ataque of ataques) {
          expect(sanitizarParametroTenant(ataque)).toBeNull();
        }
      });

      it("deve rejeitar tentativas de injeção XSS e caracteres HTML", () => {
        const ataques = [
          "<script>alert(1)</script>",
          '"><img src=x onerror=alert(1)>',
          "javascript:void(0)",
          "<svg onload=alert(1)>",
          "carreiro' autofocus onfocus=alert(1) '",
        ];

        for (const ataque of ataques) {
          expect(sanitizarParametroTenant(ataque)).toBeNull();
        }
      });

      it("deve rejeitar tentativas de injeção DAX / SQL", () => {
        const ataques = [
          "EVALUATE 'PRODUTOS'",
          "carreiro; DROP TABLE tenants; --",
          "1' OR '1'='1",
          "' OR 1=1 --",
          "CALCULATE(1=1, ALL('PRODUTOS'))",
          "UNION SELECT * FROM users",
        ];

        for (const ataque of ataques) {
          expect(sanitizarParametroTenant(ataque)).toBeNull();
        }
      });

      it("deve rejeitar strings com caracteres especiais, pontuações e quebras de linha no meio", () => {
        const caracteresEspeciais = [
          "carreiro:8080",
          "carreiro@domain.com",
          "carreiro$home",
          "carreiro|whoami",
          "carreiro&reboot",
          "carreiro\nadmin",
          "carreiro\r\ninject",
          "carreiro com espaco",
          "carréiro",
          "🚗",
        ];

        for (const item of caracteresEspeciais) {
          expect(sanitizarParametroTenant(item)).toBeNull();
        }
      });

      it("deve aceitar identificadores legítimos e normalizar para caixa baixa", () => {
        expect(sanitizarParametroTenant("carreiro")).toBe("carreiro");
        expect(sanitizarParametroTenant("CARREIRO")).toBe("carreiro");
        expect(sanitizarParametroTenant("  carreiro-lojas  ")).toBe("carreiro-lojas");
        expect(sanitizarParametroTenant("tenant-01")).toBe("tenant-01");
      });
    });

    describe("3.2 Extração de Subdomínio Robusta (extrairSubdominioDeHost)", () => {
      it("deve lidar com hostnames hostis e portas malformadas sem travar", () => {
        const hostsHostis = [
          "../../insightd.com.br",
          "carreiro.insightd.com.br:invalid_port",
          "carreiro.insightd.com.br:-8080",
          "carreiro.insightd.com.br:9999999999999999999999999999999",
          "::::8080",
          "carreiro.insightd.com.br:80:80",
          "127.0.0.1:3000",
          "192.168.1.100",
          "insightd.com.br",
          "insight-compras.com.br",
          "www.insightd.com.br",
          "app.insightd.com.br",
          "api.insightd.com.br",
          "",
        ];

        for (const host of hostsHostis) {
          // Deve executar sem lançar exceções não tratadas
          expect(() => extrairSubdominioDeHost(host)).not.toThrow();
        }
      });

      it("deve extrair subdomínio de host legítimo mesmo com portas anômalas", () => {
        // "carreiro.insightd.com.br:invalid" divide no ":" e processa "carreiro.insightd.com.br"
        expect(extrairSubdominioDeHost("carreiro.insightd.com.br:invalid")).toBe("carreiro");
        expect(extrairSubdominioDeHost("CARREIRO.insightd.com.br:443")).toBe("carreiro");
        expect(extrairSubdominioDeHost("carreiro.localhost:8080")).toBe("carreiro");
      });

      it("deve retornar null para hosts que não possuem subdomínio válido", () => {
        expect(extrairSubdominioDeHost("insightd.com.br")).toBeNull();
        expect(extrairSubdominioDeHost("10.0.0.1:8080")).toBeNull();
        expect(extrairSubdominioDeHost("www.insightd.com.br")).toBeNull();
      });
    });

    describe("3.3 Resolução Ponta a Ponta no Middleware sob Ataque", () => {
      it("deve recorrer com segurança ao tenant padrão quando receber requisições hostis", () => {
        const resultado = processarRequisicaoTenant({
          hostname: "host-desconhecido-ou-malicioso.com.br",
          searchParams: new URLSearchParams("tenant=../../admin"),
          cookies: { "x-tenant-id": "<script>alert(1)</script>" },
        });

        // O parâmetro e o cookie maliciosos são anulados pela sanitização, e o
        // recuo é para a DEMONSTRAÇÃO. Isto é o ponto do teste: host hostil não
        // pode terminar exibindo a marca nem os dados de um cliente real.
        expect(resultado.origemResolucao).toBe("fallback");
        expect(resultado.tenantId).toBe(TENANT_PADRAO.id);
        expect(resultado.tenant.cores.primaria).toBe(TENANT_PADRAO.cores.primaria);
        expect(resultado.tenantId).not.toBe(TENANT_CARREIRO.id);
      });

      it("Edge Middleware deve enriquecer requisições com headers downstream e cabeçalhos de segurança mesmo sob ataque", async () => {
        const mockRequestHostil: NextRequestLike = {
          headers: new Headers({
            host: "ataque-injecao.com.br:9999",
            "x-forwarded-host": "invalido",
          }),
          nextUrl: {
            searchParams: new URLSearchParams("tenant=' OR 1=1 --"),
            pathname: "/compras/../../admin",
          },
          cookies: {
            get: () => ({ value: "%00carreiro" }),
          },
        };

        const response = await middleware(mockRequestHostil);

        // Não deve quebrar o fluxo
        expect(response).toBeDefined();
        expect(response.cookiesToSet.name).toBe("x-tenant-id");
        expect(response.cookiesToSet.value).toBe("demonstracao");

        // Headers downstream do tenant injetados
        expect(response.request.headers.get("x-tenant-id")).toBe("demonstracao");
        expect(response.request.headers.get("x-tenant-cor-primaria")).toBe("#1E293B");
        expect(response.request.headers.get("x-tenant-cor-secundaria")).toBe("#0EA5E9");

        // Todos os cabeçalhos de segurança HTTP devem ser garantidos
        for (const [header, valor] of Object.entries(CABECALHOS_SEGURANCA_HTTP)) {
          expect(response.request.headers.get(header)).toBe(valor);
        }
      });
    });
  });
});

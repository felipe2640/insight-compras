/**
 * Testes Automatizados de Prontidão Multi-Tenant em Produção
 * Garante:
 * 1. Não-regressão estrita para a Rede Carreiro (instalação dedicada TENANT_ATIVO=carreiro)
 * 2. Resolução dinâmica de adaptadores por tenant sem variáveis globais
 * 3. Isolamento de instâncias de adaptadores (prevenção de vazamento de cache L1 / Circuit Breakers)
 * 4. Extensibilidade dinâmica do catálogo através de registrarTenant
 * 5. Proteção RBAC contra contaminação cruzada de dados entre organizações (ErroViolacaoTenant)
 * 6. Resposta multi-tenant correta no healthcheck
 *
 * 100% em Português do Brasil (pt-BR).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  obterAdaptadorInventario,
  limparInstanciasAdaptadores,
  AdaptadorInventarioCarreiro,
  AdaptadorInventarioMock,
} from "@adapters/index";
import {
  CATALOGO_TENANTS,
  TENANT_CARREIRO,
  TENANT_DEMONSTRACAO,
  TENANT_PADRAO,
  obterConfiguracaoTenant,
  registrarTenant,
  resolverTenantConfigurado,
  ConfiguracaoTenant,
} from "@config/tenants";
import { obterTenantAtivo, montarOpcoesMatriz } from "@/lib/cockpit/opcoes-tenant";
import { validarTenantContexto } from "@/lib/rbac/validador-carteira";
import { ErroViolacaoTenant, UsuarioAutenticado } from "@/lib/rbac/tipos";
import { GET as healthGet } from "@/app/api/health/route";
import { GET as healthFonteGet } from "@/app/api/health/fonte/route";
import { NextRequest } from "next/server";

describe("Prontidão Multi-Tenant em Produção & Salvaguarda Carreiro", () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    limparInstanciasAdaptadores();
    delete process.env.TENANT_ATIVO;
    delete process.env.USE_MOCK_ADAPTER;
  });

  afterEach(() => {
    process.env = { ...envOriginal };
    limparInstanciasAdaptadores();
  });

  describe("1. Salvaguarda da Operação Rede Carreiro", () => {
    it("deve resolver para Carreiro quando TENANT_ATIVO=carreiro (ambiente dedicado)", () => {
      process.env.TENANT_ATIVO = "carreiro";

      const tenant = resolverTenantConfigurado();
      expect(tenant.id).toBe("carreiro");
      expect(tenant.nome).toBe("Rede Carreiro Autopeças");
      expect(tenant.fonte.adaptador).toBe("powerbi-dax");
      expect(tenant.parametrosMotor.motor.fatorCalibracao).toBe(0.9);
      expect(tenant.parametrosMotor.filialFocoPadraoId).toBe(1);
    });

    it("obterTenantAtivo deve retornar Carreiro quando TENANT_ATIVO estiver ativo", () => {
      process.env.TENANT_ATIVO = "carreiro";
      const ativo = obterTenantAtivo();
      expect(ativo.id).toBe("carreiro");
    });

    it("obterAdaptadorInventario deve instanciar AdaptadorInventarioCarreiro com credenciais ativas", () => {
      process.env.TENANT_ATIVO = "carreiro";
      process.env.POWERBI_WORKSPACE_ID = "workspace-de-teste";
      process.env.POWERBI_DATASET_ID = "dataset-de-teste";
      process.env.POWERBI_TENANT_ID = "tenant-carreiro-teste";
      process.env.POWERBI_CLIENT_ID = "client-carreiro-teste";
      process.env.POWERBI_CLIENT_SECRET = "segredo-carreiro-teste";

      const adaptador = obterAdaptadorInventario();
      expect(adaptador).toBeInstanceOf(AdaptadorInventarioCarreiro);
    });
  });

  describe("2. Resolução Dinâmica de Adaptadores por Tenant", () => {
    it("deve instanciar AdaptadorInventarioCarreiro ao passar tenant: 'carreiro' com credenciais ativas sem TENANT_ATIVO", () => {
      delete process.env.TENANT_ATIVO;
      process.env.POWERBI_WORKSPACE_ID = "workspace-de-teste";
      process.env.POWERBI_DATASET_ID = "dataset-de-teste";
      process.env.POWERBI_TENANT_ID = "tenant-carreiro-teste";
      process.env.POWERBI_CLIENT_ID = "client-carreiro-teste";
      process.env.POWERBI_CLIENT_SECRET = "segredo-carreiro-teste";

      const adaptador = obterAdaptadorInventario({ tenant: "carreiro" });
      expect(adaptador).toBeInstanceOf(AdaptadorInventarioCarreiro);
    });

    it("deve instanciar AdaptadorInventarioMock ao passar tenant: 'demonstracao'", () => {
      process.env.TENANT_ATIVO = "carreiro"; // Mesmo com carreiro no env

      const adaptador = obterAdaptadorInventario({ tenant: "demonstracao" });
      expect(adaptador).toBeInstanceOf(AdaptadorInventarioMock);
    });

    it("deve isolar instâncias de adaptadores em mapa sem interferência de caches", () => {
      process.env.POWERBI_WORKSPACE_ID = "workspace-de-teste";
      process.env.POWERBI_DATASET_ID = "dataset-de-teste";
      process.env.POWERBI_TENANT_ID = "tenant-carreiro-teste";
      process.env.POWERBI_CLIENT_ID = "client-carreiro-teste";
      process.env.POWERBI_CLIENT_SECRET = "segredo-carreiro-teste";

      const adaptadorCarreiro = obterAdaptadorInventario({ tenant: "carreiro" });
      const adaptadorMock = obterAdaptadorInventario({ tenant: "demonstracao" });

      expect(adaptadorCarreiro).not.toBe(adaptadorMock);
      expect(adaptadorCarreiro).toBeInstanceOf(AdaptadorInventarioCarreiro);
      expect(adaptadorMock).toBeInstanceOf(AdaptadorInventarioMock);

      // Chamadas subsequentes devem reaproveitar a instância do mesmo tenant
      const adaptadorCarreiro2 = obterAdaptadorInventario({ tenant: "carreiro" });
      expect(adaptadorCarreiro2).toBe(adaptadorCarreiro);
    });
  });

  describe("3. Extensibilidade Dinâmica de Novos Clientes (registrarTenant)", () => {
    it("deve permitir o registro dinâmico de um novo cliente no catálogo", () => {
      const novoTenant: ConfiguracaoTenant = {
        ...TENANT_DEMONSTRACAO,
        id: "autopecas-nordeste",
        nome: "Autopeças Nordeste Ltda",
        razaoSocial: "Autopeças Nordeste Distribuidora SA",
        subdominioPrincipal: "nordeste.insightd.com.br",
        subdominiosValidos: ["nordeste.insightd.com.br", "nordeste"],
        fonte: { adaptador: "sintetica" },
      };

      registrarTenant(novoTenant);

      const resolvidoPorId = obterConfiguracaoTenant("autopecas-nordeste");
      expect(resolvidoPorId.id).toBe("autopecas-nordeste");
      expect(resolvidoPorId.nome).toBe("Autopeças Nordeste Ltda");

      const resolvidoPorSubdominio = obterConfiguracaoTenant("nordeste.insightd.com.br");
      expect(resolvidoPorSubdominio.id).toBe("autopecas-nordeste");

      const adaptadorNovo = obterAdaptadorInventario({ tenant: novoTenant });
      expect(adaptadorNovo).toBeInstanceOf(AdaptadorInventarioMock);
    });
  });

  describe("4. Proteção RBAC contra Contaminação de Dados (Cross-Tenant)", () => {
    const usuarioCarreiro: UsuarioAutenticado = {
      id: "usr-carreiro-01",
      email: "comprador@carreiro.com.br",
      nome: "Comprador Carreiro",
      role: "COMPRADOR",
      allowedSupplierIds: [501, 502],
      tenantId: "carreiro",
    };

    it("deve permitir operação quando o tenant solicitado for idêntico ao do usuário", () => {
      expect(() => {
        validarTenantContexto(usuarioCarreiro, "carreiro");
      }).not.toThrow();
    });

    it("deve lançar ErroViolacaoTenant (403) se usuário Carreiro tentar operar em outro tenant", () => {
      expect(() => {
        validarTenantContexto(usuarioCarreiro, "outro-cliente");
      }).toThrow(ErroViolacaoTenant);

      try {
        validarTenantContexto(usuarioCarreiro, "outro-cliente");
      } catch (err) {
        const erro = err as ErroViolacaoTenant;
        expect(erro.statusCode).toBe(403);
        expect(erro.codigoErro).toBe("TENANT_MISMATCH");
      }
    });
  });

  describe("5. Healthcheck", () => {
    it("o health público não revela nem consulta o cliente", async () => {
      // Esta rota é pública e ficava fora do middleware, aceitando
      // `x-tenant-id` do próprio chamador e disparando uma consulta à fonte
      // daquele cliente. Qualquer um na internet fazia a plataforma consultar
      // o Power BI de um cliente, sem sessão nenhuma.
      const res = await healthGet();
      const dados = await res.json();

      expect(res.status).toBe(200);
      expect(dados.status).toBe("ok");
      expect(dados.tenant).toBeUndefined();
      expect(dados.conexaoDados).toBeUndefined();
    });

    it("o health da FONTE exige sessão", async () => {
      const requisicao = new NextRequest("http://localhost/api/health/fonte", {
        headers: { "x-tenant-id": "carreiro" },
      });
      const res = await healthFonteGet(requisicao);
      expect(res.status).toBe(401);
    });
  });

  describe("6. Matriz de Decisão e Parâmetros Multi-Tenant", () => {
    it("deve montar opções com parâmetros calibrados do tenant especificado", () => {
      const opcoesCarreiro = montarOpcoesMatriz(1, TENANT_CARREIRO);
      expect(opcoesCarreiro.parametrosMotor).toBeDefined();
      expect(opcoesCarreiro.nomesFiliais).toBeDefined();
      expect(opcoesCarreiro.parametrosMotor?.fatorCalibracao).toBe(0.9);
      expect(opcoesCarreiro.nomesFiliais?.[1]).toBe("Carreiro Pedro II (Matriz)");
      expect(opcoesCarreiro.nomesFiliais?.[2]).toBe("Melo / Piripiri");

      const opcoesDemo = montarOpcoesMatriz(1, TENANT_DEMONSTRACAO);
      expect(opcoesDemo.parametrosMotor?.fatorCalibracao).toBe(1.0);
      expect(opcoesDemo.nomesFiliais?.[1]).toBe("Loja Matriz");
    });
  });
});

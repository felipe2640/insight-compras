/**
 * Suíte de Testes Automatizados: Edge Middleware e Resolução Dinâmica de Tenants
 * Requisitos: ORIGINAL_REQUEST R5, PROJECT.md Feature #27
 * 100% em Português do Brasil (pt-BR).
 */

import { describe, it, expect } from "vitest";
import {
  processarRequisicaoTenant,
  sanitizarParametroTenant,
  extrairSubdominioDeHost,
} from "@/lib/middleware-tenant";
import { middleware, NextRequestLike } from "@/middleware";
import { CABECALHOS_SEGURANCA_HTTP } from "@/lib/seguranca/headers";

describe("Edge Middleware — Resolução de Subdomínio, Tenants e White-Label", () => {
  describe("1. Funções Utilitárias de Sanitização e Extração", () => {
    it("sanitizarParametroTenant deve aceitar identificadores alfanuméricos válidos", () => {
      expect(sanitizarParametroTenant("carreiro")).toBe("carreiro");
      expect(sanitizarParametroTenant("Carreiro-01")).toBe("carreiro-01");
      expect(sanitizarParametroTenant("loja-norte")).toBe("loja-norte");
    });

    it("sanitizarParametroTenant deve rejeitar e anular tentativas de injeção e path traversal", () => {
      expect(sanitizarParametroTenant("<script>alert(1)</script>")).toBeNull();
      expect(sanitizarParametroTenant("../../etc/passwd")).toBeNull();
      expect(sanitizarParametroTenant("carreiro; DROP TABLE")).toBeNull();
      expect(sanitizarParametroTenant("carreiro' OR '1'='1")).toBeNull();
      expect(sanitizarParametroTenant("carreiro/admin")).toBeNull();
      expect(sanitizarParametroTenant("")).toBeNull();
      expect(sanitizarParametroTenant(null)).toBeNull();
    });

    it("extrairSubdominioDeHost deve extrair subdomínio de host de produção insightd.com.br", () => {
      expect(extrairSubdominioDeHost("carreiro.insightd.com.br")).toBe("carreiro");
      expect(extrairSubdominioDeHost("carreiro.insight-compras.com.br")).toBe("carreiro");
      expect(extrairSubdominioDeHost("CARREIRO.insightd.com.br:443")).toBe("carreiro");
    });

    it("extrairSubdominioDeHost deve ignorar subdomínios de sistema (www, app, api)", () => {
      expect(extrairSubdominioDeHost("www.insightd.com.br")).toBeNull();
      expect(extrairSubdominioDeHost("app.insightd.com.br")).toBeNull();
      expect(extrairSubdominioDeHost("api.insightd.com.br")).toBeNull();
    });

    it("extrairSubdominioDeHost deve suportar subdomínio em localhost para desenvolvimento", () => {
      expect(extrairSubdominioDeHost("carreiro.localhost:3000")).toBe("carreiro");
      expect(extrairSubdominioDeHost("carreiro.localhost")).toBe("carreiro");
      expect(extrairSubdominioDeHost("localhost:3000")).toBeNull();
    });

    it("extrairSubdominioDeHost deve ignorar IPs diretos", () => {
      expect(extrairSubdominioDeHost("127.0.0.1:3000")).toBeNull();
      expect(extrairSubdominioDeHost("192.168.1.100")).toBeNull();
    });
  });

  describe("2. Ordem de Precedência da Resolução de Tenant", () => {
    it("Ordem 1: Query param (?tenant=carreiro) tem prioridade máxima", () => {
      const resultado = processarRequisicaoTenant({
        hostname: "outro.insightd.com.br",
        searchParams: new URLSearchParams("tenant=carreiro"),
        cookies: { "x-tenant-id": "qualquer" },
      });

      expect(resultado.origemResolucao).toBe("query");
      expect(resultado.tenantId).toBe("carreiro");
    });

    it("Ordem 2: Subdomínio no hostname é utilizado se não houver query param", () => {
      const resultado = processarRequisicaoTenant({
        hostname: "carreiro.insightd.com.br",
        searchParams: new URLSearchParams(),
      });

      expect(resultado.origemResolucao).toBe("subdominio");
      expect(resultado.tenantId).toBe("carreiro");
    });

    it("Ordem 3: Custom Domain do cliente é resolvido quando aplicável", () => {
      const resultado = processarRequisicaoTenant({
        hostname: "compras.carreiro.com.br",
        searchParams: new URLSearchParams(),
      });

      expect(resultado.origemResolucao).toBe("custom_domain");
      expect(resultado.tenantId).toBe("carreiro");
    });

    it("Ordem 4: Cookie x-tenant-id é utilizado se não houver host nem query", () => {
      const resultado = processarRequisicaoTenant({
        hostname: "localhost:3000",
        searchParams: new URLSearchParams(),
        cookies: { "x-tenant-id": "carreiro" },
      });

      expect(resultado.origemResolucao).toBe("cookie");
      expect(resultado.tenantId).toBe("carreiro");
    });

    it("Ordem 5: Recorre a Fallback Seguro caso nenhum indicador identifique outro tenant", () => {
      const resultado = processarRequisicaoTenant({
        hostname: "insightd.com.br",
        searchParams: new URLSearchParams(),
      });

      expect(resultado.origemResolucao).toBe("fallback");
      expect(resultado.tenantId).toBe("carreiro");
    });

    it("deve recorrer a fallback seguro se query param contiver payload malicioso", () => {
      const resultado = processarRequisicaoTenant({
        hostname: "localhost:3000",
        searchParams: new URLSearchParams("tenant=<script>alert(1)</script>"),
      });

      expect(resultado.origemResolucao).toBe("fallback");
      expect(resultado.tenantId).toBe("carreiro");
    });
  });

  describe("3. Injeção de Cabeçalhos Downstream e Middleware Next.js", () => {
    it("deve injetar cabeçalhos downstream com os dados do tenant Carreiro", () => {
      const resultado = processarRequisicaoTenant({
        hostname: "carreiro.insightd.com.br",
        searchParams: new URLSearchParams(),
      });

      expect(resultado.headersDownstream["x-tenant-id"]).toBe("carreiro");
      expect(resultado.headersDownstream["x-tenant-subdominio"]).toBe("carreiro.insightd.com.br");
      expect(resultado.headersDownstream["x-tenant-cor-primaria"]).toBe("#0F2B5C");
      expect(resultado.headersDownstream["x-tenant-cor-secundaria"]).toBe("#D4AF37");
      expect(resultado.headersDownstream["x-tenant-cor-destaque-multiplo"]).toBe("#FFFFCC");
      expect(resultado.headersDownstream["x-tenant-cor-fundo"]).toBe("#F8FAFC");
    });

    it("middleware deve enriquecer a requisição e configurar cookie x-tenant-id e cabeçalhos de segurança", () => {
      const mockRequest: NextRequestLike = {
        headers: new Headers({
          host: "carreiro.insightd.com.br",
        }),
        nextUrl: {
          searchParams: new URLSearchParams(),
          pathname: "/compras",
        },
        cookies: {
          get: () => undefined,
        },
      };

      const response = middleware(mockRequest);

      expect(response.request.headers.get("x-tenant-id")).toBe("carreiro");
      expect(response.request.headers.get("x-tenant-cor-primaria")).toBe("#0F2B5C");
      expect(response.cookiesToSet.name).toBe("x-tenant-id");
      expect(response.cookiesToSet.value).toBe("carreiro");

      // Deve injetar os cabeçalhos de segurança HTTP
      for (const chave of Object.keys(CABECALHOS_SEGURANCA_HTTP)) {
        expect(response.request.headers.get(chave)).toBeDefined();
      }
    });
  });
});

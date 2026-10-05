/**
 * Testes Automatizados da Unidade U0: Resolução Dinâmica de Tenant e Modo Demonstração
 * Garante que sem .env a aplicação sobe em modo demonstração com tenant neutro,
 * sem vazar nomes de redes reais nem cores fixas.
 * 100% em Português do Brasil (pt-BR).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolverTenantConfigurado,
  TENANT_PADRAO,
  TENANT_DEMONSTRACAO,
  TENANT_CARREIRO,
  gerarStringCssVarsInline,
} from "@config/tenants";
import { GET as healthGet } from "@/app/api/health/route";
import { NextRequest } from "next/server";

describe("Unidade U0 — Resolução Dinâmica de Tenant e Modo Demonstração", () => {
  const envOriginal = process.env.TENANT_ATIVO;

  beforeEach(() => {
    delete process.env.TENANT_ATIVO;
  });

  afterEach(() => {
    if (envOriginal !== undefined) {
      process.env.TENANT_ATIVO = envOriginal;
    } else {
      delete process.env.TENANT_ATIVO;
    }
  });

  it("deve resolver para TENANT_PADRAO (demonstracao) quando TENANT_ATIVO não estiver configurado", () => {
    const tenant = resolverTenantConfigurado();
    expect(tenant).toBe(TENANT_PADRAO);
    expect(tenant.id).toBe("demonstracao");
    expect(tenant.nome).toBe("Rede Demonstração");
    expect(tenant.nome).not.toContain("Carreiro");
  });

  it("deve resolver para o tenant especificado quando TENANT_ATIVO for 'carreiro'", () => {
    process.env.TENANT_ATIVO = "carreiro";
    const tenant = resolverTenantConfigurado();
    expect(tenant.id).toBe("carreiro");
    expect(tenant).toBe(TENANT_CARREIRO);
  });

  it("deve fazer fallback seguro para demonstracao se TENANT_ATIVO for desconhecido", () => {
    process.env.TENANT_ATIVO = "tenant-fantasma-999";
    const tenant = resolverTenantConfigurado();
    expect(tenant.id).toBe("demonstracao");
  });

  it("a rota /api/health é pública e não revela o cliente da instalação", async () => {
    delete process.env.TENANT_ATIVO;
    const response = await healthGet();
    const corpo = await response.json();

    expect(response.status).toBe(200);
    expect(corpo.status).toBe("ok");
    expect(corpo.tenant).toBeUndefined();
  });

  it("deve gerar variáveis CSS neutras no modo demonstração", () => {
    const cssVars = gerarStringCssVarsInline(TENANT_DEMONSTRACAO);
    expect(cssVars).toContain(`--cor-primaria: ${TENANT_DEMONSTRACAO.cores.primaria}`);
    expect(cssVars).toContain(`--cor-secundaria: ${TENANT_DEMONSTRACAO.cores.secundaria}`);
    // Cores da demonstração não devem ser as cores da Carreiro (#0F2B5C / #D4AF37)
    expect(TENANT_DEMONSTRACAO.cores.primaria).not.toBe("#0F2B5C");
    expect(TENANT_DEMONSTRACAO.cores.secundaria).not.toBe("#D4AF37");
  });
});

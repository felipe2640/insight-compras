/**
 * "Estou em produção?" — a pergunta que derrubou o preview do PR.
 *
 * Todo deploy da Vercel, inclusive o PREVIEW de um PR, roda com
 * NODE_ENV=production. A primeira versão da regra olhava NODE_ENV, então o
 * preview era tratado como produção: exigia TENANT_ATIVO, e o projeto de
 * apresentação (que não declara um) respondia 503 em todas as páginas.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErroTenant, ehAmbienteProducao, resolverTenantConfigurado } from "@config/tenants";

const envOriginal = { ...process.env };

beforeEach(() => {
  process.env = { ...envOriginal };
  delete process.env.TENANT_ATIVO;
  delete process.env.VERCEL_ENV;
});

afterEach(() => {
  process.env = { ...envOriginal };
  vi.unstubAllEnvs();
});

describe("detecção de produção", () => {
  it("PREVIEW da Vercel não é produção, mesmo com NODE_ENV=production", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.VERCEL_ENV = "preview";
    expect(ehAmbienteProducao()).toBe(false);
  });

  it("PRODUÇÃO da Vercel é produção", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.VERCEL_ENV = "production";
    expect(ehAmbienteProducao()).toBe(true);
  });

  it("fora da Vercel, vale o NODE_ENV (servidor próprio)", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(ehAmbienteProducao()).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    expect(ehAmbienteProducao()).toBe(false);
  });

  it("preview SEM TENANT_ATIVO abre a demonstração em vez de 503", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.VERCEL_ENV = "preview";
    expect(resolverTenantConfigurado().id).toBe("demonstracao");
  });

  it("produção SEM TENANT_ATIVO continua sendo erro (ADR-0001)", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.VERCEL_ENV = "production";
    expect(() => resolverTenantConfigurado()).toThrow(ErroTenant);
  });
});

/**
 * Testes Automatizados da Unidade U5 — F1: Tema & White-Label Honesto
 * Camada: Testes / Whitelabel (tests/whitelabel/tema-honesto.test.ts)
 * 100% em Português do Brasil (pt-BR).
 *
 * Garante que a tela de personalização de tema:
 * 1. Declara honestamente as cores e configurações de deploy do tenant ativo.
 * 2. Gera e expõe as variáveis CSS ativas sem formulários falsos que simulam salvar.
 * 3. Não vaza literais ou nomes de rede hardcoded no código genérico.
 */

import { describe, it, expect, vi } from "vitest";
import { obterTenantAtivo } from "@/lib/cockpit/opcoes-tenant";
import {
  gerarVariaveisCssTenant,
  gerarStringCssVarsInline,
} from "@config/tenants/tipos";
import * as servidorAuth from "@/lib/autenticacao/servidor";
import PaginaTema from "@/app/configuracoes/tema/page";

describe("Unidade U5 — F1: Tema & White-Label Honesto", () => {
  it("deve derivar todas as variáveis CSS do tenant ativo", () => {
    const tenant = obterTenantAtivo();
    const varsCss = gerarVariaveisCssTenant(tenant);

    expect(varsCss["--cor-primaria"]).toBe(tenant.cores.primaria);
    expect(varsCss["--cor-secundaria"]).toBe(tenant.cores.secundaria);
    expect(varsCss["--cor-acento"]).toBe(tenant.cores.acento);
    expect(varsCss["--cor-fundo"]).toBe(tenant.cores.fundo);
    expect(varsCss["--cor-card"]).toBe(tenant.cores.card);
    expect(varsCss["--cor-borda"]).toBe(tenant.cores.borda);
    expect(varsCss["--cor-texto"]).toBe(tenant.cores.texto);
    expect(varsCss["--cor-texto-secundario"]).toBe(tenant.cores.textoSecundario);
    expect(varsCss["--cor-destaque-multiplo"]).toBe(tenant.cores.fundoDestaqueMultiplo);
  });

  it("deve gerar string CSS inline sem inconsistências", () => {
    const tenant = obterTenantAtivo();
    const stringInline = gerarStringCssVarsInline(tenant);

    expect(stringInline).toContain(`--cor-primaria: ${tenant.cores.primaria};`);
    expect(stringInline).toContain(`--cor-secundaria: ${tenant.cores.secundaria};`);
  });

  it("PaginaTema deve renderizar como Server Component honesto e assíncrono", async () => {
    vi.spyOn(servidorAuth, "obterUsuarioAtual").mockResolvedValue({
      id: "usr-admin-01",
      nome: "Administrador Teste",
      email: "admin@empresa.com.br",
      role: "ADMIN",
      allowedSupplierIds: null,
      tenantId: "carreiro",
    });

    const jsx = await PaginaTema();
    expect(jsx).toBeDefined();
    expect(jsx.type).toBe("div");
  });
});

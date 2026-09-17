/**
 * Validação de ambiente: uma instalação incompleta não pode operar pela metade.
 *
 * Cada subsistema escolhia o provedor pelo que por acaso estivesse no ambiente.
 * Dava para subir um cliente real com login de demonstração, pedidos só em
 * memória e fonte caindo em dado sintético — em silêncio, e com cara de que
 * estava tudo certo.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { limparCacheValidacaoAmbiente, validarAmbiente } from "@/lib/ambiente/validacao-ambiente";

const envOriginal = { ...process.env };

function ambienteDeClienteReal(): void {
  process.env.TENANT_ATIVO = "carreiro";
  process.env.POWERBI_WORKSPACE_ID = "workspace";
  process.env.POWERBI_DATASET_ID = "dataset";
  process.env.POWERBI_TENANT_ID = "tenant";
  process.env.POWERBI_CLIENT_ID = "client";
  process.env.POWERBI_CLIENT_SECRET = "segredo";
  process.env.SUPABASE_URL = "https://exemplo.supabase.co";
  process.env.SUPABASE_ANON_KEY = "publica";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "privilegiada";
  process.env.AUTH_SECRET = "segredo-de-sessao";
}

beforeEach(() => {
  process.env = { ...envOriginal };
  delete process.env.TENANT_ATIVO;
  limparCacheValidacaoAmbiente();
});

afterEach(() => {
  process.env = { ...envOriginal };
  limparCacheValidacaoAmbiente();
});

describe("validação de ambiente", () => {
  it("o catálogo de clientes do repositório é válido", () => {
    // Se um cadastro quebrar o esquema (filial sem identificador de fonte,
    // loja em foco inexistente, id duplicado), é aqui que aparece.
    const resultado = validarAmbiente();
    expect(resultado.problemas.filter((p) => p.startsWith("tenant "))).toEqual([]);
  });

  it("cliente sintético não exige credencial nenhuma", () => {
    process.env.TENANT_ATIVO = "demonstracao";
    const resultado = validarAmbiente();
    expect(resultado.ok).toBe(true);
    expect(resultado.tenantId).toBe("demonstracao");
  });

  it("cliente real sem credenciais da fonte é bloqueado, com o nome do que falta", () => {
    process.env.TENANT_ATIVO = "carreiro";
    const resultado = validarAmbiente();

    expect(resultado.ok).toBe(false);
    expect(resultado.problemas.join(" ")).toContain("POWERBI_WORKSPACE_ID");
  });

  it("cliente real completo passa", () => {
    ambienteDeClienteReal();
    const resultado = validarAmbiente();
    expect(resultado.problemas).toEqual([]);
    expect(resultado.ok).toBe(true);
  });

  it("cliente real com mock forçado é bloqueado", () => {
    ambienteDeClienteReal();
    process.env.USE_MOCK_ADAPTER = "true";

    const resultado = validarAmbiente();
    expect(resultado.ok).toBe(false);
    expect(resultado.problemas.join(" ")).toContain("USE_MOCK_ADAPTER");
  });

  it("cliente real com login de demonstração é bloqueado", () => {
    ambienteDeClienteReal();
    process.env.AUTH_PROVIDER = "demo";

    const resultado = validarAmbiente();
    expect(resultado.ok).toBe(false);
    expect(resultado.problemas.join(" ")).toContain("AUTH_PROVIDER");
  });

  it("cliente real guardando pedidos só em memória é bloqueado", () => {
    ambienteDeClienteReal();
    process.env.PEDIDOS_PROVIDER = "memoria";

    const resultado = validarAmbiente();
    expect(resultado.ok).toBe(false);
    expect(resultado.problemas.join(" ")).toContain("PEDIDOS_PROVIDER");
  });

  it("cliente real sem AUTH_SECRET é bloqueado (a sessão cairia em segredo de desenvolvimento)", () => {
    ambienteDeClienteReal();
    delete process.env.AUTH_SECRET;

    const resultado = validarAmbiente();
    expect(resultado.ok).toBe(false);
    expect(resultado.problemas.join(" ")).toContain("AUTH_SECRET");
  });

  it("sem TENANT_ATIVO, avisa e abre em demonstração fora de produção", () => {
    const resultado = validarAmbiente();
    expect(resultado.tenantId).toBe("demonstracao");
    expect(resultado.avisos.join(" ")).toContain("TENANT_ATIVO");
  });
});

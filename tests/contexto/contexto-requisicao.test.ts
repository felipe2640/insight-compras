/**
 * O contexto da requisição e a trava que fechou o vazamento entre clientes.
 *
 * A matriz aqui é cabeçalho × sessão × ambiente. Era a combinação que ninguém
 * testava: a página do cockpit usava o cabeçalho ANTES da sessão e nunca
 * comparava os dois, então numa instalação multi-cliente bastava
 * `/compras?tenant=<cliente>` para uma sessão de demonstração abrir a grade
 * real. A API conferia; a página, não.
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UsuarioAutenticado } from "@/lib/rbac/tipos";

vi.mock("next/headers", () => ({
  headers: () => new Headers(cabecalhosSimulados),
  cookies: () => ({ get: () => undefined }),
}));

let cabecalhosSimulados: Record<string, string> = {};
let usuarioSimulado: UsuarioAutenticado | null = null;

vi.mock("@/lib/autenticacao/servidor", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("@/lib/autenticacao/servidor")>();
  return {
    ...original,
    obterUsuarioAtual: async () => usuarioSimulado,
    obterUsuarioDaRequisicao: async () => usuarioSimulado,
  };
});

const { ErroContexto, contextoDaPagina, contextoDaRequisicao } = await import(
  "@/lib/contexto/contexto-requisicao"
);
const { limparCacheValidacaoAmbiente } = await import("@/lib/ambiente/validacao-ambiente");
const { limparInstanciasAdaptadores } = await import("@adapters/index");

function usuarioDe(tenantId: string): UsuarioAutenticado {
  return {
    id: "usr-1",
    nome: "Fulano",
    email: "fulano@exemplo.com.br",
    role: "GESTOR",
    allowedSupplierIds: null,
    tenantId,
  };
}

/** Instalação de cliente real completa, para testar o que vem DEPOIS do ambiente. */
function darCredenciaisDeClienteReal(): void {
  process.env.POWERBI_WORKSPACE_ID = "workspace-de-teste";
  process.env.POWERBI_DATASET_ID = "dataset-de-teste";
  process.env.POWERBI_TENANT_ID = "tenant-de-teste";
  process.env.POWERBI_CLIENT_ID = "client-de-teste";
  process.env.POWERBI_CLIENT_SECRET = "segredo-de-teste";
  process.env.SUPABASE_URL = "https://exemplo.supabase.co";
  process.env.SUPABASE_ANON_KEY = "chave-publica-de-teste";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-privilegiada-de-teste";
  process.env.AUTH_SECRET = "segredo-de-sessao-de-teste";
}

function requisicaoCom(tenantCabecalho?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/compras", {
    headers: tenantCabecalho ? { "x-tenant-id": tenantCabecalho } : {},
  });
}

const envOriginal = { ...process.env };

beforeEach(() => {
  process.env = { ...envOriginal };
  delete process.env.TENANT_ATIVO;
  cabecalhosSimulados = {};
  usuarioSimulado = null;
  limparCacheValidacaoAmbiente();
  limparInstanciasAdaptadores();
});

afterEach(() => {
  process.env = { ...envOriginal };
  vi.unstubAllEnvs();
});

describe("contexto da requisição — falha fechada entre clientes", () => {
  it("sem sessão, nega (nunca segue como usuário nulo)", async () => {
    usuarioSimulado = null;
    await expect(contextoDaRequisicao(requisicaoCom("demonstracao"))).rejects.toMatchObject({
      motivo: "nao_autenticado",
    });
  });

  it("sessão e cabeçalho do MESMO cliente: segue", async () => {
    usuarioSimulado = usuarioDe("demonstracao");
    const contexto = await contextoDaRequisicao(requisicaoCom("demonstracao"));
    expect(contexto.tenant.id).toBe("demonstracao");
    expect(contexto.fonte.natureza).toBe("sintetica");
  });

  it("sessão de um cliente pedindo OUTRO pelo cabeçalho: 403 na API", async () => {
    usuarioSimulado = usuarioDe("demonstracao");
    await expect(contextoDaRequisicao(requisicaoCom("carreiro"))).rejects.toMatchObject({
      motivo: "tenant_divergente",
    });
  });

  it("MESMO caminho pela PÁGINA também nega — era por aqui que a grade real vazava", async () => {
    usuarioSimulado = usuarioDe("demonstracao");
    cabecalhosSimulados = { "x-tenant-id": "carreiro" };
    await expect(contextoDaPagina()).rejects.toMatchObject({ motivo: "tenant_divergente" });
  });

  it("instalação dedicada a um cliente recusa sessão de outro", async () => {
    process.env.TENANT_ATIVO = "carreiro";
    darCredenciaisDeClienteReal();
    usuarioSimulado = usuarioDe("demonstracao");
    await expect(contextoDaRequisicao(requisicaoCom())).rejects.toMatchObject({
      motivo: "tenant_divergente",
    });
  });

  it("sessão apontando para cliente que não existe: nega", async () => {
    usuarioSimulado = usuarioDe("cliente-que-nao-existe");
    await expect(contextoDaRequisicao(requisicaoCom())).rejects.toMatchObject({
      motivo: "tenant_desconhecido",
    });
  });

  it("cliente REAL sem credencial de fonte: erro de configuração, nunca mock", async () => {
    usuarioSimulado = usuarioDe("carreiro");
    for (const variavel of [
      "POWERBI_WORKSPACE_ID",
      "POWERBI_DATASET_ID",
      "POWERBI_TENANT_ID",
      "POWERBI_CLIENT_ID",
      "POWERBI_CLIENT_SECRET",
    ]) {
      delete process.env[variavel];
    }

    try {
      await contextoDaRequisicao(requisicaoCom("carreiro"));
      throw new Error("deveria ter falhado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroContexto);
      const contexto = erro as InstanceType<typeof ErroContexto>;
      expect(contexto.motivo).toBe("configuracao_incompleta");
      expect(contexto.detalhe?.join(" ")).toContain("POWERBI");
    }
  });

  it("a loja em foco vem do CADASTRO do cliente, não da convenção filial 1", async () => {
    usuarioSimulado = usuarioDe("demonstracao");
    const contexto = await contextoDaRequisicao(requisicaoCom());
    const filiaisDoCadastro = contexto.tenant.filiais.map((f) => f.filialId);

    expect(filiaisDoCadastro).toContain(contexto.filialFocoId);
    expect(contexto.filialFocoId).toBe(contexto.tenant.parametrosMotor.filialFocoPadraoId);
  });
});

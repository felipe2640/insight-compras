import { beforeEach, describe, expect, it, vi } from "vitest";
import { codificarCookieSessao } from "@/lib/autenticacao/sessao";

let valorCookie: string | undefined;

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => (valorCookie ? { value: valorCookie } : undefined) }),
}));

const { sbSelecionar, sbInserir } = await import("@/lib/aprendizado/supabase");

describe("PostgREST — menor privilégio", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://exemplo.supabase.co";
    process.env.SUPABASE_ANON_KEY = "chave-publica";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-servico";
    valorCookie = codificarCookieSessao({
      provedor: "supabase",
      token: "jwt-do-usuario",
      tokenRenovacao: null,
      expiraEm: Date.now() + 60_000,
    });
  });

  it("usa anon como apikey e o JWT do usuário nas operações normais", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);

    await sbSelecionar("aprendizado_snapshot", "select=id");

    const [, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      apikey: "chave-publica",
      Authorization: "Bearer jwt-do-usuario",
    });
  });

  it("não cai silenciosamente para service_role quando a sessão não existe", async () => {
    valorCookie = undefined;
    await expect(sbSelecionar("aprendizado_snapshot", "select=id")).rejects.toThrow(
      /Sessão Supabase ausente/
    );
  });

  it("usa service_role somente quando o chamador declara acesso privilegiado", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchFalso);

    await sbInserir("auditoria_pedido", { id: "aud-1" }, { acesso: "privilegiado" });

    const [, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      apikey: "chave-servico",
      Authorization: "Bearer chave-servico",
    });
  });
});

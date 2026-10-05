import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { middleware, rotaPublica, NextRequestLike } from "@/middleware";
import { codificarCookieSessao, decodificarCookieSessao } from "@/lib/autenticacao/sessao";
import { ProvedorAutenticacaoDemo } from "@/lib/autenticacao/provedores/demo";
import { limparInstanciasProvedores } from "@/lib/autenticacao/fabrica";

function requisicao(pathname: string, cookies: Record<string, string> = {}, host = "carreiro.insightd.com.br"): NextRequestLike {
  return {
    headers: new Headers({ host }),
    nextUrl: { searchParams: new URLSearchParams(), pathname },
    cookies: { get: (nome) => (cookies[nome] !== undefined ? { value: cookies[nome] } : undefined) },
  };
}

describe("portão de sessão do middleware", () => {
  const ambienteOriginal = { ...process.env };
  beforeEach(() => {
    process.env.AUTH_PROVIDER = "demo";
    limparInstanciasProvedores();
  });
  afterEach(() => {
    process.env = { ...ambienteOriginal };
    vi.unstubAllGlobals();
    limparInstanciasProvedores();
  });

  it("classifica rotas públicas", () => {
    expect(rotaPublica("/login")).toBe(true);
    expect(rotaPublica("/api/auth/entrar")).toBe(true);
    expect(rotaPublica("/api/health")).toBe(true);
    expect(rotaPublica("/compras")).toBe(false);
    expect(rotaPublica("/api/compras")).toBe(false);
  });

  it("página sem sessão redireciona para /login com next=", async () => {
    const r = await middleware(requisicao("/aprendizado"));
    expect(r.decisaoSessao).toBe("redirecionar_login");
    expect(r.status).toBe(307);
    const destino = new URL(r.headers.get("location")!);
    expect(destino.pathname).toBe("/login");
    expect(destino.searchParams.get("next")).toBe("/aprendizado");
    // tenant continua resolvido mesmo no redirecionamento
    expect(r.cookiesToSet.value).toBe("carreiro");
  });

  it("API sem sessão responde 401 (não redireciona)", async () => {
    const r = await middleware(requisicao("/api/compras"));
    expect(r.decisaoSessao).toBe("nao_autenticado_api");
    expect(r.status).toBe(401);
  });

  it("rota pública passa sem sessão e mantém cabeçalhos do tenant", async () => {
    const r = await middleware(requisicao("/login"));
    expect(r.decisaoSessao).toBe("publica");
    expect(r.request.headers.get("x-tenant-id")).toBe("carreiro");
  });

  it("sessão válida passa; expirada sem renovação vira redirecionamento e limpa cookie", async () => {
    const demo = new ProvedorAutenticacaoDemo({ senha: "demo", segredo: "insight-demo-segredo-somente-desenvolvimento" });
    const sessao = await demo.entrar({ usuario: "gestor", senha: "demo", tenantId: "demonstracao" });
    const valido = codificarCookieSessao({ provedor: "demo", token: sessao.token, tokenRenovacao: null, expiraEm: sessao.expiraEm });
    const ok = await middleware(requisicao("/compras", { insight_sessao: valido }));
    expect(ok.decisaoSessao).toBe("autenticada");

    const vencido = codificarCookieSessao({ provedor: "demo", token: sessao.token, tokenRenovacao: null, expiraEm: Date.now() - 1000 });
    const r = await middleware(requisicao("/compras", { insight_sessao: vencido }));
    expect(r.decisaoSessao).toBe("redirecionar_login");
    const setCookie = r.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/insight_sessao=;/);
  });

  it("já logado indo ao /login vai para o cockpit", async () => {
    const demo = new ProvedorAutenticacaoDemo({ senha: "demo", segredo: "insight-demo-segredo-somente-desenvolvimento" });
    const sessao = await demo.entrar({ usuario: "gestor", senha: "demo", tenantId: "demonstracao" });
    const cookie = codificarCookieSessao({ provedor: "demo", token: sessao.token, tokenRenovacao: null, expiraEm: sessao.expiraEm });
    const r = await middleware(requisicao("/login", { insight_sessao: cookie }));
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location")!).pathname).toBe("/compras");
  });

  it("entrega a sessão renovada ao handler na própria requisição", async () => {
    process.env.AUTH_PROVIDER = "supabase";
    process.env.SUPABASE_URL = "https://exemplo.supabase.co";
    process.env.SUPABASE_ANON_KEY = "publica";
    limparInstanciasProvedores();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "jwt-novo", refresh_token: "refresh-novo", expires_in: 3600,
        user: { id: "11111111-1111-4111-8111-111111111111", app_metadata: {
          tenant_id: "carreiro", papel: "ADMIN", usuario: "admin",
        } },
      }),
    }));
    const vencido = codificarCookieSessao({
      provedor: "supabase", token: "jwt-vencido", tokenRenovacao: "refresh-antigo",
      expiraEm: Date.now() - 1000,
    });
    const resposta = await middleware(requisicao("/api/compras", { insight_sessao: vencido }));
    expect(resposta.decisaoSessao).toBe("renovada");
    const header = resposta.request.headers.get("cookie") ?? "";
    const valor = header.split("insight_sessao=")[1]?.split(";")[0];
    expect(decodificarCookieSessao(valor)?.token).toBe("jwt-novo");
    expect(resposta.headers.get("set-cookie")).toContain("insight_sessao=");
  });
});

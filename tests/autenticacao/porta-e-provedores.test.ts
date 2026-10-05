import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  montarUsuarioAutenticado,
  normalizarFornecedores,
  normalizarPapel,
  ErroCredenciaisInvalidas,
  ErroUsuarioDesativado,
  normalizarNomeUsuario,
  emailInternoDoUsuario,
} from "@/lib/autenticacao/porta";
import {
  codificarCookieSessao,
  decodificarCookieSessao,
  sessaoExpirada,
  opcoesCookieSessao,
} from "@/lib/autenticacao/sessao";
import { ProvedorAutenticacaoDemo } from "@/lib/autenticacao/provedores/demo";
import { ProvedorAutenticacaoSupabase } from "@/lib/autenticacao/provedores/supabase";
import { idProvedorConfigurado, obterProvedorAutenticacao, limparInstanciasProvedores } from "@/lib/autenticacao/fabrica";
import { ErroAcessoNegado } from "@/lib/rbac/tipos";

describe("porta: normalização do perfil (igual para qualquer provedor)", () => {
  it("papel aceita maiúsculas/minúsculas e rejeita o resto", () => {
    expect(normalizarPapel("gestor")).toBe("GESTOR");
    expect(normalizarPapel(" Admin ")).toBe("ADMIN");
    expect(normalizarPapel("root")).toBeNull();
    expect(normalizarPapel(3)).toBeNull();
  });

  it("fornecedores aceita array, strings e '1,2' — vazio é irrestrito", () => {
    expect(normalizarFornecedores([3, 3, "4", "x"])).toEqual([3, 4]);
    expect(normalizarFornecedores("10, 20")).toEqual([10, 20]);
    expect(normalizarFornecedores(null)).toBeNull();
    expect(normalizarFornecedores([])).toBeNull();
  });

  it("usuário de outro tenant ou sem papel não entra", () => {
    const base = { id: "u1", usuario: "ana", nome: "Ana", papel: "GESTOR", tenantId: "carreiro", fornecedores: null };
    expect(montarUsuarioAutenticado(base, "carreiro")?.role).toBe("GESTOR");
    expect(montarUsuarioAutenticado(base, "outro")).toBeNull();
    expect(montarUsuarioAutenticado({ ...base, papel: null }, "carreiro")).toBeNull();
  });

  it("comprador sem carteira falha fechado (lista vazia), gestor é irrestrito (null)", () => {
    const comprador = montarUsuarioAutenticado(
      { id: "u", usuario: "c", nome: "", papel: "COMPRADOR", tenantId: "t", fornecedores: null }, "t");
    expect(comprador?.allowedSupplierIds).toEqual([]);
    expect(comprador?.nome).toBe("c");
    const gestor = montarUsuarioAutenticado(
      { id: "u", usuario: "g", nome: "G", papel: "GESTOR", tenantId: "t", fornecedores: null }, "t");
    expect(gestor?.allowedSupplierIds).toBeNull();
  });
});

describe("cookie de sessão", () => {
  it("codifica e decodifica sem perder nada", () => {
    const s = { provedor: "supabase" as const, token: "abc.def", tokenRenovacao: "r1", expiraEm: 1_700_000_000_000 };
    expect(decodificarCookieSessao(codificarCookieSessao(s))).toEqual(s);
  });

  it("rejeita lixo, provedor desconhecido e ausência", () => {
    expect(decodificarCookieSessao("nao-e-base64-json")).toBeNull();
    expect(decodificarCookieSessao(undefined)).toBeNull();
    expect(decodificarCookieSessao(btoa(JSON.stringify({ p: "firebase", t: "x", e: 1 })))).toBeNull();
  });

  it("expiração respeita a margem", () => {
    const agora = 1_000_000;
    const s = { provedor: "demo" as const, token: "t", tokenRenovacao: null, expiraEm: agora + 30_000 };
    expect(sessaoExpirada(s, agora, 60_000)).toBe(true);
    expect(sessaoExpirada(s, agora, 0)).toBe(false);
  });

  it("cookie é httpOnly, lax, e só secure em produção", () => {
    const s = { provedor: "demo" as const, token: "t", tokenRenovacao: null, expiraEm: Date.now() + 3600_000 };
    const dev = opcoesCookieSessao(s, false);
    expect(dev.httpOnly).toBe(true);
    expect(dev.sameSite).toBe("lax");
    expect(dev.secure).toBe(false);
    expect(opcoesCookieSessao(s, true).secure).toBe(true);
    expect(dev.maxAge).toBeGreaterThan(3500);
  });
});

describe("provedor demo", () => {
  const provedor = new ProvedorAutenticacaoDemo({ senha: "segredo", segredo: "chave-teste" });

  it("entra com usuário conhecido e senha certa; token valida de volta", async () => {
    const sessao = await provedor.entrar({ usuario: "gestor", senha: "segredo", tenantId: "demonstracao" });
    expect(sessao.usuario.role).toBe("GESTOR");
    const validado = await provedor.validar(sessao.token, "demonstracao");
    expect(validado?.id).toBe("demo-gestor");
  });

  it("senha errada ou usuário desconhecido = credenciais inválidas", async () => {
    await expect(provedor.entrar({ usuario: "gestor", senha: "x", tenantId: "demonstracao" })).rejects.toBeInstanceOf(ErroCredenciaisInvalidas);
    await expect(provedor.entrar({ usuario: "ninguem", senha: "segredo", tenantId: "demonstracao" })).rejects.toBeInstanceOf(ErroCredenciaisInvalidas);
  });

  it("token adulterado, assinado com outro segredo ou de outro tenant não valida", async () => {
    const sessao = await provedor.entrar({ usuario: "comprador", senha: "segredo", tenantId: "demonstracao" });
    const [carga, assinatura] = sessao.token.split(".");
    expect(await provedor.validar(`${carga}x.${assinatura}`, "demonstracao")).toBeNull();
    const outro = new ProvedorAutenticacaoDemo({ senha: "segredo", segredo: "outra-chave" });
    expect(await outro.validar(sessao.token, "demonstracao")).toBeNull();
    expect(await provedor.validar(sessao.token, "outro-tenant")).toBeNull();
  });

  it("token expirado não valida", async () => {
    let relogio = 1_000_000;
    const p = new ProvedorAutenticacaoDemo({ senha: "s", segredo: "k", agora: () => relogio });
    const sessao = await p.entrar({ usuario: "gestor", senha: "s", tenantId: "demonstracao" });
    relogio += 13 * 3600 * 1000;
    expect(await p.validar(sessao.token, "demonstracao")).toBeNull();
  });

  it("permite alterar senha com a senha atual correta e rejeita senha fraca ou errada", async () => {
    const p = new ProvedorAutenticacaoDemo({ senha: "senhaAntiga123", segredo: "k" });
    await expect(p.alterarSenha("demo-gestor", "senhaErrada", "novaSenha123")).rejects.toBeInstanceOf(ErroCredenciaisInvalidas);
    await expect(p.alterarSenha("demo-gestor", "senhaAntiga123", "curta")).rejects.toThrow(/mínimo 8 caracteres/);

    await p.alterarSenha("demo-gestor", "senhaAntiga123", "novaSenhaForte123");
    // Login com a senha antiga deve falhar
    await expect(p.entrar({ usuario: "gestor", senha: "senhaAntiga123", tenantId: "demonstracao" })).rejects.toBeInstanceOf(ErroCredenciaisInvalidas);
    // Login com a nova senha deve funcionar
    const sessao = await p.entrar({ usuario: "gestor", senha: "novaSenhaForte123", tenantId: "demonstracao" });
    expect(sessao.usuario.id).toBe("demo-gestor");
  });

  it("desativação de usuário impede login e invalida token existente; reativação restaura acesso", async () => {
    const p = new ProvedorAutenticacaoDemo({ senha: "segredo123", segredo: "k" });
    const sessaoAtiva = await p.entrar({ usuario: "comprador", senha: "segredo123", tenantId: "demonstracao" });
    expect(await p.validar(sessaoAtiva.token, "demonstracao")).not.toBeNull();

    // Desativa a conta
    await p.desativarUsuario("demo-comprador");

    // Novo login rejeitado por conta desativada
    await expect(p.entrar({ usuario: "comprador", senha: "segredo123", tenantId: "demonstracao" })).rejects.toBeInstanceOf(ErroUsuarioDesativado);

    // Token existente agora é invalidado (revogação imediata)
    expect(await p.validar(sessaoAtiva.token, "demonstracao")).toBeNull();

    // Reativa a conta
    await p.reativarUsuario("demo-comprador");
    const novaSessao = await p.entrar({ usuario: "comprador", senha: "segredo123", tenantId: "demonstracao" });
    expect(novaSessao.usuario.id).toBe("demo-comprador");
  });

  it("conta órfã gestor.demo não existe no provedor demo e não autentica", async () => {
    const p = new ProvedorAutenticacaoDemo({ senha: "demo", segredo: "k" });
    const lista = await p.listarUsuarios("carreiro");
    expect(lista.some((u) => u.usuario === "gestor.demo")).toBe(false);
    await expect(p.entrar({ usuario: "gestor.demo", senha: "demo", tenantId: "demonstracao" })).rejects.toBeInstanceOf(ErroCredenciaisInvalidas);
  });

  it("listarUsuarios('demonstracao') e listarUsuarios('demo') retornam usuários demo com sucesso", async () => {
    const p = new ProvedorAutenticacaoDemo({ senha: "demo", segredo: "k" });
    const listaDemonstracao = await p.listarUsuarios("demonstracao");
    expect(listaDemonstracao.length).toBeGreaterThanOrEqual(3);
    expect(listaDemonstracao.some((u) => u.usuario === "gestor")).toBe(true);
    expect(listaDemonstracao.some((u) => u.usuario === "admin")).toBe(true);
    expect(listaDemonstracao.some((u) => u.usuario === "comprador")).toBe(true);

    const listaDemo = await p.listarUsuarios("demo");
    expect(listaDemo.length).toBe(listaDemonstracao.length);
  });
});

describe("provedor supabase (GoTrue via fetch simulado)", () => {
  const cfg = { url: "https://proj.supabase.co", chavePublica: "pub", chaveServico: "srv" };
  const usuarioGoTrue = {
    id: "uuid-1",
    email: "gestor@empresa.com.br",
    app_metadata: { nome: "Gestora", papel: "GESTOR", tenant_id: "demonstracao", fornecedores: null },
  };

  function fetchSimulado(respostas: Record<string, { status: number; corpo: unknown }>) {
    const chamadas: Array<{ url: string; init: RequestInit }> = [];
    const fn = vi.fn(async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      const chave = Object.keys(respostas).find((k) => url.includes(k));
      const r = chave ? respostas[chave] : { status: 404, corpo: {} };
      return new Response(JSON.stringify(r.corpo), { status: r.status, headers: { "Content-Type": "application/json" } });
    });
    return { fn: fn as unknown as typeof fetch, chamadas };
  }

  it("login por senha usa a chave PÚBLICA e mapeia app_metadata", async () => {
    const { fn, chamadas } = fetchSimulado({
      "token?grant_type=password": { status: 200, corpo: { access_token: "at", refresh_token: "rt", expires_in: 3600, user: usuarioGoTrue } },
    });
    const p = new ProvedorAutenticacaoSupabase(cfg, fn);
    const s = await p.entrar({ usuario: "gestor", senha: "x", tenantId: "demonstracao" });
    expect(s.usuario).toMatchObject({ id: "uuid-1", nome: "Gestora", role: "GESTOR", tenantId: "demonstracao" });
    expect(s.tokenRenovacao).toBe("rt");
    const h = chamadas[0].init.headers as Record<string, string>;
    expect(h.apikey).toBe("pub");
    expect(h.Authorization).not.toContain("srv");
  });

  it("400 do GoTrue vira credenciais inválidas (sem vazar detalhe)", async () => {
    const { fn } = fetchSimulado({ "token?grant_type=password": { status: 400, corpo: { error_description: "Invalid login" } } });
    await expect(new ProvedorAutenticacaoSupabase(cfg, fn).entrar({ usuario: "abc", senha: "x", tenantId: "demonstracao" }))
      .rejects.toBeInstanceOf(ErroCredenciaisInvalidas);
  });

  it("conta de outro tenant: revoga e nega (403)", async () => {
    const { fn, chamadas } = fetchSimulado({
      "token?grant_type=password": { status: 200, corpo: { access_token: "at", user: { ...usuarioGoTrue, app_metadata: { ...usuarioGoTrue.app_metadata, tenant_id: "outra" } } } },
      logout: { status: 204, corpo: {} },
    });
    await expect(new ProvedorAutenticacaoSupabase(cfg, fn).entrar({ usuario: "abc", senha: "x", tenantId: "demonstracao" }))
      .rejects.toBeInstanceOf(ErroAcessoNegado);
    expect(chamadas.some((c) => c.url.endsWith("/auth/v1/logout"))).toBe(true);
  });

  it("validar: 401 = null; falha de rede = null (falha fechada)", async () => {
    const { fn } = fetchSimulado({ "/user": { status: 401, corpo: {} } });
    expect(await new ProvedorAutenticacaoSupabase(cfg, fn).validar("token-invalido", "carreiro")).toBeNull();
    const quebrado = vi.fn(async () => { throw new Error("rede"); }) as unknown as typeof fetch;
    expect(await new ProvedorAutenticacaoSupabase(cfg, quebrado).validar("t", "carreiro")).toBeNull();
  });

  it("administração usa a chave PRIVILEGIADA e grava o perfil em app_metadata", async () => {
    const { fn, chamadas } = fetchSimulado({
      "admin/users": { status: 200, corpo: { ...usuarioGoTrue, created_at: "2026-09-09T00:00:00Z" } },
    });
    const p = new ProvedorAutenticacaoSupabase(cfg, fn);
    const criado = await p.criarUsuario({ usuario: "gestor", senha: "s", nome: "Gestora", papel: "GESTOR", tenantId: "demonstracao", fornecedores: null });
    expect(criado.papel).toBe("GESTOR");
    const h = chamadas[0].init.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer srv");
    const corpo = JSON.parse(String(chamadas[0].init.body));
    expect(corpo.app_metadata).toMatchObject({ papel: "GESTOR", tenant_id: "demonstracao" });
    expect(corpo.email_confirm).toBe(true);
  });

  it("sem chave privilegiada, administrar falha claramente", async () => {
    const p = new ProvedorAutenticacaoSupabase({ url: cfg.url, chavePublica: "pub" }, fetchSimulado({}).fn);
    await expect(p.listarUsuarios("carreiro")).rejects.toThrow(/SERVICE_ROLE/);
  });

  it("alterarSenha no Supabase valida senha antiga na pública e atualiza na chave de serviço", async () => {
    const { fn, chamadas } = fetchSimulado({
      "admin/users/uuid-1": { status: 200, corpo: usuarioGoTrue },
      "token?grant_type=password": { status: 200, corpo: { access_token: "at", user: usuarioGoTrue } },
    });
    const p = new ProvedorAutenticacaoSupabase(cfg, fn);
    await p.alterarSenha("uuid-1", "senhaAntiga123", "novaSenhaSegura123");

    // Chamou admin/users/uuid-1 GET para descobrir email
    expect(chamadas[0].url).toContain("admin/users/uuid-1");
    // Chamou token?grant_type=password com apikey pública
    const hToken = chamadas[1].init.headers as Record<string, string>;
    expect(hToken.apikey).toBe("pub");
    // Chamou admin/users/uuid-1 PUT com chave de serviço
    expect(chamadas[2].init.method).toBe("PUT");
    const hUpdate = chamadas[2].init.headers as Record<string, string>;
    expect(hUpdate.Authorization).toBe("Bearer srv");
    expect(JSON.parse(String(chamadas[2].init.body))).toEqual({ password: "novaSenhaSegura123" });
  });

  it("desativarUsuario no Supabase aplica banimento e marca app_metadata.desativado", async () => {
    const { fn, chamadas } = fetchSimulado({
      "admin/users/uuid-1": { status: 200, corpo: usuarioGoTrue },
    });
    const p = new ProvedorAutenticacaoSupabase(cfg, fn);
    await p.desativarUsuario("uuid-1");

    const putChamada = chamadas.find((c) => c.init.method === "PUT");
    expect(putChamada).toBeDefined();
    const corpo = JSON.parse(String(putChamada!.init.body));
    expect(corpo.ban_duration).toBe("876600h");
    expect(corpo.app_metadata.desativado).toBe(true);
  });

  it("expurgarContaOrfaGestorDemo e listarUsuarios limpam e ignoram gestor.demo", async () => {
    const usuarioOrfao = {
      id: "uuid-orfao",
      email: "gestor.demo@carreiro.invalid",
      app_metadata: { usuario: "gestor.demo", papel: "GESTOR", tenant_id: "carreiro" },
    };
    const { fn, chamadas } = fetchSimulado({
      "admin/users?page=1&per_page=1000": { status: 200, corpo: { users: [usuarioGoTrue, usuarioOrfao] } },
      "admin/users/uuid-orfao": { status: 200, corpo: {} },
    });
    const p = new ProvedorAutenticacaoSupabase(cfg, fn);
    // O usuário válido do fixture pertence à demonstração; a conta órfã é que
    // aponta para um cliente real.
    const lista = await p.listarUsuarios("demonstracao");

    // gestor.demo não aparece na lista final
    expect(lista.some((u) => u.usuario === "gestor.demo")).toBe(false);
    expect(lista.length).toBe(1);
    expect(lista[0].usuario).toBe("gestor");

    // Enviou DELETE para o ID da conta órfã
    const deleteChamada = chamadas.find((c) => c.init.method === "DELETE");
    expect(deleteChamada?.url).toContain("admin/users/uuid-orfao");
  });
});

describe("contas de demonstração só valem no tenant de DEMONSTRAÇÃO", () => {
  const envOriginal = { ...process.env };
  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...envOriginal };
  });

  it("entra no mostruário, esteja em produção ou não", async () => {
    delete process.env.TENANT_ATIVO;
    vi.stubEnv("NODE_ENV", "production");
    const sessao = await new ProvedorAutenticacaoDemo().entrar({
      usuario: "gestor",
      senha: "demo",
      tenantId: "demonstracao",
    });
    expect(sessao.usuario.role).toBe("GESTOR");
  });

  it("NÃO entra na instalação de um cliente, mesmo fora de produção", async () => {
    // O risco nunca foi "produção": era a instalação de um CLIENTE subir com
    // contas internas de senha "demo" porque a variável do Supabase faltou.
    process.env.TENANT_ATIVO = "carreiro";
    vi.stubEnv("NODE_ENV", "development");
    await expect(
      new ProvedorAutenticacaoDemo().entrar({
        usuario: "gestor",
        senha: "demo",
        tenantId: "carreiro",
      })
    ).rejects.toThrow(/não entram na instalação de um cliente/);
  });
});

describe("fábrica", () => {
  const envOriginal = { ...process.env };
  beforeEach(() => {
    process.env = { ...envOriginal };
    delete process.env.AUTH_PROVIDER;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    limparInstanciasProvedores();
  });

  it("sem env: demo; com chaves supabase: supabase; AUTH_PROVIDER manda", () => {
    expect(idProvedorConfigurado()).toBe("demo");
    process.env.SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_ANON_KEY = "pub";
    expect(idProvedorConfigurado()).toBe("supabase");
    process.env.AUTH_PROVIDER = "demo";
    expect(idProvedorConfigurado()).toBe("demo");
    expect(obterProvedorAutenticacao().id).toBe("demo");
  });

  it("pedir supabase sem chaves falha com mensagem clara", () => {
    expect(() => obterProvedorAutenticacao("supabase")).toThrow(/SUPABASE_URL/);
  });
});

describe("nome de usuário (a plataforma não pede e-mail)", () => {
  it("aceita o formato combinado e recusa o resto", () => {
    expect(normalizarNomeUsuario("Carlos.Eduardo")).toBe("carlos.eduardo");
    expect(normalizarNomeUsuario("  JOÃO_1 ")).toBe("joao_1");
    expect(normalizarNomeUsuario("ab")).toBeNull(); // curto demais
    expect(normalizarNomeUsuario("com espaço")).toBeNull();
    expect(normalizarNomeUsuario("com@arroba")).toBeNull();
    expect(normalizarNomeUsuario(".comecaComPonto")).toBeNull();
    expect(normalizarNomeUsuario(null)).toBeNull();
  });

  it("o e-mail interno usa domínio reservado, para ninguém tentar escrever nele", () => {
    expect(emailInternoDoUsuario("carlos", "carreiro")).toBe("carlos@carreiro.invalid");
  });

  it("nome fora do padrão é credencial inválida, não erro de formato", async () => {
    const provedor = new ProvedorAutenticacaoDemo({ senha: "s", segredo: "k" });
    await expect(
      provedor.entrar({ usuario: "x", senha: "s", tenantId: "demonstracao" })
    ).rejects.toBeInstanceOf(ErroCredenciaisInvalidas);
  });
});

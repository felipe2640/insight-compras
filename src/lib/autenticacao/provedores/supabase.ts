/**
 * Provedor SUPABASE (GoTrue) — fetch puro, sem SDK. Edge-safe.
 * Camada: Aplicação (src/lib/autenticacao/provedores).
 *
 * Onde mora o perfil: em `app_metadata` do usuário (só a chave privilegiada
 * escreve — o próprio usuário NÃO consegue se promover, diferente de
 * `user_metadata`). Campos: nome, papel, tenant_id, fornecedores.
 *
 * Env:
 *   SUPABASE_URL              (obrigatória)
 *   SUPABASE_ANON_KEY         chave pública — login por senha e validação
 *   SUPABASE_SERVICE_ROLE_KEY chave privilegiada — SÓ administração (server)
 */

import type { UsuarioAutenticado } from "@/lib/rbac/tipos";
import { ErroAcessoNegado } from "@/lib/rbac/tipos";
import {
  AdministradorUsuarios,
  CredenciaisLogin,
  ErroCredenciaisInvalidas,
  ErroProvedorIndisponivel,
  NovoUsuario,
  ProvedorAutenticacao,
  SessaoAutenticada,
  UsuarioCadastrado,
  montarUsuarioAutenticado,
  normalizarFornecedores,
  normalizarPapel,
  normalizarNomeUsuario,
  emailInternoDoUsuario,
} from "../porta";

export interface ConfiguracaoSupabaseAuth {
  readonly url: string;
  readonly chavePublica: string;
  readonly chaveServico?: string;
}

interface UsuarioGoTrue {
  id: string;
  email?: string;
  created_at?: string;
  banned_until?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

interface RespostaToken {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  user?: UsuarioGoTrue;
}

export function lerConfiguracaoSupabaseAuth(): ConfiguracaoSupabaseAuth | null {
  const url = process.env.SUPABASE_URL;
  const chavePublica = process.env.SUPABASE_ANON_KEY;
  if (!url || !chavePublica) return null;
  return { url: url.replace(/\/+$/, ""), chavePublica, chaveServico: process.env.SUPABASE_SERVICE_ROLE_KEY };
}

export function supabaseAuthConfigurado(): boolean {
  return lerConfiguracaoSupabaseAuth() !== null;
}

function mapearUsuario(u: UsuarioGoTrue, tenantId: string): UsuarioAutenticado | null {
  const meta = u.app_metadata ?? {};
  if (meta.desativado === true || u.banned_until) return null;
  return montarUsuarioAutenticado(
    {
      id: u.id,
      // O nome de usuário mora em app_metadata: só a chave privilegiada escreve
      // lá, então ninguém troca a própria identidade.
      usuario: String(meta.usuario ?? (u.email ?? "").split("@")[0] ?? ""),
      nome: meta.nome ?? u.user_metadata?.nome,
      papel: meta.papel,
      tenantId: meta.tenant_id,
      fornecedores: meta.fornecedores,
    },
    tenantId
  );
}

// Cache curto da validação: uma chamada ao GoTrue por token a cada 60 s, não por requisição.
const cacheValidacao = new Map<string, { ate: number; usuario: UsuarioAutenticado | null }>();
const TTL_VALIDACAO_MS = 60_000;

export class ProvedorAutenticacaoSupabase implements ProvedorAutenticacao, AdministradorUsuarios {
  readonly id = "supabase" as const;

  constructor(private readonly cfg: ConfiguracaoSupabaseAuth, private readonly fetchFn: typeof fetch = fetch) {}

  private async auth(caminho: string, init: RequestInit, chave: string): Promise<Response> {
    return this.fetchFn(`${this.cfg.url}/auth/v1/${caminho}`, {
      ...init,
      headers: {
        apikey: chave,
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
        ...(init.headers as Record<string, string> | undefined),
      },
      cache: "no-store",
    });
  }

  private montarSessao(r: RespostaToken, tenantId: string): SessaoAutenticada | null {
    if (!r.user) return null;
    const usuario = mapearUsuario(r.user, tenantId);
    if (!usuario) return null;
    const expiraEm = r.expires_at
      ? r.expires_at * 1000
      : Date.now() + (r.expires_in ?? 3600) * 1000;
    return { provedor: "supabase", usuario, token: r.access_token, tokenRenovacao: r.refresh_token ?? null, expiraEm };
  }

  async entrar(credenciais: CredenciaisLogin): Promise<SessaoAutenticada> {
    const usuario = normalizarNomeUsuario(credenciais.usuario);
    // Nome fora do padrão nem chega ao provedor: é credencial inválida, e dizer
    // "formato errado" entregaria de graça quais nomes existem.
    if (!usuario) throw new ErroCredenciaisInvalidas();

    let res: Response;
    try {
      res = await this.auth(
        "token?grant_type=password",
        {
          method: "POST",
          body: JSON.stringify({
            email: emailInternoDoUsuario(usuario, credenciais.tenantId),
            password: credenciais.senha,
          }),
        },
        this.cfg.chavePublica
      );
    } catch (erro) {
      throw new ErroProvedorIndisponivel("supabase", erro instanceof Error ? erro.message : String(erro));
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new ErroCredenciaisInvalidas();
    }
    if (!res.ok) {
      throw new ErroProvedorIndisponivel("supabase", `${res.status} ${await res.text()}`);
    }
    const corpo = (await res.json()) as RespostaToken;
    const sessao = this.montarSessao(corpo, credenciais.tenantId);
    if (!sessao) {
      // Conta existe mas não pertence a este tenant / sem papel: revoga e nega.
      await this.sair(corpo.access_token);
      throw new ErroAcessoNegado("Usuário sem perfil válido para esta organização.");
    }
    cacheValidacao.set(sessao.token, { ate: Date.now() + TTL_VALIDACAO_MS, usuario: sessao.usuario });
    return sessao;
  }

  async validar(token: string, tenantId: string): Promise<UsuarioAutenticado | null> {
    const chaveCache = `${tenantId}|${token}`;
    const emCache = cacheValidacao.get(chaveCache);
    if (emCache && emCache.ate > Date.now()) return emCache.usuario;

    let usuario: UsuarioAutenticado | null = null;
    try {
      const res = await this.auth("user", { method: "GET", headers: { Authorization: `Bearer ${token}` } }, this.cfg.chavePublica);
      if (res.ok) usuario = mapearUsuario((await res.json()) as UsuarioGoTrue, tenantId);
    } catch (erro) {
      console.warn("[autenticacao] supabase indisponível ao validar sessão:", erro);
      return null; // falha fechada
    }
    if (cacheValidacao.size > 1000) cacheValidacao.clear();
    cacheValidacao.set(chaveCache, { ate: Date.now() + TTL_VALIDACAO_MS, usuario });
    return usuario;
  }

  async renovar(tokenRenovacao: string, tenantId: string): Promise<SessaoAutenticada | null> {
    try {
      const res = await this.auth(
        "token?grant_type=refresh_token",
        { method: "POST", body: JSON.stringify({ refresh_token: tokenRenovacao }) },
        this.cfg.chavePublica
      );
      if (!res.ok) return null;
      return this.montarSessao((await res.json()) as RespostaToken, tenantId);
    } catch {
      return null;
    }
  }

  async sair(token: string): Promise<void> {
    try {
      await this.auth("logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }, this.cfg.chavePublica);
    } catch {
      // revogação é melhor esforço; o cookie some de qualquer jeito
    }
    for (const chave of Array.from(cacheValidacao.keys())) {
      if (chave.endsWith(`|${token}`)) cacheValidacao.delete(chave);
    }
  }

  // ------------------------------------------------------------------
  // Administração (chave privilegiada)
  // ------------------------------------------------------------------

  private chaveServico(): string {
    if (!this.cfg.chaveServico) {
      throw new ErroProvedorIndisponivel("supabase", "SUPABASE_SERVICE_ROLE_KEY ausente para administrar usuários.");
    }
    return this.cfg.chaveServico;
  }

  private mapearCadastrado(u: UsuarioGoTrue): UsuarioCadastrado | null {
    const meta = u.app_metadata ?? {};
    const papel = normalizarPapel(meta.papel);
    if (!papel || typeof meta.tenant_id !== "string") return null;
    const ativo = meta.desativado !== true && !u.banned_until;
    return {
      id: u.id,
      usuario: String(meta.usuario ?? (u.email ?? "").split("@")[0] ?? ""),
      nome: typeof meta.nome === "string" ? meta.nome : String(meta.usuario ?? ""),
      papel,
      tenantId: meta.tenant_id,
      fornecedores: normalizarFornecedores(meta.fornecedores),
      criadoEm: u.created_at ?? "",
      ativo,
    };
  }

  async criarUsuario(novo: NovoUsuario): Promise<UsuarioCadastrado> {
    const usuarioNormalizado = normalizarNomeUsuario(novo.usuario);
    if (!usuarioNormalizado) {
      throw new ErroProvedorIndisponivel(
        "supabase",
        "nome de usuário inválido: use de 3 a 30 caracteres, minúsculas, números, ponto, hífen ou sublinhado."
      );
    }

    const res = await this.auth(
      "admin/users",
      {
        method: "POST",
        body: JSON.stringify({
          email: emailInternoDoUsuario(usuarioNormalizado, novo.tenantId),
          password: novo.senha,
          email_confirm: true,
          app_metadata: {
            usuario: usuarioNormalizado,
            nome: novo.nome,
            papel: novo.papel,
            tenant_id: novo.tenantId,
            fornecedores: novo.fornecedores,
          },
          user_metadata: { nome: novo.nome },
        }),
      },
      this.chaveServico()
    );
    if (!res.ok) throw new ErroProvedorIndisponivel("supabase", `criar usuário: ${res.status} ${await res.text()}`);
    const cadastrado = this.mapearCadastrado((await res.json()) as UsuarioGoTrue);
    if (!cadastrado) throw new ErroProvedorIndisponivel("supabase", "usuário criado sem perfil legível.");
    return cadastrado;
  }

  async alterarSenha(usuarioId: string, senhaAtual: string, novaSenha: string): Promise<void> {
    if (!novaSenha || novaSenha.length < 8) {
      throw new Error("A nova senha deve conter no mínimo 8 caracteres.");
    }

    // 1. Obter usuário pelo admin para descobrir o email interno
    const userRes = await this.auth(`admin/users/${usuarioId}`, { method: "GET" }, this.chaveServico());
    if (!userRes.ok) {
      throw new ErroProvedorIndisponivel("supabase", `obter usuário: ${userRes.status}`);
    }
    const user = (await userRes.json()) as UsuarioGoTrue;
    const email = user.email ?? emailInternoDoUsuario(
      String(user.app_metadata?.usuario ?? ""),
      String(user.app_metadata?.tenant_id ?? "")
    );

    // 2. Validar senha atual com a chave pública
    let tokenRes: Response;
    try {
      tokenRes = await this.auth(
        "token?grant_type=password",
        {
          method: "POST",
          body: JSON.stringify({
            email,
            password: senhaAtual,
          }),
        },
        this.cfg.chavePublica
      );
    } catch (erro) {
      throw new ErroProvedorIndisponivel("supabase", erro instanceof Error ? erro.message : String(erro));
    }
    if (tokenRes.status === 400 || tokenRes.status === 401 || tokenRes.status === 403) {
      throw new ErroCredenciaisInvalidas("Senha atual incorreta.");
    }
    if (!tokenRes.ok) {
      throw new ErroProvedorIndisponivel("supabase", `verificar senha: ${tokenRes.status}`);
    }

    // 3. Atualizar para a nova senha via chave privilegiada
    const updateRes = await this.auth(
      `admin/users/${usuarioId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          password: novaSenha,
        }),
      },
      this.chaveServico()
    );
    if (!updateRes.ok) {
      throw new ErroProvedorIndisponivel("supabase", `atualizar senha: ${updateRes.status} ${await updateRes.text()}`);
    }
  }

  async desativarUsuario(usuarioId: string): Promise<void> {
    const userRes = await this.auth(`admin/users/${usuarioId}`, { method: "GET" }, this.chaveServico());
    if (!userRes.ok) {
      throw new ErroProvedorIndisponivel("supabase", `obter usuário: ${userRes.status}`);
    }
    const user = (await userRes.json()) as UsuarioGoTrue;
    const metaAtual = user.app_metadata ?? {};

    const res = await this.auth(
      `admin/users/${usuarioId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          ban_duration: "876600h",
          app_metadata: {
            ...metaAtual,
            desativado: true,
          },
        }),
      },
      this.chaveServico()
    );
    if (!res.ok) {
      throw new ErroProvedorIndisponivel("supabase", `desativar usuário: ${res.status} ${await res.text()}`);
    }

    // Invalida cache de sessões ativas deste usuário
    for (const chave of Array.from(cacheValidacao.keys())) {
      const item = cacheValidacao.get(chave);
      if (item?.usuario?.id === usuarioId) {
        cacheValidacao.delete(chave);
      }
    }
  }

  async reativarUsuario(usuarioId: string): Promise<void> {
    const userRes = await this.auth(`admin/users/${usuarioId}`, { method: "GET" }, this.chaveServico());
    if (!userRes.ok) {
      throw new ErroProvedorIndisponivel("supabase", `obter usuário: ${userRes.status}`);
    }
    const user = (await userRes.json()) as UsuarioGoTrue;
    const metaAtual = { ...(user.app_metadata ?? {}) };
    delete metaAtual.desativado;

    const res = await this.auth(
      `admin/users/${usuarioId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          ban_duration: "none",
          app_metadata: metaAtual,
        }),
      },
      this.chaveServico()
    );
    if (!res.ok) {
      throw new ErroProvedorIndisponivel("supabase", `reativar usuário: ${res.status} ${await res.text()}`);
    }
  }

  /**
   * Remove ou migra contas órfãs antigas que usavam o formato legado (ex: gestor.demo).
   */
  async expurgarContaOrfaGestorDemo(): Promise<{ removidos: number }> {
    const res = await this.auth("admin/users?page=1&per_page=1000", { method: "GET" }, this.chaveServico());
    if (!res.ok) return { removidos: 0 };
    const corpo = (await res.json()) as { users?: UsuarioGoTrue[] };
    let removidos = 0;
    for (const u of corpo.users ?? []) {
      const usuarioStr = String(u.app_metadata?.usuario ?? (u.email ?? "").split("@")[0] ?? "");
      if (usuarioStr === "gestor.demo" || u.email?.startsWith("gestor.demo")) {
        await this.auth(`admin/users/${u.id}`, { method: "DELETE" }, this.chaveServico());
        removidos++;
      }
    }
    return { removidos };
  }

  async listarUsuarios(tenantId: string): Promise<UsuarioCadastrado[]> {
    const res = await this.auth("admin/users?page=1&per_page=1000", { method: "GET" }, this.chaveServico());
    if (!res.ok) throw new ErroProvedorIndisponivel("supabase", `listar usuários: ${res.status} ${await res.text()}`);
    const corpo = (await res.json()) as { users?: UsuarioGoTrue[] };
    const usuariosBrutos = corpo.users ?? [];

    // Limpeza automática da conta órfã gestor.demo se encontrada
    for (const u of usuariosBrutos) {
      const usuarioStr = String(u.app_metadata?.usuario ?? (u.email ?? "").split("@")[0] ?? "");
      if (usuarioStr === "gestor.demo" || u.email?.startsWith("gestor.demo")) {
        try {
          await this.auth(`admin/users/${u.id}`, { method: "DELETE" }, this.chaveServico());
        } catch {
          // Melhor esforço
        }
      }
    }

    return usuariosBrutos
      .filter((u) => {
        const usuarioStr = String(u.app_metadata?.usuario ?? (u.email ?? "").split("@")[0] ?? "");
        return usuarioStr !== "gestor.demo" && !u.email?.startsWith("gestor.demo");
      })
      .map((u) => this.mapearCadastrado(u))
      .filter((u): u is UsuarioCadastrado => u !== null && u.tenantId === tenantId);
  }
}

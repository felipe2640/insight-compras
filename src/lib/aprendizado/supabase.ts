/**
 * Cliente Supabase minimalista via PostgREST — fetch puro, sem dependência.
 * Camada: Aplicação (src/lib/aprendizado)
 * 100% em Português do Brasil (pt-BR).
 *
 * Guarda APENAS os dados leves do ciclo de aprendizado (snapshots, feedback,
 * confirmações, parâmetros). O dado pesado — grade, catálogo — nunca vem para cá.
 *
 * Env (somente servidor):
 *   SUPABASE_URL=https://<projeto>.supabase.co
 *   SUPABASE_ANON_KEY=...              (operações normais: JWT do usuário + RLS)
 *   SUPABASE_SERVICE_ROLE_KEY=...      (somente acesso privilegiado explícito)
 *
 * REGRA HERDADA DO DIÁRIO: sem env configurada, tudo vira no-op com aviso.
 * A exportação do cockpit NUNCA pode falhar por causa da captura do aprendizado.
 */

import { cookies } from "next/headers";
import { NOME_COOKIE_SESSAO, decodificarCookieSessao, sessaoExpirada } from "@/lib/autenticacao/sessao";

type Linha = Record<string, unknown>;

export interface OpcoesAcessoSupabase {
  /** O padrão é sempre o usuário autenticado e, portanto, sujeito a RLS. */
  readonly acesso?: "usuario" | "privilegiado";
  /** Injeção explícita para jobs/testes; rotas normais usam o cookie HttpOnly. */
  readonly tokenAcesso?: string;
}

export function supabaseConfigurado(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

export function tokenUsuarioAtual(tokenExplicito?: string): string {
  if (tokenExplicito) return tokenExplicito;
  const sessao = decodificarCookieSessao(cookies().get(NOME_COOKIE_SESSAO)?.value);
  if (!sessao || sessao.provedor !== "supabase" || sessaoExpirada(sessao, Date.now(), 0)) {
    throw new Error("Sessão Supabase ausente ou expirada para operação protegida por RLS.");
  }
  return sessao.token;
}

async function rest(
  caminho: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
  opcoes: OpcoesAcessoSupabase = {}
) {
  const url = process.env.SUPABASE_URL;
  const privilegiado = opcoes.acesso === "privilegiado";
  const chaveApi = privilegiado ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_ANON_KEY;
  if (!url || !chaveApi) {
    const variavel = privilegiado ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_ANON_KEY";
    throw new Error(`Supabase não configurado (SUPABASE_URL / ${variavel}).`);
  }
  const token = privilegiado ? chaveApi : tokenUsuarioAtual(opcoes.tokenAcesso);
  return fetch(`${url}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: chaveApi,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
}

async function falhar(operacao: string, tabela: string, res: Response): Promise<never> {
  throw new Error(`Supabase ${operacao} ${tabela} falhou: ${res.status} ${await res.text()}`);
}

export async function sbInserir<T extends Linha>(
  tabela: string,
  linhas: T | T[],
  opcoes: { retornar?: boolean } & OpcoesAcessoSupabase = {}
): Promise<Linha[] | null> {
  const res = await rest(tabela, {
    method: "POST",
    headers: { Prefer: opcoes.retornar ? "return=representation" : "return=minimal" },
    body: JSON.stringify(Array.isArray(linhas) ? linhas : [linhas]),
  }, opcoes);
  if (!res.ok) await falhar("insert", tabela, res);
  return opcoes.retornar ? ((await res.json()) as Linha[]) : null;
}

export async function sbSelecionar<T = Linha>(
  tabela: string,
  consulta: string,
  opcoes: OpcoesAcessoSupabase = {}
): Promise<T[]> {
  const res = await rest(`${tabela}?${consulta}`, { method: "GET" }, opcoes);
  if (!res.ok) await falhar("select", tabela, res);
  return (await res.json()) as T[];
}

/** Upsert atômico do PostgREST (ON CONFLICT) — exige índice único na coluna. */
export async function sbUpsert<T extends Linha>(
  tabela: string,
  colunaConflito: string,
  linhas: T | T[],
  opcoes: OpcoesAcessoSupabase = {}
): Promise<void> {
  const res = await rest(`${tabela}?on_conflict=${colunaConflito}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(Array.isArray(linhas) ? linhas : [linhas]),
  }, opcoes);
  if (!res.ok) await falhar("upsert", tabela, res);
}

export async function sbAtualizar(
  tabela: string,
  consulta: string,
  dados: Linha,
  opcoes: OpcoesAcessoSupabase = {}
): Promise<void> {
  const res = await rest(`${tabela}?${consulta}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(dados),
  }, opcoes);
  if (!res.ok) await falhar("update", tabela, res);
}

export async function sbExcluir(
  tabela: string,
  consulta: string,
  opcoes: OpcoesAcessoSupabase = {}
): Promise<void> {
  const res = await rest(`${tabela}?${consulta}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }, opcoes);
  if (!res.ok) await falhar("delete", tabela, res);
}

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
 *   SUPABASE_SERVICE_ROLE_KEY=...      (service role: as rotas são server-side)
 *
 * REGRA HERDADA DO DIÁRIO: sem env configurada, tudo vira no-op com aviso.
 * A exportação do cockpit NUNCA pode falhar por causa da captura do aprendizado.
 */

type Linha = Record<string, unknown>;

export function supabaseConfigurado(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function rest(caminho: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error("Supabase não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  return fetch(`${url}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
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
  opcoes: { retornar?: boolean } = {}
): Promise<Linha[] | null> {
  const res = await rest(tabela, {
    method: "POST",
    headers: { Prefer: opcoes.retornar ? "return=representation" : "return=minimal" },
    body: JSON.stringify(Array.isArray(linhas) ? linhas : [linhas]),
  });
  if (!res.ok) await falhar("insert", tabela, res);
  return opcoes.retornar ? ((await res.json()) as Linha[]) : null;
}

export async function sbSelecionar<T = Linha>(tabela: string, consulta: string): Promise<T[]> {
  const res = await rest(`${tabela}?${consulta}`, { method: "GET" });
  if (!res.ok) await falhar("select", tabela, res);
  return (await res.json()) as T[];
}

/** Upsert atômico do PostgREST (ON CONFLICT) — exige índice único na coluna. */
export async function sbUpsert<T extends Linha>(
  tabela: string,
  colunaConflito: string,
  linhas: T | T[]
): Promise<void> {
  const res = await rest(`${tabela}?on_conflict=${colunaConflito}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(Array.isArray(linhas) ? linhas : [linhas]),
  });
  if (!res.ok) await falhar("upsert", tabela, res);
}

export async function sbExcluir(tabela: string, consulta: string): Promise<void> {
  const res = await rest(`${tabela}?${consulta}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  if (!res.ok) await falhar("delete", tabela, res);
}

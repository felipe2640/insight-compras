/**
 * Fachada do repositório do ciclo de aprendizado + fábrica do provedor.
 * Camada: Aplicação (src/lib/aprendizado) — server-only.
 *
 * Seleção do provedor:
 *   APRENDIZADO_PROVIDER=supabase | memoria | nenhum   (explícito)
 *   ausente -> supabase se SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY existem, senão nenhum.
 *
 * REGRA HERDADA DO DIÁRIO: com "nenhum", tudo vira no-op com aviso — a
 * exportação do cockpit NUNCA falha por causa da captura do aprendizado.
 *
 * As rotas importam SÓ daqui; nunca de provedores/.
 */

import {
  ConfirmacaoEntrada,
  FeedbackEntrada,
  IdProvedorAprendizado,
  ItemComparativo,
  ItemParaConfirmar,
  LinhaCalibracaoDb,
  ParametrosPublicados,
  PublicacaoParametros,
  RepositorioAprendizado,
  ResultadoGravacaoSnapshot,
  SnapshotEntrada,
} from "./porta-repositorio";
import { supabaseConfigurado } from "./supabase";
import { RepositorioAprendizadoMemoria } from "./provedores/memoria";
import { RepositorioAprendizadoSupabase } from "./provedores/supabase";

export type {
  ItemSnapshotEntrada,
  SnapshotEntrada,
  ItemComparativo,
  ItemParaConfirmar,
  LinhaCalibracaoDb,
  ParametrosPublicados,
  RepositorioAprendizado,
  IdProvedorAprendizado,
} from "./porta-repositorio";

export function idProvedorAprendizado(): IdProvedorAprendizado {
  const forcado = process.env.APRENDIZADO_PROVIDER?.trim().toLowerCase();
  if (forcado === "memoria") return "memoria";
  if (forcado === "nenhum") return "nenhum";
  if (forcado === "supabase") return "supabase";
  return supabaseConfigurado() ? "supabase" : "nenhum";
}

export function aprendizadoConfigurado(): boolean {
  return idProvedorAprendizado() !== "nenhum";
}

let instanciaMemoria: RepositorioAprendizadoMemoria | null = null;
let instanciaSupabase: RepositorioAprendizadoSupabase | null = null;

export function obterRepositorioAprendizado(): RepositorioAprendizado | null {
  const id = idProvedorAprendizado();
  if (id === "memoria") return (instanciaMemoria ??= new RepositorioAprendizadoMemoria());
  if (id === "supabase") return (instanciaSupabase ??= new RepositorioAprendizadoSupabase());
  return null;
}

/** Só para testes. */
export function reiniciarRepositorioAprendizado(): void {
  instanciaMemoria = null;
  instanciaSupabase = null;
  cacheParametros.clear();
}

// ---------------------------------------------------------------------------
// Funções que as rotas usam (assinaturas estáveis, independentes do provedor)
// ---------------------------------------------------------------------------

export async function gravarSnapshot(entrada: SnapshotEntrada): Promise<ResultadoGravacaoSnapshot> {
  const repo = obterRepositorioAprendizado();
  if (!repo) return { gravado: false, motivo: "aprendizado_nao_configurado" };
  return repo.gravarSnapshot(entrada);
}

export async function listarComparativo(p: { tenantId: string; dias: number; filialId?: number; limite?: number }): Promise<ItemComparativo[]> {
  return (await obterRepositorioAprendizado()?.listarComparativo(p)) ?? [];
}

export async function gravarFeedback(entrada: FeedbackEntrada): Promise<void> {
  await obterRepositorioAprendizado()?.gravarFeedback(entrada);
}

export async function listarItensParaConfirmar(p: { tenantId: string; dias: number; limite?: number }): Promise<ItemParaConfirmar[]> {
  return (await obterRepositorioAprendizado()?.listarItensParaConfirmar(p)) ?? [];
}

export async function gravarConfirmacoes(tenantId: string, confirmacoes: readonly ConfirmacaoEntrada[]): Promise<void> {
  await obterRepositorioAprendizado()?.gravarConfirmacoes(tenantId, confirmacoes);
}

export async function listarLinhasCalibracao(p: { tenantId: string; dias: number }): Promise<LinhaCalibracaoDb[]> {
  return (await obterRepositorioAprendizado()?.listarLinhasCalibracao(p)) ?? [];
}

export async function publicarParametros(entrada: PublicacaoParametros): Promise<ParametrosPublicados> {
  const repo = obterRepositorioAprendizado();
  if (!repo) throw new Error("Ciclo de aprendizado não configurado: nada para publicar.");
  const publicado = await repo.publicarParametros(entrada);
  invalidarCacheParametros(entrada.tenantId);
  return publicado;
}

// Cache curto: o cockpit carrega a cada requisição e não pode bater no banco toda vez.
const cacheParametros = new Map<string, { ate: number; valor: ParametrosPublicados | null }>();
const TTL_CACHE_MS = 60_000;

export function invalidarCacheParametros(tenantId: string): void {
  cacheParametros.delete(tenantId);
}

/**
 * Última versão publicada para o tenant, ou null (usa o arquivo do tenant).
 * Nunca lança: falha de rede aqui não pode derrubar o cockpit.
 */
export async function carregarParametrosPublicados(tenantId: string): Promise<ParametrosPublicados | null> {
  const repo = obterRepositorioAprendizado();
  if (!repo) return null;
  const emCache = cacheParametros.get(tenantId);
  if (emCache && emCache.ate > Date.now()) return emCache.valor;
  try {
    const valor = await repo.carregarParametrosPublicados(tenantId);
    cacheParametros.set(tenantId, { ate: Date.now() + TTL_CACHE_MS, valor });
    return valor;
  } catch (erro) {
    console.warn("[aprendizado] falha ao carregar parâmetros publicados; usando o tenant.", erro);
    cacheParametros.set(tenantId, { ate: Date.now() + TTL_CACHE_MS, valor: null });
    return null;
  }
}

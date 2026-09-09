/**
 * Repositório do ciclo de aprendizado (Supabase / PostgREST).
 * Camada: Aplicação (src/lib/aprendizado) — server-only.
 *
 * Tudo é filtrado por tenant_id: vários clientes podem compartilhar o projeto.
 */

import { PerfilRotatividade } from "@core/dominio";
import {
  MotivoDivergencia,
  StatusConfirmacao,
  PropostaPerfil,
} from "@core/aprendizado";
import { sbInserir, sbSelecionar, sbUpsert, supabaseConfigurado } from "./supabase";

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export interface ItemSnapshotEntrada {
  readonly produtoId: number;
  readonly sku: string;
  readonly descricao: string;
  readonly filialId: number;
  readonly custo: number;
  readonly qtdComprador: number;
  readonly qtdTransferenciaComprador: number;
  readonly qtdModelo: number | null;
  readonly qtdTransferenciaModelo: number;
  readonly perfil: PerfilRotatividade;
  readonly consumoDiario: number;
  readonly horizonteDias: number;
  readonly margemAplicada: number;
  readonly fatorCalibracao: number;
  readonly previsaoBruta: number;
  readonly elegivel: boolean;
  readonly motivoInelegibilidade: string | null;
  readonly sinalGovernanca: string | null;
}

export interface SnapshotEntrada {
  readonly tenantId: string;
  readonly filialId: number;
  readonly usuario: string;
  readonly layoutId: string;
  readonly formato: string;
  readonly itens: readonly ItemSnapshotEntrada[];
}

export async function gravarSnapshot(
  entrada: SnapshotEntrada
): Promise<{ gravado: boolean; snapshotId?: number; motivo?: string }> {
  if (!supabaseConfigurado()) {
    return { gravado: false, motivo: "supabase_nao_configurado" };
  }

  const inserido = (await sbInserir(
    "aprendizado_snapshot",
    {
      tenant_id: entrada.tenantId,
      filial_id: entrada.filialId,
      usuario: entrada.usuario,
      layout_id: entrada.layoutId,
      formato: entrada.formato,
      n_itens: entrada.itens.length,
      app_version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? null,
    },
    { retornar: true }
  )) as Array<{ id: number }> | null;

  const snapshotId = inserido?.[0]?.id;
  if (!snapshotId) return { gravado: false, motivo: "snapshot_sem_id" };

  await sbInserir(
    "aprendizado_item",
    entrada.itens.map((i) => ({
      snapshot_id: snapshotId,
      tenant_id: entrada.tenantId,
      produto_id: i.produtoId,
      sku: i.sku,
      descricao: i.descricao,
      filial_id: i.filialId,
      custo: i.custo,
      qtd_comprador: i.qtdComprador,
      qtd_transferencia_comprador: i.qtdTransferenciaComprador,
      qtd_modelo: i.qtdModelo,
      qtd_transferencia_modelo: i.qtdTransferenciaModelo,
      perfil: i.perfil,
      consumo_diario: i.consumoDiario,
      horizonte_dias: i.horizonteDias,
      margem_aplicada: i.margemAplicada,
      fator_calibracao: i.fatorCalibracao,
      previsao_bruta: i.previsaoBruta,
      elegivel: i.elegivel,
      motivo_inelegibilidade: i.motivoInelegibilidade,
      sinal_governanca: i.sinalGovernanca,
    }))
  );

  return { gravado: true, snapshotId };
}

// ---------------------------------------------------------------------------
// Comparativo
// ---------------------------------------------------------------------------

export interface ItemComparativo {
  readonly id: number;
  readonly snapshotId: number;
  readonly exportadoEm: string;
  readonly usuario: string | null;
  readonly produtoId: number;
  readonly sku: string | null;
  readonly descricao: string | null;
  readonly filialId: number | null;
  readonly custo: number | null;
  readonly qtdComprador: number;
  readonly qtdModelo: number | null;
  readonly qtdTransferenciaComprador: number | null;
  readonly qtdTransferenciaModelo: number | null;
  readonly perfil: string | null;
  readonly elegivel: boolean;
  readonly motivoInelegibilidade: string | null;
  readonly sinalGovernanca: string | null;
  readonly feedback: { motivo: string; comentario: string | null; usuario: string | null } | null;
  readonly confirmacao: { status: StatusConfirmacao; qtdEntrada: number; qtdTransferida: number } | null;
}

interface LinhaItemDb {
  id: number;
  snapshot_id: number;
  produto_id: number;
  sku: string | null;
  descricao: string | null;
  filial_id: number | null;
  custo: number | null;
  qtd_comprador: number;
  qtd_modelo: number | null;
  qtd_transferencia_comprador: number | null;
  qtd_transferencia_modelo: number | null;
  perfil: string | null;
  elegivel: boolean;
  motivo_inelegibilidade: string | null;
  sinal_governanca: string | null;
  aprendizado_snapshot: { exportado_em: string; usuario: string | null } | null;
  aprendizado_feedback: Array<{ motivo: string; comentario: string | null; usuario: string | null }> | null;
  aprendizado_confirmacao: Array<{ status: StatusConfirmacao; qtd_entrada: number; qtd_transferida: number }> | null;
}

export async function listarComparativo(parametros: {
  tenantId: string;
  dias: number;
  filialId?: number;
  limite?: number;
}): Promise<ItemComparativo[]> {
  if (!supabaseConfigurado()) return [];
  const desde = new Date(Date.now() - parametros.dias * 86_400_000).toISOString();
  const filtroFilial = parametros.filialId ? `&filial_id=eq.${parametros.filialId}` : "";
  const limite = Math.min(5000, Math.max(1, parametros.limite ?? 2000));

  const linhas = await sbSelecionar<LinhaItemDb>(
    "aprendizado_item",
    `select=id,snapshot_id,produto_id,sku,descricao,filial_id,custo,qtd_comprador,qtd_modelo,` +
      `qtd_transferencia_comprador,qtd_transferencia_modelo,perfil,elegivel,motivo_inelegibilidade,sinal_governanca,` +
      `aprendizado_snapshot!inner(exportado_em,usuario),aprendizado_feedback(motivo,comentario,usuario),` +
      `aprendizado_confirmacao(status,qtd_entrada,qtd_transferida)` +
      `&tenant_id=eq.${encodeURIComponent(parametros.tenantId)}` +
      `&aprendizado_snapshot.exportado_em=gte.${desde}${filtroFilial}` +
      `&order=id.desc&limit=${limite}`
  );

  return linhas.map((l) => ({
    id: l.id,
    snapshotId: l.snapshot_id,
    exportadoEm: l.aprendizado_snapshot?.exportado_em ?? "",
    usuario: l.aprendizado_snapshot?.usuario ?? null,
    produtoId: Number(l.produto_id),
    sku: l.sku,
    descricao: l.descricao,
    filialId: l.filial_id,
    custo: l.custo === null ? null : Number(l.custo),
    qtdComprador: Number(l.qtd_comprador),
    qtdModelo: l.qtd_modelo === null ? null : Number(l.qtd_modelo),
    qtdTransferenciaComprador: l.qtd_transferencia_comprador === null ? null : Number(l.qtd_transferencia_comprador),
    qtdTransferenciaModelo: l.qtd_transferencia_modelo === null ? null : Number(l.qtd_transferencia_modelo),
    perfil: l.perfil,
    elegivel: Boolean(l.elegivel),
    motivoInelegibilidade: l.motivo_inelegibilidade,
    sinalGovernanca: l.sinal_governanca,
    feedback: l.aprendizado_feedback?.[0] ?? null,
    confirmacao: l.aprendizado_confirmacao?.[0]
      ? {
          status: l.aprendizado_confirmacao[0].status,
          qtdEntrada: Number(l.aprendizado_confirmacao[0].qtd_entrada),
          qtdTransferida: Number(l.aprendizado_confirmacao[0].qtd_transferida),
        }
      : null,
  }));
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export async function gravarFeedback(entrada: {
  tenantId: string;
  itemId: number;
  motivo: MotivoDivergencia;
  comentario: string | null;
  usuario: string;
}): Promise<void> {
  await sbUpsert("aprendizado_feedback", "item_id", {
    item_id: entrada.itemId,
    tenant_id: entrada.tenantId,
    motivo: entrada.motivo,
    comentario: entrada.comentario,
    usuario: entrada.usuario,
  });
}

// ---------------------------------------------------------------------------
// Confirmação de entrada
// ---------------------------------------------------------------------------

export interface ItemParaConfirmar {
  readonly id: number;
  readonly snapshotId: number;
  readonly exportadoEm: string;
  readonly produtoId: number;
  readonly filialId: number;
  readonly qtdPedida: number;
}

/** Itens elegíveis exportados na janela e ainda sem confirmação fechada. */
export async function listarItensParaConfirmar(parametros: {
  tenantId: string;
  dias: number;
  limite?: number;
}): Promise<ItemParaConfirmar[]> {
  if (!supabaseConfigurado()) return [];
  const desde = new Date(Date.now() - parametros.dias * 86_400_000).toISOString();
  const limite = Math.min(5000, parametros.limite ?? 3000);

  const linhas = await sbSelecionar<{
    id: number;
    snapshot_id: number;
    produto_id: number;
    filial_id: number | null;
    qtd_comprador: number;
    aprendizado_snapshot: { exportado_em: string } | null;
    aprendizado_confirmacao: Array<{ status: string }> | null;
  }>(
    "aprendizado_item",
    `select=id,snapshot_id,produto_id,filial_id,qtd_comprador,aprendizado_snapshot!inner(exportado_em),aprendizado_confirmacao(status)` +
      `&tenant_id=eq.${encodeURIComponent(parametros.tenantId)}&elegivel=eq.true` +
      `&aprendizado_snapshot.exportado_em=gte.${desde}&order=id.asc&limit=${limite}`
  );

  return linhas
    .filter((l) => l.filial_id !== null)
    .filter((l) => {
      const status = l.aprendizado_confirmacao?.[0]?.status;
      return !status || status === "aguardando";
    })
    .map((l) => ({
      id: l.id,
      snapshotId: l.snapshot_id,
      exportadoEm: l.aprendizado_snapshot?.exportado_em ?? "",
      produtoId: Number(l.produto_id),
      filialId: Number(l.filial_id),
      qtdPedida: Number(l.qtd_comprador),
    }));
}

export async function gravarConfirmacoes(
  tenantId: string,
  confirmacoes: readonly {
    itemId: number;
    janelaDias: number;
    qtdEntrada: number;
    qtdTransferida: number;
    status: StatusConfirmacao;
  }[]
): Promise<void> {
  if (confirmacoes.length === 0) return;
  await sbUpsert(
    "aprendizado_confirmacao",
    "item_id",
    confirmacoes.map((c) => ({
      item_id: c.itemId,
      tenant_id: tenantId,
      janela_dias: c.janelaDias,
      qtd_entrada: c.qtdEntrada,
      qtd_transferida: c.qtdTransferida,
      status: c.status,
      confirmado_em: new Date().toISOString(),
    }))
  );
}

// ---------------------------------------------------------------------------
// Calibração
// ---------------------------------------------------------------------------

export interface LinhaCalibracaoDb {
  readonly perfil: PerfilRotatividade;
  readonly consumoDiario: number;
  readonly horizonteDias: number;
  readonly margemAplicada: number;
  readonly fatorCalibracao: number;
  readonly suprimentoReal: number;
  readonly status: StatusConfirmacao;
}

/** Linhas de aprendizado = item elegível + confirmação fechada. */
export async function listarLinhasCalibracao(parametros: {
  tenantId: string;
  dias: number;
}): Promise<LinhaCalibracaoDb[]> {
  if (!supabaseConfigurado()) return [];
  const desde = new Date(Date.now() - parametros.dias * 86_400_000).toISOString();

  const linhas = await sbSelecionar<{
    perfil: string | null;
    consumo_diario: number | null;
    horizonte_dias: number | null;
    margem_aplicada: number | null;
    fator_calibracao: number | null;
    aprendizado_snapshot: { exportado_em: string } | null;
    aprendizado_confirmacao: Array<{ status: StatusConfirmacao; qtd_entrada: number; qtd_transferida: number }> | null;
  }>(
    "aprendizado_item",
    `select=perfil,consumo_diario,horizonte_dias,margem_aplicada,fator_calibracao,` +
      `aprendizado_snapshot!inner(exportado_em),aprendizado_confirmacao!inner(status,qtd_entrada,qtd_transferida)` +
      `&tenant_id=eq.${encodeURIComponent(parametros.tenantId)}&elegivel=eq.true` +
      `&aprendizado_snapshot.exportado_em=gte.${desde}&limit=20000`
  );

  return linhas
    .filter((l) => l.perfil && l.aprendizado_confirmacao?.[0])
    .map((l) => {
      const c = l.aprendizado_confirmacao![0];
      return {
        perfil: l.perfil as PerfilRotatividade,
        consumoDiario: Number(l.consumo_diario) || 0,
        horizonteDias: Number(l.horizonte_dias) || 0,
        margemAplicada: Number(l.margem_aplicada) || 0,
        fatorCalibracao: Number(l.fator_calibracao) || 1,
        suprimentoReal: Number(c.qtd_entrada) + Number(c.qtd_transferida),
        status: c.status,
      };
    });
}

export interface ParametrosPublicados {
  readonly versao: string;
  readonly margens: Readonly<Record<PerfilRotatividade, number>>;
  readonly fatorCalibracao: number;
  readonly publicadoPor: string | null;
  readonly criadoEm: string;
}

export async function publicarParametros(entrada: {
  tenantId: string;
  margens: Readonly<Record<PerfilRotatividade, number>>;
  fatorCalibracao: number;
  proposta: readonly PropostaPerfil[];
  usuario: string;
}): Promise<ParametrosPublicados> {
  const versao = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  await sbInserir("parametros_modelo", {
    tenant_id: entrada.tenantId,
    versao,
    margens: entrada.margens,
    fator_calibracao: entrada.fatorCalibracao,
    procedencia: entrada.proposta,
    publicado_por: entrada.usuario,
  });
  invalidarCacheParametros(entrada.tenantId);
  return {
    versao,
    margens: entrada.margens,
    fatorCalibracao: entrada.fatorCalibracao,
    publicadoPor: entrada.usuario,
    criadoEm: new Date().toISOString(),
  };
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
export async function carregarParametrosPublicados(
  tenantId: string
): Promise<ParametrosPublicados | null> {
  if (!supabaseConfigurado()) return null;
  const emCache = cacheParametros.get(tenantId);
  if (emCache && emCache.ate > Date.now()) return emCache.valor;

  try {
    const linhas = await sbSelecionar<{
      versao: string;
      margens: Record<PerfilRotatividade, number>;
      fator_calibracao: number;
      publicado_por: string | null;
      created_at: string;
    }>(
      "parametros_modelo",
      `select=versao,margens,fator_calibracao,publicado_por,created_at&tenant_id=eq.${encodeURIComponent(tenantId)}&order=created_at.desc&limit=1`
    );
    const l = linhas[0];
    const valor: ParametrosPublicados | null = l
      ? {
          versao: l.versao,
          margens: l.margens,
          fatorCalibracao: Number(l.fator_calibracao),
          publicadoPor: l.publicado_por,
          criadoEm: l.created_at,
        }
      : null;
    cacheParametros.set(tenantId, { ate: Date.now() + TTL_CACHE_MS, valor });
    return valor;
  } catch (erro) {
    console.warn("[aprendizado] falha ao carregar parâmetros publicados; usando o tenant.", erro);
    cacheParametros.set(tenantId, { ate: Date.now() + TTL_CACHE_MS, valor: null });
    return null;
  }
}

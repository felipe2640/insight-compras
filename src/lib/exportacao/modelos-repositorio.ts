/**
 * Persistência dos modelos de exportação.
 * Camada: Aplicação (src/lib/exportacao) — server-only.
 *
 * Mesma regra do ciclo de aprendizado: sem Supabase configurado, tudo vira
 * no-op. O cockpit continua exportando pelos modelos de fábrica do tenant; o
 * que se perde é a capacidade de salvar novos, e isso é dito na tela.
 */

import { sbSelecionar, sbUpsert, sbExcluir, supabaseConfigurado } from "@/lib/aprendizado/supabase";
import { ModeloExportacao } from "./modelos";
import { EscopoLinhasExportacao, FormatoExportacao, OpcoesCsv } from "./tipos";

const TABELA = "exportacao_modelo";

interface LinhaModeloDb {
  id: string;
  nome: string;
  escopo: string;
  formato: string;
  colunas: string[];
  rotulos: Record<string, string> | null;
  csv: Partial<OpcoesCsv> | null;
  nome_arquivo: string;
  titulo_pdf: string | null;
  criado_por: string | null;
  created_at: string;
}

export function modelosPersistidos(): boolean {
  return supabaseConfigurado();
}

export async function listarModelosSalvos(tenantId: string): Promise<ModeloExportacao[]> {
  if (!supabaseConfigurado()) return [];
  try {
    const linhas = await sbSelecionar<LinhaModeloDb>(
      TABELA,
      `select=*&tenant_id=eq.${encodeURIComponent(tenantId)}&order=nome.asc`
    );
    return linhas.map((l) => ({
      id: l.id,
      nome: l.nome,
      escopo: l.escopo as EscopoLinhasExportacao,
      formato: l.formato as FormatoExportacao,
      colunas: l.colunas ?? [],
      rotulosPersonalizados: l.rotulos ?? undefined,
      csv: l.csv ?? undefined,
      nomeArquivo: l.nome_arquivo,
      tituloPdf: l.titulo_pdf ?? undefined,
      deFabrica: false,
      criadoPor: l.criado_por,
      criadoEm: l.created_at,
    }));
  } catch (erro) {
    // Nunca derruba o cockpit: sem os salvos, sobram os de fábrica.
    console.warn("[exportacao] falha ao listar modelos salvos:", erro);
    return [];
  }
}

export async function salvarModelo(
  tenantId: string,
  modelo: ModeloExportacao,
  criadoPor: string | null
): Promise<void> {
  await sbUpsert(TABELA, "tenant_id,id", {
    tenant_id: tenantId,
    id: modelo.id,
    nome: modelo.nome,
    escopo: modelo.escopo,
    formato: modelo.formato,
    colunas: modelo.colunas,
    rotulos: modelo.rotulosPersonalizados ?? null,
    csv: modelo.csv ?? null,
    nome_arquivo: modelo.nomeArquivo,
    titulo_pdf: modelo.tituloPdf ?? null,
    criado_por: criadoPor,
  });
}

export async function excluirModelo(tenantId: string, id: string): Promise<void> {
  await sbExcluir(
    TABELA,
    `tenant_id=eq.${encodeURIComponent(tenantId)}&id=eq.${encodeURIComponent(id)}`
  );
}

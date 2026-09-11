/**
 * Persistência dos modelos de exportação.
 * Camada: Aplicação (src/lib/exportacao) — server-only.
 * 100% em Português do Brasil (pt-BR).
 *
 * Segue o padrão de portas e adaptadores:
 * 1. Provedor Supabase quando as variáveis de ambiente estiverem configuradas.
 * 2. Provedor em memória transparente como fallback declarado para modo demonstração,
 *    desenvolvimento local e esteira de testes sem variáveis de ambiente.
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

/**
 * Armazenamento em memória por tenant para modo demonstração e testes unitários/integrados.
 */
const modelosEmMemoria = new Map<string, Map<string, ModeloExportacao>>();

/**
 * Limpa todos os modelos em memória (utilitário para isolamento de testes).
 */
export function limparModelosMemoria(): void {
  modelosEmMemoria.clear();
}

/**
 * Declara se a capacidade de persistência de modelos está ativa na plataforma.
 * Sempre retorna true devido ao suporte de persistência em memória como fallback.
 */
export function modelosPersistidos(): boolean {
  return true;
}

export async function listarModelosSalvos(tenantId: string): Promise<ModeloExportacao[]> {
  if (supabaseConfigurado()) {
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
      console.warn("[exportacao] falha ao listar modelos salvos no Supabase, usando memória:", erro);
    }
  }

  // Fallback em memória
  const mapa = modelosEmMemoria.get(tenantId);
  if (!mapa) return [];
  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function salvarModelo(
  tenantId: string,
  modelo: ModeloExportacao,
  criadoPor: string | null
): Promise<void> {
  // Salva no banco de dados se configurado
  if (supabaseConfigurado()) {
    try {
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
    } catch (erro) {
      console.warn("[exportacao] falha ao salvar modelo no Supabase, mantendo em memória:", erro);
    }
  }

  // Sempre sincroniza o repositório em memória
  let mapa = modelosEmMemoria.get(tenantId);
  if (!mapa) {
    mapa = new Map<string, ModeloExportacao>();
    modelosEmMemoria.set(tenantId, mapa);
  }

  mapa.set(modelo.id, {
    ...modelo,
    criadoPor: criadoPor ?? modelo.criadoPor ?? null,
    criadoEm: modelo.criadoEm ?? new Date().toISOString(),
  });
}

export async function excluirModelo(tenantId: string, id: string): Promise<void> {
  if (supabaseConfigurado()) {
    try {
      await sbExcluir(
        TABELA,
        `tenant_id=eq.${encodeURIComponent(tenantId)}&id=eq.${encodeURIComponent(id)}`
      );
    } catch (erro) {
      console.warn("[exportacao] falha ao excluir modelo no Supabase:", erro);
    }
  }

  // Exclui do repositório em memória
  const mapa = modelosEmMemoria.get(tenantId);
  if (mapa) {
    mapa.delete(id);
  }
}

/**
 * Orquestrador de exportação: layout do cliente + formato → arquivo.
 * Camada: Aplicação (src/lib/exportacao)
 */

import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import { gerarCsv, OPCOES_CSV_PADRAO } from "./gerar-csv";
import { gerarPdf } from "./gerar-pdf";
import { gerarXlsx } from "./gerar-xlsx";
import { montarTabelaExportacao } from "./montar-tabela";
import {
  ArquivoExportado,
  ConfiguracaoExportacaoTenant,
  ContextoExportacao,
  FormatoExportacao,
  LayoutExportacao,
  OpcoesCsv,
} from "./tipos";

export const MIME_POR_FORMATO: Readonly<Record<FormatoExportacao, string>> = {
  csv: "text/csv;charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

/** Nome de arquivo seguro: sem acento, sem espaço, sem caractere proibido. */
export function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function dataIso(data: Date): string {
  const dd = String(data.getDate()).padStart(2, "0");
  const mm = String(data.getMonth() + 1).padStart(2, "0");
  return `${data.getFullYear()}-${mm}-${dd}`;
}

/** Resolve o padrão do tenant: {tenant} {loja} {data} {layout}. */
export function montarNomeArquivo(
  layout: LayoutExportacao,
  formato: FormatoExportacao,
  contexto: ContextoExportacao
): string {
  const base = layout.nomeArquivo
    .replace(/\{tenant\}/g, slugificar(contexto.tenantId))
    .replace(/\{loja\}/g, slugificar(contexto.nomeLoja))
    .replace(/\{data\}/g, dataIso(contexto.dataReferencia))
    .replace(/\{layout\}/g, slugificar(layout.id));
  // Os marcadores já vêm slugificados; aqui só se removem caracteres proibidos em
  // nome de arquivo, preservando o "-" da data (2026-09-09) e o "." do padrão.
  const seguro = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${seguro || "exportacao"}.${formato}`;
}

export interface ParametrosExportacao {
  readonly itens: readonly LinhaCockpitMatriz[];
  readonly layout: LayoutExportacao;
  readonly formato: FormatoExportacao;
  readonly contexto: ContextoExportacao;
  /** Subconjunto das colunas do layout escolhido pelo usuário na hora. */
  readonly colunasSelecionadas?: ReadonlySet<string> | readonly string[];
  /** Opções de CSV do tenant (o layout ainda pode sobrescrever). */
  readonly csvPadrao?: OpcoesCsv;
}

export async function gerarArquivoExportacao(
  parametros: ParametrosExportacao
): Promise<ArquivoExportado> {
  const { itens, layout, formato, contexto, colunasSelecionadas } = parametros;

  if (!layout.formatosPermitidos.includes(formato)) {
    throw new Error(
      `O layout "${layout.nome}" não permite o formato ${formato.toUpperCase()}.`
    );
  }

  const tabela = montarTabelaExportacao(itens, layout, colunasSelecionadas);
  const nomeArquivo = montarNomeArquivo(layout, formato, contexto);
  const opcoesCsv: OpcoesCsv = {
    ...OPCOES_CSV_PADRAO,
    ...(parametros.csvPadrao ?? {}),
    ...(layout.csv ?? {}),
  };

  switch (formato) {
    case "csv":
      return { nomeArquivo, mime: MIME_POR_FORMATO.csv, conteudo: gerarCsv(tabela, opcoesCsv) };
    case "xlsx":
      return {
        nomeArquivo,
        mime: MIME_POR_FORMATO.xlsx,
        conteudo: gerarXlsx(tabela, { nomePlanilha: layout.nome }),
      };
    case "pdf":
      return {
        nomeArquivo,
        mime: MIME_POR_FORMATO.pdf,
        conteudo: await gerarPdf(tabela, {
          titulo: layout.tituloPdf ?? layout.nome,
          contexto,
          separadorDecimal: opcoesCsv.separadorDecimal,
        }),
      };
  }
}

/** Dispara o download no navegador. Só funciona em ambiente com DOM. */
export function baixarArquivoNoNavegador(arquivo: ArquivoExportado): void {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("Download só é possível no navegador.");
  }
  const blob = new Blob([arquivo.conteudo as BlobPart], { type: arquivo.mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = arquivo.nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Layout padrão do tenant, com queda segura para o primeiro cadastrado. */
export function layoutPadraoDoTenant(cfg: ConfiguracaoExportacaoTenant): LayoutExportacao {
  return cfg.layouts.find((l) => l.id === cfg.layoutPadraoId) ?? cfg.layouts[0];
}

/**
 * Valida a configuração de exportação de um tenant: todo layout precisa
 * referenciar colunas que o catálogo conhece e permitir ao menos um formato.
 * Devolve a lista de problemas (vazia = válida).
 */
export function validarConfiguracaoExportacao(
  cfg: ConfiguracaoExportacaoTenant,
  idsConhecidos: ReadonlySet<string>
): string[] {
  const problemas: string[] = [];
  if (cfg.layouts.length === 0) problemas.push("Nenhum layout de exportação cadastrado.");
  if (!cfg.layouts.some((l) => l.id === cfg.layoutPadraoId)) {
    problemas.push(`layoutPadraoId "${cfg.layoutPadraoId}" não corresponde a nenhum layout.`);
  }
  for (const layout of cfg.layouts) {
    if (layout.formatosPermitidos.length === 0) {
      problemas.push(`Layout "${layout.id}" não permite nenhum formato.`);
    }
    if (layout.colunas.length === 0) {
      problemas.push(`Layout "${layout.id}" não tem colunas.`);
    }
    for (const id of layout.colunas) {
      if (!idsConhecidos.has(id)) {
        problemas.push(`Layout "${layout.id}" usa a coluna desconhecida "${id}".`);
      }
    }
    for (const id of Object.keys(layout.rotulosPersonalizados ?? {})) {
      if (!layout.colunas.includes(id)) {
        problemas.push(
          `Layout "${layout.id}" personaliza o rótulo de "${id}", que não está nas suas colunas.`
        );
      }
    }
  }
  return problemas;
}

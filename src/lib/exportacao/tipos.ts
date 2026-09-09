/**
 * Exportação Configurável por Cliente — Tipos
 * Camada: Aplicação (src/lib/exportacao)
 * 100% em Português do Brasil (pt-BR).
 *
 * POR QUE CONFIGURÁVEL:
 * O arquivo exportado vai para o ERP ou para o fornecedor DO CLIENTE, e cada um
 * exige colunas, nomes e formatos próprios. O que é base: o motor que monta a
 * tabela e gera CSV/XLSX/PDF. O que é do cliente: quais colunas, com que rótulo,
 * em que ordem, com que separador e com que nome de arquivo — tudo no tenant.
 */

import { LinhaCockpitMatriz } from "@/tipos/cockpit";

export type FormatoExportacao = "csv" | "xlsx" | "pdf";

/** Como o valor da coluna deve ser formatado no arquivo. */
export type TipoValorColuna =
  | "texto"
  | "inteiro"
  | "decimal"
  | "moeda"
  | "percentual"
  | "data";

/**
 * Quais linhas entram no arquivo.
 * - compra: só itens com quantidade de pedido > 0
 * - transferencia: só itens com quantidade de transferência > 0
 * - compra_ou_transferencia: qualquer ação
 * - todos: tudo que está na grade (análise completa)
 */
export type EscopoLinhasExportacao =
  | "compra"
  | "transferencia"
  | "compra_ou_transferencia"
  | "todos";

/** Uma coluna que a plataforma sabe exportar. O catálogo é a base comum. */
export interface ColunaExportavel {
  readonly id: string;
  readonly rotulo: string;
  readonly tipo: TipoValorColuna;
  /** Agrupamento na interface de configuração (ex.: "Produto", "Decisão"). */
  readonly grupo: string;
  readonly extrair: (item: LinhaCockpitMatriz) => string | number | null | undefined;
}

export interface OpcoesCsv {
  readonly separador: ";" | "," | "\t";
  readonly separadorDecimal: "," | ".";
  /** BOM UTF-8 no início: necessário para o Excel pt-BR abrir acentos corretamente. */
  readonly incluirBom: boolean;
  readonly quebraLinha: "\r\n" | "\n";
}

/** Um layout de exportação definido pelo cliente. */
export interface LayoutExportacao {
  readonly id: string;
  readonly nome: string;
  readonly descricao?: string;
  readonly escopo: EscopoLinhasExportacao;
  /** IDs do catálogo, NA ORDEM em que devem sair no arquivo. */
  readonly colunas: readonly string[];
  readonly formatosPermitidos: readonly FormatoExportacao[];
  /** Sobrescreve o rótulo do catálogo — o ERP do cliente pode exigir "COD_PROD". */
  readonly rotulosPersonalizados?: Readonly<Record<string, string>>;
  /** Sobrescreve as opções de CSV padrão do tenant só para este layout. */
  readonly csv?: Partial<OpcoesCsv>;
  /**
   * Padrão do nome do arquivo, sem extensão. Marcadores:
   * {tenant} {loja} {data} {layout}
   */
  readonly nomeArquivo: string;
  /** Título impresso no cabeçalho do PDF. */
  readonly tituloPdf?: string;
}

export interface ConfiguracaoExportacaoTenant {
  readonly layouts: readonly LayoutExportacao[];
  readonly layoutPadraoId: string;
  readonly formatoPadrao: FormatoExportacao;
  readonly csvPadrao: OpcoesCsv;
}

/** Tabela já resolvida: pronta para virar qualquer formato. */
export interface TabelaExportacao {
  readonly cabecalhos: readonly string[];
  readonly tipos: readonly TipoValorColuna[];
  readonly linhas: ReadonlyArray<ReadonlyArray<string | number | null>>;
}

/** Contexto impresso em nomes de arquivo e cabeçalhos de PDF. */
export interface ContextoExportacao {
  readonly tenantId: string;
  readonly nomeTenant: string;
  readonly filialId: number;
  readonly nomeLoja: string;
  readonly dataReferencia: Date;
  readonly usuario?: string;
}

export interface ArquivoExportado {
  readonly nomeArquivo: string;
  readonly mime: string;
  /** string para CSV; bytes para XLSX e PDF. */
  readonly conteudo: string | Uint8Array;
}

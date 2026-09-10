/**
 * Modelos de exportação salvos — parte pura.
 * Camada: Aplicação (src/lib/exportacao). Sem React, sem banco.
 *
 * O comprador exporta a mesma coisa todo dia. Escolher layout, formato e
 * colunas a cada vez é atrito puro: o que ele quer é um botão que já faz o que
 * ele sempre faz. Um MODELO é essa escolha congelada, com nome.
 *
 * Os layouts do arquivo do tenant continuam existindo como modelos de fábrica:
 * chegam prontos no primeiro dia e não podem ser apagados. O que o usuário cria
 * fica salvo por cliente e aparece ao lado deles.
 */

import {
  ConfiguracaoExportacaoTenant,
  EscopoLinhasExportacao,
  FormatoExportacao,
  LayoutExportacao,
  OpcoesCsv,
} from "./tipos";

export interface ModeloExportacao {
  readonly id: string;
  readonly nome: string;
  readonly escopo: EscopoLinhasExportacao;
  readonly colunas: readonly string[];
  /** Formato que o botão usa direto, sem perguntar. */
  readonly formato: FormatoExportacao;
  readonly rotulosPersonalizados?: Readonly<Record<string, string>>;
  readonly csv?: Partial<OpcoesCsv>;
  readonly nomeArquivo: string;
  readonly tituloPdf?: string;
  /** true = veio do arquivo do tenant e não pode ser apagado. */
  readonly deFabrica: boolean;
  readonly criadoPor?: string | null;
  readonly criadoEm?: string | null;
}

export const ESCOPOS_VALIDOS: readonly EscopoLinhasExportacao[] = [
  "compra",
  "transferencia",
  "compra_ou_transferencia",
  "todos",
];

export const FORMATOS_VALIDOS: readonly FormatoExportacao[] = ["csv", "xlsx", "pdf"];

/** Identificador estável a partir do nome que a pessoa digitou. */
export function idDoModelo(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || "modelo";
}

/** Modelos de fábrica: os layouts do arquivo do tenant. */
export function modelosDeFabrica(cfg: ConfiguracaoExportacaoTenant): ModeloExportacao[] {
  return cfg.layouts.map((l) => ({
    id: l.id,
    nome: l.nome,
    escopo: l.escopo,
    colunas: l.colunas,
    // O formato do botão é o primeiro permitido, com preferência pelo padrão do
    // tenant quando ele estiver na lista.
    formato: l.formatosPermitidos.includes(cfg.formatoPadrao)
      ? cfg.formatoPadrao
      : l.formatosPermitidos[0],
    rotulosPersonalizados: l.rotulosPersonalizados,
    csv: l.csv,
    nomeArquivo: l.nomeArquivo,
    tituloPdf: l.tituloPdf,
    deFabrica: true,
  }));
}

/** Vira um layout para o gerador de arquivo, que não conhece modelos. */
export function layoutDoModelo(modelo: ModeloExportacao): LayoutExportacao {
  return {
    id: modelo.id,
    nome: modelo.nome,
    escopo: modelo.escopo,
    colunas: modelo.colunas,
    // O modelo já decidiu o formato; permitir só ele evita exportar em algo que
    // o layout do cliente não aceita.
    formatosPermitidos: [modelo.formato],
    rotulosPersonalizados: modelo.rotulosPersonalizados,
    csv: modelo.csv,
    nomeArquivo: modelo.nomeArquivo,
    tituloPdf: modelo.tituloPdf,
  };
}

/**
 * Junta fábrica e salvos. Um modelo salvo com o mesmo id substitui o de fábrica:
 * é o cliente ajustando o padrão que veio de casa.
 */
export function mesclarModelos(
  fabrica: readonly ModeloExportacao[],
  salvos: readonly ModeloExportacao[]
): ModeloExportacao[] {
  const porId = new Map<string, ModeloExportacao>();
  for (const m of fabrica) porId.set(m.id, m);
  for (const m of salvos) {
    const anterior = porId.get(m.id);
    // Sobrescrever um de fábrica mantém a marca: ele continua não podendo sumir.
    porId.set(m.id, anterior?.deFabrica ? { ...m, deFabrica: true } : m);
  }
  return Array.from(porId.values());
}

export interface ErroValidacaoModelo {
  readonly campo: string;
  readonly mensagem: string;
}

/** Valida o que veio da tela ou da API antes de salvar. */
export function validarModelo(
  candidato: Partial<ModeloExportacao>,
  colunasConhecidas: readonly string[]
): ErroValidacaoModelo[] {
  const erros: ErroValidacaoModelo[] = [];

  const nome = (candidato.nome ?? "").trim();
  if (nome.length < 3) {
    erros.push({ campo: "nome", mensagem: "Dê um nome de ao menos 3 letras ao modelo." });
  }
  if (nome.length > 60) {
    erros.push({ campo: "nome", mensagem: "O nome do modelo passa de 60 caracteres." });
  }

  if (!candidato.escopo || !ESCOPOS_VALIDOS.includes(candidato.escopo)) {
    erros.push({ campo: "escopo", mensagem: "Escopo desconhecido." });
  }

  if (!candidato.formato || !FORMATOS_VALIDOS.includes(candidato.formato)) {
    erros.push({ campo: "formato", mensagem: "Formato desconhecido." });
  }

  const colunas = candidato.colunas ?? [];
  if (colunas.length === 0) {
    erros.push({ campo: "colunas", mensagem: "Um modelo sem coluna nenhuma gera arquivo vazio." });
  }
  const desconhecidas = colunas.filter((c) => !colunasConhecidas.includes(c));
  if (desconhecidas.length > 0) {
    erros.push({
      campo: "colunas",
      mensagem: `Coluna que não existe no catálogo: ${desconhecidas.slice(0, 3).join(", ")}.`,
    });
  }

  return erros;
}

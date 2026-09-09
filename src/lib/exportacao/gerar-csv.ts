/**
 * Gerador CSV — função pura, retorna a string do arquivo.
 * Camada: Aplicação (src/lib/exportacao)
 */

import { formatarValorTexto } from "./formatar-valor";
import { OpcoesCsv, TabelaExportacao } from "./tipos";

export const OPCOES_CSV_PADRAO: OpcoesCsv = {
  separador: ";",
  separadorDecimal: ",",
  incluirBom: true,
  quebraLinha: "\r\n",
};

/** BOM UTF-8: sem ele o Excel em português abre "Descrição" como "DescriÃ§Ã£o". */
const BOM = "﻿";

/**
 * Coloca o campo entre aspas quando contém separador, aspas ou quebra de linha,
 * dobrando aspas internas (RFC 4180). Texto SEMPRE vai entre aspas — evita que
 * um SKU como "000363" seja lido como número 363 pelo Excel.
 */
function escaparCampo(texto: string, separador: string, forcarAspas: boolean): string {
  const precisaAspas =
    forcarAspas ||
    texto.includes(separador) ||
    texto.includes('"') ||
    texto.includes("\n") ||
    texto.includes("\r");
  if (!precisaAspas) return texto;
  return `"${texto.replace(/"/g, '""')}"`;
}

export function gerarCsv(tabela: TabelaExportacao, opcoes: Partial<OpcoesCsv> = {}): string {
  const cfg: OpcoesCsv = { ...OPCOES_CSV_PADRAO, ...opcoes };
  const { separador, quebraLinha } = cfg;

  const cabecalho = tabela.cabecalhos.map((h) => escaparCampo(h, separador, true)).join(separador);

  const linhas = tabela.linhas.map((linha) =>
    linha
      .map((valor, idx) => {
        const tipo = tabela.tipos[idx] ?? "texto";
        const texto = formatarValorTexto(valor, tipo, { separadorDecimal: cfg.separadorDecimal });
        return escaparCampo(texto, separador, tipo === "texto" && texto.length > 0);
      })
      .join(separador)
  );

  const corpo = [cabecalho, ...linhas].join(quebraLinha);
  return (cfg.incluirBom ? BOM : "") + corpo + quebraLinha;
}

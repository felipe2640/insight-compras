/**
 * Formatação de valores para arquivos de texto (CSV e PDF).
 * Camada: Aplicação (src/lib/exportacao) — função pura.
 */

import { TipoValorColuna } from "./tipos";

export interface OpcoesFormatacaoValor {
  readonly separadorDecimal: "," | ".";
}

function trocarDecimal(texto: string, separador: "," | "."): string {
  return separador === "," ? texto.replace(".", ",") : texto;
}

function formatarData(valor: string | number): string {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor);
  const dd = String(data.getDate()).padStart(2, "0");
  const mm = String(data.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${data.getFullYear()}`;
}

/**
 * Converte um valor da tabela em texto conforme o tipo da coluna.
 * null vira string vazia — o arquivo não inventa zero onde não há medida.
 */
export function formatarValorTexto(
  valor: string | number | null,
  tipo: TipoValorColuna,
  opcoes: OpcoesFormatacaoValor
): string {
  if (valor === null) return "";

  switch (tipo) {
    case "inteiro":
      return typeof valor === "number" ? String(Math.round(valor)) : String(valor);
    case "decimal":
      return typeof valor === "number"
        ? trocarDecimal(valor.toFixed(2), opcoes.separadorDecimal)
        : String(valor);
    case "moeda":
      return typeof valor === "number"
        ? trocarDecimal(valor.toFixed(2), opcoes.separadorDecimal)
        : String(valor);
    case "percentual":
      return typeof valor === "number"
        ? trocarDecimal(valor.toFixed(1), opcoes.separadorDecimal)
        : String(valor);
    case "data":
      return formatarData(valor);
    case "texto":
    default:
      return String(valor);
  }
}

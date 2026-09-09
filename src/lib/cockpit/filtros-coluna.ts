/**
 * Filtro tipado por coluna — motor puro.
 * Camada: Aplicação (src/lib/cockpit). Sem React, sem TanStack: só regra.
 *
 * Vem do diário: o comprador filtra pela coluna que está olhando, com o
 * operador que faz sentido para aquele tipo de dado. Texto não tem "maior que";
 * número não tem "começa com". Oferecer o operador errado é convidar ao engano.
 *
 * DUAS DECISÕES QUE IMPORTAM
 * 1. Filtro INCOMPLETO não filtra. Enquanto o comprador digita "entre 10 e ___",
 *    a grade continua inteira. Esconder tudo no meio da digitação faz parecer
 *    que não há resultado.
 * 2. Texto compara sem acento e sem caixa. "MOLA" acha "Mola" e "molá".
 */

export type VarianteColuna = "texto" | "numero" | "selecao" | "data";

export type OperadorFiltro =
  | "contem"
  | "naoContem"
  | "comecaCom"
  | "terminaCom"
  | "igual"
  | "diferente"
  | "maior"
  | "maiorOuIgual"
  | "menor"
  | "menorOuIgual"
  | "entre"
  | "eUmDe"
  | "naoEUmDe"
  | "vazio"
  | "naoVazio";

export interface FiltroColuna {
  readonly operador: OperadorFiltro;
  readonly valor?: string | number | null;
  /** Só para "entre". */
  readonly valor2?: string | number | null;
  /** Só para "eUmDe" / "naoEUmDe". */
  readonly valores?: readonly string[];
}

export interface OperadorDescrito {
  readonly id: OperadorFiltro;
  readonly rotulo: string;
}

/** Operadores que não pedem valor nenhum. */
export const OPERADORES_SEM_VALOR: readonly OperadorFiltro[] = ["vazio", "naoVazio"];

const COMUNS: readonly OperadorDescrito[] = [
  { id: "vazio", rotulo: "está vazio" },
  { id: "naoVazio", rotulo: "não está vazio" },
];

export const OPERADORES_POR_VARIANTE: Readonly<Record<VarianteColuna, readonly OperadorDescrito[]>> = {
  texto: [
    { id: "contem", rotulo: "contém" },
    { id: "naoContem", rotulo: "não contém" },
    { id: "igual", rotulo: "é igual a" },
    { id: "diferente", rotulo: "é diferente de" },
    { id: "comecaCom", rotulo: "começa com" },
    { id: "terminaCom", rotulo: "termina com" },
    ...COMUNS,
  ],
  numero: [
    { id: "igual", rotulo: "é igual a" },
    { id: "diferente", rotulo: "é diferente de" },
    { id: "maior", rotulo: "é maior que" },
    { id: "maiorOuIgual", rotulo: "é maior ou igual a" },
    { id: "menor", rotulo: "é menor que" },
    { id: "menorOuIgual", rotulo: "é menor ou igual a" },
    { id: "entre", rotulo: "está entre" },
    ...COMUNS,
  ],
  selecao: [
    { id: "eUmDe", rotulo: "é um de" },
    { id: "naoEUmDe", rotulo: "não é um de" },
    ...COMUNS,
  ],
  data: [
    { id: "igual", rotulo: "é em" },
    { id: "menor", rotulo: "é antes de" },
    { id: "maior", rotulo: "é depois de" },
    { id: "entre", rotulo: "está entre" },
    ...COMUNS,
  ],
};

export function operadorPadraoDaVariante(variante: VarianteColuna): OperadorFiltro {
  return OPERADORES_POR_VARIANTE[variante][0].id;
}

export function operadorPertenceAVariante(operador: OperadorFiltro, variante: VarianteColuna): boolean {
  return OPERADORES_POR_VARIANTE[variante].some((o) => o.id === operador);
}

export function rotuloDoOperador(operador: OperadorFiltro, variante: VarianteColuna): string {
  return OPERADORES_POR_VARIANTE[variante].find((o) => o.id === operador)?.rotulo ?? operador;
}

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

const DIACRITICOS = /[̀-ͯ]/g;

/** Sem acento, sem caixa — a mesma regra da busca livre do cockpit. */
export function normalizarParaComparacao(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).normalize("NFD").replace(DIACRITICOS, "").toLowerCase().trim();
}

/**
 * Lê número digitado por gente: "1.234,56" (pt-BR), "1234.56", "12".
 * Com vírgula, ela é a decimal e o ponto é milhar. Sem vírgula, o ponto é decimal.
 */
export function interpretarNumero(entrada: unknown): number | null {
  if (typeof entrada === "number") return Number.isFinite(entrada) ? entrada : null;
  if (entrada === null || entrada === undefined) return null;
  const texto = String(entrada).trim();
  if (texto === "") return null;
  const limpo = (texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto)
    .replace(/\s|R\$|%/g, "");
  // Validação estrita ANTES de Number(): sem ela, "abc" viraria 0 e o comprador
  // filtraria por um número que nunca digitou.
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(limpo)) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** Aceita ISO (2026-09-09) e pt-BR (09/09/2026). Devolve epoch ms do dia. */
export function interpretarData(entrada: unknown): number | null {
  if (entrada === null || entrada === undefined || entrada === "") return null;
  if (entrada instanceof Date) return Number.isNaN(entrada.getTime()) ? null : entrada.getTime();
  const texto = String(entrada).trim();
  const ptBr = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ptBr) return Date.UTC(Number(ptBr[3]), Number(ptBr[2]) - 1, Number(ptBr[1]));
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const t = Date.parse(texto);
  return Number.isNaN(t) ? null : t;
}

export function valorEstaVazio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === "string") return valor.trim() === "";
  if (Array.isArray(valor)) return valor.length === 0;
  return false;
}

// ---------------------------------------------------------------------------
// Aplicação
// ---------------------------------------------------------------------------

/**
 * O filtro tem tudo de que precisa para decidir? Um filtro pela metade — o
 * comprador ainda digitando — não deve esconder linha nenhuma.
 */
export function filtroEstaCompleto(filtro: FiltroColuna | null | undefined): boolean {
  if (!filtro) return false;
  if (OPERADORES_SEM_VALOR.includes(filtro.operador)) return true;
  if (filtro.operador === "eUmDe" || filtro.operador === "naoEUmDe") {
    return (filtro.valores?.length ?? 0) > 0;
  }
  if (filtro.operador === "entre") {
    return !valorEstaVazio(filtro.valor) && !valorEstaVazio(filtro.valor2);
  }
  return !valorEstaVazio(filtro.valor);
}

function compararNumerico(
  valorCelula: unknown,
  filtro: FiltroColuna,
  ler: (v: unknown) => number | null
): boolean {
  const celula = ler(valorCelula);
  const a = ler(filtro.valor);
  if (celula === null || a === null) return false;

  switch (filtro.operador) {
    case "igual":
      return celula === a;
    case "diferente":
      return celula !== a;
    case "maior":
      return celula > a;
    case "maiorOuIgual":
      return celula >= a;
    case "menor":
      return celula < a;
    case "menorOuIgual":
      return celula <= a;
    case "entre": {
      const b = ler(filtro.valor2);
      if (b === null) return false;
      // Ordem invertida pelo usuário não deve zerar a grade.
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      return celula >= min && celula <= max;
    }
    default:
      return false;
  }
}

/**
 * Decide se UMA célula passa pelo filtro.
 * Filtro incompleto devolve `true` — não esconde nada.
 */
export function aplicarFiltroColuna(
  valorCelula: unknown,
  filtro: FiltroColuna | null | undefined,
  variante: VarianteColuna = "texto"
): boolean {
  if (!filtro || !filtroEstaCompleto(filtro)) return true;

  if (filtro.operador === "vazio") return valorEstaVazio(valorCelula);
  if (filtro.operador === "naoVazio") return !valorEstaVazio(valorCelula);

  if (variante === "numero") return compararNumerico(valorCelula, filtro, interpretarNumero);
  if (variante === "data") return compararNumerico(valorCelula, filtro, interpretarData);

  if (filtro.operador === "eUmDe" || filtro.operador === "naoEUmDe") {
    const alvo = normalizarParaComparacao(valorCelula);
    const conjunto = (filtro.valores ?? []).map(normalizarParaComparacao);
    const pertence = conjunto.includes(alvo);
    return filtro.operador === "eUmDe" ? pertence : !pertence;
  }

  const celula = normalizarParaComparacao(valorCelula);
  const busca = normalizarParaComparacao(filtro.valor);

  switch (filtro.operador) {
    case "contem":
      return celula.includes(busca);
    case "naoContem":
      return !celula.includes(busca);
    case "igual":
      return celula === busca;
    case "diferente":
      return celula !== busca;
    case "comecaCom":
      return celula.startsWith(busca);
    case "terminaCom":
      return celula.endsWith(busca);
    default:
      return true;
  }
}

/** Texto curto do chip: «Marca contém bosch». */
export function descreverFiltroColuna(
  rotuloColuna: string,
  filtro: FiltroColuna,
  variante: VarianteColuna = "texto"
): string {
  const operador = rotuloDoOperador(filtro.operador, variante);
  if (OPERADORES_SEM_VALOR.includes(filtro.operador)) {
    return `${rotuloColuna} ${operador}`;
  }
  if (filtro.operador === "eUmDe" || filtro.operador === "naoEUmDe") {
    const lista = filtro.valores ?? [];
    const amostra = lista.slice(0, 2).join(", ");
    const resto = lista.length > 2 ? ` +${lista.length - 2}` : "";
    return `${rotuloColuna} ${operador} ${amostra}${resto}`;
  }
  if (filtro.operador === "entre") {
    return `${rotuloColuna} ${operador} ${filtro.valor} e ${filtro.valor2}`;
  }
  return `${rotuloColuna} ${operador} ${filtro.valor}`;
}

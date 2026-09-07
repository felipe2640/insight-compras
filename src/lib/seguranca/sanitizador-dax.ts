/**
 * Módulo de Sanitização e Construção Segura contra Injeção DAX / SQL
 * Camada: src/lib/seguranca/sanitizador-dax.ts
 * 100% em Português do Brasil (pt-BR).
 */

// ============================================================================
// 1. EXPRESSÕES REGULARES DE DEFESA ADVERSARIAL
// ============================================================================

/**
 * Caracteres de pontuação e delimitadores perigosos que sinalizam injeção DAX, SQL ou XSS.
 * Aspas duplas (delimitador DAX), aspas simples (SQL e tabelas DAX), ponto e vírgula,
 * comentários (-- e /*), barras duplas (//), pipes, e-comerciais, tags HTML (< >),
 * dois pontos (pseudo-protocolos javascript:) e igualdade (=).
 */
export const REGEX_CARACTERES_INJECAO = /["';\-\-/\*\\|&`$<>=:]/;

/**
 * Padrões de tags HTML, manipuladores de evento e pseudo-protocolos XSS.
 */
export const REGEX_XSS_E_PROTOCOLOS = /(<\s*[\w/]|javascript\s*:|data\s*:|vbscript\s*:|on\w+\s*=)/i;

/**
 * Palavras-chave e operadores reservadas do DAX que NUNCA devem constar em entradas
 * textuais fornecidas pelo cliente (case-insensitive com limites de palavra \b).
 */
export const REGEX_PALAVRAS_CHAVE_DAX =
  /\b(EVALUATE|DEFINE|VAR|RETURN|CALCULATE|CALCULATETABLE|FILTER|ALL|ALLEXCEPT|ALLNOBLANKROW|REMOVEFILTERS|KEEPFILTERS|USERELATIONSHIP|CROSSJOIN|GENERATE|UNION|ROW|SUMMARIZE|SUMMARIZECOLUMNS|SELECTCOLUMNS|ADDCOLUMNS|LOOKUPVALUE|USERNAME|USERPRINCIPALNAME|CUSTOMDATA|ERROR)\b/i;

/**
 * Expressões booleanas clássicas de injeção para burlar cláusulas WHERE/FILTER
 * Exemplos: "OR 1=1", "|| 1=1", "' OR '1'='1", "|| TRUE()", "&& FALSE()"
 */
export const REGEX_INJECAO_BOOLEANA =
  /(\b(OR|AND)\b|\|\||&&)\s*(\d+\s*=\s*\d+|['"][^'"]*['"]\s*=\s*['"][^'"]*['"]|true\(\)|false\(\))/i;

/**
 * Padrão estrito de SKU de autopeças: letras, números, hífens, pontos e underscores.
 * Exemplos válidos: "AM-MON-001", "BD.9012", "PF_440", "SKU12345".
 */
export const REGEX_SKU_SEGURO = /^[A-Za-z0-9._-]+$/;

/**
 * Padrão estrito de nome de filial: alfanuméricos com acentuação pt-BR, espaços, hífens e pontos.
 * Exemplos válidos: "Loja 1 - Trairi", "Loja 2 - Paraipaba", "Distribuidora São Paulo".
 */
export const REGEX_NOME_FILIAL_SEGURO = /^[A-Za-z0-9À-ÿ\s._-]+$/;

/**
 * Padrão estrito de data ISO 8601: YYYY-MM-DD
 */
export const REGEX_DATA_ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// ============================================================================
// 2. SANITIZADORES E FORMATADORES ESTRUTURADOS DE CONSULTA DAX
// ============================================================================

/**
 * Formata com segurança matemática uma lista de IDs para cláusula IN do DAX.
 * Garante que apenas inteiros positivos sejam concatenados.
 * Retorna "{ -1 }" se a lista for nula ou vazia, garantindo filtro fechado seguro.
 */
export const sanitizarListaIdsParaDax = (ids: readonly number[] | null | undefined): string => {
  if (!ids || ids.length === 0) {
    return "{ -1 }";
  }

  const idsValidos = ids
    .filter((id) => typeof id === "number" && Number.isInteger(id) && id > 0 && id <= 2_147_483_647)
    .map((id) => Math.floor(id));

  if (idsValidos.length === 0) {
    return "{ -1 }";
  }

  return `{ ${idsValidos.join(", ")} }`;
};

/**
 * Alias de compatibilidade com formatarListaNumericaDax existente na camada de adaptadores.
 */
export const formatarListaNumericaDax = sanitizarListaIdsParaDax;

/**
 * Sanitiza e escapa uma string literal para uso seguro dentro de aspas duplas no DAX.
 * Substitui aspas duplas internas por aspas duplas duplicadas (""), remove quebras
 * de linha e caracteres nulos.
 */
export const escaparLiteralTextoDax = (texto: string): string => {
  if (!texto) return '""';

  // Remove caracteres de controle e nulos
  const limpo = texto.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

  // No DAX, o escape de aspas duplas é feito duplicando-as
  const escapado = limpo.replace(/"/g, '""');

  return `"${escapado}"`;
};

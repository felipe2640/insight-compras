/**
 * Módulo de Segurança e Sanitização Estrita contra Injeção DAX / SQL
 * Proposta de Implementação para: src/lib/seguranca/esquemas-sanitizacao.ts
 * 100% em Português do Brasil (pt-BR).
 *
 * Arquitetura em Duas Camadas:
 * 1. Camada de Perímetro (Zod): Validação de tipos, formatos, tamanhos e bloqueio de palavras-chave.
 * 2. Camada de Construção Segura: Sanitização e formatação estruturada de consultas DAX.
 */

import { z } from "zod";

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
// 2. ESQUEMAS ZOD ATÔMICOS (PRIMITIVOS DE DOMÍNIO)
// ============================================================================

/**
 * Validador estrito de ID de Fornecedor.
 * Deve ser um número inteiro positivo dentro dos limites de 32 bits (1 a 2.147.483.647).
 */
export const SchemaFornecedorId = z
  .number({
    invalid_type_error: "ID do fornecedor deve ser numérico",
    required_error: "ID do fornecedor é obrigatório",
  })
  .int("ID do fornecedor deve ser um número inteiro")
  .positive("ID do fornecedor deve ser maior que zero")
  .max(2_147_483_647, "ID do fornecedor excede o limite máximo permitido");

/**
 * Validador estrito de Lista de Fornecedores Autorizados (carteira do comprador).
 * Previne ataques de DoS por payloads gigantes e rejeita duplicatas.
 */
export const SchemaFornecedoresPermitidos = z
  .array(SchemaFornecedorId, {
    invalid_type_error: "Lista de fornecedores deve ser um array numérico",
  })
  .min(1, "A lista de fornecedores não pode ser vazia")
  .max(1000, "A lista de fornecedores excede o teto de 1000 registros")
  .refine((itens) => new Set(itens).size === itens.length, {
    message: "A lista de fornecedores contém IDs duplicados",
  });

/**
 * Validador estrito de ID de Filial / Loja.
 */
export const SchemaFilialId = z
  .number({
    invalid_type_error: "ID da filial deve ser numérico",
    required_error: "ID da filial é obrigatório",
  })
  .int("ID da filial deve ser um número inteiro")
  .positive("ID da filial deve ser maior que zero")
  .max(999, "ID da filial inválido (máximo 999)");

/**
 * Validador estrito de ID de Seção / Categoria de autopeças.
 */
export const SchemaSecaoId = z
  .number({
    invalid_type_error: "ID da seção deve ser numérico",
  })
  .int("ID da seção deve ser um número inteiro")
  .positive("ID da seção deve ser maior que zero")
  .max(9999, "ID da seção inválido (máximo 9999)");

/**
 * Validador estrito de Código SKU de autopeça.
 * Bloqueia qualquer caractere especial fora da allowlist e rejeita palavras reservadas de DAX.
 */
export const SchemaCodigoSku = z
  .string({
    invalid_type_error: "Código SKU deve ser uma string",
    required_error: "Código SKU é obrigatório",
  })
  .trim()
  .min(1, "Código SKU não pode ser vazio")
  .max(50, "Código SKU não pode exceder 50 caracteres")
  .regex(
    REGEX_SKU_SEGURO,
    "Código SKU contém caracteres inválidos. Permitidos apenas letras, números, hífens, pontos e underscores"
  )
  .refine((val) => !REGEX_PALAVRAS_CHAVE_DAX.test(val), {
    message: "Código SKU contém palavra-chave reservada de DAX",
  });

/**
 * Validador estrito de Nome de Filial.
 */
export const SchemaNomeFilial = z
  .string({
    invalid_type_error: "Nome da filial deve ser uma string",
    required_error: "Nome da filial é obrigatório",
  })
  .trim()
  .min(2, "Nome da filial deve ter no mínimo 2 caracteres")
  .max(100, "Nome da filial não pode exceder 100 caracteres")
  .regex(
    REGEX_NOME_FILIAL_SEGURO,
    "Nome da filial contém caracteres especiais ou tags inválidas"
  )
  .refine((val) => !REGEX_PALAVRAS_CHAVE_DAX.test(val), {
    message: "Nome da filial contém comando reservado de DAX",
  });

/**
 * Validador estrito de Data de Filtro no formato YYYY-MM-DD.
 * Valida o formato ISO e a existência real no calendário gregoriano (exclui 31 de fevereiro).
 */
export const SchemaDataFiltro = z
  .string({
    invalid_type_error: "Data deve ser uma string",
    required_error: "Data é obrigatória",
  })
  .regex(REGEX_DATA_ISO, "Data deve estar no formato ISO YYYY-MM-DD")
  .refine((val) => {
    const partes = val.split("-").map(Number);
    const ano = partes[0];
    const mes = partes[1];
    const dia = partes[2];
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    return (
      data.getUTCFullYear() === ano &&
      data.getUTCMonth() + 1 === mes &&
      data.getUTCDate() === dia
    );
  }, "Data de calendário inválida (ex: dia inexistente para o mês)")
  .refine((val) => {
    const ano = parseInt(val.substring(0, 4), 10);
    return ano >= 2020 && ano <= 2050;
  }, "Ano fora da faixa operacional permitida (2020 a 2050)");

/**
 * Validador estrito de Termo de Busca textual.
 * Bloqueia delimitadores de injeção, palavras-chave de DAX e operadores booleanos maliciosos.
 */
export const SchemaTermoBusca = z
  .string({
    invalid_type_error: "Termo de busca deve ser uma string",
  })
  .trim()
  .max(100, "Termo de busca não pode exceder 100 caracteres")
  .refine((val) => !REGEX_CARACTERES_INJECAO.test(val), {
    message: "Termo de busca contém caracteres proibidos de injeção DAX/SQL/XSS (\", ', ;, --, //, /*, <, >, :, =)",
  })
  .refine((val) => !REGEX_XSS_E_PROTOCOLOS.test(val), {
    message: "Tentativa de injeção XSS ou pseudo-protocolo detectada no termo de busca",
  })
  .refine((val) => !REGEX_PALAVRAS_CHAVE_DAX.test(val), {
    message: "Termo de busca contém comandos ou palavras-chave de DAX (EVALUATE, CALCULATE, etc.)",
  })
  .refine((val) => !REGEX_INJECAO_BOOLEANA.test(val), {
    message: "Tentativa de injeção lógica booleana detectada no termo de busca",
  });

// ============================================================================
// 3. ESQUEMAS COMPOSTOS PARA ROTAS DE API DO NEXT.JS
// ============================================================================

/**
 * Schema para requisição de carga de inventário (/api/compras)
 */
export const SchemaRequisicaoComprasApi = z.object({
  fornecedoresPermitidos: z.union([SchemaFornecedoresPermitidos, z.null()]),
  secaoId: SchemaSecaoId.optional(),
  filialId: SchemaFilialId.optional(),
  apenasComEstoqueOuVenda: z.boolean().optional().default(true),
  termoBusca: SchemaTermoBusca.optional(),
  dataCorte: SchemaDataFiltro.optional(),
});

/**
 * Schema para requisição de detalhes de item para tooltips analíticos (/api/detalhes-item)
 */
export const SchemaRequisicaoDetalhesItemApi = z.object({
  produtoId: z.number().int().positive("ID do produto deve ser inteiro positivo"),
  codigoSku: SchemaCodigoSku,
  filialId: SchemaFilialId.optional(),
});

/**
 * Schema para registro imutável de ordens de compra (/api/pedidos)
 */
export const SchemaRequisicaoPedidoCompraApi = z.object({
  produtoId: z.number().int().positive("ID do produto deve ser inteiro positivo"),
  codigoSku: SchemaCodigoSku,
  filialId: SchemaFilialId,
  fornecedorId: SchemaFornecedorId,
  quantidadeSugeridaSistema: z.number().int().nonnegative("Quantidade sugerida não pode ser negativa"),
  quantidadeDefinidaComprador: z.number().int().positive("Quantidade comprada deve ser maior que zero"),
  justificativaDivergencia: z
    .string()
    .trim()
    .max(500, "Justificativa não pode exceder 500 caracteres")
    .refine((val) => !REGEX_PALAVRAS_CHAVE_DAX.test(val), "Justificativa contém palavras-chave suspeitas")
    .optional()
    .nullable(),
});

// ============================================================================
// 4. SANITIZADORES E FORMATADORES ESTRUTURADOS DE CONSULTA DAX
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

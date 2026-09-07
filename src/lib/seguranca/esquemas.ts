/**
 * Esquemas Zod Estritos para Sanitização de Entradas e Proteção contra Injeção DAX/SQL
 * Camada: src/lib/seguranca/esquemas.ts
 * 100% em Português do Brasil (pt-BR).
 */

import { z } from "zod";
import {
  REGEX_CARACTERES_INJECAO,
  REGEX_XSS_E_PROTOCOLOS,
  REGEX_PALAVRAS_CHAVE_DAX,
  REGEX_INJECAO_BOOLEANA,
  REGEX_SKU_SEGURO,
  REGEX_NOME_FILIAL_SEGURO,
  REGEX_DATA_ISO,
} from "./sanitizador-dax";

// ============================================================================
// 1. ESQUEMAS ZOD ATÔMICOS (PRIMITIVOS DE DOMÍNIO)
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
// 2. ESQUEMAS COMPOSTOS PARA ROTAS DE API DO NEXT.JS
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
 * Schema atômico para criação de item de pedido
 */
export const SchemaItemPedidoCriacao = z.object({
  produtoId: z.number().int().positive("ID do produto inválido"),
  codigoSku: SchemaCodigoSku,
  fornecedorId: SchemaFornecedorId,
  filialId: SchemaFilialId,
  quantidadeSugerida: z.number().min(0),
  quantidadeDigitada: z.number().int().min(0, "Quantidade não pode ser negativa"),
  precoCusto: z.number().min(0),
  justificativaOverride: z
    .string()
    .trim()
    .max(500, "Justificativa não pode exceder 500 caracteres")
    .refine((val) => !REGEX_PALAVRAS_CHAVE_DAX.test(val), "Justificativa contém palavras-chave suspeitas de DAX")
    .optional()
    .nullable(),
});

/**
 * Schema para payload completo de criação de pedido (/api/pedidos)
 */
export const SchemaPayloadPedido = z.object({
  tenantId: z.string().min(1, "Tenant ID é obrigatório"),
  itens: z.array(SchemaItemPedidoCriacao).min(1, "O pedido deve conter pelo menos um item"),
});

/**
 * Schema para requisição individual de pedido de compra (/api/pedidos)
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

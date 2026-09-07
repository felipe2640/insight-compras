/**
 * Motor de Cálculo: Necessidade Bruta, Estoque de Segurança, Ponto de Pedido e Necessidade Líquida
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 */

import { PerfilRotatividade } from "../dominio/produto";

export interface ParametrosConfiguracaoPerfil {
  readonly horizonteDias: number;
  readonly margemSeguranca: number;
}

export const CONFIGURACAO_PADRAO_PERFIS: Record<
  PerfilRotatividade,
  ParametrosConfiguracaoPerfil
> = {
  ALTO_GIRO: {
    horizonteDias: 20,
    margemSeguranca: 0.25,
  },
  MEDIO_GIRO: {
    horizonteDias: 15,
    margemSeguranca: 0.45,
  },
  BAIXO_GIRO_INTERMITENTE: {
    horizonteDias: 7,
    margemSeguranca: 0.8,
  },
  SEM_HISTORICO_SUFICIENTE: {
    horizonteDias: 0,
    margemSeguranca: 0,
  },
};

export interface ParametrosCalculoNecessidade {
  readonly consumoDiario: number;
  readonly perfilGiro: PerfilRotatividade;
  readonly saldoFisico: number;
  readonly estoqueMinimoCadastrado: number;
  readonly quantidadeJaPedida: number;
  readonly leadTimeDias: number; // Tempo de entrega do fornecedor em dias
  readonly configuracaoPerfilCustomizada?: ParametrosConfiguracaoPerfil;
}

export interface ResultadoCalculoNecessidade {
  readonly consumoDiario: number;
  readonly horizonteDias: number;
  readonly margemSeguranca: number;
  readonly estoqueSeguranca: number;
  readonly pontoDePedido: number;
  readonly demandaHorizonte: number;
  readonly metaEstoque: number;
  readonly estoqueDisponivel: number;
  readonly necessidadeBruta: number;
  readonly necessidadeLiquida: number;
}

/**
 * Calcula o Estoque de Segurança com base no consumo diário, lead time e margem do perfil.
 * Garante que o estoque de segurança não seja inferior ao estoque mínimo fixado pelo ERP.
 */
export function calcularEstoqueSeguranca(
  consumoDiario: number,
  leadTimeDias: number,
  margemSeguranca: number,
  estoqueMinimoCadastrado: number = 0
): number {
  if (consumoDiario <= 0) {
    return Math.max(0, estoqueMinimoCadastrado);
  }
  const leadTimeValido = Math.max(1, leadTimeDias);
  const calculoDinamico = Math.ceil(consumoDiario * leadTimeValido * (1 + margemSeguranca));
  return Math.max(calculoDinamico, Math.max(0, estoqueMinimoCadastrado));
}

/**
 * Calcula o Ponto de Pedido (nível de estoque que dispara a reposição).
 */
export function calcularPontoDePedido(
  consumoDiario: number,
  leadTimeDias: number,
  estoqueSeguranca: number
): number {
  if (consumoDiario <= 0) return estoqueSeguranca;
  const leadTimeValido = Math.max(1, leadTimeDias);
  return Math.ceil(consumoDiario * leadTimeValido + estoqueSeguranca);
}

/**
 * Calcula a necessidade completa de compras de um item em uma filial.
 * Princípio inviolável: Se não houver demanda comprovada (consumo diário 0 ou sem histórico),
 * a necessidade é estritamente 0.
 */
export function calcularNecessidadeItem(
  parametros: ParametrosCalculoNecessidade
): ResultadoCalculoNecessidade {
  const {
    consumoDiario,
    perfilGiro,
    saldoFisico,
    estoqueMinimoCadastrado,
    quantidadeJaPedida,
    leadTimeDias,
    configuracaoPerfilCustomizada,
  } = parametros;

  // Se não tem histórico ou consumo é zero, necessidade é estritamente 0
  if (perfilGiro === "SEM_HISTORICO_SUFICIENTE" || consumoDiario <= 0) {
    return {
      consumoDiario: 0,
      horizonteDias: 0,
      margemSeguranca: 0,
      estoqueSeguranca: Math.max(0, estoqueMinimoCadastrado),
      pontoDePedido: Math.max(0, estoqueMinimoCadastrado),
      demandaHorizonte: 0,
      metaEstoque: Math.max(0, estoqueMinimoCadastrado),
      estoqueDisponivel: Math.max(0, saldoFisico) + Math.max(0, quantidadeJaPedida),
      necessidadeBruta: 0,
      necessidadeLiquida: 0,
    };
  }

  const config = configuracaoPerfilCustomizada ?? CONFIGURACAO_PADRAO_PERFIS[perfilGiro];
  const { horizonteDias, margemSeguranca } = config;

  const estoqueSeguranca = calcularEstoqueSeguranca(
    consumoDiario,
    leadTimeDias,
    margemSeguranca,
    estoqueMinimoCadastrado
  );

  const pontoDePedido = calcularPontoDePedido(consumoDiario, leadTimeDias, estoqueSeguranca);

  const demandaHorizonte = Math.ceil(consumoDiario * horizonteDias * (1 + margemSeguranca));
  const metaEstoque = demandaHorizonte + estoqueSeguranca;

  const estoqueDisponivel = Math.max(0, saldoFisico) + Math.max(0, quantidadeJaPedida);

  const necessidadeBruta = Math.max(0, metaEstoque - Math.max(0, saldoFisico));
  const necessidadeLiquida = Math.max(0, metaEstoque - estoqueDisponivel);

  return {
    consumoDiario,
    horizonteDias,
    margemSeguranca,
    estoqueSeguranca,
    pontoDePedido,
    demandaHorizonte,
    metaEstoque,
    estoqueDisponivel,
    necessidadeBruta,
    necessidadeLiquida,
  };
}

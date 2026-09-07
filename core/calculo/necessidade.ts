/**
 * Motor de Cálculo: Previsão de Demanda, Calibração e Necessidade Líquida de Compra
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 *
 * BASE COMUM A TODOS OS CLIENTES (white-label).
 * A fórmula abaixo é a tradução fiel do motor homologado no estudo de machine learning
 * (`carreiro_ml/forecasting.py :: current_engine_forecast` e `calibrated_forecast`):
 *
 *   previsaoBruta      = max( arredondarLote(consumoDiario * horizonte * (1 + margem)),
 *                             arredondarLote(piso) )
 *   previsaoCalibrada  = max(1, ceil(previsaoBruta * fatorCalibracao))   [se previsaoBruta > 0]
 *   necessidadeLiquida = max(0, previsaoCalibrada - saldoFisico - quantidadeJaPedida)
 *
 * PONTOS INVIOLÁVEIS:
 * - O piso é aplicado com `max`, NUNCA somado à demanda. Somar o estoque de segurança
 *   à demanda do horizonte infla a meta e foi a divergência que reprovou a versão anterior.
 * - Sem demanda comprovada (perfil SEM_HISTORICO_SUFICIENTE ou consumo <= 0) a
 *   necessidade é estritamente 0.
 *
 * O QUE VARIA POR CLIENTE fica em `ParametrosMotorCompra`, injetado pelo tenant:
 * horizontes, margens, fator de calibração (aprendido no backtest do cliente) e
 * a origem do piso. A lógica em si é idêntica para todos.
 */

import { PerfilRotatividade } from "../dominio/produto";

/**
 * Origem do piso mínimo da previsão.
 * - MEDIANA_LINHA: mediana das quantidades positivas vendidas por linha (padrão do estudo ML).
 * - ESTOQUE_MINIMO_ERP: estoque mínimo cadastrado no ERP do cliente.
 * - NENHUM: sem piso, a previsão é puramente a demanda do horizonte.
 */
export type OrigemPisoPrevisao = "MEDIANA_LINHA" | "ESTOQUE_MINIMO_ERP" | "NENHUM";

/**
 * Critérios de elegibilidade histórica (base comum, valores ajustáveis por cliente).
 * Espelha `carreiro_ml/config.py :: AnalysisConfig.min_notas_12m / min_meses_12m`.
 */
export interface CriteriosElegibilidade {
  /** Mínimo de notas fiscais distintas na janela de histórico. Padrão: 3. */
  readonly minimoNotasDistintas: number;
  /** Mínimo de meses com movimento na janela de histórico. Padrão: 2. */
  readonly minimoMesesAtivos: number;
}

/**
 * Conjunto completo de parâmetros que o tenant injeta no motor.
 * Tudo aqui é calibrável por cliente; a lógica que consome estes valores não é.
 */
export interface ParametrosMotorCompra {
  /** Dias de cobertura planejada por perfil de giro. */
  readonly horizontes: Readonly<Record<PerfilRotatividade, number>>;
  /** Margem de segurança proporcional por perfil de giro (0.25 = +25%). */
  readonly margens: Readonly<Record<PerfilRotatividade, number>>;
  /**
   * Fator de calibração aprendido no backtest do cliente (0 < fator <= 1).
   * 1 = motor sem calibração (baseline). Carreiro homologou 0.90.
   */
  readonly fatorCalibracao: number;
  /** De onde sai o piso mínimo da previsão. */
  readonly origemPiso: OrigemPisoPrevisao;
  /** Critérios de elegibilidade histórica. */
  readonly elegibilidade: CriteriosElegibilidade;
}

/**
 * Parâmetros padrão da plataforma — espelham `AnalysisConfig` do estudo ML.
 * Um tenant sem calibração própria herda estes valores com fatorCalibracao = 1
 * (ou seja, o baseline, explicitamente não calibrado).
 */
export const PARAMETROS_MOTOR_PADRAO: ParametrosMotorCompra = {
  horizontes: {
    ALTO_GIRO: 20,
    MEDIO_GIRO: 15,
    BAIXO_GIRO_INTERMITENTE: 7,
    SEM_HISTORICO_SUFICIENTE: 0,
  },
  margens: {
    ALTO_GIRO: 0.25,
    MEDIO_GIRO: 0.45,
    BAIXO_GIRO_INTERMITENTE: 0.8,
    SEM_HISTORICO_SUFICIENTE: 0,
  },
  fatorCalibracao: 1,
  origemPiso: "MEDIANA_LINHA",
  elegibilidade: {
    minimoNotasDistintas: 3,
    minimoMesesAtivos: 2,
  },
};

/**
 * Configuração de um perfil isolado (horizonte + margem), mantida para
 * compatibilidade com chamadas que sobrescrevem apenas um perfil.
 */
export interface ParametrosConfiguracaoPerfil {
  readonly horizonteDias: number;
  readonly margemSeguranca: number;
}

/**
 * Configuração padrão por perfil, derivada de PARAMETROS_MOTOR_PADRAO.
 */
export const CONFIGURACAO_PADRAO_PERFIS: Record<
  PerfilRotatividade,
  ParametrosConfiguracaoPerfil
> = {
  ALTO_GIRO: { horizonteDias: 20, margemSeguranca: 0.25 },
  MEDIO_GIRO: { horizonteDias: 15, margemSeguranca: 0.45 },
  BAIXO_GIRO_INTERMITENTE: { horizonteDias: 7, margemSeguranca: 0.8 },
  SEM_HISTORICO_SUFICIENTE: { horizonteDias: 0, margemSeguranca: 0 },
};

export interface ParametrosCalculoNecessidade {
  readonly consumoDiario: number;
  readonly perfilGiro: PerfilRotatividade;
  readonly saldoFisico: number;
  readonly quantidadeJaPedida: number;
  /** Estoque mínimo cadastrado no ERP (usado como piso apenas se origemPiso pedir). */
  readonly estoqueMinimoCadastrado?: number;
  /** Mediana das quantidades positivas por linha de venda (piso padrão do estudo ML). */
  readonly medianaLinhaVenda?: number;
  /** Lote/múltiplo de fábrica para arredondamento da previsão. 1 = avulso. */
  readonly loteMultiplo?: number;
  /** Parâmetros do tenant. Se omitido, usa PARAMETROS_MOTOR_PADRAO. */
  readonly parametrosMotor?: ParametrosMotorCompra;
  /** Sobrescreve horizonte/margem apenas deste item (ex.: simulação do comprador). */
  readonly configuracaoPerfilCustomizada?: ParametrosConfiguracaoPerfil;
  /** Lead time do fornecedor em dias — diagnóstico (ponto de pedido), não entra na previsão. */
  readonly leadTimeDias?: number;
}

export interface ResultadoCalculoNecessidade {
  readonly consumoDiario: number;
  readonly horizonteDias: number;
  readonly margemSeguranca: number;
  /** Demanda do horizonte já arredondada ao lote, antes do piso e da calibração. */
  readonly demandaHorizonte: number;
  /** Piso aplicado (conforme origemPiso), já arredondado ao lote. */
  readonly pisoAplicado: number;
  /** max(demandaHorizonte, pisoAplicado) — a previsão antes da calibração. */
  readonly previsaoBruta: number;
  /** Fator de calibração efetivamente aplicado. */
  readonly fatorCalibracao: number;
  /** Previsão após a calibração do cliente. */
  readonly previsaoCalibrada: number;
  readonly estoqueDisponivel: number;
  /** Necessidade desconsiderando pedidos em aberto. */
  readonly necessidadeBruta: number;
  /** Necessidade final, já descontados saldo e pedidos em aberto. */
  readonly necessidadeLiquida: number;
  /** Diagnóstico: estoque de segurança sugerido (NÃO entra na necessidade). */
  readonly estoqueSegurancaDiagnostico: number;
  /** Diagnóstico: nível de estoque que dispara reposição (NÃO entra na necessidade). */
  readonly pontoDePedidoDiagnostico: number;
}

/**
 * Arredonda para cima até o próximo múltiplo inteiro do lote.
 * Espelha `carreiro_ml/forecasting.py :: ceil_to_lot`.
 */
export function arredondarParaLote(valor: number, lote: number): number {
  const loteValido = Math.max(1, Math.floor(lote || 1));
  const base = Math.max(0, valor);
  return Math.ceil(base / loteValido) * loteValido;
}

/**
 * Aplica o fator de calibração aprendido no backtest do cliente.
 * Espelha `carreiro_ml/forecasting.py :: calibrated_forecast`:
 * uma previsão positiva nunca é reduzida a zero pela calibração.
 */
export function calibrarPrevisao(previsaoBruta: number, fator: number): number {
  if (previsaoBruta <= 0) return 0;
  const fatorValido = Number.isFinite(fator) && fator > 0 ? fator : 1;
  return Math.max(1, Math.ceil(previsaoBruta * fatorValido));
}

/**
 * Calcula a previsão de demanda para o horizonte, com piso e arredondamento por lote.
 * Espelha `carreiro_ml/forecasting.py :: current_engine_forecast`.
 */
export function calcularPrevisaoDemanda(
  consumoDiario: number,
  horizonteDias: number,
  margemSeguranca: number,
  loteMultiplo = 1,
  piso = 0
): { demandaHorizonte: number; pisoAplicado: number; previsaoBruta: number } {
  if (consumoDiario <= 0 || horizonteDias <= 0) {
    const pisoZerado = arredondarParaLote(Math.max(0, piso), loteMultiplo);
    return { demandaHorizonte: 0, pisoAplicado: pisoZerado, previsaoBruta: 0 };
  }

  const demandaHorizonte = arredondarParaLote(
    consumoDiario * horizonteDias * (1 + margemSeguranca),
    loteMultiplo
  );
  const pisoAplicado = arredondarParaLote(Math.max(0, piso), loteMultiplo);

  return {
    demandaHorizonte,
    pisoAplicado,
    previsaoBruta: Math.max(demandaHorizonte, pisoAplicado),
  };
}

/**
 * Diagnóstico: estoque de segurança sugerido a partir do lead time do fornecedor.
 * NÃO entra na necessidade de compra — é exibido no cockpit como referência.
 */
export function calcularEstoqueSeguranca(
  consumoDiario: number,
  leadTimeDias: number,
  margemSeguranca: number,
  estoqueMinimoCadastrado = 0
): number {
  if (consumoDiario <= 0) {
    return Math.max(0, estoqueMinimoCadastrado);
  }
  const leadTimeValido = Math.max(1, leadTimeDias);
  const calculoDinamico = Math.ceil(consumoDiario * leadTimeValido * (1 + margemSeguranca));
  return Math.max(calculoDinamico, Math.max(0, estoqueMinimoCadastrado));
}

/**
 * Diagnóstico: nível de estoque que dispara a reposição.
 * NÃO entra na necessidade de compra.
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
 * Resolve o valor do piso conforme a origem configurada pelo tenant.
 */
function resolverPiso(
  origem: OrigemPisoPrevisao,
  medianaLinhaVenda: number,
  estoqueMinimoCadastrado: number
): number {
  if (origem === "MEDIANA_LINHA") return Math.max(0, medianaLinhaVenda);
  if (origem === "ESTOQUE_MINIMO_ERP") return Math.max(0, estoqueMinimoCadastrado);
  return 0;
}

/**
 * Calcula a necessidade completa de compra de um item em uma filial.
 *
 * Princípio inviolável: sem demanda comprovada (perfil sem histórico suficiente
 * ou consumo diário <= 0), a necessidade é estritamente 0.
 */
export function calcularNecessidadeItem(
  parametros: ParametrosCalculoNecessidade
): ResultadoCalculoNecessidade {
  const {
    consumoDiario,
    perfilGiro,
    saldoFisico,
    quantidadeJaPedida,
    estoqueMinimoCadastrado = 0,
    medianaLinhaVenda = 0,
    loteMultiplo = 1,
    parametrosMotor = PARAMETROS_MOTOR_PADRAO,
    configuracaoPerfilCustomizada,
    leadTimeDias = 0,
  } = parametros;

  const saldo = Math.max(0, saldoFisico);
  const pedidos = Math.max(0, quantidadeJaPedida);
  const estoqueDisponivel = saldo + pedidos;

  // Sem histórico suficiente ou sem consumo: necessidade estritamente 0.
  if (perfilGiro === "SEM_HISTORICO_SUFICIENTE" || consumoDiario <= 0) {
    return {
      consumoDiario: 0,
      horizonteDias: 0,
      margemSeguranca: 0,
      demandaHorizonte: 0,
      pisoAplicado: 0,
      previsaoBruta: 0,
      fatorCalibracao: parametrosMotor.fatorCalibracao,
      previsaoCalibrada: 0,
      estoqueDisponivel,
      necessidadeBruta: 0,
      necessidadeLiquida: 0,
      estoqueSegurancaDiagnostico: Math.max(0, estoqueMinimoCadastrado),
      pontoDePedidoDiagnostico: Math.max(0, estoqueMinimoCadastrado),
    };
  }

  const horizonteDias =
    configuracaoPerfilCustomizada?.horizonteDias ?? parametrosMotor.horizontes[perfilGiro];
  const margemSeguranca =
    configuracaoPerfilCustomizada?.margemSeguranca ?? parametrosMotor.margens[perfilGiro];

  const piso = resolverPiso(
    parametrosMotor.origemPiso,
    medianaLinhaVenda,
    estoqueMinimoCadastrado
  );

  const { demandaHorizonte, pisoAplicado, previsaoBruta } = calcularPrevisaoDemanda(
    consumoDiario,
    horizonteDias,
    margemSeguranca,
    loteMultiplo,
    piso
  );

  const previsaoCalibrada = calibrarPrevisao(previsaoBruta, parametrosMotor.fatorCalibracao);

  const necessidadeBruta = Math.max(0, previsaoCalibrada - saldo);
  const necessidadeLiquida = Math.max(0, previsaoCalibrada - estoqueDisponivel);

  const estoqueSegurancaDiagnostico = calcularEstoqueSeguranca(
    consumoDiario,
    leadTimeDias,
    margemSeguranca,
    estoqueMinimoCadastrado
  );

  return {
    consumoDiario,
    horizonteDias,
    margemSeguranca,
    demandaHorizonte,
    pisoAplicado,
    previsaoBruta,
    fatorCalibracao: parametrosMotor.fatorCalibracao,
    previsaoCalibrada,
    estoqueDisponivel,
    necessidadeBruta,
    necessidadeLiquida,
    estoqueSegurancaDiagnostico,
    pontoDePedidoDiagnostico: calcularPontoDePedido(
      consumoDiario,
      leadTimeDias,
      estoqueSegurancaDiagnostico
    ),
  };
}

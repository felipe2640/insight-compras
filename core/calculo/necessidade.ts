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
import { SinalGovernancaCompra } from "../dominio/estoque";

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
  /**
   * Como reagir a um sinal REDUZIR da governança do cliente.
   *
   * O corte NÃO é um número fixo: é proporcional ao quanto a margem realizada
   * do item nos últimos meses está abaixo da margem alvo. Item que quase alcança
   * a meta sofre corte pequeno; item que vende no prejuízo sofre o corte máximo.
   * PAUSAR continua sendo o único caso que zera.
   */
  readonly reducaoGovernanca: ReducaoPorMargem;
}

/**
 * Parâmetros da redução proporcional à saúde de margem.
 */
export interface ReducaoPorMargem {
  /** Margem alvo do cliente quando a fonte não informa por item (0..1). */
  readonly margemAlvoPadrao: number;
  /** Piso do fator: nunca corta além disso. Zerar é papel do PAUSAR. */
  readonly pisoFator: number;
  /** Fator aplicado quando não há margem medida para o item. */
  readonly fatorSemMargem: number;
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
  reducaoGovernanca: {
    margemAlvoPadrao: 0.3,
    pisoFator: 0.25,
    fatorSemMargem: 0.5,
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
  /** Sinal de governança do processo do cliente. null/omitido = sem restrição. */
  readonly sinalGovernanca?: SinalGovernancaCompra | null;
  /** Margem realizada do item na janela recente (0..1). null = não medida. */
  readonly margemRealizada?: number | null;
  /** Margem alvo do item. Se ausente, usa a padrão do tenant. */
  readonly margemAlvo?: number | null;
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
  /** Necessidade após demanda e estoque, ANTES da governança do cliente. */
  readonly necessidadeAntesGovernanca: number;
  /** Necessidade final, já descontados saldo, pedidos em aberto e governança. */
  readonly necessidadeLiquida: number;
  /** Sinal de governança efetivamente aplicado. */
  readonly sinalGovernancaAplicado: SinalGovernancaCompra | null;
  /** Fator de redução efetivamente aplicado pela governança (1 = sem corte). */
  readonly fatorReducaoAplicado: number;
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
 * Calcula o fator de redução a partir da saúde de margem do item.
 *
 * A ideia: o corte é proporcional ao tamanho do buraco entre a margem que o item
 * realmente entregou nos últimos meses e a margem alvo do cliente.
 *
 *   deficit    = max(0, margemAlvo - margemRealizada)
 *   proporcao  = deficit / margemAlvo        (0 = na meta, 1 = margem zero)
 *   fator      = limita(1 - proporcao, piso, 1)
 *
 * Exemplos com alvo de 30%:
 *   margem 30% ou mais -> fator 1,00 (compra integral)
 *   margem 27%         -> fator 0,90
 *   margem 15,6%       -> fator 0,52
 *   margem negativa    -> fator no piso
 *
 * Sem margem medida, devolve `fatorSemMargem` — um corte declarado, e não um
 * palpite disfarçado de cálculo.
 */
export function calcularFatorReducaoPorMargem(
  margemRealizada: number | null | undefined,
  margemAlvo: number | null | undefined,
  parametros: ReducaoPorMargem
): number {
  const piso = Math.min(1, Math.max(0, parametros.pisoFator));

  const alvo =
    margemAlvo !== null && margemAlvo !== undefined && Number.isFinite(margemAlvo) && margemAlvo > 0
      ? margemAlvo
      : parametros.margemAlvoPadrao;

  if (!Number.isFinite(alvo) || alvo <= 0) {
    return Math.min(1, Math.max(piso, parametros.fatorSemMargem));
  }

  if (
    margemRealizada === null ||
    margemRealizada === undefined ||
    !Number.isFinite(margemRealizada)
  ) {
    return Math.min(1, Math.max(piso, parametros.fatorSemMargem));
  }

  // Margem acima de 100% é ruído de item com custo não lançado; trata como saudável.
  const realizada = Math.min(1, margemRealizada);
  const deficit = Math.max(0, alvo - realizada);
  const proporcao = deficit / alvo;

  return Math.min(1, Math.max(piso, 1 - proporcao));
}

/**
 * Aplica o sinal de governança do processo de compra do cliente.
 * PAUSAR zera. REDUZIR corta proporcionalmente à saúde de margem do item,
 * sem nunca zerar uma necessidade que era positiva.
 */
export function aplicarGovernancaCompra(
  necessidade: number,
  sinal: SinalGovernancaCompra | null | undefined,
  fatorReducao: number
): number {
  if (necessidade <= 0) return 0;
  if (sinal === "PAUSAR") return 0;
  if (sinal === "REDUZIR") {
    const fator =
      Number.isFinite(fatorReducao) && fatorReducao > 0 && fatorReducao < 1 ? fatorReducao : 1;
    return Math.max(1, Math.floor(necessidade * fator));
  }
  return necessidade;
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
    sinalGovernanca = null,
    margemRealizada = null,
    margemAlvo = null,
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
      necessidadeAntesGovernanca: 0,
      necessidadeLiquida: 0,
      sinalGovernancaAplicado: sinalGovernanca,
      fatorReducaoAplicado: 1,
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
  const necessidadeAntesGovernanca = Math.max(0, previsaoCalibrada - estoqueDisponivel);

  // A régua de "posso comprar?" é do cliente; a reação a ela é da base.
  // O tamanho do corte vem da saúde de margem do próprio item.
  const fatorReducaoAplicado =
    sinalGovernanca === "REDUZIR"
      ? calcularFatorReducaoPorMargem(
          margemRealizada,
          margemAlvo,
          parametrosMotor.reducaoGovernanca
        )
      : 1;

  const necessidadeLiquida = aplicarGovernancaCompra(
    necessidadeAntesGovernanca,
    sinalGovernanca,
    fatorReducaoAplicado
  );

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
    necessidadeAntesGovernanca,
    necessidadeLiquida,
    sinalGovernancaAplicado: sinalGovernanca,
    fatorReducaoAplicado,
    estoqueSegurancaDiagnostico,
    pontoDePedidoDiagnostico: calcularPontoDePedido(
      consumoDiario,
      leadTimeDias,
      estoqueSegurancaDiagnostico
    ),
  };
}

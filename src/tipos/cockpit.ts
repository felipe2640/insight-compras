/**
 * Contratos de Tipagem Canônica para o Cockpit do Comprador e Tooltips Analíticos
 * Projeto: Plataforma White-Label de Inteligência de Compras para Autopeças
 * 100% em Português do Brasil (pt-BR).
 */

import React from "react";
import { CurvaABC, PerfilRotatividade, StatusSugestao } from "@core/dominio";
import { EntradaNFeDoDia, ItemSimilarIntercambiavel } from "@adapters/AdaptadorInventario";

export type { EntradaNFeDoDia, ItemSimilarIntercambiavel };

// ============================================================================
// 1. CLASSIFICAÇÕES E ENUMS DO NOVO MODELO DE COMPRA
// ============================================================================

export type SeveridadeRuptura = "Boa" | "Atenção" | "Grave" | "Sem histórico";
export type ClassificacaoFrequencia = "Alta" | "Média" | "Baixa";
export type TendenciaCobertura = "ALTA" | "QUEDA" | "ESTAVEL" | "ZUMBI";

/**
 * Movimentação individual de nota fiscal para o extrato analítico do Tooltip de Frequência.
 */
export interface ExtratoMovimentacaoFrequencia {
  readonly dataVenda: string;
  readonly nomeCliente: string;
  readonly tipo: "venda" | "devolucao";
  readonly quantidade: number;
  readonly numeroNota: string;
}

// ============================================================================
// 2. LINHA DA MATRIZ DE DECISÃO DO COCKPIT (TanStack Table Row)
// ============================================================================

export interface LinhaCockpitMatriz {
  // Identificação do Produto
  readonly produtoId: number;
  readonly codigoSku: string;
  readonly descricao: string;
  readonly marca: string;
  readonly fabricante: string;
  readonly referenciaFabricante: string | null;
  readonly aplicacaoVeicular: string | null;
  readonly secaoId?: number;
  readonly secaoNome: string | null;
  readonly fornecedorId?: number;
  readonly nomeFornecedor?: string;
  readonly precoCusto: number;
  readonly precoVenda: number;
  readonly curvaAbc: CurvaABC;
  readonly perfilGiro: PerfilRotatividade;

  // Ruptura
  /** null = a fonte não mede ruptura. */
  readonly rupturaDiasAnalisados: number | null;
  /** null = a fonte não mede ruptura. */
  readonly rupturaDiasZerados: number | null;
  readonly rupturaPercentual: number | null;
  readonly classificacaoRuptura: SeveridadeRuptura;
  readonly dataUltimoZeramento: string | null;
  readonly vendaPerdidaEstimadaReais: number;

  // Frequência em 90 dias
  readonly notasVenda90d: number;
  readonly notasDevolucao90d: number;
  readonly notasLiquidas90d: number;
  readonly frequenciaPercentual90d: number;
  readonly classificacaoFrequencia: ClassificacaoFrequencia;
  readonly totalPecasVendidas90d: number;
  readonly extratoFrequencia90d: readonly ExtratoMovimentacaoFrequencia[];

  // Coberturas Comparativas (30d / 90d / 180d)
  readonly vendasLiquidas30d: number;
  readonly consumoMedioDiario30d: number;
  /** null = sem consumo na janela, cobertura não calculável. */
  readonly diasCobertura30d: number | null;

  readonly vendasLiquidas90d: number;
  readonly consumoMedioDiario90d: number;
  /** null = sem consumo na janela, cobertura não calculável. */
  readonly diasCobertura90d: number | null;

  readonly vendasLiquidas180d: number;
  readonly consumoMedioDiario180d: number;
  /** null = sem consumo na janela, cobertura não calculável. */
  readonly diasCobertura180d: number | null;

  readonly tendenciaCobertura: TendenciaCobertura;
  readonly isMarcaZumbi: boolean; // true se saldoEstoque > 0 e vendasLiquidas180d === 0

  // Estoque da Rede
  readonly filialFocoId: number;
  readonly filialFocoNome: string;
  readonly estoqueLojaFoco: number;
  readonly estoqueMinimoLojaFoco: number;
  /** null = a fonte do cliente não expõe pedidos em aberto (não medido != zero). */
  readonly quantidadeJaPedidaFoco: number | null;
  readonly estoqueOutrasLojasRede: number;

  // Sugestão e Decisão do Motor
  readonly sugestaoFinalCompra: number;
  /**
   * Contexto do modelo congelado na linha — o ciclo de aprendizado grava isto
   * no snapshot para recalcular a calibração sem depender da fonte do cliente.
   */
  readonly previsaoBrutaModelo: number;
  readonly horizonteDiasAplicado: number;
  readonly margemSegurancaAplicada: number;
  readonly fatorCalibracaoAplicado: number;
  readonly motivoInelegibilidade: string | null;
  readonly statusSugestao: StatusSugestao;
  readonly motivoDecisao: string;

  // Ajuste Humano e Múltiplos
  readonly loteMultiplo: number; // ex: 1 avulso, 2 par, 4 jogo
  readonly embalagemMinima?: number;
  readonly pedidoCustom: number;
  readonly transferenciaCustom: number;

  // Transferência Inteligente entre Lojas
  readonly filialOrigemTransferenciaId: number | null;
  readonly filialOrigemTransferenciaNome: string | null;
  readonly saldoOrigemTransferencia: number;
  readonly estoqueMinimoOrigemTransferencia: number;
  readonly sobraRealOrigemTransferencia: number;
  readonly necessidadeDestinoTransferencia: number;
  readonly quantidadeTransferenciaSugerida: number;

  // Similares e Chegadas Recentes
  readonly similares: readonly ItemSimilarIntercambiavel[];
  readonly entradasHoje: readonly EntradaNFeDoDia[];

  // 29 Colunas da Grade Operacional Fiel
  readonly selecionado?: boolean;
  readonly codigo?: string;
  readonly aplicacao?: string;
  readonly refFabricante?: string;
  readonly custo?: number;
  readonly dtUltVenda?: string | null;
  readonly dtUltimaCompra?: string | null;
  readonly curvaAbcSistema?: string;
  readonly produtosVend90d?: number;
  readonly consumoDiario?: number;
  readonly consumoMensal?: number;
  readonly vendaACadaDias?: number | null;
  readonly consumoUltimos30DiasQtd?: number;
  readonly consumoUltimos30DiasDetalhes?: readonly ExtratoMovimentacaoFrequencia[];
  readonly giroUltimaVenda?: string;
  readonly frequencia?: string;
  readonly classificacaoConsumo?: string;
  readonly ruptura?: string;
  readonly periodoIdeal?: string;
  readonly histVendas90d?: number | null;
  readonly histProdVend90d?: number | null;
  readonly diasSemVenda?: number | null;
  readonly estoqueRede?: number;
  readonly statusMovimentacao?: string;
  readonly sugestaoCompra?: number;
  readonly sugestaoTransferencia?: number;
  readonly temSimilarComEstoque?: boolean;
  readonly exigeMultiploEmbalagem?: boolean;

  // Índice de busca pré-computado em memória para busca < 250ms
  _searchIndex?: string;
}

export type LinhaCockpitCompras = LinhaCockpitMatriz;

// ============================================================================
// 3. PROPS DOS 5 TOOLTIPS ANALÍTICOS RICOS
// ============================================================================

export interface PropsTooltipRuptura {
  readonly diasAnalisados: number | null;
  readonly diasZerados: number | null;
  readonly percentualRuptura: number | null;
  readonly classificacao: SeveridadeRuptura;
  readonly dataUltimoZeramento: string | null;
  readonly vendaPerdidaEstimadaReais: number;
  readonly consumoDiarioReferencia?: number;
  readonly precoVenda?: number;
  readonly delayDuration?: number;
  readonly children: React.ReactNode;
}

export interface PropsTooltipFrequencia {
  readonly notasVenda: number;
  readonly notasDevolucao: number;
  readonly notasLiquidas: number;
  readonly frequenciaPercentual: number;
  readonly classificacao: ClassificacaoFrequencia;
  readonly totalPecasVendidas: number;
  readonly extratoMovimentacoes?: readonly ExtratoMovimentacaoFrequencia[];
  readonly delayDuration?: number;
  readonly children: React.ReactNode;
}

export interface PropsTooltipCobertura {
  readonly saldoEstoqueAtual: number;
  readonly leadTimeDias?: number;
  readonly vendas30d: number;
  readonly cmd30d: number;
  readonly cobertura30dDias: number | null;
  readonly vendas90d: number;
  readonly cmd90d: number;
  readonly cobertura90dDias: number | null;
  readonly vendas180d: number;
  readonly cmd180d: number;
  readonly cobertura180dDias: number | null;
  readonly tendencia: TendenciaCobertura;
  readonly isMarcaZumbi: boolean;
  readonly delayDuration?: number;
  readonly children: React.ReactNode;
}

export interface PropsTooltipTransferencia {
  readonly filialOrigemNome: string;
  readonly saldoOrigem: number;
  readonly estoqueMinimoOrigem: number;
  readonly sobraRealOrigem: number;
  readonly filialDestinoNome: string;
  readonly necessidadeDestino: number;
  readonly quantidadeTransferirRecomendada: number;
  readonly motivo?: string;
  readonly delayDuration?: number;
  readonly children: React.ReactNode;
}

export interface PropsTooltipNfeDoDia {
  readonly entradas: readonly EntradaNFeDoDia[];
  readonly delayDuration?: number;
  readonly children: React.ReactNode;
}

export interface PropsDialogSimilares {
  readonly aberto: boolean;
  readonly onOpenChange: (aberto: boolean) => void;
  readonly produtoPrincipalCodigo: string;
  readonly produtoPrincipalDescricao: string;
  readonly similares: readonly ItemSimilarIntercambiavel[];
}

// ============================================================================
// 4. PROPS DA CÉLULA EDITÁVEL E RASCUNHO DE SESSÃO
// ============================================================================

export interface EditableCellProps {
  readonly initialValue: number;
  readonly skuId: string | number;
  readonly minMultiplo?: number;
  readonly embalagemMinima?: number;
  readonly valorSugeridoSistema?: number;
  readonly onCommit: (skuId: string | number, quantidadeFinal: number, motivoAjuste: string | null) => void;
  readonly rotuloAcessibilidade?: string;
  readonly disabled?: boolean;
  readonly className?: string;
}

export interface ItemDeltaRascunho {
  readonly quantidade: number;
  readonly modificadoEm: number;
  readonly tipo?: "pedir" | "transferir";
  readonly ajustadoPorMultiplo?: boolean;
  readonly motivoAjuste?: string | null;
}

export interface EstadoFiltrosRascunho {
  readonly queryBusca?: string;
  readonly marcasDeselecionadas?: string[];
  readonly secoesDeselecionadas?: number[];
  readonly curvasDeselecionadas?: string[];
  readonly filtroStatus?: string;
  readonly lojaFocoId?: number | string;
}

export interface RascunhoSessaoPayload {
  readonly versao: number;
  readonly timestamp: number;
  readonly tenantId: string;
  readonly userId: string;
  readonly deltas: Record<string, ItemDeltaRascunho>;
  readonly filtros?: EstadoFiltrosRascunho;
  readonly config?: {
    leadTimeDias?: number;
    diasCoberturaABC?: { A: number; B: number; C: number };
  };
}

export interface DraftSaveError {
  readonly tipo: "QUOTA" | "SEGURANCA" | "SERIALIZACAO" | "DESCONHECIDO";
  readonly mensagem: string;
  readonly dica?: string;
}

// ============================================================================
// 5. ESTADO DE FILTROS DO COCKPIT
// ============================================================================

export type StatusFilterOption = "ALL" | "PEDIR" | "TRANSFERIR" | "RUPTURA" | "ZUMBI";

export interface FiltrosCockpitState {
  readonly queryBusca: string;
  readonly fornecedoresPermitidos: ReadonlySet<number> | null;
  readonly marcasDeselecionadas: ReadonlySet<string>;
  readonly secoesDeselecionadas: ReadonlySet<number>;
  readonly curvasDeselecionadas: ReadonlySet<CurvaABC>;
  readonly statusFiltro: StatusFilterOption;
  readonly lojaFocoId: number;
}

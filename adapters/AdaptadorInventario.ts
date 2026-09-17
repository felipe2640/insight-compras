/**
 * Contrato Canônico da Camada de Adaptadores: InventoryAdapter
 * Camada: Adapters (Clean Architecture)
 * 100% em Português do Brasil (pt-BR).
 *
 * Desacopla o núcleo puro do sistema de qualquer fonte externa de dados
 * (seja Power BI Fabric REST API com DAX ou Gerador Mock em memória).
 */

import { Produto, EstoqueFilial, HistoricoVendasFilial } from "@core/dominio";

/**
 * Critérios e filtros aceitos na carga de inventário.
 */
export interface FiltroCargaInventario {
  /**
   * Fornecedores autorizados na carteira do comprador (RBAC).
   * Se for null, indica permissão irrestrita (Admin ou Gestor de Compras).
   */
  readonly fornecedoresPermitidos: readonly number[] | null;

  /**
   * Seção / Categoria específica de autopeças (ex: Suspensão, Freios, etc.).
   */
  readonly secaoId?: number;

  /**
   * Se verdadeiro, filtra apenas itens que possuem saldo em estoque ou vendas recentes.
   */
  readonly apenasComEstoqueOuVenda?: boolean;

  /**
   * Filial específica para visualização ou filtro de estoque (opcional).
   */
  readonly filialId?: number;
}

/**
 * Registro de movimentação de entrada recente (NF-e do dia) para alerta visual no cockpit.
 */
export interface EntradaNFeDoDia {
  readonly numeroNotaFiscal: string;
  readonly produtoId: number;
  readonly filialId: number;
  readonly fornecedorNome: string;
  readonly quantidadeEntrada: number;
  readonly valorEntrada: number;
  readonly dataHoraChegada: string;
}

/**
 * Item intercambiável/similar da mesma aplicação veicular com saldo disponível na rede.
 */
export interface ItemSimilarIntercambiavel {
  readonly produtoIdOrigem: number;
  readonly produtoIdSimilar: number;
  readonly codigoSkuSimilar: string;
  readonly descricaoSimilar: string;
  readonly marcaSimilar: string;
  readonly saldoFisicoDisponivelRede: number;
}

/**
 * Alias de compatibilidade com especificações do projeto.
 */
export type ItemSimiliarIntercambiavel = ItemSimilarIntercambiavel;

/**
 * Sugestão de compra ou reposição gerada pelo ERP do cliente (operação em paralelo).
 */
export interface SugestaoCompraERPItem {
  readonly produtoId: number;
  readonly filialId: number;
  readonly quantidadeSugerida: number;
  readonly dataSugestao: string;
  readonly origem?: string;
  readonly descricao?: string;
  readonly solicitador?: string;
}

/**
 * Loja que a FONTE devolveu e o cadastro do cliente não reconhece.
 *
 * Antes isso virava filial 1 em silêncio (`?? 1`), misturando o estoque de uma
 * loja nova com o da matriz. Agora a linha é descartada e o fato aparece aqui,
 * para o gestor completar o cadastro.
 */
export interface LojaNaoMapeada {
  readonly identificador: string;
  readonly linhasDescartadas: number;
}

/**
 * Metadados operacionais de diagnóstico e observabilidade do adaptador.
 */
export interface MetadadosStatusAdapter {
  readonly provedor: "POWERBI_FABRIC_DAX" | "MOCK_SINTETICO" | "CARREIRO_SNAPSHOT_LOCAL";
  readonly timestampCarga: string;
  readonly emModoDegradado: boolean;
  readonly totalSkusCarregados: number;
  readonly latenciaMs: number;
  readonly motivoModoDegradado?: string | null;
  /** Lojas devolvidas pela fonte que não constam no cadastro do cliente. */
  readonly lojasNaoMapeadas?: readonly LojaNaoMapeada[];
  /**
   * A fonte cortou o resultado por limite (TOPN/paginação) e existe mais dado
   * do que o devolvido. Quem exibe precisa dizer isso ao comprador.
   */
  readonly truncado?: boolean;
}

/**
 * Carga consolidada e normalizada do catálogo, posições de estoque e histórico.
 */
export interface RespostaCargaInventario {
  readonly produtos: readonly Produto[];
  /** Chave do mapa de estoques: `${produtoId}:${filialId}` */
  readonly estoques: ReadonlyMap<string, EstoqueFilial>;
  /** Chave do mapa de históricos: `${produtoId}:${filialId}` */
  readonly historicos: ReadonlyMap<string, HistoricoVendasFilial>;
  readonly entradasHoje: readonly EntradaNFeDoDia[];
  /** Chave do mapa de similares: `produtoId` */
  readonly similares: ReadonlyMap<number, readonly ItemSimilarIntercambiavel[]>;
  /** Chave do mapa de sugestões ERP: `${produtoId}:${filialId}` */
  readonly sugestoesErp?: ReadonlyMap<string, SugestaoCompraERPItem>;
  readonly metadados: MetadadosStatusAdapter;
}

export interface FiltroRastreamentoERP {
  readonly dias?: number;
  readonly filialId?: number;
  readonly fornecedorId?: number;
  readonly limite?: number;
}

export interface PedidoCompraERP {
  readonly id: number;
  readonly numero: number | string;
  readonly dataEmissao: string;
  readonly fornecedorId: number;
  readonly fornecedorNome?: string;
  readonly cotacaoId?: number | null;
  /** Status já traduzido pelo adaptador; o código cru fica em statusOriginal. */
  readonly status: StatusNormalizadoERP;
  readonly statusOriginal: string;
  readonly valorTotal: number;
  /** `null` quando a fonte não distingue a loja (granularidade "rede"). */
  readonly filialId: number | null;
  readonly filialNome: string;
  readonly totalItens?: number;
}

export interface ItemPedidoCompraERP {
  readonly id: number;
  readonly pedidoId: number;
  readonly produtoId: number;
  readonly sku?: string;
  readonly descricao: string;
  readonly quantidade: number;
  readonly valorUnitario: number;
  readonly valorTotal: number;
  readonly dataEmissao: string;
  /** `null` quando a fonte não distingue a loja (granularidade "rede"). */
  readonly filialId: number | null;
  readonly fornecedorId: number;
}

export interface CotacaoCompraERP {
  readonly rowId: number;
  readonly codigo: number;
  readonly descricao: string;
  readonly dataHora: string;
  readonly status: StatusNormalizadoERP;
  readonly statusOriginal: string;
  readonly filialId: number | null;
  readonly filialNome: string;
  readonly totalItens: number;
  readonly totalPropostas: number;
  readonly propostasVencedoras: number;
  readonly menorValorCotado: number;
}

/**
 * Entrada de mercadoria já conferida no ERP, usada pelo ciclo de aprendizado
 * para comparar o que foi pedido com o que de fato chegou.
 */
export interface EntradaConfirmadaERP {
  readonly produtoId: number;
  readonly filialId: number | null;
  readonly quantidadeEntrada: number;
  readonly dataEntrada: string;
  readonly numeroNotaFiscal?: string;
  readonly fornecedorNome?: string;
}

/**
 * Status de pedido/cotação NORMALIZADO pelo adaptador.
 *
 * Traduzir código de ERP ("F", "conc") é trabalho de quem conhece o ERP, e
 * estava na rota (`includes("conc") || === "F"`). "desconhecido" existe porque
 * status não reconhecido não é "aberto": é não medido, e aparece como "—".
 */
export type StatusNormalizadoERP = "aberto" | "concluido" | "cancelado" | "desconhecido";

/**
 * Até onde a fonte distingue a loja num conjunto de dados.
 *
 * "rede" não é defeito a esconder: é o cliente cujo ERP não separa por loja.
 * A tela mostra "Rede" e o motor não atribui o dado a nenhuma filial.
 */
export type GranularidadeLoja = "loja" | "rede";

/** Capacidade: rastrear pedidos de compra e cotações no ERP do cliente. */
export interface CapacidadePedidosERP {
  readonly granularidade: GranularidadeLoja;
  listarPedidos(filtro?: FiltroRastreamentoERP): Promise<readonly PedidoCompraERP[]>;
  listarItensDoPedido(pedidoId: number): Promise<readonly ItemPedidoCompraERP[]>;
  listarComprasNaJanela(dias: number, filialId?: number): Promise<readonly ItemPedidoCompraERP[]>;
}

/** Capacidade: listar cotações do ERP. */
export interface CapacidadeCotacoesERP {
  readonly granularidade: GranularidadeLoja;
  listarCotacoes(filtro?: FiltroRastreamentoERP): Promise<readonly CotacaoCompraERP[]>;
}

/** Capacidade: confirmar, na fonte, o que entrou de verdade. */
export interface CapacidadeEntradasConfirmadas {
  readonly granularidade: GranularidadeLoja;
  listarEntradas(produtoIds: readonly number[], dias: number): Promise<readonly EntradaConfirmadaERP[]>;
}

/**
 * Interface unificada e agnóstica para qualquer provedor de inventário.
 *
 * CAPACIDADES: o que varia entre clientes são os sub-objetos opcionais abaixo.
 * Ter o sub-objeto É ter a capacidade — não há flag que possa discordar do
 * método, e o TypeScript obriga a checar antes de usar. O cadastro do cliente
 * só SUBTRAI capacidade (`fonte.capacidadesDesligadas`), nunca acrescenta
 * (ADR-0003). Ninguém pergunta mais "é a Carreiro?" para decidir o que mostrar.
 */
export interface InventoryAdapter {
  /** Como a fonte se chama para o usuário final (ex: "Power BI"). */
  readonly descricaoFonte: string;

  /**
   * "sintetica" significa dado inventado, e não pode aparecer para cliente
   * real em nenhuma circunstância (ADR-0002).
   */
  readonly natureza: "real" | "sintetica";

  /**
   * Executa a carga completa do inventário aplicando as regras de filtro e RBAC.
   */
  carregarInventarioCompleto(filtro: FiltroCargaInventario): Promise<RespostaCargaInventario>;

  /**
   * Verifica a conectividade e saúde da fonte de dados.
   */
  verificarSaudeConexao(): Promise<boolean>;

  /** A fonte entrega sugestões de compra do próprio ERP na carga. */
  readonly forneceSugestoesErp: boolean;

  /** Presente quando a fonte rastreia pedidos de compra do ERP. */
  readonly pedidosERP?: CapacidadePedidosERP;

  /** Presente quando a fonte lista cotações do ERP. */
  readonly cotacoesERP?: CapacidadeCotacoesERP;

  /** Presente quando a fonte diz o que entrou de verdade (conferência). */
  readonly entradasConfirmadas?: CapacidadeEntradasConfirmadas;
}

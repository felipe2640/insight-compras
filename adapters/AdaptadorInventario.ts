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
 * Metadados operacionais de diagnóstico e observabilidade do adaptador.
 */
export interface MetadadosStatusAdapter {
  readonly provedor: "POWERBI_FABRIC_DAX" | "MOCK_SINTETICO" | "CARREIRO_SNAPSHOT_LOCAL";
  readonly timestampCarga: string;
  readonly emModoDegradado: boolean;
  readonly totalSkusCarregados: number;
  readonly latenciaMs: number;
  readonly motivoModoDegradado?: string | null;
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
  readonly metadados: MetadadosStatusAdapter;
}

/**
 * Interface unificada e agnóstica para qualquer provedor de inventário.
 */
export interface InventoryAdapter {
  /**
   * Executa a carga completa do inventário aplicando as regras de filtro e RBAC.
   */
  carregarInventarioCompleto(filtro: FiltroCargaInventario): Promise<RespostaCargaInventario>;

  /**
   * Verifica a conectividade e saúde da fonte de dados (Power BI ou Mock).
   */
  verificarSaudeConexao(): Promise<boolean>;
}

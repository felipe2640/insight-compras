/**
 * Entidade de domínio: Produto
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 */

export type CurvaABC = "A" | "B" | "C";

export type PerfilRotatividade =
  | "ALTO_GIRO"
  | "MEDIO_GIRO"
  | "BAIXO_GIRO_INTERMITENTE"
  | "SEM_HISTORICO_SUFICIENTE";

export interface Produto {
  readonly id: number;
  readonly codigoSku: string;
  readonly descricao: string;
  readonly marca: string;
  readonly fabricante: string;
  readonly referenciaFabricante: string | null;
  readonly aplicacaoVeicular: string | null;
  readonly familiaId: string | null;
  readonly secaoId: number | null;
  /** Grupo/classe do ERP. Cuidado: alguns clientes usam marca como classe. */
  readonly nomeSecao: string | null;
  /** Sub-grupo (tipo da peça: BIELETA, PIVO, BOMBA COMBUSTIVEL). */
  readonly subgrupoId?: number | null;
  readonly subgrupoNome?: string | null;
  readonly fornecedorId: number;
  readonly nomeFornecedor: string;
  readonly precoCusto: number;
  readonly precoVenda: number;
  readonly loteMultiplo: number; // 1 = avulso, 2 = par, 4 = jogo
  readonly origemLoteMultiplo?: "CONFIGURACAO" | "ERP" | "HISTOGRAMA" | "VOCABULARIO" | "PADRAO";
  /**
   * ENTRADAS CRUAS da resolução do múltiplo, preservadas.
   *
   * O múltiplo final depende da configuração do cliente (quais fontes valem,
   * exceções por SKU), que é editável em tela e mesclada por requisição. Sem
   * guardar as entradas, trocar a configuração exigia recarregar a fonte — e o
   * adaptador ficava preso a uma configuração de lotes, com cache frio a cada
   * edição. Com elas, o múltiplo é recalculado sobre a carga em cache.
   *
   * 0 = a fonte não informou.
   */
  readonly loteErp?: number;
  readonly loteHistograma?: number;
  readonly dataUltimaVenda?: string | null;
  readonly dataUltimaCompra?: string | null;
  /**
   * Data da última solicitação de compra. Nível de PRODUTO: a fonte do cliente
   * não distingue a loja que pediu.
   */
  readonly dataUltimoPedido?: string | null;
}

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
  readonly nomeSecao: string | null;
  readonly fornecedorId: number;
  readonly nomeFornecedor: string;
  readonly precoCusto: number;
  readonly precoVenda: number;
  readonly loteMultiplo: number; // 1 = avulso, 2 = par, 4 = jogo
  readonly dataUltimaVenda?: string | null;
  readonly dataUltimaCompra?: string | null;
}

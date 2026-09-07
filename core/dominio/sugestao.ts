/**
 * Entidade de domínio: SugestaoCompraItem e StatusSugestao
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 */

import { Produto, CurvaABC, PerfilRotatividade } from "./produto";

export type StatusSugestao =
  | "APROVADO_COMPRA"
  | "ESTOQUE_SUFICIENTE"
  | "COBERTO_POR_TRANSFERENCIA"
  | "TRAVADO_MARCA_ZUMBI"
  | "TRAVADO_COBERTURA_FAMILIA"
  | "INELEGIVEL_SEM_HISTORICO";

export interface SugestaoCompraItem {
  readonly produto: Produto;
  readonly filialId: number;
  readonly perfilGiro: PerfilRotatividade;
  readonly curvaAbc: CurvaABC;
  readonly consumoDiarioCalculado: number;
  readonly estoqueAtual: number;
  readonly estoqueMinimoSeguranca: number;
  readonly quantidadeJaPedida: number;
  readonly necessidadeBruta: number;
  readonly quantidadeTransferenciaReceber: number;
  readonly quantidadeTransferenciaEnviar: number;
  readonly filialOrigemTransferencia: number | null;
  readonly filialDestinoTransferencia: number | null;
  readonly sugestaoFinalCompra: number;
  readonly statusSugestao: StatusSugestao;
  readonly motivoDecisao: string;
}

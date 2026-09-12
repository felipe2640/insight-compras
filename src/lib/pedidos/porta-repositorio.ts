/**
 * Porta de Persistência do Ciclo de Vida de Pedidos
 * Camada: Aplicação / Pedidos (src/lib/pedidos/porta-repositorio.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { ItemPedido, Pedido, StatusPedido } from "./tipos";

export type IdProvedorPedidos = "supabase" | "memoria";

export interface FiltrosListagemPedidos {
  readonly tenantId: string;
  readonly dias: number;
  readonly filialId?: number;
  readonly status?: StatusPedido;
  readonly limite?: number;
}

export interface ParametrosTransicaoPedido {
  readonly tenantId: string;
  readonly pedidoId: number;
  readonly novoStatus: StatusPedido;
  readonly responsavel: string;
  readonly observacao?: string | null;
  readonly dataHora?: string;
}

export interface RepositorioPedidos {
  readonly id: IdProvedorPedidos;
  listarPedidos(filtros: FiltrosListagemPedidos): Promise<readonly Pedido[]>;
  obterPedidoPorId(tenantId: string, pedidoId: number): Promise<Pedido | null>;
  listarItensDoPedido(tenantId: string, pedidoId: number): Promise<readonly ItemPedido[]>;
  atualizarStatusPedido(parametros: ParametrosTransicaoPedido): Promise<Pedido>;
  limpar?(tenantId?: string): void | Promise<void>;
}

/**
 * Repositório e Fachada de Acesso ao Histórico e Ciclo de Vida de Pedidos
 * Camada: Aplicação / Pedidos (src/lib/pedidos/repositorio.ts) — server-only.
 * 100% em Português do Brasil (pt-BR).
 */

import { supabaseConfigurado } from "@/lib/aprendizado/supabase";
import {
  FiltrosListagemPedidos,
  IdProvedorPedidos,
  ParametrosTransicaoPedido,
  RepositorioPedidos,
} from "./porta-repositorio";
import { ItemPedido, Pedido, StatusPedido, TransicaoPedido } from "./tipos";
import { RepositorioPedidosMemoria } from "./provedores/memoria";
import { RepositorioPedidosSupabase } from "./provedores/supabase";

export type {
  Pedido,
  ItemPedido,
  StatusPedido,
  TransicaoPedido,
  PedidoExportado,
  ItemPedidoExportado,
} from "./tipos";

export type {
  FiltrosListagemPedidos,
  ParametrosTransicaoPedido,
  RepositorioPedidos,
  IdProvedorPedidos,
} from "./porta-repositorio";

export { RepositorioPedidosMemoria } from "./provedores/memoria";
export { RepositorioPedidosSupabase } from "./provedores/supabase";

export function idProvedorPedidos(): IdProvedorPedidos {
  const forcado = process.env.PEDIDOS_PROVIDER?.trim().toLowerCase();
  if (forcado === "memoria") return "memoria";
  if (forcado === "supabase") return "supabase";
  return supabaseConfigurado() ? "supabase" : "memoria";
}

let repositorioPersonalizado: RepositorioPedidos | null = null;
let instanciaMemoria: RepositorioPedidosMemoria | null = null;
let instanciaSupabase: RepositorioPedidosSupabase | null = null;

export function obterRepositorioPedidos(): RepositorioPedidos {
  if (repositorioPersonalizado) {
    return repositorioPersonalizado;
  }

  const id = idProvedorPedidos();
  if (id === "supabase") {
    return (instanciaSupabase ??= new RepositorioPedidosSupabase());
  }

  return (instanciaMemoria ??= new RepositorioPedidosMemoria(true));
}

export function definirRepositorioPedidos(repo: RepositorioPedidos | null): void {
  repositorioPersonalizado = repo;
}

export function reiniciarRepositorioPedidos(): void {
  repositorioPersonalizado = null;
  instanciaMemoria = null;
  instanciaSupabase = null;
}

/**
 * Indica se o histórico de pedidos está disponível para consulta e atualização.
 * Sempre disponível: em produção conecta ao Supabase; em demonstração/desenvolvimento
 * utiliza o provedor em memória como fallback gracioso.
 */
export function historicoDisponivel(): boolean {
  return true;
}

export function modoHistorico(): IdProvedorPedidos {
  return idProvedorPedidos();
}

export async function listarPedidosExportados(parametros: {
  tenantId: string;
  dias: number;
  filialId?: number;
  status?: StatusPedido;
  limite?: number;
}): Promise<Pedido[]> {
  const repo = obterRepositorioPedidos();
  const resultados = await repo.listarPedidos(parametros);
  return [...resultados];
}

export async function obterPedidoPorId(
  tenantId: string,
  pedidoId: number
): Promise<Pedido | null> {
  const repo = obterRepositorioPedidos();
  return repo.obterPedidoPorId(tenantId, pedidoId);
}

export async function listarItensDoPedido(
  tenantId: string,
  pedidoId: number
): Promise<ItemPedido[]> {
  const repo = obterRepositorioPedidos();
  const resultados = await repo.listarItensDoPedido(tenantId, pedidoId);
  return [...resultados];
}

export async function atualizarStatusPedido(
  parametros: ParametrosTransicaoPedido
): Promise<Pedido> {
  const repo = obterRepositorioPedidos();
  return repo.atualizarStatusPedido(parametros);
}

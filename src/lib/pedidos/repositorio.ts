/**
 * Repositório e Fachada de Acesso ao Histórico e Ciclo de Vida de Pedidos
 * Camada: Aplicação / Pedidos (src/lib/pedidos/repositorio.ts) — server-only.
 * 100% em Português do Brasil (pt-BR).
 */

import { supabaseConfigurado } from "@/lib/aprendizado/supabase";
import { resolverTenantConfigurado , naturezaTenant } from "@config/tenants";
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

/**
 * Registros de demonstração: só para o tenant de DEMONSTRAÇÃO.
 *
 * O provedor em memória é o que atende quando não há banco configurado — e
 * isso acontece por OMISSÃO, bastando faltar a variável do Supabase no
 * ambiente. Semeado incondicionalmente, ele enchia a instalação de um cliente
 * REAL com pedidos de compra inventados, com SKU, fornecedor e valor.
 *
 * Medido com TENANT_ATIVO=carreiro e sem Supabase: a tela trazia "Carlos
 * Comprador" e "Ana Suprimentos" operando em "Loja Central 01" e "Filial Norte
 * 02" — pessoas e lojas que não existem na rede — com justificativas escritas
 * e valores em reais, e os indicadores do topo calculados em cima disso.
 *
 * A regra é a mesma da fonte de dados: cliente de natureza sintética recebe
 * conteúdo sintético; cliente real começa vazio, que é a verdade.
 *
 * Lê o tenant do AMBIENTE de propósito: isto roda na inicialização do módulo,
 * fora de qualquer requisição. Numa instalação dedicada (TENANT_ATIVO
 * obrigatório em produção, ADR-0001) ambiente e requisição são o mesmo cliente.
 */
function deveSemearDemonstracao(): boolean {
  try {
    return naturezaTenant(resolverTenantConfigurado()) === "sintetica";
  } catch {
    // Sem TENANT_ATIVO em produção o erro aparece no contexto da requisição,
    // com mensagem útil. Aqui, na dúvida, NÃO semeia dado sintético.
    return false;
  }
}

let repositorioPersonalizado: RepositorioPedidos | null = null;
let instanciaMemoria: RepositorioPedidosMemoria | null = null;
let memoriaSemeada: boolean | null = null;
let instanciaSupabase: RepositorioPedidosSupabase | null = null;

export function obterRepositorioPedidos(): RepositorioPedidos {
  if (repositorioPersonalizado) {
    return repositorioPersonalizado;
  }

  const id = idProvedorPedidos();
  if (id === "supabase") {
    return (instanciaSupabase ??= new RepositorioPedidosSupabase());
  }

  const semear = deveSemearDemonstracao();
  if (!instanciaMemoria || memoriaSemeada !== semear) {
    instanciaMemoria = new RepositorioPedidosMemoria(semear);
    memoriaSemeada = semear;
  }
  return instanciaMemoria;
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
/**
 * Existe histórico para consultar? Sempre sim — o provedor em memória atende.
 *
 * Não confunda com PERSISTIDO: use `historicoPersistido()` para saber se o que
 * o comprador registrar sobrevive ao próximo deploy.
 */
export function historicoDisponivel(): boolean {
  return true;
}

/**
 * O histórico sobrevive a um reinício?
 *
 * Só com banco configurado. Sem ele, o provedor em memória some a cada deploy
 * ou reciclagem de função — e a tela precisa dizer isso. Antes ela tinha o
 * aviso pronto, mas ele nunca aparecia: a rota respondia `configurado: true`
 * de qualquer jeito, e o comprador não tinha como saber que o pedido que ele
 * acabou de avançar de estado ia evaporar.
 */
export function historicoPersistido(): boolean {
  return idProvedorPedidos() === "supabase";
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

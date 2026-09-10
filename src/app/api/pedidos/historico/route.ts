/**
 * GET /api/pedidos/historico?dias=30            -> pedidos exportados
 * GET /api/pedidos/historico?pedidoId=12        -> itens de um pedido
 *
 * O comprador só enxerga o que a carteira dele permite? Não aqui: o histórico é
 * o registro do que a REDE decidiu, e esconder pedido de colega esconderia
 * duplicidade. Quem entra vê tudo do seu tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { obterUsuarioDaRequisicao, respostaNaoAutenticado } from "@/lib/autenticacao/servidor";
import {
  historicoDisponivel,
  listarItensDoPedido,
  listarPedidosExportados,
} from "@/lib/pedidos/repositorio";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioDaRequisicao(request);
  if (!usuario) return respostaNaoAutenticado();

  if (!historicoDisponivel()) {
    return NextResponse.json({ configurado: false, pedidos: [], itens: [] });
  }

  const p = new URL(request.url).searchParams;

  const pedidoId = p.get("pedidoId");
  if (pedidoId) {
    const id = parseInt(pedidoId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ erro: "pedidoId inválido" }, { status: 400 });
    }
    try {
      return NextResponse.json({ configurado: true, itens: await listarItensDoPedido(usuario.tenantId, id) });
    } catch (erro) {
      console.error("[pedidos] falha ao abrir pedido:", erro);
      return NextResponse.json({ erro: "falha ao abrir o pedido" }, { status: 500 });
    }
  }

  const dias = Math.min(365, Math.max(1, parseInt(p.get("dias") ?? "30", 10) || 30));
  const filialQuery = p.get("filialId");
  const filialId = filialQuery ? parseInt(filialQuery, 10) : undefined;

  const pedidos = await listarPedidosExportados({
    tenantId: usuario.tenantId,
    dias,
    filialId: Number.isInteger(filialId) && (filialId as number) > 0 ? filialId : undefined,
  });

  return NextResponse.json({ configurado: true, dias, pedidos });
}

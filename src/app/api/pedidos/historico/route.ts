/**
 * GET /api/pedidos/historico?dias=30&filialId=1&status=enviado  -> pedidos exportados com filtros
 * GET /api/pedidos/historico?pedidoId=12                       -> pedido e seus itens
 * PATCH /api/pedidos/historico                                 -> avança estado no ciclo de vida
 *
 * O comprador só enxerga o que a carteira dele permite? Não aqui: o histórico é
 * o registro do que a REDE decidiu, e esconder pedido de colega esconderia
 * duplicidade. Quem entra vê tudo do seu tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { obterUsuarioDaRequisicao, respostaNaoAutenticado } from "@/lib/autenticacao/servidor";
import {
  atualizarStatusPedido,
  historicoDisponivel,
  historicoPersistido,
  listarItensDoPedido,
  listarPedidosExportados,
  obterPedidoPorId,
  StatusPedido,
} from "@/lib/pedidos";

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
      const [itens, pedido] = await Promise.all([
        listarItensDoPedido(usuario.tenantId, id),
        obterPedidoPorId(usuario.tenantId, id),
      ]);
      return NextResponse.json({ configurado: historicoPersistido(), pedido, itens });
    } catch (erro) {
      console.error("[pedidos] falha ao abrir pedido:", erro);
      return NextResponse.json({ erro: "falha ao abrir o pedido" }, { status: 500 });
    }
  }

  const dias = Math.min(365, Math.max(1, parseInt(p.get("dias") ?? "30", 10) || 30));
  const filialQuery = p.get("filialId");
  const filialId = filialQuery ? parseInt(filialQuery, 10) : undefined;
  const statusParam = p.get("status");
  const status =
    statusParam === "exportado" ||
    statusParam === "enviado" ||
    statusParam === "confirmado" ||
    statusParam === "recebido"
      ? (statusParam as StatusPedido)
      : undefined;

  const pedidos = await listarPedidosExportados({
    tenantId: usuario.tenantId,
    dias,
    filialId: Number.isInteger(filialId) && (filialId as number) > 0 ? filialId : undefined,
    status,
  });

  return NextResponse.json({ configurado: historicoPersistido(), dias, pedidos });
}

export async function PATCH(request: NextRequest) {
  const usuario = await obterUsuarioDaRequisicao(request);
  if (!usuario) return respostaNaoAutenticado();

  try {
    const corpo = await request.json();
    const pedidoId = Number(corpo.pedidoId);
    const novoStatus = corpo.novoStatus as StatusPedido;
    const observacao = corpo.observacao as string | undefined;

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return NextResponse.json({ sucesso: false, erro: "pedidoId inválido" }, { status: 400 });
    }

    if (!novoStatus || !["exportado", "enviado", "confirmado", "recebido"].includes(novoStatus)) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "novoStatus inválido. Estados permitidos: exportado, enviado, confirmado, recebido.",
        },
        { status: 400 }
      );
    }

    const responsavel = usuario.nome ? `${usuario.nome} (${usuario.email})` : usuario.email;

    const pedidoAtualizado = await atualizarStatusPedido({
      tenantId: usuario.tenantId,
      pedidoId,
      novoStatus,
      responsavel,
      observacao,
    });

    return NextResponse.json({
      sucesso: true,
      mensagem: `Status do pedido #${pedidoId} atualizado para '${novoStatus}' com sucesso.`,
      pedido: pedidoAtualizado,
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Erro ao atualizar status do pedido";
    return NextResponse.json({ sucesso: false, erro: mensagem }, { status: 400 });
  }
}

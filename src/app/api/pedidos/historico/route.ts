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
  Pedido,
} from "@/lib/pedidos";
import { obterAdaptadorInventario } from "@adapters/index";
import { obterConfiguracaoTenant } from "@config/tenants";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioDaRequisicao(request);
  if (!usuario) return respostaNaoAutenticado();

  const tenant = obterConfiguracaoTenant(usuario.tenantId);
  const temProcessoERP = Boolean(tenant.processoCompra?.habilitado);
  const p = new URL(request.url).searchParams;

  const dias = Math.min(365, Math.max(1, parseInt(p.get("dias") ?? "30", 10) || 30));
  const filialQuery = p.get("filialId");
  const filialId = filialQuery ? parseInt(filialQuery, 10) : undefined;
  const origemParam = p.get("origem")?.toLowerCase();
  const origem = origemParam ?? "exportacao";
  const tipo = p.get("tipo"); // 'cotacoes' ou 'pedidos'

  // Consulta de cotações do ERP
  if (tipo === "cotacoes") {
    const adaptador = obterAdaptadorInventario({ tenant: usuario.tenantId });
    if (adaptador.listarCotacoesERP) {
      const cotacoes = await adaptador.listarCotacoesERP({ dias, filialId });
      return NextResponse.json({ configurado: true, tipo: "cotacoes", dias, cotacoes });
    }
    return NextResponse.json({ configurado: false, tipo: "cotacoes", cotacoes: [] });
  }

  // Detalhe de pedido específico
  const pedidoId = p.get("pedidoId");
  if (pedidoId) {
    const id = parseInt(pedidoId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ erro: "pedidoId inválido" }, { status: 400 });
    }

    // 1. Busca primeiro no repositório de exportações
    const pedidoLocal = await obterPedidoPorId(usuario.tenantId, id);
    if (pedidoLocal) {
      const itens = await listarItensDoPedido(usuario.tenantId, id);
      return NextResponse.json({
        configurado: historicoPersistido(),
        origem: "exportacao",
        pedido: pedidoLocal,
        itens,
      });
    }

    // 2. Se não encontrado localmente e for pedido do ERP
    const adaptador = obterAdaptadorInventario({ tenant: usuario.tenantId });
    if (adaptador.listarItensPedidoCompraERP) {
      const itensErp = await adaptador.listarItensPedidoCompraERP(id);
      if (itensErp && itensErp.length > 0) {
        const itens = itensErp.map((it) => ({
          id: it.id,
          sku: it.sku ?? (it.produtoId ? String(it.produtoId).padStart(6, "0") : `PROD-${it.produtoId}`),
          descricao: it.descricao || "Item de Compra ERP",
          qtdComprador: it.quantidade,
          qtdTransferencia: 0,
          qtdModelo: null,
          custo: it.valorUnitario,
          valorTotal: it.valorTotal,
          quantidade: it.quantidade,
          valorUnitario: it.valorUnitario,
          dataEmissao: it.dataEmissao,
        }));
        return NextResponse.json({
          configurado: true,
          origem: "erp",
          itens,
        });
      }
    }

    return NextResponse.json({ erro: "falha ao abrir o pedido" }, { status: 404 });
  }

  const statusParam = p.get("status");
  const status =
    statusParam === "exportado" ||
    statusParam === "enviado" ||
    statusParam === "confirmado" ||
    statusParam === "recebido"
      ? (statusParam as StatusPedido)
      : undefined;

  let pedidos: Pedido[] = [];

  // 1. Busca Pedidos do ERP se solicitado
  if (origem === "erp" || origem === "todos") {
    const adaptador = obterAdaptadorInventario({ tenant: usuario.tenantId });
    if (adaptador.listarPedidosCompraERP) {
      const pedidosErp = await adaptador.listarPedidosCompraERP({
        dias,
        filialId: Number.isInteger(filialId) && (filialId as number) > 0 ? filialId : undefined,
      });

      const ehConnectsoft = tenant.processoCompra?.tipoERP === "connectsoft-shopcash";
      const rotuloErp = ehConnectsoft ? "ERP Connectsoft" : "ERP Integrado";
      const modeloErpId = ehConnectsoft ? "erp-connectsoft" : "erp-integrado";

      const pedidosMapeados: Pedido[] = pedidosErp.map((pErp) => {
        const statusNormalizado: StatusPedido =
          pErp.status.toLowerCase().includes("conc") || pErp.status === "F"
            ? "confirmado"
            : "enviado";

        return {
          id: pErp.id,
          tenantId: usuario.tenantId,
          exportadoEm: pErp.dataEmissao,
          usuario: rotuloErp,
          filialId: pErp.filialId,
          filialNome: pErp.filialNome,
          modeloId: modeloErpId,
          formato: "ERP",
          totalItens: pErp.totalItens ?? 1,
          status: statusNormalizado,
          origem: "erp" as const,
          numeroPedidoERP: pErp.numero,
          fornecedorId: pErp.fornecedorId,
          fornecedorNome: pErp.fornecedorNome,
          cotacaoId: pErp.cotacaoId,
          valorTotal: pErp.valorTotal,
          dataEmissao: pErp.dataEmissao,
          statusERP: pErp.status,
          historico: [],
        };
      });

      if (!status) {
        pedidos = pedidosMapeados;
      } else {
        pedidos = pedidosMapeados.filter((p) => p.status === status);
      }
    }
  }

  // 2. Busca Pedidos Exportados se solicitado
  if (origem === "exportacao" || origem === "todos") {
    if (historicoDisponivel()) {
      const pedidosExportados = await listarPedidosExportados({
        tenantId: usuario.tenantId,
        dias,
        filialId: Number.isInteger(filialId) && (filialId as number) > 0 ? filialId : undefined,
        status,
      });

      const exportadosMarcados = pedidosExportados.map((pExp) => ({
        ...pExp,
        origem: "exportacao" as const,
      }));

      pedidos = origem === "todos" ? [...pedidos, ...exportadosMarcados] : exportadosMarcados;
    }
  }

  return NextResponse.json({
    configurado: origem === "erp" ? true : historicoPersistido(),
    dias,
    origem,
    pedidos,
    temProcessoERP,
  });

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

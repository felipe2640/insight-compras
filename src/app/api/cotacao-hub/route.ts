import { NextRequest, NextResponse } from "next/server";
import { aplicarGuardrailInventarioServerSide } from "@/lib/rbac/validador-carteira";
import { listarIdsProdutosEmPedidosAtivos } from "@/lib/pedidos/produtos-pendentes";
import { atualizarStatusPedido } from "@/lib/pedidos";
import { createConnector } from "@/lib/cotacao-hub/connector";
import { createSnapshot, selectionSchema } from "@/lib/cotacao-hub/selection";
import { connectorContext, connectorFailure } from "@/lib/cotacao-hub/server-context";
import type { Supplier } from "@/lib/cotacao-hub/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { config, context } = await connectorContext(request, true);
    if (Number(request.headers.get("content-length") ?? 0) > 200_000) return new Response(null, { status: 413 });
    const input = selectionSchema.parse(await request.json());

    // Mesclar fornecedores informados na seleção (com e-mail informado ou extraído do Power BI)
    let effectiveConfig = config;
    if (input.suppliersData && input.suppliersData.length > 0) {
      const dynamicSuppliers: Supplier[] = input.suppliersData.map(s => ({
        external_id: s.id,
        legal_name: s.name,
        contacts: [{ name: s.name, email: s.email }],
      }));
      const dynamicIds = new Set(dynamicSuppliers.map(d => d.external_id));
      effectiveConfig = {
        ...config,
        suppliers: [
          ...dynamicSuppliers,
          ...config.suppliers.filter(s => !dynamicIds.has(s.external_id)),
        ],
      };
    }

    const filter = aplicarGuardrailInventarioServerSide(
      context.usuario,
      input.filialId ? { filialId: input.filialId } : {}
    );
    const [inventory, pendingRaw] = await Promise.all([
      context.carregarInventario(filter),
      listarIdsProdutosEmPedidosAtivos(context.tenant.id, input.filialId ?? 1),
    ]);

    // Se a cotação for compilada a partir de pedidos existentes, esses produtos não devem ser bloqueados por si mesmos
    const pending = (input.pedidoIds && input.pedidoIds.length > 0)
      ? new Set<number>()
      : pendingRaw;

    const snapshot = createSnapshot(effectiveConfig, context.usuario, context.tenant, inventory.produtos, pending, input);
    const result = await createConnector(effectiveConfig).submit(snapshot);

    // Avançar automaticamente o status dos pedidos compilados para "enviado"
    if (input.pedidoIds && input.pedidoIds.length > 0) {
      for (const pedidoId of input.pedidoIds) {
        try {
          await atualizarStatusPedido({
            tenantId: context.tenant.id,
            pedidoId,
            novoStatus: "enviado",
            responsavel: context.usuario.nome || context.usuario.email || "Cotação Hub",
            observacao: `Cotação compilada #${result.quotationId || input.externalId} disparada no Cotação Hub`,
          });
        } catch (errAtualizar) {
          console.warn(`[cotacao-hub] Falha ao avançar status do pedido #${pedidoId}:`, errAtualizar);
        }
      }
    }

    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[cotacao-hub] Erro no POST:", err);
    return connectorFailure(err instanceof Error ? err.message : undefined);
  }
}
export async function GET(request: NextRequest) {
  try {
    const { config, context } = await connectorContext(request);
    const ledger = await createConnector(config).status();
    const sends = Object.values(ledger.submissions).filter(s => context.usuario.role !== "COMPRADOR" || s.snapshot.actorId === context.usuario.id);

    // Buscar fornecedores com email da tabela FORNECEDOR (AEMAIL) do Power BI
    let pbiSuppliers: readonly { id: string; name: string; email: string }[] = [];
    if (typeof (context.fonte as any).carregarFornecedoresComEmail === "function") {
      try {
        pbiSuppliers = await (context.fonte as any).carregarFornecedoresComEmail();
      } catch (err) {
        console.warn("[cotacao-hub] Erro ao carregar fornecedores do Power BI:", err);
      }
    }

    const supplierMap = new Map<string, { id: string; name: string; email: string }>();
    for (const s of config.suppliers) {
      supplierMap.set(s.external_id, {
        id: s.external_id,
        name: s.legal_name,
        email: s.contacts[0]?.email || "",
      });
    }
    for (const p of pbiSuppliers) {
      const existing = supplierMap.get(p.id);
      supplierMap.set(p.id, {
        id: p.id,
        name: p.name || existing?.name || `Fornecedor ${p.id}`,
        email: p.email || existing?.email || "",
      });
    }

    let catalogProducts: { id: number; sku: string; descricao: string; marca: string; fabricante: string; referencia: string }[] = [];
    try {
      const filter = aplicarGuardrailInventarioServerSide(context.usuario, {});
      const inv = await context.carregarInventario(filter);
      catalogProducts = inv.produtos.map(p => ({
        id: p.id,
        sku: p.codigoSku,
        descricao: p.descricao,
        marca: p.marca || "",
        fabricante: p.fabricante || "",
        referencia: p.referenciaFabricante || "",
      }));
    } catch (e) {
      console.warn("[cotacao-hub] Erro ao carregar catálogo para prévia:", e);
    }

    return NextResponse.json({
      portalOrigin: config.portalOrigin,
      applicationId: config.applicationId,
      suppliers: Array.from(supplierMap.values()),
      units: config.units,
      catalogProducts,
      submissions: sends.map(s => ({ externalId: s.snapshot.externalId, quotationId: s.quotationId, state: s.state })),
      drafts: ledger.drafts.filter(d => sends.some(s => s.quotationId === d.quotationId)),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[cotacao-hub] Erro no GET:", err);
    return connectorFailure(err instanceof Error ? err.message : undefined);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { aplicarGuardrailInventarioServerSide } from "@/lib/rbac/validador-carteira";
import { listarIdsProdutosEmPedidosAtivos } from "@/lib/pedidos/produtos-pendentes";
import { createConnector } from "@/lib/cotacao-hub/connector";
import { createSnapshot, selectionSchema } from "@/lib/cotacao-hub/selection";
import { connectorContext, connectorFailure } from "@/lib/cotacao-hub/server-context";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { config, context } = await connectorContext(request, true);
    if (Number(request.headers.get("content-length") ?? 0) > 200_000) return new Response(null, { status: 413 });
    const input = selectionSchema.parse(await request.json());
    const filter = aplicarGuardrailInventarioServerSide(context.usuario, { filialId: input.filialId });
    const [inventory, pending] = await Promise.all([
      context.carregarInventario(filter), listarIdsProdutosEmPedidosAtivos(context.tenant.id, input.filialId),
    ]);
    const snapshot = createSnapshot(config, context.usuario, context.tenant, inventory.produtos, pending, input);
    const result = await createConnector(config).submit(snapshot);
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch { return connectorFailure(); }
}
export async function GET(request: NextRequest) {
  try {
    const { config, context } = await connectorContext(request);
    const ledger = await createConnector(config).status();
    const sends = Object.values(ledger.submissions).filter(s => context.usuario.role !== "COMPRADOR" || s.snapshot.actorId === context.usuario.id);
    return NextResponse.json({ portalOrigin: config.portalOrigin, applicationId: config.applicationId,
      suppliers: config.suppliers.filter(s => context.usuario.role !== "COMPRADOR" || new Set(context.usuario.allowedSupplierIds ?? []).has(Number(s.external_id)))
        .map(s => ({ id: s.external_id, name: s.legal_name })),
      submissions: sends.map(s => ({ externalId: s.snapshot.externalId, quotationId: s.quotationId, state: s.state })),
      drafts: ledger.drafts.filter(d => sends.some(s => s.quotationId === d.quotationId)),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch { return connectorFailure(); }
}

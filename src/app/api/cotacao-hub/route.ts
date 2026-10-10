import { NextRequest, NextResponse } from "next/server";
import { aplicarGuardrailInventarioServerSide } from "@/lib/rbac/validador-carteira";
import { listarIdsProdutosEmPedidosAtivos } from "@/lib/pedidos/produtos-pendentes";
import { createConnector } from "@/lib/cotacao-hub/connector";
import { createSnapshot, selectionSchema } from "@/lib/cotacao-hub/selection";
import { connectorContext, connectorFailure } from "@/lib/cotacao-hub/server-context";
import { fonteFornecedoresAutorizada, revalidarSuppliersDaSelecao } from "@/lib/cotacao-hub/fornecedores";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { config, context } = await connectorContext(request, true);
    if (Number(request.headers.get("content-length") ?? 0) > 200_000) return new Response(null, { status: 413 });
    const input = selectionSchema.parse(await request.json());

    // Autoridade de cadastro: o browser sugere (suppliersData), o servidor
    // decide contra a fonte autorizada (conexão + contatosFornecedores do
    // adaptador). Nome vem da fonte; e-mail é correção explícita conferida.
    const fonteAutorizada = await fonteFornecedoresAutorizada(config, context.fonte);
    const { efetiva: effectiveConfig } = revalidarSuppliersDaSelecao(config, fonteAutorizada, input.suppliersData);

    const filter = aplicarGuardrailInventarioServerSide(
      context.usuario,
      input.filialId ? { filialId: input.filialId } : {}
    );
    const [inventory, pendingRaw] = await Promise.all([
      context.carregarInventario(filter),
      // Sem filial em foco (cotação multi-loja) consulta o tenant inteiro;
      // nunca cai para a filial 1 em silêncio.
      listarIdsProdutosEmPedidosAtivos(context.tenant.id, input.filialId),
    ]);
    // Se a cotação for compilada a partir de pedidos existentes, esses produtos não devem ser bloqueados por si mesmos
    const pending = (input.pedidoIds && input.pedidoIds.length > 0)
      ? new Set<number>()
      : pendingRaw;

    const snapshot = createSnapshot(effectiveConfig, context.usuario, context.tenant, inventory.produtos, pending, input);
    const result = await createConnector(effectiveConfig).submit(snapshot);

    // O estado COMERCIAL do pedido não muda porque uma cotação foi enviada
    // (decisão vigente): a integração registra o próprio estado no ledger
    // (submissions.state) e o retorno do Hub gera rascunhos para revisão —
    // nunca compra nem confirmação automática.

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

    // Fornecedores da fonte autorizada: cadastro da conexão + capacidade
    // tipada contatosFornecedores do adaptador (ex.: AEMAIL do Power BI).
    const fonteAutorizada = await fonteFornecedoresAutorizada(config, context.fonte);
    const supplierMap = new Map<string, { id: string; name: string; email: string }>();
    for (const [id, oficial] of fonteAutorizada) {
      supplierMap.set(id, {
        id,
        name: oficial.name || `Fornecedor ${id}`,
        email: oficial.email || "",
      });
    }

    return NextResponse.json({
      portalOrigin: config.portalOrigin,
      applicationId: config.applicationId,
      suppliers: Array.from(supplierMap.values()),
      units: config.units,
      submissions: sends.map(s => ({ externalId: s.snapshot.externalId, quotationId: s.quotationId, state: s.state })),
      drafts: ledger.drafts.filter(d => sends.some(s => s.quotationId === d.quotationId)),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[cotacao-hub] Erro no GET:", err);
    return connectorFailure(err instanceof Error ? err.message : undefined);
  }
}

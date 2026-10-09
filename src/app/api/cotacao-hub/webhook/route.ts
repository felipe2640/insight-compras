import { NextRequest } from "next/server";
import { loadConfig } from "@/lib/cotacao-hub/config";
import { createConnector } from "@/lib/cotacao-hub/connector";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Receptor do webhook do Cotação Hub (award.approved.v1 e eventos irmãos).
 *
 * A proteção é criptográfica e de configuração, não de endereço:
 * - a conexão precisa existir (loadConfig falha fechado — sem config, 503);
 * - receive() confere key id autorizado, timestamp na janela de 5 min e
 *   HMAC-SHA256 sobre os bytes brutos (`timestamp.eventId.` + corpo);
 * - o evento é deduplicado por event id no inbox durável antes de processar.
 *
 * O bloqueio exclusivo de localhost foi removido: o Hub assina entregas
 * HTTPS reais e o endpoint publica em https://<dominio>/api/cotacao-hub/webhook
 * conforme o contrato (WebhookSubscriptionCreate exige ^https://). Remover o
 * guard não tornou o endpoint permissivo — sem assinatura válida da conexão
 * registrada, nada é persistido e nenhuma compra é emitida.
 */
export async function POST(request: NextRequest) {
  try {
    const config = await loadConfig();
    if (Number(request.headers.get("content-length") ?? 0) > 1_048_576) return new Response(null, { status: 413 });
    const raw = Buffer.from(await request.arrayBuffer());
    await createConnector(config).receive(raw, Object.fromEntries(request.headers.entries()));
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ erro: "Evento não aceito; nenhuma compra emitida." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}

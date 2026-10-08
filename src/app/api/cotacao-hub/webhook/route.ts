import { NextRequest } from "next/server";
import { loadConfig } from "@/lib/cotacao-hub/config";
import { createConnector } from "@/lib/cotacao-hub/connector";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname)) return new Response(null, { status: 403 });
    const config = await loadConfig();
    if (Number(request.headers.get("content-length") ?? 0) > 1_048_576) return new Response(null, { status: 413 });
    const raw = Buffer.from(await request.arrayBuffer());
    await createConnector(config).receive(raw, Object.fromEntries(request.headers.entries()));
    return new Response(null, { status: 204 });
  } catch { return Response.json({ erro: "Evento não aceito; nenhuma compra emitida." }, { status: 503 }); }
}

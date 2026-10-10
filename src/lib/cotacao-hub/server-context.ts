import { NextRequest } from "next/server";
import { contextoDaRequisicao } from "@/lib/contexto/contexto-requisicao";
import { loadConfig } from "./config";

export async function connectorContext(request: NextRequest, mutation = false) {
  const context = await contextoDaRequisicao(request);
  const config = await loadConfig();
  if (config.mode === "synthetic-local" && !["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname)) {
    throw new Error("Laboratório disponível somente localmente.");
  }
  if (mutation) exigirOrigemMesma(request);
  if (context.tenant.id !== config.tenantId || (config.allowedActorIds.length > 0 && !config.allowedActorIds.includes(context.usuario.id)) || (config.mode === "synthetic-local" && context.fonte.natureza !== "sintetica")) {
    throw new Error("Sessão não autorizada para esta conexão.");
  }
  return { config, context };
}

/**
 * Mutação browser de mesma origem: Origin confere com a própria origem da
 * requisição e Sec-Fetch-Site, quando presente, é same-origin.
 */
export function exigirOrigemMesma(request: NextRequest): void {
  if (request.headers.get("origin") !== request.nextUrl.origin ||
      ![null, "same-origin"].includes(request.headers.get("sec-fetch-site"))) {
    throw new Error("Origem da requisição não autorizada.");
  }
}
export const connectorFailure = (detalhe?: string) => Response.json({
  erro: detalhe || "Conexão indisponível ou seleção não autorizada. Confira o cadastro da conexão e a prévia."
}, { status: 503, headers: { "Cache-Control": "no-store" } });

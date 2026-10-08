import { NextRequest } from "next/server";
import { contextoDaRequisicao } from "@/lib/contexto/contexto-requisicao";
import { loadConfig } from "./config";

export async function connectorContext(request: NextRequest, mutation = false) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname)) throw new Error("Laboratório disponível somente localmente.");
  if (mutation && (request.headers.get("origin") !== request.nextUrl.origin ||
      ![null, "same-origin"].includes(request.headers.get("sec-fetch-site")))) throw new Error("Origem da requisição não autorizada.");
  const config = await loadConfig();
  const context = await contextoDaRequisicao(request);
  if (context.tenant.id !== config.tenantId || !config.allowedActorIds.includes(context.usuario.id) || context.fonte.natureza !== "sintetica") throw new Error("Sessão não autorizada para o laboratório.");
  return { config, context };
}
export const connectorFailure = () => Response.json({ erro: "Conexão indisponível ou seleção não autorizada. Confira o cadastro do laboratório e a prévia." }, { status: 503, headers: { "Cache-Control": "no-store" } });

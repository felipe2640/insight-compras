import { NextRequest } from "next/server";
import { z } from "zod";
import { createConnector } from "@/lib/cotacao-hub/connector";
import { HubClient } from "@/lib/cotacao-hub/client";
import { criarLaunch } from "@/lib/cotacao-hub/sso";
import { connectorContext, connectorFailure } from "@/lib/cotacao-hub/server-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pedidoSchema = z.object({
  application_id: z.string().uuid(),
  browser_state_id: z.string().uuid(),
  nonce: z.string().min(16).max(256),
  quotation_id: z.string().uuid().optional(),
}).strict();

/**
 * Emissor de acesso individual ao Hub, chamado pela própria tela com a
 * sessão do comprador (usuário ativo + tenant + conexão conferidos no
 * contexto). A credencial M2M não representa o comprador: ela apenas
 * transporta a chamada, e a assertion assinada carrega a identidade real
 * (função habilitada e permissões efetivas são decididas no Hub, pela
 * membership provisionada).
 */
export async function POST(request: NextRequest) {
  try {
    const { config, context } = await connectorContext(request, true);
    const pedido = pedidoSchema.parse(await request.json());
    if (!config.sso) {
      return Response.json({ erro: "Acesso individual ao Hub não configurado nesta instalação (bloco sso da conexão)." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    if (pedido.application_id !== config.applicationId) {
      return Response.json({ erro: "Aplicação do acesso não confere com a conexão." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }

    // A cotação precisa existir e pertencer ao escopo do comprador:
    // COMPRADOR só abre o que ele mesmo enviou; GESTOR/ADMIN, o do tenant.
    const ledger = await createConnector(config).status();
    const envios = Object.values(ledger.submissions).filter(s => s.quotationId);
    const envio = pedido.quotation_id
      ? envios.find(s => s.quotationId === pedido.quotation_id)
      : envios[envios.length - 1];
    if (!envio || !envio.quotationId) {
      return Response.json({ erro: "Envie uma cotação antes de abrir o Hub." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    if (context.usuario.role === "COMPRADOR" && envio.snapshot.actorId !== context.usuario.id) {
      return Response.json({ erro: "Cotação fora do seu escopo." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }

    const client = new HubClient(config);
    const launch = await criarLaunch(client, config.sso, context.usuario.id, {
      quotationId: envio.quotationId,
      browserStateId: pedido.browser_state_id,
      nonce: pedido.nonce,
    });
    // launch_url é capability de uso único (TTL 120 s): não é registrada em
    // ledger nem em log; vai direto à janela do portal.
    return Response.json({ launch_url: launch.launchUrl, expires_at: launch.expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    console.error("[cotacao-hub] Erro no SSO launch:", erro);
    return connectorFailure(erro instanceof Error ? erro.message : undefined);
  }
}

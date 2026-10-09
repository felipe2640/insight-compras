import { createSign, randomUUID } from "node:crypto";
import { HubClient } from "./client";
import { digest } from "./connector";
import type { ConfigSso } from "./types";

/**
 * Emissor de acesso individual ao portal do Cotação Hub (CCR-013 / H7).
 *
 * O comprador abre o Hub a partir do Insight com a PRÓPRIA identidade:
 * 1. a tela abre o portal em `#sso/<applicationId>`; o portal cria o browser
 *    state (PKCE S256) e devolve `browser_state_id` + `nonce` via
 *    postMessage `cotacao-hub.browser-context.v1`;
 * 2. ESTE emissor assina uma assertion JWT RS256 (iss/aud/sub/exp/iat/jti/
 *    nonce) com a chave privada da origem registrada no Hub (provider
 *    jwt_jwks); o subject mapeia o usuário ativo do Insight — subjectPrefix
 *    + id — e o provisionamento (subjectBindings) resolve quem ele é no Hub;
 * 3. `POST /api/v1/sso/launches` com Bearer M2M (scope portal:launch) +
 *    X-Hub-Identity-Assertion devolve launch_url de uso único (TTL 120 s);
 * 4. a tela devolve `cotacao-hub.launch.v1` { launch_url } ao popup, que
 *    resgata e ganha sessão hub_session própria.
 *
 * Cookie da origem nunca é compartilhado; a credencial M2M é só o meio de
 * transporte da chamada, nunca a identidade do comprador.
 */

const base64url = (valor: Buffer) => valor.toString("base64url");

export interface PedidosLaunch {
  readonly quotationId: string;
  readonly browserStateId: string;
  readonly nonce: string;
}

/** Subject estável do usuário ativo (binding pré-provisionado no Hub). */
export function subjectUsuario(sso: ConfigSso, usuarioId: string): string {
  return `${sso.subjectPrefix ?? "insight-compras:user:"}${usuarioId}`;
}

/** Assertion JWT RS256 fresca (validade curta; jti único por tentativa). */
export function assinarAssertion(sso: ConfigSso, subject: string, nonce: string, agora = Math.floor(Date.now() / 1000)): { jwt: string; jti: string } {
  const jti = randomUUID();
  const header = { alg: "RS256", typ: "JWT", kid: sso.keyId };
  const payload = { iss: sso.issuer, aud: sso.audience, sub: subject, iat: agora, exp: agora + 300, jti, nonce };
  const assinavel = `${base64url(Buffer.from(JSON.stringify(header)))}.${base64url(Buffer.from(JSON.stringify(payload)))}`;
  const assinatura = createSign("RSA-SHA256").update(assinavel).sign(sso.privateKeyPem);
  return { jwt: `${assinavel}.${base64url(assinatura)}`, jti };
}

/**
 * Cria o launch no Hub. Cada tentativa usa assertion e chave de idempotência
 * NOVAS: replay da assertion original devolve o mesmo launch sem URL, e
 * assertion reusada com chave nova é 409 — a regra é começar o fluxo de novo.
 */
export async function criarLaunch(
  client: HubClient,
  sso: ConfigSso,
  usuarioId: string,
  pedido: PedidosLaunch,
): Promise<{ launchUrl: string; launchId: string; expiresAt: string }> {
  const { jwt, jti } = assinarAssertion(sso, subjectUsuario(sso, usuarioId), pedido.nonce);
  const key = digest(`sso-launch:${usuarioId}:${pedido.browserStateId}:${jti}`);
  const result = await client.request(
    "POST", "/api/v1/sso/launches",
    { quotation_id: pedido.quotationId, browser_state_id: pedido.browserStateId },
    key, undefined, { "X-Hub-Identity-Assertion": jwt },
  );
  const body = result.body as { launch_id?: string; expires_at?: string; launch_url?: string };
  if (!body?.launch_id) throw new Error("O Hub não confirmou a abertura de acesso.");
  if (!body.launch_url) {
    throw new Error("A abertura já foi consumida. Feche a janela do Hub e abra novamente.");
  }
  return { launchUrl: body.launch_url, launchId: body.launch_id, expiresAt: body.expires_at ?? "" };
}

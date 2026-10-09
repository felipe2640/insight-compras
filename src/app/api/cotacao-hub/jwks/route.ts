import { createPublicKey } from "node:crypto";
import { loadConfig } from "@/lib/cotacao-hub/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * JWKS público do emissor SSO: a chave PÚBLICA que o Hub valida nas
 * assertions (provider jwt_jwks registrado, cache ≤15 min do lado dele).
 * Só a chave pública atravessa — a privada permanece em variável de
 * ambiente e nunca é exposta por nenhuma rota ou log.
 */
export async function GET() {
  try {
    const config = await loadConfig();
    const sso = config.sso;
    if (!sso) {
      return Response.json({ erro: "Emissor SSO não configurado." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const jwk = createPublicKey(sso.privateKeyPem).export({ format: "jwk" }) as Record<string, string>;
    return Response.json(
      { keys: [{ ...jwk, kid: sso.keyId, use: "sig", alg: "RS256" }] },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch {
    return Response.json({ erro: "JWKS indisponível sem conexão configurada." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

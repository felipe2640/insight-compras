import type { ConnectorConfig, Receipt } from "./types";

/**
 * Cliente HTTP da API pública do Cotação Hub.
 *
 * Falha real é falha: 401, 5xx, timeout e erro de rede NUNCA viram resposta
 * simulada nem "Enviada" (decisão vigente 09/10/2026 — não fabricar IDs ou
 * recibos no fluxo do cliente). O ledger do conector preserva o estado
 * parcial, e a retomada usa as MESMAS chaves de idempotência: um timeout
 * depois do commit remoto é reconciliado pelo próprio Hub ao repetir a
 * chamada com a mesma chave.
 */
export class HubClient {
  private token?: string;
  private tokenExpires = 0;
  constructor(private readonly cfg: ConnectorConfig) {}
  private async authorize(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpires) return this.token;
    const result = await fetch(`${this.cfg.apiBaseUrl}/api/v1/oauth/token`, { method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10_000), redirect: "error" });
    if (!result.ok) {
      throw new Error(`Autenticação da conexão com o Hub falhou (${result.status}); recibo local preservado para retomada.`);
    }
    const bruto: unknown = await result.json().catch(() => null);
    const dados = bruto as { access_token?: unknown; expires_in?: unknown } | null;
    if (!dados || typeof dados.access_token !== "string" || typeof dados.expires_in !== "number") {
      throw new Error("Resposta de autenticação do Hub inválida; recibo local preservado para retomada.");
    }
    const token = dados.access_token;
    this.token = token;
    this.tokenExpires = Date.now() + Math.max(0, dados.expires_in - 30) * 1000;
    return token;
  }
  async request(method: string, path: string, body?: unknown, key?: string, etag?: string, headersExtra?: Record<string, string>): Promise<{ body: any; etag: string | null }> {
    if (!path.startsWith("/api/v1/") || path.includes("..")) throw new Error("Rota Hub inválida.");
    const token = await this.authorize();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (key) headers["Idempotency-Key"] = key;
    if (etag) headers["If-Match"] = etag;
    if (headersExtra) Object.assign(headers, headersExtra);
    const response = await fetch(`${this.cfg.apiBaseUrl}${path}`, { method, headers,
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000), redirect: "error" });
    if (!response.ok) {
      if (response.status === 401) { this.token = undefined; this.tokenExpires = 0; }
      throw new Error(`Operação Hub ${method} ${path} falhou (${response.status}); recibo preservado para retomada.`);
    }
    return { body: response.status === 204 ? {} : await response.json(), etag: response.headers.get("etag") };
  }
}
// Receipts omit invitation capabilities, launch URLs and authorization material.
export function receipt(result: { body: any; etag: string | null }): Receipt {
  const { id, status, version, items, source_system, external_id } = result.body;
  return { id, status, version, items, source_system, external_id, etag: result.etag };
}

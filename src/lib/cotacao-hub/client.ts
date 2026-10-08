import type { ConnectorConfig, Receipt } from "./types";

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
    if (!result.ok) throw new Error(`Autenticação da conexão indisponível (${result.status}).`);
    const body = await result.json();
    if (typeof body.access_token !== "string" || typeof body.expires_in !== "number") throw new Error("Token remoto inválido.");
    this.token = body.access_token; this.tokenExpires = Date.now() + Math.max(0, body.expires_in - 30) * 1000;
    return this.token!;
  }
  async request(method: string, path: string, body?: unknown, key?: string, etag?: string): Promise<{ body: any; etag: string | null }> {
    if (!path.startsWith("/api/v1/") || path.includes("..")) throw new Error("Rota Hub inválida.");
    const headers: Record<string, string> = { Authorization: `Bearer ${await this.authorize()}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (key) headers["Idempotency-Key"] = key;
    if (etag) headers["If-Match"] = etag;
    const response = await fetch(`${this.cfg.apiBaseUrl}${path}`, { method, headers,
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000), redirect: "error" });
    if (!response.ok) {
      if (response.status === 401) { this.token = undefined; this.tokenExpires = 0; }
      throw new Error(`Operação Hub ${method} falhou (${response.status}); recibo preservado para retomada.`);
    }
    return { body: response.status === 204 ? {} : await response.json(), etag: response.headers.get("etag") };
  }
}
// Receipts omit invitation capabilities, launch URLs and authorization material.
export function receipt(result: { body: any; etag: string | null }): Receipt {
  const { id, status, version, items, source_system, external_id } = result.body;
  return { id, status, version, items, source_system, external_id, etag: result.etag };
}

import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { z } from "zod";
import type { ConnectorConfig } from "./types";

const supplier = z.object({ external_id: z.string().min(1), legal_name: z.string().min(1),
  contacts: z.array(z.object({ name: z.string().min(1), email: z.string().email() }).strict()).min(1) }).strict();
const schema = z.object({ mode: z.literal("synthetic-local"), tenantId: z.literal("demonstracao"),
  hubTenantId: z.string().uuid(), sourceSystem: z.literal("insight-compras"),
  apiBaseUrl: z.string().url(), portalOrigin: z.string().url(), applicationId: z.string().uuid(),
  clientId: z.string().min(1), clientSecret: z.string().min(32), webhookKeyId: z.string().min(1),
  webhookSecret: z.string().min(32), storageFile: z.string().min(1), buyerName: z.string().min(1),
  destinations: z.array(z.object({ external_id: z.string().min(1), name: z.string().min(1), address: z.string().min(1) }).strict()).min(1),
  suppliers: z.array(supplier).min(1), units: z.record(z.string().min(1).max(40)),
  allowedActorIds: z.array(z.string().min(1)).min(1),
}).strict();
export function validateConfig(input: unknown): ConnectorConfig {
  const cfg = schema.parse(input);
  const api = new URL(cfg.apiBaseUrl);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(api.hostname) ||
      !["http:", "https:"].includes(api.protocol) || api.username || api.password || api.search || api.hash || api.pathname !== "/") {
    throw new Error("O laboratório aceita somente API local com origem exata.");
  }
  const portal = new URL(cfg.portalOrigin);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(portal.hostname) ||
      !['http:', 'https:'].includes(portal.protocol) || portal.username || portal.password || portal.search || portal.hash || portal.pathname !== '/') {
    throw new Error("O laboratório aceita somente portal local com origem exata.");
  }
  if (!isAbsolute(cfg.storageFile)) throw new Error("O ledger precisa de caminho absoluto próprio.");
  for (const list of [cfg.suppliers.map(s => s.external_id), cfg.destinations.map(d => d.external_id)]) {
    if (new Set(list).size !== list.length) throw new Error("Cadastro de integração contém IDs duplicados.");
  }
  return cfg;
}
export async function loadConfig(): Promise<ConnectorConfig> {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL || process.env.INSIGHT_HUB_TEST_MODE !== "synthetic-local") {
    throw new Error("Conector disponível somente no laboratório local sintético desta branch.");
  }
  const file = process.env.INSIGHT_HUB_TEST_CONFIG;
  if (!file || !isAbsolute(file)) throw new Error("Configure INSIGHT_HUB_TEST_CONFIG com um arquivo privado absoluto.");
  return validateConfig(JSON.parse(await readFile(file, "utf8")));
}

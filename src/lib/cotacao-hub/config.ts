import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { z } from "zod";
import type { ConnectorConfig } from "./types";

const supplier = z.object({ external_id: z.string().min(1), legal_name: z.string().min(1),
  contacts: z.array(z.object({ name: z.string().min(1), email: z.string().email() }).strict()).min(1) }).strict();
const ssoSchema = z.object({
  issuer: z.string().url(),
  audience: z.string().min(1),
  keyId: z.string().min(1),
  privateKeyPem: z.string().min(1),
  subjectPrefix: z.string().min(1).optional(),
}).strict();
const schema = z.object({ mode: z.enum(["synthetic-local", "production"]),
  tenantId: z.string().min(1),
  hubTenantId: z.string().uuid(), sourceSystem: z.literal("insight-compras"),
  apiBaseUrl: z.string().url(), portalOrigin: z.string().url(), applicationId: z.string().uuid(),
  clientId: z.string().min(1), clientSecret: z.string().min(32), webhookKeyId: z.string().min(1),
  webhookSecret: z.string().min(32), storageFile: z.string().min(1).optional(), buyerName: z.string().min(1),
  destinations: z.array(z.object({ external_id: z.string().min(1), name: z.string().min(1), address: z.string().min(1) }).strict()).min(1),
  suppliers: z.array(supplier).min(1), units: z.record(z.string().min(1).max(40)),
  allowedActorIds: z.array(z.string().min(1)),
  sso: ssoSchema.optional(),
}).strict();

const HOSTS_LOCAIS = ["localhost", "127.0.0.1", "[::1]"];

/** Origem exata (scheme://host[:port]/) sem credenciais, query ou fragmento. */
function origemExata(valor: string, rotulo: string): URL {
  const url = new URL(valor);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error(`${rotulo} precisa ser uma origem exata, sem credenciais, caminho, query ou fragmento.`);
  }
  return url;
}

export function validateConfig(input: unknown): ConnectorConfig {
  const cfg = schema.parse(input);
  const api = origemExata(cfg.apiBaseUrl, "API do Hub");
  origemExata(cfg.portalOrigin, "Portal do Hub");
  if (cfg.mode === "production") {
    // Conexão real: TLS obrigatório nos dois lados (o webhook do Hub só
    // assina entrega https:// e o portal do comprador é https://).
    if (api.protocol !== "https:") throw new Error("Conexão de produção exige API em https://.");
    if (new URL(cfg.portalOrigin).protocol !== "https:") throw new Error("Conexão de produção exige portal em https://.");
  } else {
    // Laboratório sintético: API obrigatoriamente local; o portal pode ser a
    // constante sintética remota usada pela jornada connections-run do Hub.
    if (!HOSTS_LOCAIS.includes(api.hostname)) throw new Error("O laboratório aceita somente API local com origem exata.");
  }
  if (cfg.mode === "synthetic-local") {
    if (!cfg.storageFile || !isAbsolute(cfg.storageFile)) throw new Error("O ledger do laboratório exige caminho absoluto próprio.");
  }
  for (const list of [cfg.suppliers.map(s => s.external_id), cfg.destinations.map(d => d.external_id)]) {
    if (new Set(list).size !== list.length) throw new Error("Cadastro de integração contém IDs duplicados.");
  }
  return cfg as ConnectorConfig;
}

/**
 * A conexão é SEMPRE explícita e privada: JSON de ambiente (produção/Vercel)
 * ou arquivo privado com caminho absoluto (laboratório). Não existe cadastro
 * nem credencial padrão embutida — valores fictícios nunca alimentam uma
 * conexão operacional (ADR-0002: cliente real não vê resposta fabricada).
 */
export async function loadConfig(): Promise<ConnectorConfig> {
  const json = process.env.INSIGHT_HUB_CONFIG_JSON;
  if (json) {
    return validateConfig(JSON.parse(json));
  }
  const file = process.env.INSIGHT_HUB_TEST_CONFIG;
  if (file && isAbsolute(file)) {
    return validateConfig(JSON.parse(await readFile(file, "utf8")));
  }
  throw new Error(
    "Conexão com o Cotação Hub não configurada. Defina INSIGHT_HUB_CONFIG_JSON (produção/Vercel) " +
    "ou INSIGHT_HUB_TEST_CONFIG (laboratório local, arquivo privado com caminho absoluto). " +
    "Não existe configuração padrão.",
  );
}

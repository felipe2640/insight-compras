import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { z } from "zod";
import type { ConnectorConfig } from "./types";

const supplier = z.object({ external_id: z.string().min(1), legal_name: z.string().min(1),
  contacts: z.array(z.object({ name: z.string().min(1), email: z.string().email() }).strict()).min(1) }).strict();
const schema = z.object({ mode: z.enum(["synthetic-local", "test-carreiro", "test-preview"]),
  tenantId: z.string().min(1),
  hubTenantId: z.string().uuid(), sourceSystem: z.literal("insight-compras"),
  apiBaseUrl: z.string().url(), portalOrigin: z.string().url(), applicationId: z.string().uuid(),
  clientId: z.string().min(1), clientSecret: z.string().min(32), webhookKeyId: z.string().min(1),
  webhookSecret: z.string().min(32), storageFile: z.string().min(1), buyerName: z.string().min(1),
  destinations: z.array(z.object({ external_id: z.string().min(1), name: z.string().min(1), address: z.string().min(1) }).strict()).min(1),
  suppliers: z.array(supplier).min(1), units: z.record(z.string().min(1).max(40)),
  allowedActorIds: z.array(z.string().min(1)),
}).strict();
export function validateConfig(input: unknown): ConnectorConfig {
  const cfg = schema.parse(input);
  const api = new URL(cfg.apiBaseUrl);
  if (cfg.mode === "synthetic-local") {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(api.hostname) ||
        !["http:", "https:"].includes(api.protocol) || api.username || api.password || api.search || api.hash || api.pathname !== "/") {
      throw new Error("O laboratório aceita somente API local com origem exata.");
    }
    const portal = new URL(cfg.portalOrigin);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(portal.hostname) ||
        !['http:', 'https:'].includes(portal.protocol) || portal.username || portal.password || portal.search || portal.hash || portal.pathname !== '/') {
      throw new Error("O laboratório aceita somente portal local com origem exata.");
    }
  } else {
    if (!["http:", "https:"].includes(api.protocol) || api.username || api.password || api.search || api.hash) {
      throw new Error("API remota inválida.");
    }
    const portal = new URL(cfg.portalOrigin);
    if (!['http:', 'https:'].includes(portal.protocol) || portal.username || portal.password || portal.search || portal.hash) {
      throw new Error("Portal remoto inválido.");
    }
  }
  if (!isAbsolute(cfg.storageFile)) throw new Error("O ledger precisa de caminho absoluto próprio.");
  for (const list of [cfg.suppliers.map(s => s.external_id), cfg.destinations.map(d => d.external_id)]) {
    if (new Set(list).size !== list.length) throw new Error("Cadastro de integração contém IDs duplicados.");
  }
  return cfg;
}
export function getDefaultCarreiroConfig(): ConnectorConfig {
  return {
    mode: "test-carreiro",
    tenantId: "carreiro",
    hubTenantId: "10000000-0000-4000-8000-000000000001",
    sourceSystem: "insight-compras",
    apiBaseUrl: "https://api.insightdireto.com.br",
    portalOrigin: "https://cotacao.insightdireto.com.br",
    applicationId: "20000000-0000-4000-8000-000000000001",
    clientId: "carreiro-preview-client",
    clientSecret: "carreiro-preview-secret-at-least-32-chars",
    webhookKeyId: "key-carreiro-preview",
    webhookSecret: "carreiro-webhook-secret-at-least-32-chars",
    storageFile: "/tmp/carreiro-cotacao-ledger.json",
    buyerName: "Comprador Rede Carreiro",
    destinations: [
      { external_id: "1", name: "Carreiro Pedro II (Matriz)", address: "Pedro II - PI" },
      { external_id: "2", name: "Melo / Piripiri", address: "Piripiri - PI" },
      { external_id: "3", name: "Carreiro Esperantina", address: "Esperantina - PI" },
      { external_id: "4", name: "Carreiro Barras", address: "Barras - PI" },
      { external_id: "5", name: "Carreiro Campo Maior", address: "Campo Maior - PI" },
      { external_id: "6", name: "Carreiro Parnaíba", address: "Parnaíba - PI" },
      { external_id: "7", name: "Carreiro Teresina", address: "Teresina - PI" },
      { external_id: "8", name: "Melo / Pedro II", address: "Pedro II - PI" },
    ],
    suppliers: [
      {
        external_id: "1",
        legal_name: "Distribuidora Peças Brasil (Piloto)",
        contacts: [{ name: "Contato Fornecedor 1", email: "felipe@insightdireto.com.br" }]
      },
      {
        external_id: "2",
        legal_name: "Auto Peças Nacional (Piloto)",
        contacts: [{ name: "Contato Fornecedor 2", email: "compras@carreiro.com.br" }]
      },
      {
        external_id: "3",
        legal_name: "Melo Distribuidora (Piloto)",
        contacts: [{ name: "Contato Fornecedor 3", email: "cotacao@insightdireto.com.br" }]
      }
    ],
    units: {
      default: "UN"
    },
    allowedActorIds: []
  };
}
export async function loadConfig(tenantId?: string): Promise<ConnectorConfig> {
  if (process.env.INSIGHT_HUB_CONFIG_JSON) {
    return validateConfig(JSON.parse(process.env.INSIGHT_HUB_CONFIG_JSON));
  }
  const file = process.env.INSIGHT_HUB_TEST_CONFIG;
  if (file && isAbsolute(file)) {
    return validateConfig(JSON.parse(await readFile(file, "utf8")));
  }
  const mode = process.env.INSIGHT_HUB_TEST_MODE;
  if (mode === "test-carreiro" || mode === "test-preview" || tenantId === "carreiro") {
    return getDefaultCarreiroConfig();
  }
  if (!mode) {
    throw new Error("Conector disponível somente no laboratório de testes desta branch.");
  }
  if (process.env.VERCEL && mode === "synthetic-local") {
    throw new Error("Laboratório sintético local não é executado no Vercel.");
  }
  if (process.env.NODE_ENV === "production" && mode !== "test-carreiro" && mode !== "test-preview") {
    throw new Error("Conector disponível somente no laboratório desta branch.");
  }
  if (!file || !isAbsolute(file)) throw new Error("Configure INSIGHT_HUB_TEST_CONFIG com um arquivo privado absoluto.");
  return validateConfig(JSON.parse(await readFile(file, "utf8")));
}

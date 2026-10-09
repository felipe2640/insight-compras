import { createHash } from "node:crypto";
import { HubClient, receipt } from "./client";
import { FileLedger } from "./ledger";
import { receiveEvent, processVerifiedEvent } from "./return";
import { validateConfig } from "./config";
import { canonicalJson, destinosEquivalentes } from "./payload";
import type { ConnectorConfig, LedgerStore, Snapshot } from "./types";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** Opções do conector; a jornada connections-run do Hub injeta um env de teste. */
export interface OpcoesConector {
  readonly env?: Record<string, string | undefined>;
  /**
   * Acesso do ledger durável (produção): "usuario" usa o JWT do comprador
   * (RLS, ADR-0005); "privilegiado" é o service_role explícito do webhook.
   */
  readonly acessoLedger?: "usuario" | "privilegiado";
}

export function createConnector(config: ConnectorConfig, opcoes: OpcoesConector = {}) {
  const env = opcoes.env ?? process.env;
  const cfg = validateConfig(config);
  // O laboratório sintético nunca sobe para produção/Vercel; a conexão real
  // ("production") é a única admitida nessas hospedagens.
  if (cfg.mode === "synthetic-local" && (env.NODE_ENV === "production" || env.VERCEL)) {
    throw new Error("Laboratório sintético é recusado em produção/Vercel; configure uma conexão real (INSIGHT_HUB_CONFIG_JSON).");
  }
  const client = new HubClient(cfg);
  // Produção persiste em Supabase (durável na Vercel — /tmp é efêmero);
  // laboratório usa o arquivo local com lock. O import é tardio para não
  // arrastar next/headers para quem usa o conector fora do Next (e2e/testes).
  const resolverStore = async (): Promise<LedgerStore> => {
    if (cfg.mode !== "production") return new FileLedger(cfg);
    const { SupabaseLedger } = await import("./ledger-supabase");
    return new SupabaseLedger(cfg, opcoes.acessoLedger ?? "usuario");
  };
  return {
    async submit(snapshot: Snapshot) {
      if (!snapshot.externalId || snapshot.externalId.length > 255 || (cfg.allowedActorIds.length > 0 && !cfg.allowedActorIds.includes(snapshot.actorId))) throw new Error("Envio/ator não autorizado.");
      if (!snapshot.items.length || snapshot.items.length > 500 || !snapshot.supplierIds.length) throw new Error("Selecione itens e fornecedores.");
      for (const item of snapshot.items) {
        if (!/^[1-9][0-9]{0,13}$/.test(item.requested_quantity) || !item.requested_unit || !item.description) throw new Error("Quantidade inteira positiva/unidade/descrição obrigatórias.");
        if (!snapshot.destinations.some(d => d.external_id === item.destination_external_id)) throw new Error("Destino fora do envio.");
      }
      if (new Set(snapshot.items.map(i => i.external_id)).size !== snapshot.items.length) throw new Error("Itens externos duplicados.");
      // Homologação contra o cadastro da conexão é regra do LABORATÓRIO
      // (quem chama o módulo direto). Em produção os destinos chegam
      // homologados pelo contexto autorizado (tenant + conexão) no
      // createSnapshot — dois validadores não podem discordar entre si.
      if (cfg.mode === "synthetic-local") {
        for (const d of snapshot.destinations) {
          const known = cfg.destinations.find(x => x.external_id === d.external_id);
          if (!known || !destinosEquivalentes(known, d)) throw new Error("Destino não homologado.");
        }
      }
      return (await resolverStore()).withLock(async (ledger, save) => {
        // Fingerprint canônico: a mesma seleção produz o mesmo hash em
        // qualquer ordem de montagem; edição gera hash diferente e NÃO
        // reutiliza silenciosamente a chave anterior.
        const fingerprint = digest(canonicalJson(snapshot));
        const storageKey = digest(snapshot.externalId);
        const previous = ledger.submissions[storageKey];
        if (previous && previous.fingerprint !== fingerprint) throw new Error("ID de envio já usado com outra seleção ou ator.");
        const send = previous ?? { fingerprint, snapshot, operations: {}, suppliers: {}, state: "partial" as const };
        ledger.submissions[storageKey] = send;
        await save();
        const call = async (name: string, method: string, path: string, body?: unknown, etag?: string) => {
          if (send.operations[name]) return send.operations[name];
          const key = digest(`${cfg.tenantId}:${cfg.sourceSystem}:${snapshot.externalId}:${name}`);
          const result = receipt(await client.request(method, path, body, key, etag));
          send.operations[name] = result; await save(); return result;
        };
        for (const external of [...new Set(snapshot.supplierIds)]) {
          const supplier = cfg.suppliers.find(s => s.external_id === external);
          if (!supplier) throw new Error("Fornecedor não homologado.");
          // Vínculo já persistido numa tentativa anterior é reutilizado: é a
          // retomada de resultado incerto sem nova consulta. O lookup remoto
          // paginado permanece para quem ainda não tem vínculo (ou para
          // recuperar operação cujo recibo local se perdeu).
          const vinculado = send.suppliers[external];
          if (vinculado) {
            await save();
            continue;
          }
          let existing: string | undefined;
          let cursor: string | null = null;
          const cursors = new Set<string>();
          do {
            const page: { data: any[]; next_cursor?: string | null } = (await client.request("GET", `/api/v1/suppliers${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`)).body;
            const match = page.data.find((s: any) => s.external_refs?.some((ref: any) => ref.source_system === cfg.sourceSystem && ref.external_id === external));
            if (match) { existing = match.id; break; }
            cursor = page.next_cursor ?? null;
            if (cursor && cursors.has(cursor)) throw new Error("Paginação remota repetida.");
            if (cursor) cursors.add(cursor);
          } while (cursor);
          const created = existing ? { id: existing } : await call(`supplier-${external}`, "POST", "/api/v1/suppliers", {
            legal_name: supplier.legal_name, contacts: supplier.contacts,
            external_refs: [{ source_system: cfg.sourceSystem, external_id: external }],
          });
          if (!created.id) throw new Error("Fornecedor remoto sem ID.");
          send.suppliers[external] = created.id; await save();
        }
        const quote = await call("quote", "POST", "/api/v1/quotations", {
          source_system: cfg.sourceSystem, external_id: snapshot.externalId, currency: "BRL",
          response_deadline_at: snapshot.deadline, buyer_snapshot: { name: cfg.buyerName },
          destinations: snapshot.destinations, items: snapshot.items,
        });
        if (!quote.id || !quote.etag) throw new Error("Cotação remota sem ID/ETag.");
        send.quotationId = quote.id; await save();
        let current = await call("open", "POST", `/api/v1/quotations/${quote.id}:open`, undefined, quote.etag);
        for (const external of [...new Set(snapshot.supplierIds)]) {
          const supplier = cfg.suppliers.find(s => s.external_id === external)!;
          if (!current.etag) throw new Error("Versão remota ausente; não sobrescrever.");
          current = await call(`invite-${external}`, "POST", `/api/v1/quotations/${quote.id}/invitations`, {
            supplier_id: send.suppliers[external], recipients: supplier.contacts, delivery_mode: "email", expires_at: snapshot.deadline,
          }, current.etag);
        }
        send.state = "sent";
        await save();
        return { quotationId: quote.id, state: send.state, externalId: snapshot.externalId };
      });
    },
    async receive(raw: Buffer, headers: Record<string, string>) {
      const store = await resolverStore();
      return receiveEvent(cfg, store, client, raw, headers);
    },
    async retryInbox() {
      const store = await resolverStore();
      const pending = await store.withLock(async data => Object.entries(data.inbox).filter(([, e]) => !e.processed));
      for (const [eventId, entry] of pending) await processVerifiedEvent(cfg, store, client, entry.event, eventId, entry.hash);
      return { retried: pending.length };
    },
    async status() {
      const store = await resolverStore();
      return store.withLock(async data => data);
    },
  };
}

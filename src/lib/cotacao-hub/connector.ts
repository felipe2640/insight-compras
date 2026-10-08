import { createHash } from "node:crypto";
import { HubClient, receipt } from "./client";
import { FileLedger } from "./ledger";
import { receiveEvent, processVerifiedEvent } from "./return";
import { validateConfig } from "./config";
import type { ConnectorConfig, Snapshot } from "./types";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function createConnector(config: ConnectorConfig) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) throw new Error("Laboratório proibido em produção.");
  config = validateConfig(config);
  const store = new FileLedger(config), client = new HubClient(config);
  return {
    async submit(snapshot: Snapshot) {
      if (!snapshot.externalId || snapshot.externalId.length > 255 || !config.allowedActorIds.includes(snapshot.actorId)) throw new Error("Envio/ator não autorizado.");
      if (!snapshot.items.length || snapshot.items.length > 500 || !snapshot.supplierIds.length) throw new Error("Selecione itens e fornecedores.");
      for (const item of snapshot.items) {
        if (!/^[1-9][0-9]{0,13}$/.test(item.requested_quantity) || !item.requested_unit || !item.description) throw new Error("Quantidade inteira positiva/unidade/descrição obrigatórias no laboratório.");
        if (!snapshot.destinations.some(d => d.external_id === item.destination_external_id)) throw new Error("Destino fora do envio.");
      }
      if (new Set(snapshot.items.map(i => i.external_id)).size !== snapshot.items.length) throw new Error("Itens externos duplicados.");
      for (const d of snapshot.destinations) {
        const known = config.destinations.find(x => x.external_id === d.external_id);
        if (!known || JSON.stringify(known) !== JSON.stringify(d)) throw new Error("Destino não homologado.");
      }
      return store.withLock(async (ledger, save) => {
        const fingerprint = digest(JSON.stringify(snapshot));
        const storageKey = digest(snapshot.externalId);
        const previous = ledger.submissions[storageKey];
        if (previous && previous.fingerprint !== fingerprint) throw new Error("ID de envio já usado com outra seleção ou ator.");
        const send = previous ?? { fingerprint, snapshot, operations: {}, suppliers: {}, state: "partial" as const };
        ledger.submissions[storageKey] = send;
        await save();
        const call = async (name: string, method: string, path: string, body?: unknown, etag?: string) => {
          if (send.operations[name]) return send.operations[name];
          const key = digest(`${config.tenantId}:${config.sourceSystem}:${snapshot.externalId}:${name}`);
          const result = receipt(await client.request(method, path, body, key, etag));
          send.operations[name] = result; await save(); return result;
        };
        for (const external of [...new Set(snapshot.supplierIds)]) {
          const supplier = config.suppliers.find(s => s.external_id === external);
          if (!supplier) throw new Error("Fornecedor não homologado.");
          let existing: string | undefined;
          let cursor: string | null = null;
          const cursors = new Set<string>();
          do {
            const page: { data: any[]; next_cursor?: string | null } = (await client.request("GET", `/api/v1/suppliers${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`)).body;
            const match = page.data.find((s: any) => s.external_refs?.some((ref: any) => ref.source_system === config.sourceSystem && ref.external_id === external));
            if (match) { existing = match.id; break; }
            cursor = page.next_cursor ?? null;
            if (cursor && cursors.has(cursor)) throw new Error("Paginação remota repetida.");
            if (cursor) cursors.add(cursor);
          } while (cursor);
          const created = existing ? { id: existing } : await call(`supplier-${external}`, "POST", "/api/v1/suppliers", {
            legal_name: supplier.legal_name, contacts: supplier.contacts,
            external_refs: [{ source_system: config.sourceSystem, external_id: external }],
          });
          if (!created.id) throw new Error("Fornecedor remoto sem ID.");
          send.suppliers[external] = created.id; await save();
        }
        const quote = await call("quote", "POST", "/api/v1/quotations", {
          source_system: config.sourceSystem, external_id: snapshot.externalId, currency: "BRL",
          response_deadline_at: snapshot.deadline, buyer_snapshot: { name: config.buyerName },
          destinations: snapshot.destinations, items: snapshot.items,
        });
        if (!quote.id || !quote.etag) throw new Error("Cotação remota sem ID/ETag.");
        send.quotationId = quote.id; await save();
        let current = await call("open", "POST", `/api/v1/quotations/${quote.id}:open`, undefined, quote.etag);
        for (const external of [...new Set(snapshot.supplierIds)]) {
          const supplier = config.suppliers.find(s => s.external_id === external)!;
          if (!current.etag) throw new Error("Versão remota ausente; não sobrescrever.");
          current = await call(`invite-${external}`, "POST", `/api/v1/quotations/${quote.id}/invitations`, {
            supplier_id: send.suppliers[external], recipients: supplier.contacts, delivery_mode: "email", expires_at: snapshot.deadline,
          }, current.etag);
        }
        send.state = "sent"; await save();
        return { quotationId: quote.id, state: send.state, externalId: snapshot.externalId };
      });
    },
    receive(raw: Buffer, headers: Record<string, string>) { return receiveEvent(config, store, client, raw, headers); },
    async retryInbox() {
      const pending = await store.withLock(async data => Object.entries(data.inbox).filter(([, e]) => !e.processed));
      for (const [eventId, entry] of pending) await processVerifiedEvent(config, store, client, entry.event, eventId, entry.hash);
      return { retried: pending.length };
    },
    status() { return store.withLock(async data => data); },
  };
}

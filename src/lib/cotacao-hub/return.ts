import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { HubClient } from "./client";
import type { LedgerStore } from "./types";
import type { ConnectorConfig, Draft } from "./types";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const decimal = /^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$/;
export async function receiveEvent(cfg: ConnectorConfig, store: LedgerStore, client: HubClient, raw: Buffer, headers: Record<string, string>) {
  const timestamp = headers["x-hub-timestamp"], eventId = headers["x-hub-event-id"];
  if (raw.length > 1_048_576 || !timestamp || !uuid.test(eventId ?? "") || headers["x-hub-key-id"] !== cfg.webhookKeyId) throw new Error("Webhook inválido.");
  const at = /^[0-9]{10,13}$/.test(timestamp) ? Number(timestamp) * 1000 : NaN;
  if (!Number.isFinite(at) || Math.abs(Date.now() - at) > 300_000) throw new Error("Webhook fora da janela.");
  const expected = createHmac("sha256", cfg.webhookSecret).update(`${timestamp}.${eventId}.`).update(raw).digest();
  const signature = (headers["x-hub-signature"] ?? "").replace(/^sha256=/, "");
  if (!/^[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new Error("Assinatura inválida.");
  const event = JSON.parse(raw.toString("utf8"));
  if (event.event_id !== eventId || event.tenant_id !== cfg.hubTenantId || event.schema_version !== "1") throw new Error("Evento fora da conexão.");
  if (event.event_type !== "award.approved.v1") return { ignored: true };
  const payload = event.payload;
  if (!uuid.test(payload?.quotation_id ?? "") || !uuid.test(payload?.award_run_id ?? "")) throw new Error("Referências do evento inválidas.");
  const hash = createHash("sha256").update(raw).digest("hex");
  return processVerifiedEvent(cfg, store, client, event, eventId, hash);
}
// Only previously verified entries from the private ledger may be retried.
export async function processVerifiedEvent(cfg: ConnectorConfig, store: LedgerStore, client: HubClient, event: Record<string, any>, eventId: string, hash: string) {
  const payload = event.payload;
  return store.withLock(async (ledger, save) => {
    const previous = ledger.inbox[eventId];
    if (previous && previous.hash !== hash) throw new Error("Evento repetido com outro corpo.");
    if (previous?.processed) return { duplicate: true };
    const send = Object.values(ledger.submissions).find(s => s.quotationId === payload.quotation_id);
    if (!send) throw new Error("Cotação não foi enviada por esta conexão.");
    ledger.inbox[eventId] = { hash, event, processed: false }; await save();
    const quote = (await client.request("GET", `/api/v1/quotations/${payload.quotation_id}`)).body;
    const run = (await client.request("GET", `/api/v1/award-runs/${payload.award_run_id}`)).body;
    if (!quote.external_refs?.some((ref: any) => ref.source_system === cfg.sourceSystem && ref.external_id === send.snapshot.externalId) ||
        run.quotation_id !== quote.id || run.result_hash !== payload.result_hash) throw new Error("Decisão não corresponde ao envio.");
    if (run.status !== "approved" || !["closed_for_responses", "awarded", "ordered"].includes(quote.status)) {
      for (const draft of ledger.drafts.filter(d => d.quotationId === quote.id)) draft.state = "superseded";
      ledger.inbox[eventId].processed = true; await save(); return { superseded: true };
    }
    const drafts: Draft[] = [];
    for (const scenario of run.supplier_destination_scenarios) {
      if (!scenario.allocations.length) continue;
      const localSupplier = Object.entries(send.suppliers).find(([, hubId]) => hubId === scenario.supplier_id)?.[0];
      if (!localSupplier || !send.snapshot.destinations.some(d => d.external_id === scenario.destination_external_id)) throw new Error("Fornecedor/destino fora do vínculo.");
      const items = scenario.allocations.map((reference: any) => {
        // Current runtime returns allocation IDs; the declared DTO shape differs.
        const allocation = typeof reference === "string" ? run.allocations.find((a: any) => a.id === reference) : reference;
        if (!allocation) throw new Error("Alocação desconhecida no cenário.");
        const item = quote.items.find((i: any) => i.id === allocation.quotation_item_id);
        if (!item || !send.snapshot.items.some(i => i.external_id === item.external_id) || item.destination_external_id !== scenario.destination_external_id || allocation.supplier_id !== scenario.supplier_id) throw new Error("Item alocado fora do vínculo.");
        for (const field of ["allocated_quantity", "acquisition_quantity", "unit_price", "goods_cost"]) {
          if (typeof allocation[field] !== "string" || !decimal.test(allocation[field])) throw new Error("Decisão perdeu precisão decimal.");
        }
        return { ...allocation, external_id: item.external_id, description: item.description,
          destination_external_id: item.destination_external_id, requested_unit: item.requested_unit };
      });
      drafts.push({ id: `${run.id}:${scenario.supplier_id}:${scenario.destination_external_id}`,
        quotationId: quote.id, awardRunId: run.id, resultHash: run.result_hash,
        supplierId: scenario.supplier_id, supplierExternalId: localSupplier,
        destinationId: scenario.destination_external_id, state: "review", items });
    }
    for (const draft of ledger.drafts.filter(d => d.quotationId === quote.id)) draft.state = "superseded";
    ledger.drafts = ledger.drafts.filter(d => !drafts.some(n => n.id === d.id)).concat(drafts);
    ledger.inbox[eventId].processed = true; await save();
    return { drafts: drafts.length };
  });
}

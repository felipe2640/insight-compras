import { sbSelecionar, sbUpsert, type OpcoesAcessoSupabase } from "@/lib/aprendizado/supabase";
import type { ConnectorConfig, Draft, InboxEntry, Ledger, LedgerStore, Submission } from "./types";

interface LinhaSubmissionDb {
  external_id: string;
  fingerprint: string;
  snapshot: Submission["snapshot"];
  operations: Record<string, Submission["operations"][string]>;
  suppliers: Record<string, string>;
  quotation_id: string | null;
  state: string;
}
interface LinhaInboxDb {
  event_id: string;
  hash: string;
  event: InboxEntry["event"];
  processed: boolean;
}
interface LinhaDraftDb {
  id: string;
  quotation_id: string;
  award_run_id: string;
  result_hash: string;
  supplier_id: string;
  supplier_external_id: string;
  destination_id: string;
  state: string;
  items: Draft["items"];
}

/**
 * Ledger durável em Supabase para a conexão de PRODUÇÃO (inclusive Vercel).
 *
 * O contrato é o mesmo do FileLedger do laboratório: withLock entrega o
 * estado completo da conexão e um save() que persiste o que mudou. A
 * concorrência converge por chave primária (external_id / event_id / id de
 * rascunho) com upsert — somado às chaves de idempotência do Hub, não há
 * duplicação de cotação/convite em corridas raras.
 *
 * Acesso: "usuario" (JWT do comprador + RLS, rotas de envio/consulta) ou
 * "privilegiado" (service_role explícito, receptor do webhook — ADR-0005).
 */
export class SupabaseLedger implements LedgerStore {
  constructor(
    private readonly cfg: ConnectorConfig,
    private readonly acesso: OpcoesAcessoSupabase["acesso"] = "usuario",
  ) {}

  private exigirConfiguracao(): void {
    const chave = this.acesso === "privilegiado" ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_ANON_KEY";
    if (!process.env.SUPABASE_URL || !process.env[chave]) {
      throw new Error(`Ledger durável exige Supabase configurado (SUPABASE_URL / ${chave}).`);
    }
  }

  private filtroConexao(): string {
    const pares = [
      ["tenant_id", this.cfg.tenantId],
      ["hub_tenant_id", this.cfg.hubTenantId],
      ["source_system", this.cfg.sourceSystem],
      ["application_id", this.cfg.applicationId],
    ] as const;
    return pares.map(([chave, valor]) => `${chave}=eq.${encodeURIComponent(valor)}`).join("&");
  }

  async withLock<T>(fn: (ledger: Ledger, save: () => Promise<void>) => Promise<T>): Promise<T> {
    this.exigirConfiguracao();
    const opcoes: OpcoesAcessoSupabase = { acesso: this.acesso };
    const filtro = this.filtroConexao();
    const [linhasSubmissions, linhasInbox, linhasDrafts] = await Promise.all([
      sbSelecionar<LinhaSubmissionDb>(`cotacao_hub_submission`, `${filtro}&select=*`, opcoes),
      sbSelecionar<LinhaInboxDb>(`cotacao_hub_inbox`, `${filtro}&select=*`, opcoes),
      sbSelecionar<LinhaDraftDb>(`cotacao_hub_draft`, `${filtro}&select=*`, opcoes),
    ]);
    const ledger: Ledger = {
      tenantId: this.cfg.tenantId,
      hubTenantId: this.cfg.hubTenantId,
      sourceSystem: this.cfg.sourceSystem,
      applicationId: this.cfg.applicationId,
      submissions: Object.fromEntries(linhasSubmissions.map((l) => [l.external_id, {
        fingerprint: l.fingerprint,
        snapshot: l.snapshot,
        operations: l.operations ?? {},
        suppliers: l.suppliers ?? {},
        quotationId: l.quotation_id ?? undefined,
        state: l.state === "sent" ? "sent" as const : "partial" as const,
      }])),
      inbox: Object.fromEntries(linhasInbox.map((l) => [l.event_id, {
        hash: l.hash, event: l.event, processed: l.processed,
      }])),
      drafts: linhasDrafts.map((l) => ({
        id: l.id, quotationId: l.quotation_id, awardRunId: l.award_run_id, resultHash: l.result_hash,
        supplierId: l.supplier_id, supplierExternalId: l.supplier_external_id,
        destinationId: l.destination_id, state: l.state === "superseded" ? "superseded" as const : "review" as const,
        items: l.items ?? [],
      })),
    };
    // Base de comparação: save() grava apenas o que mudou desde a carga.
    const base = JSON.stringify({
      submissions: ledger.submissions, inbox: ledger.inbox, drafts: ledger.drafts,
    });
    const salvarSubmissions = async () => {
      const atuais = Object.entries(ledger.submissions).map(([externalId, s]) => ({
        external_id: externalId, tenant_id: this.cfg.tenantId, hub_tenant_id: this.cfg.hubTenantId,
        source_system: this.cfg.sourceSystem, application_id: this.cfg.applicationId,
        fingerprint: s.fingerprint, snapshot: s.snapshot, operations: s.operations,
        suppliers: s.suppliers, quotation_id: s.quotationId ?? null, state: s.state,
      }));
      for (let i = 0; i < atuais.length; i += 50) {
        const lote = atuais.slice(i, i + 50);
        if (lote.length > 0) await sbUpsert("cotacao_hub_submission", "external_id", lote, opcoes);
      }
    };
    const salvarInbox = async () => {
      const atuais = Object.entries(ledger.inbox).map(([eventId, e]) => ({
        event_id: eventId, tenant_id: this.cfg.tenantId, hub_tenant_id: this.cfg.hubTenantId,
        source_system: this.cfg.sourceSystem, application_id: this.cfg.applicationId,
        hash: e.hash, event: e.event, processed: e.processed,
      }));
      for (let i = 0; i < atuais.length; i += 50) {
        const lote = atuais.slice(i, i + 50);
        if (lote.length > 0) await sbUpsert("cotacao_hub_inbox", "event_id", lote, opcoes);
      }
    };
    const salvarDrafts = async () => {
      const atuais = ledger.drafts.map((d) => ({
        id: d.id, tenant_id: this.cfg.tenantId, hub_tenant_id: this.cfg.hubTenantId,
        source_system: this.cfg.sourceSystem, application_id: this.cfg.applicationId,
        quotation_id: d.quotationId, award_run_id: d.awardRunId, result_hash: d.resultHash,
        supplier_id: d.supplierId, supplier_external_id: d.supplierExternalId,
        destination_id: d.destinationId, state: d.state, items: d.items,
        atualizado_em: new Date().toISOString(),
      }));
      for (let i = 0; i < atuais.length; i += 50) {
        const lote = atuais.slice(i, i + 50);
        if (lote.length > 0) await sbUpsert("cotacao_hub_draft", "id", lote, opcoes);
      }
    };
    const save = async () => {
      if (JSON.stringify({ submissions: ledger.submissions, inbox: ledger.inbox, drafts: ledger.drafts }) === base) return;
      await salvarSubmissions();
      await salvarInbox();
      await salvarDrafts();
    };
    return await fn(ledger, save);
  }
}

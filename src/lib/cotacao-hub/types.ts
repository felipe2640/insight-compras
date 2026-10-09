export interface Destination { external_id: string; name: string; address: string }
export interface Supplier { external_id: string; legal_name: string; contacts: { name: string; email: string }[] }
export interface ConnectorConfig {
  mode: "synthetic-local" | "test-carreiro" | "test-preview"; tenantId: string; hubTenantId: string; sourceSystem: string;
  apiBaseUrl: string; portalOrigin: string; applicationId: string; clientId: string; clientSecret: string;
  webhookKeyId: string; webhookSecret: string; storageFile: string; buyerName: string;
  destinations: Destination[]; suppliers: Supplier[]; units: Record<string, string>;
  allowedActorIds: string[];
}
export interface QuoteItem {
  external_id: string; description: string; requested_quantity: string; requested_unit: string;
  destination_external_id: string; requested_brand?: string; requested_reference?: string;
  accepted_brands?: string[];
}
export interface Snapshot {
  externalId: string; actorId: string; deadline: string; items: QuoteItem[];
  supplierIds: string[]; destinations: Destination[];
}
export interface Receipt {
  id?: string; status?: string; version?: number; etag: string | null;
  items?: Record<string, unknown>[]; source_system?: string; external_id?: string;
}
export interface Submission {
  fingerprint: string; snapshot: Snapshot; operations: Record<string, Receipt>;
  suppliers: Record<string, string>; quotationId?: string; state: "partial" | "sent";
}
export interface Draft {
  id: string; quotationId: string; awardRunId: string; resultHash: string;
  supplierId: string; supplierExternalId: string; destinationId: string;
  state: "review" | "superseded"; items: Record<string, unknown>[];
}
export interface InboxEntry { hash: string; event: Record<string, any>; processed: boolean }
export interface Ledger {
  tenantId: string; hubTenantId: string; sourceSystem: string; applicationId: string;
  submissions: Record<string, Submission>; inbox: Record<string, InboxEntry>; drafts: Draft[];
}

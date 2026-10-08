import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { createConnector } from '../../src/lib/cotacao-hub/connector';
import { validateConfig, loadConfig } from '../../src/lib/cotacao-hub/config';
import { createSnapshot, selectionSchema } from '../../src/lib/cotacao-hub/selection';
import { HubClient, receipt } from '../../src/lib/cotacao-hub/client';
import type { ConnectorConfig, Snapshot } from '../../src/lib/cotacao-hub/types';
import type { Produto } from '../../core/dominio/produto';
import type { UsuarioAutenticado } from '../../src/lib/rbac/tipos';
import type { ConfiguracaoTenant } from '../../config/tenants';

const ids = {
  tenant: '10000000-0000-4000-8000-000000000001', app: '20000000-0000-4000-8000-000000000001',
  quote: '30000000-0000-4000-8000-000000000001', supplier: '40000000-0000-4000-8000-000000000001',
  item: '50000000-0000-4000-8000-000000000001', award: '60000000-0000-4000-8000-000000000001',
  allocation: '70000000-0000-4000-8000-000000000001', event: '80000000-0000-4000-8000-000000000001',
};
const actor: UsuarioAutenticado = { id: 'buyer-synthetic', nome: 'Synthetic', email: 'buyer@synthetic.example', role: 'COMPRADOR', tenantId: 'demonstracao', allowedSupplierIds: [1], allowedCategoryIds: [10] };
const product: Produto = { id: 101, codigoSku: '000101', descricao: 'Sintético', marca: 'Demo', fabricante: 'Demo', referenciaFabricante: 'REF', aplicacaoVeicular: null, familiaId: null, secaoId: 10, nomeSecao: 'Demo', fornecedorId: 1, nomeFornecedor: 'Synthetic', precoCusto: 0.1, precoVenda: 0.2, loteMultiplo: 1 };
const tenant = { id: 'demonstracao', filiais: [{ filialId: 1, ativa: true }, { filialId: 2, ativa: false }] } as unknown as ConfiguracaoTenant;
const input = () => ({ externalId: 'selection-opaque', deadline: new Date(Date.now() + 86400000).toISOString(), filialId: 1, supplierIds: ['1'], items: [{ produtoId: 101, quantity: '3' }] });

type Call = { method: string; path: string; body: string; key?: string; etag?: string };
let cfg: ConnectorConfig, snapshot: Snapshot, directory: string, server: Server, calls: Call[];
let failInvitation: boolean, responseMissingEtag: boolean, award: any, quote: any;

beforeEach(async () => {
  vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('VERCEL', '');
  directory = await mkdtemp(join(tmpdir(), 'insight-hub-adversarial-'));
  calls = []; failInvitation = false; responseMissingEtag = false;
  quote = { id: ids.quote, status: 'closed_for_responses', external_refs: [{ source_system: 'insight-compras', external_id: 'selection-opaque' }], items: [{ id: ids.item, external_id: '["101","1"]', destination_external_id: '1', description: 'Sintético', requested_unit: 'EA' }] };
  award = { id: ids.award, quotation_id: ids.quote, status: 'approved', result_hash: 'a'.repeat(64), allocations: [{ id: ids.allocation, quotation_item_id: ids.item, supplier_id: ids.supplier, allocated_quantity: '2.125000', acquisition_quantity: '3.000000', unit_price: '0.100001', goods_cost: '0.300003' }], supplier_destination_scenarios: [{ supplier_id: ids.supplier, destination_external_id: '1', allocations: [ids.allocation] }] };
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString(); const route = req.url!;
    calls.push({ method: req.method!, path: route, body, key: req.headers['idempotency-key'] as string | undefined, etag: req.headers['if-match'] as string | undefined });
    const send = (status: number, data: any, etag?: string) => { res.writeHead(status, { 'content-type': 'application/json', ...(etag ? { etag } : {}) }); res.end(JSON.stringify(data)); };
    if (route.endsWith('/oauth/token')) return send(200, { access_token: 'synthetic-token', expires_in: 900 });
    if (route === '/api/v1/suppliers' && req.method === 'GET') return send(200, { data: [] });
    if (route === '/api/v1/suppliers') return send(201, { id: ids.supplier }, '"1"');
    if (route === '/api/v1/quotations') return send(201, { id: ids.quote }, responseMissingEtag ? undefined : '"1"');
    if (route === `/api/v1/quotations/${ids.quote}:open`) return send(200, { id: ids.quote }, '"2"');
    if (route.endsWith('/invitations')) return failInvitation ? send(503, { error: 'synthetic failure' }) : send(201, { invitation_ids: ['synthetic-invitation'], manual_links: ['https://secret-capability.example'], delivery_status: 'queued' }, '"3"');
    if (route === `/api/v1/quotations/${ids.quote}`) return send(200, quote, '"4"');
    if (route === `/api/v1/award-runs/${ids.award}`) return send(200, award);
    return send(404, {});
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  cfg = validateConfig({ mode: 'synthetic-local', tenantId: 'demonstracao', hubTenantId: ids.tenant, sourceSystem: 'insight-compras', apiBaseUrl: `http://127.0.0.1:${port}`, portalOrigin: `http://127.0.0.1:${port}`, applicationId: ids.app, clientId: 'synthetic-client', clientSecret: 's'.repeat(32), webhookKeyId: 'key1', webhookSecret: 'h'.repeat(32), storageFile: join(directory, 'ledger.json'), buyerName: 'Comprador sintético', destinations: [{ external_id: '1', name: 'Demo', address: 'Rua Sintética' }], suppliers: [{ external_id: '1', legal_name: 'Supplier synthetic', contacts: [{ name: 'Pessoa', email: 'person@supplier.example' }] }], units: { '101': 'EA' }, allowedActorIds: [actor.id] });
  snapshot = createSnapshot(cfg, actor, tenant, [product], new Set(), input());
});
afterEach(async () => {
  vi.unstubAllEnvs();
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  if (directory) await rm(directory, { recursive: true, force: true });
});
function signedEvent(overrides: Record<string, unknown> = {}, timestamp = Math.floor(Date.now()/1000).toString()) {
  const event = { event_id: ids.event, schema_version: '1', tenant_id: ids.tenant, event_type: 'award.approved.v1', payload: { quotation_id: ids.quote, award_run_id: ids.award, result_hash: 'a'.repeat(64) }, ...overrides };
  const raw = Buffer.from(JSON.stringify(event));
  const headers = { 'x-hub-event-id': String(event.event_id), 'x-hub-key-id': cfg.webhookKeyId, 'x-hub-timestamp': timestamp, 'x-hub-signature': createHmac('sha256', cfg.webhookSecret).update(timestamp + '.' + event.event_id + '.').update(raw).digest('hex') };
  return { raw, headers };
}

 describe('Insight isolated connector adversarial contracts', () => {
  it('rejects remote/credentialed/pathful API origins and duplicated supplier/destination bindings', () => {
    for (const apiBaseUrl of ['https://remote.example', 'http://user:pass@localhost', 'http://localhost/api', 'http://localhost?key=x']) expect(() => validateConfig({ ...cfg, apiBaseUrl })).toThrow();
    expect(() => validateConfig({ ...cfg, suppliers: [...cfg.suppliers, cfg.suppliers[0]] })).toThrow();
    expect(() => validateConfig({ ...cfg, destinations: [...cfg.destinations, cfg.destinations[0]] })).toThrow();
    expect(() => validateConfig({ ...cfg, storageFile: 'relative.json' })).toThrow();
  });
  it('fails closed in production/cloud and without explicit configured laboratory', async () => {
    vi.stubEnv('NODE_ENV', 'production'); expect(() => createConnector(cfg)).toThrow(); await expect(loadConfig()).rejects.toThrow();
    vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('VERCEL', '1'); expect(() => createConnector(cfg)).toThrow();
    vi.stubEnv('VERCEL', ''); vi.stubEnv('INSIGHT_HUB_TEST_MODE', ''); await expect(loadConfig()).rejects.toThrow();
  });
  it('rejects zero/fraction/float/exponent/unsafe quantities without coercion or inflating to one', () => {
    for (const quantity of ['0', '0.000000', '2.125000', '-1', '1e2', 1, '100000000000000']) expect(() => selectionSchema.parse({ ...input(), items: [{ produtoId: 101, quantity }] })).toThrow();
    expect(snapshot.items[0].requested_quantity).toBe('3');
  });
  it('requires exact tenant and administered individual actor binding', () => {
    for (const user of [{ ...actor, tenantId: 'other' }, { ...actor, id: 'intruder' }]) expect(() => createSnapshot(cfg, user, tenant, [product], new Set(), input())).toThrow();
    expect(() => createSnapshot(cfg, actor, { ...tenant, id: 'other' }, [product], new Set(), input())).toThrow();
  });
  it('denies comprador null/empty suppliers, unauthorized product suppliers and restricted categories', () => {
    for (const allowedSupplierIds of [null, []]) expect(() => createSnapshot(cfg, { ...actor, allowedSupplierIds }, tenant, [product], new Set(), input())).toThrow();
    expect(() => createSnapshot(cfg, actor, tenant, [{ ...product, fornecedorId: 2 }], new Set(), input())).toThrow();
    expect(() => createSnapshot(cfg, actor, tenant, [{ ...product, secaoId: 99 }], new Set(), input())).toThrow();
  });
  it('denies inactive/missing destination, pending/duplicate product, missing commercial unit and expired deadline', () => {
    expect(() => createSnapshot(cfg, actor, tenant, [product], new Set(), { ...input(), filialId: 2 })).toThrow();
    expect(() => createSnapshot({ ...cfg, destinations: [] }, actor, tenant, [product], new Set(), input())).toThrow();
    expect(() => createSnapshot(cfg, actor, tenant, [product], new Set([101]), input())).toThrow();
    expect(() => createSnapshot(cfg, actor, tenant, [product], new Set(), { ...input(), items: [input().items[0], input().items[0]] })).toThrow();
    expect(() => createSnapshot({ ...cfg, units: {} }, actor, tenant, [product], new Set(), input())).toThrow();
    expect(() => createSnapshot(cfg, actor, tenant, [product], new Set(), { ...input(), deadline: '2001-01-01T00:00:00Z' })).toThrow();
  });
  it('performs actual OAuth HTTP and the supplier/quotation/open/invitation sequence with ETags', async () => {
    const result = await createConnector(cfg).submit(snapshot); expect(result.state).toBe('sent'); expect(result.quotationId).toBe(ids.quote);
    expect(calls.filter(c => c.method === 'POST').map(c => c.path)).toEqual(['/api/v1/oauth/token', '/api/v1/suppliers', '/api/v1/quotations', `/api/v1/quotations/${ids.quote}:open`, `/api/v1/quotations/${ids.quote}/invitations`]);
    expect(calls.find(c => c.path.endsWith(':open'))?.etag).toBe('"1"'); expect(calls.find(c => c.path.endsWith('/invitations'))?.etag).toBe('"2"');
    expect(JSON.parse(calls.find(c => c.path === '/api/v1/quotations')!.body).items[0].external_id).toBe('["101","1"]');
  });
  it('retains stable keys/body/If-Match across failed HTTP and connector restart without another quotation', async () => {
    failInvitation = true; await expect(createConnector(cfg).submit(snapshot)).rejects.toThrow();
    failInvitation = false; await createConnector(cfg).submit(snapshot);
    const invites = calls.filter(c => c.path.endsWith('/invitations')); expect(invites).toHaveLength(2); expect(invites[1].key).toBe(invites[0].key); expect(invites[1].body).toBe(invites[0].body); expect(invites[1].etag).toBe(invites[0].etag);
    expect(calls.filter(c => c.path === '/api/v1/quotations')).toHaveLength(1);
  });
  it('rejects modified immutable snapshot and another application/Hub tenant reading the ledger', async () => {
    await createConnector(cfg).submit(snapshot);
    await expect(createConnector(cfg).submit({ ...snapshot, actorId: 'intruder' })).rejects.toThrow();
    await expect(createConnector(cfg).submit({ ...snapshot, items: [{ ...snapshot.items[0], requested_quantity: '4' }] })).rejects.toThrow();
    await expect(createConnector({ ...cfg, applicationId: '90000000-0000-4000-8000-000000000001' }).status()).rejects.toThrow();
    await expect(createConnector({ ...cfg, hubTenantId: '90000000-0000-4000-8000-000000000002' }).status()).rejects.toThrow();
  });
  it('never opens a quotation with missing ETag or leaks capabilities/token into receipts', async () => {
    responseMissingEtag = true; await expect(createConnector(cfg).submit(snapshot)).rejects.toThrow(); expect(calls.some(c => c.path.endsWith(':open'))).toBe(false);
    expect(JSON.stringify(receipt({ body: { id: 'id', manual_links: ['secret'], access_token: 'token' }, etag: '"1"' }))).not.toContain('secret');
    expect(JSON.stringify(receipt({ body: { access_token: 'token' }, etag: null }))).not.toContain('token');
  });
  it('rejects altered raw bytes, wrong signature/key and timestamps beyond either side of five minute window', async () => {
    const connector = createConnector(cfg), event = signedEvent();
    await expect(connector.receive(Buffer.concat([event.raw, Buffer.from(' ')]), event.headers)).rejects.toThrow();
    await expect(connector.receive(event.raw, { ...event.headers, 'x-hub-signature': '0'.repeat(64) })).rejects.toThrow();
    await expect(connector.receive(event.raw, { ...event.headers, 'x-hub-key-id': 'other' })).rejects.toThrow();
    for (const offset of [-301, 301]) { const dated = signedEvent({}, String(Math.floor(Date.now()/1000) + offset)); await expect(connector.receive(dated.raw, dated.headers)).rejects.toThrow(); }
  });
  it('rejects signed wrong tenant/header event id and unrelated quotation before draft creation', async () => {
    const connector = createConnector(cfg); const other = signedEvent({ tenant_id: ids.app }); await expect(connector.receive(other.raw, other.headers)).rejects.toThrow();
    const e = signedEvent(); await expect(connector.receive(e.raw, { ...e.headers, 'x-hub-event-id': ids.app })).rejects.toThrow();
    await expect(connector.receive(e.raw, e.headers)).rejects.toThrow(); expect((await connector.status()).drafts).toEqual([]);
  });
  it('accepts runtime hex and contractual prefix, persists once across restart and rejects divergent replay', async () => {
    const connector = createConnector(cfg); await connector.submit(snapshot); const e = signedEvent();
    expect(await connector.receive(e.raw, e.headers)).toEqual({ drafts: 1 });
    expect(await createConnector(cfg).receive(e.raw, { ...e.headers, 'x-hub-signature': 'sha256=' + e.headers['x-hub-signature'] })).toEqual({ duplicate: true });
    const changed = signedEvent({ correlation_id: 'different' }); await expect(connector.receive(changed.raw, changed.headers)).rejects.toThrow(); expect((await connector.status()).drafts).toHaveLength(1);
  });
  it('preserves fractional allocation, exact monetary text and opaque external/hub identities in drafts', async () => {
    const connector = createConnector(cfg); await connector.submit(snapshot); const e = signedEvent(); await connector.receive(e.raw, e.headers);
    const draft = (await createConnector(cfg).status()).drafts[0]; expect(draft.supplierId).toBe(ids.supplier); expect(draft.supplierExternalId).toBe('1'); expect(draft.destinationId).toBe('1');
    expect(draft.items[0]).toMatchObject({ allocated_quantity: '2.125000', acquisition_quantity: '3.000000', unit_price: '0.100001', goods_cost: '0.300003', external_id: '["101","1"]' });
    expect(JSON.parse(await readFile(cfg.storageFile, 'utf8')).drafts[0].state).toBe('review');
  });
  it('denies numeric monetary DTO, wrong hash and unmapped supplier/destination; inbox remains durable for retry', async () => {
    const connector = createConnector(cfg); await connector.submit(snapshot); const e = signedEvent();
    award.allocations[0].unit_price = 0.100001; await expect(connector.receive(e.raw, e.headers)).rejects.toThrow();
    let ledger = await connector.status(); expect(ledger.inbox[ids.event].processed).toBe(false); expect(ledger.drafts).toHaveLength(0);
    award.allocations[0].unit_price = '0.100001'; award.result_hash = 'b'.repeat(64); await expect(connector.receive(e.raw, e.headers)).rejects.toThrow();
    award.result_hash = 'a'.repeat(64); award.supplier_destination_scenarios[0].destination_external_id = 'other'; await expect(connector.receive(e.raw, e.headers)).rejects.toThrow();
    award.supplier_destination_scenarios[0].destination_external_id = '1'; await connector.receive(e.raw, e.headers); ledger = await connector.status(); expect(ledger.inbox[ids.event].processed).toBe(true);
  });
  it('ignores purchase-order events and supersedes prior draft on a fresh approved-event notification for revoked run', async () => {
    const connector = createConnector(cfg); await connector.submit(snapshot); const e = signedEvent(); await connector.receive(e.raw, e.headers);
    const po = signedEvent({ event_type: 'purchase_order.created.v1', event_id: '80000000-0000-4000-8000-000000000002' }); expect(await connector.receive(po.raw, po.headers)).toEqual({ ignored: true }); expect((await connector.status()).drafts).toHaveLength(1);
    award.status = 'superseded'; const revoked = signedEvent({ event_id: '80000000-0000-4000-8000-000000000003' }); expect(await connector.receive(revoked.raw, revoked.headers)).toEqual({ superseded: true }); expect((await connector.status()).drafts[0].state).toBe('superseded');
  });
  it('blocks direct malformed submission and Hub client path escape before any network', async () => {
    const connector = createConnector(cfg);
    for (const requested_quantity of ['0', '1.5', '1e2']) await expect(connector.submit({ ...snapshot, items: [{ ...snapshot.items[0], requested_quantity }] })).rejects.toThrow();
    await expect(connector.submit({ ...snapshot, items: [snapshot.items[0], snapshot.items[0]] })).rejects.toThrow();
    await expect(new HubClient(cfg).request('GET', '/api/v1/../secrets')).rejects.toThrow(); expect(calls).toHaveLength(0);
  });
});

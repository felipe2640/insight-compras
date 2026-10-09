import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnector } from '../../src/lib/cotacao-hub/connector';
import { validateConfig } from '../../src/lib/cotacao-hub/config';
import { createSnapshot, selectionSchema } from '../../src/lib/cotacao-hub/selection';
import type { ConnectorConfig, Snapshot } from '../../src/lib/cotacao-hub/types';
import type { Produto } from '../../core/dominio/produto';
import type { UsuarioAutenticado } from '../../src/lib/rbac/tipos';
import type { ConfiguracaoTenant } from '../../config/tenants';

const ids = {
  tenant: '10000000-0000-4000-8000-000000000001',
  app: '20000000-0000-4000-8000-000000000001',
  quote: '30000000-0000-4000-8000-000000000001',
  supplier: '40000000-0000-4000-8000-000000000001',
};

const actor: UsuarioAutenticado = {
  id: 'buyer-test',
  nome: 'Comprador Teste',
  email: 'buyer@test.example',
  role: 'COMPRADOR',
  tenantId: 'demonstracao',
  allowedSupplierIds: [1, 2],
  allowedCategoryIds: [10],
};

const tenant = {
  id: 'demonstracao',
  filiais: [
    { filialId: 1, ativa: true, nome: 'Loja 1', cidade: 'Recife', uf: 'PE' },
    { filialId: 2, ativa: true, nome: 'Loja 2', cidade: 'Caruaru', uf: 'PE' },
  ],
} as unknown as ConfiguracaoTenant;

const baseProduct: Produto = {
  id: 101,
  codigoSku: 'SKU-ALFA-99',
  descricao: 'Amortecedor Dianteiro',
  marca: 'Monroe',
  fabricante: 'Tenneco',
  referenciaFabricante: 'MON-8001',
  aplicacaoVeicular: null,
  familiaId: null,
  secaoId: 10,
  nomeSecao: 'Suspensao',
  fornecedorId: 1,
  nomeFornecedor: 'Distribuidora A',
  precoCusto: 100,
  precoVenda: 150,
  loteMultiplo: 1,
};

const productSemReferencia: Produto = {
  ...baseProduct,
  id: 102,
  codigoSku: 'SKU-SEM-REF',
  descricao: 'Bucha da Barra',
  marca: '',
  fabricante: '',
  referenciaFabricante: null,
};

let cfg: ConnectorConfig;
let directory: string;
let server: Server;
let serverCalls: { method: string; path: string; body: string }[];

beforeEach(async () => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('VERCEL', '');
  directory = await mkdtemp(join(tmpdir(), 'insight-hub-enriquecimento-'));
  serverCalls = [];

  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString();
    serverCalls.push({ method: req.method!, path: req.url!, body });

    const send = (status: number, data: any, etag?: string) => {
      res.writeHead(status, {
        'content-type': 'application/json',
        ...(etag ? { etag } : {}),
      });
      res.end(JSON.stringify(data));
    };

    if (req.url?.endsWith('/oauth/token')) {
      return send(200, { access_token: 'token-teste', expires_in: 900 });
    }
    if (req.url === '/api/v1/suppliers' && req.method === 'GET') {
      return send(200, { data: [] });
    }
    if (req.url === '/api/v1/suppliers') {
      return send(201, { id: ids.supplier }, '"1"');
    }
    if (req.url === '/api/v1/quotations') {
      return send(201, { id: ids.quote }, '"1"');
    }
    if (req.url === `/api/v1/quotations/${ids.quote}:open`) {
      return send(200, { id: ids.quote }, '"2"');
    }
    if (req.url?.endsWith('/invitations')) {
      return send(201, { invitation_ids: ['inv-1'], delivery_status: 'queued' }, '"3"');
    }
    return send(404, {});
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;

  cfg = validateConfig({
    mode: 'synthetic-local',
    tenantId: 'demonstracao',
    hubTenantId: ids.tenant,
    sourceSystem: 'insight-compras',
    apiBaseUrl: `http://127.0.0.1:${port}`,
    portalOrigin: `http://127.0.0.1:${port}`,
    applicationId: ids.app,
    clientId: 'test-client',
    clientSecret: 's'.repeat(32),
    webhookKeyId: 'key1',
    webhookSecret: 'h'.repeat(32),
    storageFile: join(directory, 'ledger.json'),
    buyerName: 'Comprador de Teste',
    destinations: [
      { external_id: '1', name: 'Loja 1', address: 'Recife - PE' },
      { external_id: '2', name: 'Loja 2', address: 'Caruaru - PE' },
    ],
    suppliers: [
      {
        external_id: '1',
        legal_name: 'Distribuidora A',
        contacts: [{ name: 'Vendedor', email: 'vendas@distribuidora.com' }],
      },
    ],
    units: { default: 'UN', '101': 'UN', '102': 'PC' },
    allowedActorIds: [actor.id],
  });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (directory) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('10 Testes Obrigatórios de Enriquecimento e Mapeamento de Itens', () => {
  // Teste 1: Envio sem edição preserva os dados reais de marca e referência
  it('1. Envio sem edição preserva os dados reais de marca e referência', () => {
    const input = {
      externalId: 'ext-sem-edicao-1',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      filialId: 1,
      supplierIds: ['1'],
      items: [{ produtoId: 101, quantity: '5' }],
    };

    const snapshot = createSnapshot(cfg, actor, tenant, [baseProduct], new Set(), input);
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0].requested_brand).toBe('Monroe');
    expect(snapshot.items[0].requested_reference).toBe('MON-8001');
    expect(snapshot.items[0].accepted_brands).toBeUndefined();
  });

  // Teste 2: Referência alterada no modal aparece em requested_reference
  it('2. Referência alterada no modal aparece em requested_reference', () => {
    const input = {
      externalId: 'ext-com-edicao-ref',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      filialId: 1,
      supplierIds: ['1'],
      items: [{
        produtoId: 101,
        quantity: '5',
        requested_reference: 'REF-PERSONALIZADA-2026',
      }],
    };

    const snapshot = createSnapshot(cfg, actor, tenant, [baseProduct], new Set(), input);
    expect(snapshot.items[0].requested_reference).toBe('REF-PERSONALIZADA-2026');
    // Marca do catálogo foi preservada
    expect(snapshot.items[0].requested_brand).toBe('Monroe');
  });

  // Teste 3: accepted_brands só aparece conforme as escolhas permitidas
  it('3. accepted_brands só aparece conforme as escolhas permitidas', () => {
    const input = {
      externalId: 'ext-marcas-alternativas',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      filialId: 1,
      supplierIds: ['1'],
      items: [{
        produtoId: 101,
        quantity: '5',
        requested_brand: 'Cofap',
        accepted_brands: ['Nakata', 'Monroe', 'KyB'],
      }],
    };

    const snapshot = createSnapshot(cfg, actor, tenant, [baseProduct], new Set(), input);
    expect(snapshot.items[0].requested_brand).toBe('Cofap');
    expect(snapshot.items[0].accepted_brands).toEqual(['Nakata', 'Monroe', 'KyB']);
  });

  // Teste 4: Produto sem referência não recebe valor fictício
  it('4. Produto sem referência não recebe valor fictício', () => {
    const input = {
      externalId: 'ext-sem-ref-catalogo',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      filialId: 1,
      supplierIds: ['1'],
      items: [{ produtoId: 102, quantity: '10' }],
    };

    const snapshot = createSnapshot(cfg, actor, tenant, [productSemReferencia], new Set(), input);
    expect(snapshot.items[0].requested_reference).toBeUndefined();
    expect(snapshot.items[0].requested_brand).toBeUndefined();
  });

  // Teste 5: Produto com SKU alfanumérico mantém sua identidade correta
  it('5. Produto com SKU alfanumérico mantém sua identidade correta', () => {
    const input = {
      externalId: 'ext-sku-alfanumerico',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      filialId: 1,
      supplierIds: ['1'],
      items: [{ produtoId: 101, quantity: '8' }],
    };

    const snapshot = createSnapshot(cfg, actor, tenant, [baseProduct], new Set(), input);
    // Identidade estável vinculada ao ID do produto e destino
    expect(snapshot.items[0].external_id).toBe(JSON.stringify(['101', '1']));
    expect(baseProduct.codigoSku).toBe('SKU-ALFA-99');
  });

  // Teste 6: Quantidade zero não é convertida em 1
  it('6. Quantidade zero não é convertida em 1 (rejeita 0 sem inflar para 1)', () => {
    const inputComZero = {
      externalId: 'ext-qtd-zero',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      filialId: 1,
      supplierIds: ['1'],
      items: [{ produtoId: 101, quantity: '0' }],
    };

    expect(() => selectionSchema.parse(inputComZero)).toThrow();
  });

  // Teste 7: Mesmo produto em lojas diferentes mantém destinos separados
  it('7. Mesmo produto em lojas diferentes mantém destinos separados', () => {
    const inputMultiLoja = {
      externalId: 'ext-multi-loja',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      supplierIds: ['1'],
      items: [
        { produtoId: 101, filialId: 1, quantity: '10', requested_reference: 'REF-LOJA-1' },
        { produtoId: 101, filialId: 2, quantity: '25', requested_reference: 'REF-LOJA-2' },
      ],
    };

    const snapshot = createSnapshot(cfg, actor, tenant, [baseProduct], new Set(), inputMultiLoja);
    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.items[0].destination_external_id).toBe('1');
    expect(snapshot.items[0].requested_quantity).toBe('10');
    expect(snapshot.items[0].requested_reference).toBe('REF-LOJA-1');

    expect(snapshot.items[1].destination_external_id).toBe('2');
    expect(snapshot.items[1].requested_quantity).toBe('25');
    expect(snapshot.items[1].requested_reference).toBe('REF-LOJA-2');

    expect(snapshot.items[0].external_id).toBe(JSON.stringify(['101', '1']));
    expect(snapshot.items[1].external_id).toBe(JSON.stringify(['101', '2']));
  });

  // Teste 8: Carteira de fornecedor e isolamento por tenant continuam aplicados no servidor
  it('8. Carteira de fornecedor e isolamento por tenant continuam aplicados no servidor', () => {
    const inputInvasao = {
      externalId: 'ext-invasao',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      filialId: 1,
      supplierIds: ['999'], // Fornecedor 999 não permitido
      items: [{ produtoId: 101, quantity: '5' }],
    };

    expect(() => createSnapshot(cfg, actor, tenant, [baseProduct], new Set(), inputInvasao)).toThrow(
      'Fornecedor fora da carteira/conexão.'
    );

    // Tentativa com outro tenant
    const outroTenant = { ...tenant, id: 'outro-tenant' } as unknown as ConfiguracaoTenant;
    expect(() =>
      createSnapshot(cfg, actor, outroTenant, [baseProduct], new Set(), {
        ...inputInvasao,
        supplierIds: ['1'],
      })
    ).toThrow('Identidade fora da conexão.');
  });

  // Teste 9: Uma retentativa não gera outra cotação (idempotência preservada)
  it('9. Uma retentativa não gera outra cotação (idempotência e ledger preservados)', async () => {
    const input = {
      externalId: 'ext-idempotencia-123',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      filialId: 1,
      supplierIds: ['1'],
      items: [{ produtoId: 101, quantity: '15' }],
    };

    const snapshot1 = createSnapshot(cfg, actor, tenant, [baseProduct], new Set(), input);
    const connector = createConnector(cfg);

    const res1 = await connector.submit(snapshot1);
    expect(res1.quotationId).toBe(ids.quote);

    // Segunda submissão com o mesmo externalId
    const res2 = await connector.submit(snapshot1);
    expect(res2.quotationId).toBe(ids.quote);

    // O servidor HTTP do Hub só recebeu a criação de cotação uma única vez
    const cotacoesCriadas = serverCalls.filter(
      (c) => c.method === 'POST' && c.path === '/api/v1/quotations'
    );
    expect(cotacoesCriadas).toHaveLength(1);
  });

  // Teste 10: Os dois modais continuam funcionais sem novos campos obrigatórios
  it('10. Os dois modais continuam funcionais sem novos campos obrigatórios', () => {
    // Valida que o schema aceita tanto payload legado simples quanto payload enriquecido opcional
    const payloadLegadoCockpit = {
      externalId: 'legado-cockpit',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      filialId: 1,
      supplierIds: ['1'],
      items: [{ produtoId: 101, quantity: '10' }],
    };

    const parsedLegado = selectionSchema.safeParse(payloadLegadoCockpit);
    expect(parsedLegado.success).toBe(true);

    const payloadCompiladoCompleto = {
      externalId: 'compilado-completo',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      pedidoIds: [1001, 1002],
      supplierIds: ['1'],
      suppliersData: [{ id: '1', name: 'Distribuidora A', email: 'contato@distribuidora.com' }],
      destinations: [{ external_id: '1', name: 'Loja 1', address: 'Endereço 1' }],
      items: [
        {
          produtoId: 101,
          quantity: '10',
          filialId: 1,
          description: 'Amortecedor Dianteiro Especial',
          requested_reference: 'REF-COMPILADA',
          requested_brand: 'Monroe',
          accepted_brands: ['Cofap'],
        },
      ],
    };

    const parsedCompleto = selectionSchema.safeParse(payloadCompiladoCompleto);
    expect(parsedCompleto.success).toBe(true);
  });
});

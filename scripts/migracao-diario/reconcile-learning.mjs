// Reconciliação somente-leitura do histórico copiado de shadow_* para
// aprendizado_* de Trairi. Executar no terminal administrativo no cutover.
// Nunca registra URLs completas, chaves ou conteúdo de itens em logs.

const SOURCE_REF = "escsriqutzfdwbockfym";
const TARGET_REF = "nzomnqxqljhwqyewehvo";
const TENANT = "trairi";
const ITEM_OFFSET = 10_000_000;
const SNAPSHOT_OFFSET = 1_000_000;
const PAGE_SIZE = 1000;

function config(urlName, keyName, ref) {
  const rawUrl = process.env[urlName];
  const key = process.env[keyName];
  if (!rawUrl || !key) throw new Error(`${urlName} e ${keyName} são obrigatórios`);
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.hostname !== `${ref}.supabase.co`) {
    throw new Error(`${urlName} não aponta para o projeto esperado`);
  }
  return { url: url.origin, key };
}

async function allRows(cfg, table, select, filter = "") {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = new URLSearchParams({ select, order: "id.asc", limit: String(PAGE_SIZE), offset: String(offset) });
    const response = await fetch(`${cfg.url}/rest/v1/${table}?${query}&${filter}`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }, cache: "no-store",
    });
    if (!response.ok) throw new Error(`Leitura de ${table} falhou: HTTP ${response.status}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function comparable(row, target) {
  const columns = target
    ? ["snapshot_id", "produto_id", "sku", "descricao", "filial_id", "custo", "qtd_comprador", "qtd_modelo", "perfil", "elegivel", "motivo_inelegibilidade"]
    : ["snapshot_id", "produto_id", "codigo", "descricao", "loja", "custo", "qtd_comprador", "qtd_modelo", "perfil", "elegivel", "motivo_inelegibilidade"];
  return columns.map((column) => {
    const value = row[column];
    if (column === "snapshot_id" && !target) return String(Number(value) + SNAPSHOT_OFFSET);
    return value === null || value === undefined ? null : String(value);
  });
}

export async function reconcile() {
  const source = config("DIARIO_SUPABASE_URL", "DIARIO_SUPABASE_SERVICE_ROLE_KEY", SOURCE_REF);
  const target = config("INSIGHT_SUPABASE_URL", "INSIGHT_SUPABASE_SERVICE_ROLE_KEY", TARGET_REF);
  const [sourceItems, targetItems, sourceSnapshots, targetSnapshots] = await Promise.all([
    allRows(source, "shadow_item", "id,snapshot_id,produto_id,codigo,descricao,loja,custo,qtd_comprador,qtd_modelo,perfil,elegivel,motivo_inelegibilidade"),
    allRows(target, "aprendizado_item", "id,snapshot_id,produto_id,sku,descricao,filial_id,custo,qtd_comprador,qtd_modelo,perfil,elegivel,motivo_inelegibilidade", "tenant_id=eq.trairi"),
    allRows(source, "shadow_snapshot", "id,exported_at,n_itens"),
    allRows(target, "aprendizado_snapshot", "id,exportado_em,n_itens", "tenant_id=eq.trairi"),
  ]);
  const mappedItems = new Map(targetItems.map((row) => [Number(row.id), row]));
  const missingItems = [];
  const changedItems = [];
  for (const row of sourceItems) {
    const mapped = mappedItems.get(Number(row.id) + ITEM_OFFSET);
    if (!mapped) missingItems.push(row.id);
    else if (JSON.stringify(comparable(row, false)) !== JSON.stringify(comparable(mapped, true))) changedItems.push(row.id);
  }
  const mappedSnapshots = new Set(targetSnapshots.map((row) => Number(row.id)));
  const itemSnapshots = new Set(sourceItems.map((row) => Number(row.snapshot_id)));
  const missingSnapshotsWithItems = sourceSnapshots
    .filter((row) => !mappedSnapshots.has(Number(row.id) + SNAPSHOT_OFFSET) && itemSnapshots.has(Number(row.id)))
    .map((row) => row.id);
  const missingSnapshotsWithoutItems = sourceSnapshots
    .filter((row) => !mappedSnapshots.has(Number(row.id) + SNAPSHOT_OFFSET) && !itemSnapshots.has(Number(row.id)))
    .map((row) => row.id);
  const result = {
    tenant: TENANT,
    sourceItems: sourceItems.length,
    targetItems: targetItems.length,
    missingItemIds: missingItems,
    changedItemIds: changedItems,
    missingSnapshotsWithItems,
    missingSnapshotsWithoutItems,
    ok: missingItems.length === 0 && changedItems.length === 0 && missingSnapshotsWithItems.length === 0,
  };
  return result;
}

if (process.argv[1]?.endsWith("reconcile-learning.mjs")) {
  reconcile().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : "Reconciliação falhou");
    process.exitCode = 1;
  });
}

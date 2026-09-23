import { afterEach, describe, expect, it, vi } from "vitest";
import { reconcile } from "../../scripts/migracao-diario/reconcile-learning.mjs";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe("reconciliação read-only do histórico", () => {
  it("identifica itens ausentes sem confundir snapshot vazio com dado útil", async () => {
    process.env.DIARIO_SUPABASE_URL = "https://escsriqutzfdwbockfym.supabase.co";
    process.env.DIARIO_SUPABASE_SERVICE_ROLE_KEY = "origem-teste";
    process.env.INSIGHT_SUPABASE_URL = "https://nzomnqxqljhwqyewehvo.supabase.co";
    process.env.INSIGHT_SUPABASE_SERVICE_ROLE_KEY = "destino-teste";
    const calls: Array<{ url: string; method?: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), method: init.method });
      const path = new URL(url).pathname;
      const rows = path.endsWith("/shadow_item")
        ? [{ id: 5, snapshot_id: 6, produto_id: 10, codigo: "SKU", descricao: "Peça", loja: 1, custo: 2, qtd_comprador: 3, qtd_modelo: 4, perfil: null, elegivel: true, motivo_inelegibilidade: null }]
        : path.endsWith("/aprendizado_item") ? []
          : path.endsWith("/shadow_snapshot") ? [{ id: 6 }, { id: 7 }]
            : [{ id: 1000006 }];
      return { ok: true, json: async () => rows };
    }));

    const result = await reconcile();
    expect(result.ok).toBe(false);
    expect(result.missingItemIds).toEqual([5]);
    expect(result.missingSnapshotsWithItems).toEqual([]);
    expect(result.missingSnapshotsWithoutItems).toEqual([7]);
    expect(calls.every((call) => call.method === undefined)).toBe(true);
  });
});

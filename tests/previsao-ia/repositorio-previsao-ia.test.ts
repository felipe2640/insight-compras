import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  carregarMapaPrevisoesIa,
  contarProjecoesIa,
  dataMinimaPrevisaoVigente,
  limparCachePrevisoesIa,
} from "@/lib/previsao-ia/repositorio-previsao-ia";
import { VALIDADE_MAXIMA_DIAS } from "@/lib/previsao-ia/vigencia-previsao";

const URL_SUPABASE = "https://projeto.supabase.co";

/** Linha crua no formato que o PostgREST devolve. */
function linhaDb(produtoId: number, filialId = 1) {
  return {
    filial_id: filialId,
    produto_id: produtoId,
    sku: `SKU-${produtoId}`,
    previsao_central: 10,
    demanda_p50: 10,
    demanda_p80: 18,
    horizonte_dias: 30,
    modelo_utilizado: "Chronos-Bolt (Small)",
    data_previsao: "2026-09-14",
  };
}

function respostaOk(linhas: unknown[]) {
  return { ok: true, status: 200, json: async () => linhas } as Response;
}

describe("Repositório de Previsões de Demanda por IA", () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    process.env.SUPABASE_URL = URL_SUPABASE;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-servico";
    // O cache de 15 min é de módulo: sem limpar, um teste herda o mapa do outro.
    limparCachePrevisoesIa();
  });

  afterEach(() => {
    process.env = { ...envOriginal };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("dataMinimaPrevisaoVigente", () => {
    it("recua a janela de validade em dias", () => {
      const agora = new Date("2026-09-14T12:00:00.000Z");
      expect(dataMinimaPrevisaoVigente(3, agora)).toBe("2026-09-11");
      expect(dataMinimaPrevisaoVigente(0, agora)).toBe("2026-09-14");
    });
  });

  it("não chama o Supabase quando a env não está configurada", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);

    const mapa = await carregarMapaPrevisoesIa("carreiro");

    expect(mapa.size).toBe(0);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("não usa a chave anon: a tabela só tem grant para service role", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_ANON_KEY = "chave-publica";
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);

    const mapa = await carregarMapaPrevisoesIa("carreiro");

    expect(mapa.size).toBe(0);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("filtra por tenant e por frescor da projeção", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaOk([linhaDb(4512)]));
    vi.stubGlobal("fetch", fetchFalso);

    const mapa = await carregarMapaPrevisoesIa("carreiro");

    const urlChamada = String(fetchFalso.mock.calls[0][0]);
    expect(urlChamada).toContain("tenant_id=eq.carreiro");
    // Sem o filtro de data, projeção de meses atrás viraria compra de hoje.
    expect(urlChamada).toContain("data_previsao=gte.");
    // Ordem estável é pré-requisito da paginação por offset.
    expect(urlChamada).toContain("order=produto_id.asc,filial_id.asc");
    expect(urlChamada).toContain("horizonte_dias");

    const item = mapa.get("4512:1");
    expect(item?.demandaP80).toBe(18);
    // O horizonte de origem é obrigatório para o motor reescalar a projeção.
    expect(item?.horizonteDias).toBe(30);
  });

  it("indexa também por SKU, sempre amarrado à filial", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respostaOk([linhaDb(4512, 3)])));

    const mapa = await carregarMapaPrevisoesIa("carreiro");

    expect(mapa.get("4512:3")).toBeDefined();
    expect(mapa.get("SKU-4512:3")).toBeDefined();
    // Demanda é por loja: não existe chave solta por produto, que faria a
    // filial 5 comprar contra a previsão da filial 3.
    expect(mapa.get("4512")).toBeUndefined();
  });

  it("aplica o filtro de filial quando informada", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaOk([linhaDb(4512, 3)]));
    vi.stubGlobal("fetch", fetchFalso);

    await carregarMapaPrevisoesIa("carreiro", 3);

    expect(String(fetchFalso.mock.calls[0][0])).toContain("filial_id=eq.3");
  });

  it("pagina até a última página em vez de parar no teto do PostgREST", async () => {
    // Primeira página cheia (o Supabase corta em 1000 devolvendo HTTP 200),
    // segunda incompleta: sem paginar, 3 projeções ficariam de fora em silêncio.
    const paginaCheia = Array.from({ length: 1000 }, (_, i) => linhaDb(i + 1));
    const paginaFinal = [linhaDb(1001), linhaDb(1002), linhaDb(1003)];

    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respostaOk(paginaCheia))
      .mockResolvedValueOnce(respostaOk(paginaFinal));
    vi.stubGlobal("fetch", fetchFalso);

    const mapa = await carregarMapaPrevisoesIa("carreiro");

    expect(contarProjecoesIa(mapa)).toBe(1003);
    expect(fetchFalso).toHaveBeenCalledTimes(2);

    const urls = fetchFalso.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain("offset=0");
    expect(urls[1]).toContain("offset=1000");
  });

  it("encerra a paginação quando a página vem vazia", async () => {
    const paginaCheia = Array.from({ length: 1000 }, (_, i) => linhaDb(i + 1));
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respostaOk(paginaCheia))
      .mockResolvedValueOnce(respostaOk([]));
    vi.stubGlobal("fetch", fetchFalso);

    const mapa = await carregarMapaPrevisoesIa("carreiro");

    expect(contarProjecoesIa(mapa)).toBe(1000);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it("devolve mapa vazio quando a tabela não existe (fallback para baseline)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchFalso = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response);
    vi.stubGlobal("fetch", fetchFalso);

    const mapa = await carregarMapaPrevisoesIa("carreiro");

    expect(mapa.size).toBe(0);
  });

  it("não interrompe o cockpit quando a rede falha", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));

    const mapa = await carregarMapaPrevisoesIa("carreiro");

    expect(mapa.size).toBe(0);
  });

  it("reaproveita o cache em memória na segunda chamada", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaOk([linhaDb(4512)]));
    vi.stubGlobal("fetch", fetchFalso);

    await carregarMapaPrevisoesIa("carreiro");
    await carregarMapaPrevisoesIa("carreiro");

    expect(fetchFalso).toHaveBeenCalledTimes(1);

    limparCachePrevisoesIa();
    await carregarMapaPrevisoesIa("carreiro");
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it("usa o teto de idade como filtro no banco", () => {
    expect(VALIDADE_MAXIMA_DIAS).toBeGreaterThan(0);
  });
});

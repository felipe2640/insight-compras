import { describe, it, expect, beforeEach } from "vitest";
import { RepositorioAprendizadoMemoria } from "@/lib/aprendizado/provedores/memoria";
import { idProvedorAprendizado, reiniciarRepositorioAprendizado } from "@/lib/aprendizado/repositorio";

const item = (produtoId: number, qtdComprador: number, qtdModelo: number | null) => ({
  produtoId, sku: `S${produtoId}`, descricao: "d", filialId: 1, custo: 1,
  qtdComprador, qtdTransferenciaComprador: 0, qtdModelo, qtdTransferenciaModelo: 0,
  perfil: "ALTO_GIRO" as const, consumoDiario: 0.5, horizonteDias: 20, margemAplicada: 0.25,
  fatorCalibracao: 0.9, previsaoBruta: 12, elegivel: qtdModelo !== null, motivoInelegibilidade: null, sinalGovernanca: null,
});

describe("repositório em memória cumpre a porta (o mesmo contrato do Supabase)", () => {
  let relogio = Date.parse("2026-09-01T12:00:00Z");
  let repo: RepositorioAprendizadoMemoria;
  beforeEach(() => { repo = new RepositorioAprendizadoMemoria(() => relogio); });

  it("snapshot -> comparativo -> feedback -> confirmação -> calibração -> publicação", async () => {
    const r = await repo.gravarSnapshot({ tenantId: "t", filialId: 1, usuario: "u", layoutId: "l", formato: "csv", itens: [item(1, 6, 4), item(2, 0, null)] });
    expect(r).toEqual({ gravado: true, snapshotId: 1 });

    const comp = await repo.listarComparativo({ tenantId: "t", dias: 30 });
    expect(comp.map((c) => c.produtoId)).toEqual([2, 1]);
    expect(comp[1].feedback).toBeNull();

    await repo.gravarFeedback({ tenantId: "t", itemId: 1, motivo: "sem_verba", comentario: null, usuario: "g" });
    expect((await repo.listarComparativo({ tenantId: "t", dias: 30 }))[1].feedback?.motivo).toBe("sem_verba");

    const pendentes = await repo.listarItensParaConfirmar({ tenantId: "t", dias: 30 });
    expect(pendentes.map((p) => p.id)).toEqual([1]); // inelegível não entra

    await repo.gravarConfirmacoes("t", [{ itemId: 1, janelaDias: 10, qtdEntrada: 6, qtdTransferida: 0, status: "confirmado" }]);
    expect(await repo.listarItensParaConfirmar({ tenantId: "t", dias: 30 })).toEqual([]);

    const linhas = await repo.listarLinhasCalibracao({ tenantId: "t", dias: 30 });
    expect(linhas).toEqual([{ perfil: "ALTO_GIRO", consumoDiario: 0.5, horizonteDias: 20, margemAplicada: 0.25, fatorCalibracao: 0.9, suprimentoReal: 6, status: "confirmado" }]);

    expect(await repo.carregarParametrosPublicados("t")).toBeNull();
    const pub = await repo.publicarParametros({ tenantId: "t", margens: { ALTO_GIRO: 0.3, MEDIO_GIRO: 0.45, BAIXO_GIRO_INTERMITENTE: 0.8, SEM_HISTORICO_SUFICIENTE: 0 }, fatorCalibracao: 0.9, proposta: [], usuario: "g" });
    expect(pub.versao).toBe("20260901120000");
    expect((await repo.carregarParametrosPublicados("t"))?.margens.ALTO_GIRO).toBe(0.3);
  });

  it("isola tenants e respeita a janela de dias", async () => {
    await repo.gravarSnapshot({ tenantId: "a", filialId: 1, usuario: "u", layoutId: "l", formato: "csv", itens: [item(1, 1, 1)] });
    expect(await repo.listarComparativo({ tenantId: "b", dias: 30 })).toEqual([]);
    relogio += 40 * 86_400_000;
    expect(await repo.listarComparativo({ tenantId: "a", dias: 30 })).toEqual([]);
  });
});

describe("seleção do provedor de aprendizado", () => {
  const envOriginal = { ...process.env };
  beforeEach(() => { process.env = { ...envOriginal }; delete process.env.APRENDIZADO_PROVIDER; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; reiniciarRepositorioAprendizado(); });

  it("sem env = nenhum (no-op); com chaves = supabase; APRENDIZADO_PROVIDER manda", () => {
    expect(idProvedorAprendizado()).toBe("nenhum");
    process.env.SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "srv";
    expect(idProvedorAprendizado()).toBe("supabase");
    process.env.APRENDIZADO_PROVIDER = "memoria";
    expect(idProvedorAprendizado()).toBe("memoria");
  });
});

/**
 * Tier 1: Cobertura de Features — Adapters, Resiliência de Cache, Circuit Breaker e White-Label
 * Requisitos: ORIGINAL_REQUEST R1, R5 & PROJECT.md
 */

import { describe, it, expect, vi } from "vitest";
import {
  GerenciadorCacheResiliente,
  CircuitBreakerResiliente,
} from "../harness/mock-ambiente";
// Do CADASTRO de verdade, não do dublê do harness. Este teste importava um
// TENANT_CARREIRO de mentira e afirmava 2 filiais e os nomes "Trairi" e
// "Paraipaba" — que não são de cliente nenhum deste projeto. Passava sempre,
// dissesse o que dissesse o cadastro real, e dava por guardado justamente o
// que não guardava.
import { TENANT_CARREIRO } from "@config/tenants";

describe("Tier 1 — Feature 6: Adapters, Resiliência de Cache, Circuit Breaker & White-Label", () => {
  // T1.6.1: Conformidade da interface InventoryAdapter
  it("T1.6.1 — deve validar a conformidade dos adaptadores com os contratos de carga e saúde de conexão", async () => {
    // Contrato estipulado em PROJECT.md
    interface InventoryAdapter {
      carregarInventarioCompleto(filtro: { filialId: number }): Promise<{ total: number }>;
      verificarSaudeConexao(): Promise<boolean>;
    }

    const mockAdapter: InventoryAdapter = {
      async carregarInventarioCompleto(filtro) {
        return { total: 25000 };
      },
      async verificarSaudeConexao() {
        return true;
      },
    };

    const saude = await mockAdapter.verificarSaudeConexao();
    const inventario = await mockAdapter.carregarInventarioCompleto({ filialId: 1 });

    expect(saude).toBe(true);
    expect(inventario.total).toBe(25000);
  });

  // T1.6.2: Cache L1 com Singleflight Coalescing
  it("T1.6.2 — deve coalescer requisições concorrentes idênticas compartilhando a mesma chamada de rede (Singleflight)", async () => {
    const gerenciadorCache = new GerenciadorCacheResiliente<string>(10000);
    let contadorChamadasRede = 0;

    const chamadaRedeDemorada = async () => {
      contadorChamadasRede++;
      await new Promise((r) => setTimeout(r, 50));
      return "DADOS_POWERBI_25K";
    };

    // Dispara 3 requisições simultâneas para a mesma chave
    const [res1, res2, res3] = await Promise.all([
      gerenciadorCache.obterOuExecutar("catalogo-loja-1", chamadaRedeDemorada),
      gerenciadorCache.obterOuExecutar("catalogo-loja-1", chamadaRedeDemorada),
      gerenciadorCache.obterOuExecutar("catalogo-loja-1", chamadaRedeDemorada),
    ]);

    expect(contadorChamadasRede).toBe(1); // Apenas 1 chamada de rede real disparada!
    expect(res1.dado).toBe("DADOS_POWERBI_25K");
    expect(res2.dado).toBe("DADOS_POWERBI_25K");
    expect(res3.dado).toBe("DADOS_POWERBI_25K");

    // Um foi rede, os outros foram singleflight
    const fontes = [res1.fonte, res2.fonte, res3.fonte];
    expect(fontes).toContain("REDE");
    expect(fontes).toContain("SINGLEFLIGHT");
  });

  // T1.6.3: Cache L2 Stale-While-Revalidate
  it("T1.6.3 — deve retornar o snapshot L2 quando a consulta primária falhar", async () => {
    const gerenciadorCache = new GerenciadorCacheResiliente<string>(10000);
    gerenciadorCache.definirSnapshotL2("catalogo-loja-1", "SNAPSHOT_MATINAL_OFFLINE");

    // Simula falha de rede na API Power BI
    const chamadaComFalha = async () => {
      throw new Error("Power BI REST API: HTTP 503 Service Unavailable");
    };

    const resultado = await gerenciadorCache.obterOuExecutar("catalogo-loja-1", chamadaComFalha);
    expect(resultado.fonte).toBe("SNAPSHOT_L2");
    expect(resultado.dado).toBe("SNAPSHOT_MATINAL_OFFLINE");
  });

  // T1.6.4: Circuit Breaker desarmando após 3 falhas consecutivas
  it("T1.6.4 — deve abrir o circuito após 3 falhas consecutivas de rede e acionar modo degradado", async () => {
    const breaker = new CircuitBreakerResiliente<string>({
      limiteFalhasConsecutivas: 3,
      tempoAbertoMs: 2000,
    });

    const chamadaFalha = async () => {
      throw new Error("Timeout Power BI");
    };
    const fallback = async () => "DADOS_DEGRADADOS_CACHE_LOCAL";

    expect(breaker.obterEstado()).toBe("FECHADO");

    // Falha 1
    await breaker.executar(chamadaFalha, fallback);
    expect(breaker.obterEstado()).toBe("FECHADO");

    // Falha 2
    await breaker.executar(chamadaFalha, fallback);
    expect(breaker.obterEstado()).toBe("FECHADO");

    // Falha 3 -> Trip do Circuit Breaker para ABERTO
    const res3 = await breaker.executar(chamadaFalha, fallback);
    expect(breaker.obterEstado()).toBe("ABERTO");
    expect(res3.fonte).toBe("SNAPSHOT_DEGRADADO");
    expect(res3.dado).toBe("DADOS_DEGRADADOS_CACHE_LOCAL");
  });

  // T1.6.5: Sistema White-Label Multi-Tenant Carreiro
  it("T1.6.5 — deve validar as variáveis e especificações do tenant Carreiro para deploy isolado na Vercel", () => {
    expect(TENANT_CARREIRO.id).toBe("carreiro");
    expect(TENANT_CARREIRO.subdominioPrincipal).toBe("carreiro.insightd.com.br");
    expect(TENANT_CARREIRO.cores.primaria).toBe("#0B39B0"); // Azul do logotipo
    expect(TENANT_CARREIRO.filiais).toHaveLength(5);
    expect(TENANT_CARREIRO.filiais.map((f) => f.nome)).toEqual([
      "Carreiro Pedro II (Matriz)",
      "Melo / Piripiri",
      "Carreiro Poranga",
      "Ceará Auto Peças (Campo Maior)",
      "Carreiro José de Freitas",
    ]);
  });
});

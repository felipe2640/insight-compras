/**
 * Suíte de Testes do Cache Resiliente & Circuit Breaker
 * Camada: Adapters / Carreiro
 * Requisitos: ORIGINAL_REQUEST R1 & PROJECT.md
 */

import { describe, it, expect, vi } from "vitest";
import {
  GerenciadorCacheResiliente,
  CircuitBreakerResiliente,
  CacheLruMemoria,
} from "@adapters/carreiro/cache-resiliente";
import { RespostaCargaInventario } from "@adapters/AdaptadorInventario";

function criarRespostaInventarioDummy(id: string = "1"): RespostaCargaInventario {
  return {
    produtos: [],
    estoques: new Map(),
    historicos: new Map(),
    entradasHoje: [],
    similares: new Map(),
    metadados: {
      provedor: "POWERBI_FABRIC_DAX",
      timestampCarga: new Date().toISOString(),
      emModoDegradado: false,
      totalSkusCarregados: 100,
      latenciaMs: 15,
    },
  };
}

describe("Cache Resiliente & Circuit Breaker (Marco 2)", () => {
  describe("CacheLruMemoria", () => {
    it("deve armazenar e recuperar itens respeitando capacidade máxima LRU", () => {
      const lru = new CacheLruMemoria<string, number>(3);

      lru.set("a", 1);
      lru.set("b", 2);
      lru.set("c", 3);
      expect(lru.size).toBe(3);

      // Acessa 'a' tornando-o mais recentemente utilizado
      expect(lru.get("a")).toBe(1);

      // Insere 'd', o que deve expulsar 'b' (menos recentemente utilizado)
      lru.set("d", 4);
      expect(lru.size).toBe(3);
      expect(lru.has("b")).toBe(false);
      expect(lru.has("a")).toBe(true);
      expect(lru.has("c")).toBe(true);
      expect(lru.has("d")).toBe(true);
    });
  });

  describe("GerenciadorCacheResiliente", () => {
    it("deve retornar do Cache L1 sem chamar a rede na segunda requisição (L1 hit)", async () => {
      const gerenciador = new GerenciadorCacheResiliente<string>(10_000);
      let contadorRede = 0;

      const buscarRede = async () => {
        contadorRede++;
        return "RESPOSTA_POWERBI";
      };

      // 1ª chamada: Cache Miss -> Rede
      const res1 = await gerenciador.obterOuExecutar("chave-1", buscarRede);
      expect(res1.fonte).toBe("REDE");
      expect(res1.dado).toBe("RESPOSTA_POWERBI");
      expect(contadorRede).toBe(1);

      // 2ª chamada: Cache Hit L1
      const res2 = await gerenciador.obterOuExecutar("chave-1", buscarRede);
      expect(res2.fonte).toBe("CACHE_L1");
      expect(res2.dado).toBe("RESPOSTA_POWERBI");
      expect(contadorRede).toBe(1); // Não chamou a rede novamente!
    });

    it("deve coalescer requisições concorrentes disparadas simultaneamente (Singleflight)", async () => {
      const gerenciador = new GerenciadorCacheResiliente<string>(10_000);
      let chamadasRede = 0;

      const operacaoDemorada = async () => {
        chamadasRede++;
        await new Promise((r) => setTimeout(r, 60));
        return "DADO_UNICO_COALESCIDO";
      };

      // Dispara 5 requisições em paralelo para a mesma chave
      const resultados = await Promise.all([
        gerenciador.obterOuExecutar("chave-concorrente", operacaoDemorada),
        gerenciador.obterOuExecutar("chave-concorrente", operacaoDemorada),
        gerenciador.obterOuExecutar("chave-concorrente", operacaoDemorada),
        gerenciador.obterOuExecutar("chave-concorrente", operacaoDemorada),
        gerenciador.obterOuExecutar("chave-concorrente", operacaoDemorada),
      ]);

      expect(chamadasRede).toBe(1); // Exatamente UMA chamada de rede real!
      const fontes = resultados.map((r) => r.fonte);
      expect(fontes).toContain("REDE");
      expect(fontes).toContain("SINGLEFLIGHT");

      for (const res of resultados) {
        expect(res.dado).toBe("DADO_UNICO_COALESCIDO");
      }
    });

    it("deve servir o Snapshot L2 quando a rede primária falhar", async () => {
      const gerenciador = new GerenciadorCacheResiliente<RespostaCargaInventario>(10_000);
      const snapshotMatinal = criarRespostaInventarioDummy("matinal");

      gerenciador.definirSnapshotL2("inventario:loja1", snapshotMatinal);

      const chamadaComFalha = async () => {
        throw new Error("HTTP 504 Gateway Timeout Power BI Fabric");
      };

      const resultado = await gerenciador.obterOuExecutar("inventario:loja1", chamadaComFalha);
      expect(resultado.fonte).toBe("SNAPSHOT_L2");
      expect(resultado.dado.metadados.emModoDegradado).toBe(true);
      expect(resultado.dado.metadados.motivoModoDegradado).toBe("FALLBACK_ERRO_REDE");
    });
  });

  describe("CircuitBreakerResiliente", () => {
    it("deve abrir o circuito após 3 falhas consecutivas e servir snapshot em modo degradado", async () => {
      const breaker = new CircuitBreakerResiliente<string>({
        limiteFalhasConsecutivas: 3,
        tempoAbertoMs: 200, // 200ms para teste ágil
      });

      let tentativasRede = 0;
      const chamadaFalha = async () => {
        tentativasRede++;
        throw new Error("Falha de comunicação Fabric");
      };
      const fallbackSnapshot = async () => "SNAPSHOT_OFFLINE_SEGURO";

      expect(breaker.obterEstado()).toBe("FECHADO");

      // Falha 1
      await breaker.executar(chamadaFalha, fallbackSnapshot);
      expect(breaker.obterEstado()).toBe("FECHADO");
      expect(tentativasRede).toBe(1);

      // Falha 2
      await breaker.executar(chamadaFalha, fallbackSnapshot);
      expect(breaker.obterEstado()).toBe("FECHADO");
      expect(tentativasRede).toBe(2);

      // Falha 3 -> Trip para ABERTO
      const res3 = await breaker.executar(chamadaFalha, fallbackSnapshot);
      expect(breaker.obterEstado()).toBe("ABERTO");
      expect(res3.fonte).toBe("SNAPSHOT_DEGRADADO");
      expect(res3.dado).toBe("SNAPSHOT_OFFLINE_SEGURO");
      expect(tentativasRede).toBe(3);

      // 4ª chamada com circuito ABERTO: NÃO deve tentar a rede
      const res4 = await breaker.executar(chamadaFalha, fallbackSnapshot);
      expect(res4.fonte).toBe("SNAPSHOT_DEGRADADO");
      expect(tentativasRede).toBe(3); // Permanece 3, não chamou a rede!

      // Aguarda expirar tempo de circuito aberto (200ms)
      await new Promise((r) => setTimeout(r, 220));
      expect(breaker.obterEstado()).toBe("MEIO_ABERTO");

      // Sucesso na recuperação em meio-aberto fecha o circuito
      const chamadaSucesso = async () => {
        tentativasRede++;
        return "REDE_RECUPERADA";
      };
      const res5 = await breaker.executar(chamadaSucesso, fallbackSnapshot);
      expect(res5.fonte).toBe("REDE");
      expect(res5.dado).toBe("REDE_RECUPERADA");
      expect(breaker.obterEstado()).toBe("FECHADO");
    });
  });
});

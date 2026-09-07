/**
 * Suíte de Testes Adversariais de Resiliência de Rede, Injeção de Falhas e Circuit Breaker
 * Challenger 2 — Marco 2: Adapters & DAX Carreiro
 *
 * Testes empíricos cobrindo:
 * 1. Injeção de Falhas do Fabric REST API (Timeouts, HTTP 429, HTTP 500, HTTP 503, Oscilações)
 * 2. Transições Estritas do Circuit Breaker (3 falhas consecutivas, Meio-Aberto, Fechamento e Modo Degradado)
 * 3. Avalanche de Requisições Concorrentes (Singleflight Request Collapsing) em cenários nominais e adversariais
 * 4. Resiliência Integrada no AdaptadorInventarioCarreiro com Fallback L2 Stale-While-Revalidate
 */

import { describe, it, expect, vi } from "vitest";
import {
  GerenciadorCacheResiliente,
  CircuitBreakerResiliente,
  CacheLruMemoria,
} from "@adapters/carreiro/cache-resiliente";
import {
  AdaptadorInventarioCarreiro,
} from "@adapters/carreiro/adaptador-carreiro";
import { ClienteDaxPowerBI } from "@adapters/carreiro/cliente-dax";
import {
  RespostaCargaInventario,
  FiltroCargaInventario,
} from "@adapters/AdaptadorInventario";

/**
 * Cria payload sintético de inventário para uso como Snapshot L2
 */
function gerarSnapshotL2Mock(tag: string = "padrao"): RespostaCargaInventario {
  return {
    produtos: [
      {
        id: 101,
        codigoSku: "AMOR-001",
        descricao: "Amortecedor Dianteiro Hilux",
        marca: "Cofap",
        fabricante: "Magneti Marelli",
        referenciaFabricante: "GP30123",
        aplicacaoVeicular: "Hilux 2016-2023",
        familiaId: "SUSP-HILUX",
        secaoId: 1,
        nomeSecao: "Suspensao",
        fornecedorId: 1,
        nomeFornecedor: "Distribuidora Brasil",
        precoCusto: 180,
        precoVenda: 290,
        loteMultiplo: 2,
      },
      {
        id: 102,
        codigoSku: "VELA-002",
        descricao: "Vela de Ignicao Iridium",
        marca: "NGK",
        fabricante: "NGK Spark Plugs",
        referenciaFabricante: "BKR6EIX",
        aplicacaoVeicular: "Corolla / Civic",
        familiaId: "MOT-VELA",
        secaoId: 2,
        nomeSecao: "Motor",
        fornecedorId: 2,
        nomeFornecedor: "NGK do Brasil",
        precoCusto: 25,
        precoVenda: 45,
        loteMultiplo: 4,
      },
    ],
    estoques: new Map([
      [
        "101:1",
        {
          produtoId: 101,
          filialId: 1,
          nomeFilial: "Pedro II",
          saldoFisico: 10,
          estoqueMinimoSeguranca: 4,
          quantidadeJaPedida: 0,
          consumoMedioDiarioErp: 0.5,
          dataUltimaVenda: "2026-09-01",
          dataUltimaCompra: "2026-08-15",
        },
      ],
    ]),
    historicos: new Map([
      [
        "101:1",
        {
          produtoId: 101,
          filialId: 1,
          vendasLiquidas30dias: 15,
          vendasLiquidas90dias: 45,
          vendasLiquidas180dias: 90,
          devolucoes90dias: 0,
          notasFiscaisVenda90dias: 10,
          notasFiscaisDevolucao90dias: 0,
          diasRuptura90dias: 0,
          diasObservados: 90,
          dataPrimeiraVendaRegistrada: "2026-06-01",
        },
      ],
    ]),
    entradasHoje: [],
    similares: new Map(),
    metadados: {
      provedor: "POWERBI_FABRIC_DAX",
      timestampCarga: new Date().toISOString(),
      emModoDegradado: false,
      totalSkusCarregados: 2,
      latenciaMs: 42,
    },
  };
}

describe("Adversarial Challenger 2 — Resiliência de Rede & Circuit Breaker (Marco 2)", () => {
  // =========================================================================
  // SEÇÃO 1: INJEÇÃO DE FALHAS DE REDE (Timeouts, HTTP 429, 500, 503, Flapping)
  // =========================================================================
  describe("1. Injeção de Falhas de Rede Simuladas (Power BI Fabric API)", () => {
    it("1.1 deve capturar e tratar Timeout de Rede (ETIMEDOUT / Gateway Timeout 504)", async () => {
      const cache = new GerenciadorCacheResiliente<RespostaCargaInventario>(60_000);
      const snapshot = gerarSnapshotL2Mock("snapshot-pre-timeout");
      cache.definirSnapshotL2("inventario:filtro-timeout", snapshot);

      // Simulação de Timeout que demora 50ms e rejeita
      const chamadaComTimeout = async () => {
        await new Promise((r) => setTimeout(r, 50));
        throw new Error("ETIMEDOUT: Conexão com Fabric API expirou após 30000ms");
      };

      const resultado = await cache.obterOuExecutar("inventario:filtro-timeout", chamadaComTimeout);

      expect(resultado.fonte).toBe("SNAPSHOT_L2");
      expect(resultado.dado.metadados.emModoDegradado).toBe(true);
      expect(resultado.dado.metadados.motivoModoDegradado).toBe("FALLBACK_ERRO_REDE");
      expect(resultado.dado.produtos).toHaveLength(2);
    });

    it("1.2 deve capturar e tratar HTTP 429 Too Many Requests (Rate Limiting do Fabric)", async () => {
      const cache = new GerenciadorCacheResiliente<RespostaCargaInventario>(60_000);
      const snapshot = gerarSnapshotL2Mock("snapshot-pre-429");
      cache.definirSnapshotL2("inventario:filtro-429", snapshot);

      const chamadaRateLimit = async () => {
        throw new Error("[Cliente DAX] Erro na API REST do Power BI Fabric (HTTP 429): Quota exceeded");
      };

      const resultado = await cache.obterOuExecutar("inventario:filtro-429", chamadaRateLimit);

      expect(resultado.fonte).toBe("SNAPSHOT_L2");
      expect(resultado.dado.metadados.emModoDegradado).toBe(true);
      expect(resultado.dado.metadados.motivoModoDegradado).toBe("FALLBACK_ERRO_REDE");
    });

    it("1.3 deve capturar e tratar HTTP 500 Internal Server Error & HTTP 503 Service Unavailable", async () => {
      const cache = new GerenciadorCacheResiliente<RespostaCargaInventario>(60_000);
      const snapshot = gerarSnapshotL2Mock("snapshot-pre-500");
      cache.definirSnapshotL2("inventario:filtro-500", snapshot);

      const chamadaErro500 = async () => {
        throw new Error("[Cliente DAX] Erro na API REST do Power BI Fabric (HTTP 500): Internal Engine Crash");
      };

      const resultado = await cache.obterOuExecutar("inventario:filtro-500", chamadaErro500);

      expect(resultado.fonte).toBe("SNAPSHOT_L2");
      expect(resultado.dado.metadados.emModoDegradado).toBe(true);
      expect(resultado.dado.metadados.motivoModoDegradado).toBe("FALLBACK_ERRO_REDE");
    });

    it("1.4 deve tolerar oscilação intermitente (flapping) sem abrir o Circuit Breaker prematuramente", async () => {
      // Breaker configurado para abrir com 3 falhas consecutivas
      const cache = new GerenciadorCacheResiliente<RespostaCargaInventario>(60_000, 100, {
        limiteFalhasConsecutivas: 3,
        tempoAbertoMs: 10_000,
      });
      const snapshot = gerarSnapshotL2Mock("snapshot-flapping");
      cache.definirSnapshotL2("chave-flapping", snapshot);

      let estadoRede: "FALHA" | "SUCESSO" = "FALHA";

      const chamadaOscilante = async () => {
        if (estadoRede === "FALHA") {
          throw new Error("HTTP 503 Falha Transitória de Rede");
        }
        return gerarSnapshotL2Mock("resposta-fresca-rede");
      };

      // Ciclo de oscilação: Falha, Falha, Sucesso, Falha, Falha, Sucesso
      // Nunca atinge 3 falhas consecutivas!

      // 1. Falha 1 (falhasConsecutivas = 1) -> Serve fallback L2
      cache.limparL1();
      estadoRede = "FALHA";
      const r1 = await cache.obterOuExecutar("chave-flapping", chamadaOscilante);
      expect(r1.fonte).toBe("SNAPSHOT_L2");
      expect(cache.obterEstadoCircuitBreaker()).toBe("FECHADO");

      // 2. Falha 2 (falhasConsecutivas = 2) -> Serve fallback L2
      cache.limparL1();
      const r2 = await cache.obterOuExecutar("chave-flapping", chamadaOscilante);
      expect(r2.fonte).toBe("SNAPSHOT_L2");
      expect(cache.obterEstadoCircuitBreaker()).toBe("FECHADO");

      // 3. Sucesso! (falhasConsecutivas resetadas para 0)
      cache.limparL1();
      estadoRede = "SUCESSO";
      const r3 = await cache.obterOuExecutar("chave-flapping", chamadaOscilante);
      expect(r3.fonte).toBe("REDE");
      expect(cache.obterEstadoCircuitBreaker()).toBe("FECHADO");

      // 4. Falha 1 novamente após recuperação (falhasConsecutivas = 1)
      cache.limparL1();
      estadoRede = "FALHA";
      const r4 = await cache.obterOuExecutar("chave-flapping", chamadaOscilante);
      expect(r4.fonte).toBe("SNAPSHOT_L2");
      expect(cache.obterEstadoCircuitBreaker()).toBe("FECHADO");

      // 5. Falha 2 (falhasConsecutivas = 2)
      cache.limparL1();
      const r5 = await cache.obterOuExecutar("chave-flapping", chamadaOscilante);
      expect(r5.fonte).toBe("SNAPSHOT_L2");
      expect(cache.obterEstadoCircuitBreaker()).toBe("FECHADO");

      // Circuito continua estritamente FECHADO porque falhas foram intermitentes!
      expect(cache.obterEstadoCircuitBreaker()).toBe("FECHADO");
    });
  });

  // =========================================================================
  // SEÇÃO 2: VERIFICAÇÃO ESTRITA DO CIRCUIT BREAKER
  // =========================================================================
  describe("2. Circuit Breaker — Transições Estritas de Estado e Modo Degradado", () => {
    it("2.1 deve transitar para ABERTO estritamente na 3ª falha consecutiva", async () => {
      const breaker = new CircuitBreakerResiliente<string>({
        limiteFalhasConsecutivas: 3,
        tempoAbertoMs: 500,
      });

      const falha = async () => {
        throw new Error("Erro Fabric");
      };
      const fallback = async () => "DADO_FALLBACK";

      expect(breaker.obterEstado()).toBe("FECHADO");

      // Falha 1
      await breaker.executar(falha, fallback);
      expect(breaker.obterEstado()).toBe("FECHADO");

      // Falha 2
      await breaker.executar(falha, fallback);
      expect(breaker.obterEstado()).toBe("FECHADO");

      // Falha 3 -> Trip imediato para ABERTO
      await breaker.executar(falha, fallback);
      expect(breaker.obterEstado()).toBe("ABERTO");
    });

    it("2.2 quando ABERTO, não deve tocar a rede e deve servir SNAPSHOT_DEGRADADO com flag emModoDegradado: true", async () => {
      const cache = new GerenciadorCacheResiliente<RespostaCargaInventario>(60_000, 100, {
        limiteFalhasConsecutivas: 3,
        tempoAbertoMs: 10_000,
      });
      const snapshot = gerarSnapshotL2Mock("snapshot-degradado-teste");
      cache.definirSnapshotL2("chave-breaker", snapshot);

      let chamadasRede = 0;
      const chamadaComFalha = async () => {
        chamadasRede++;
        throw new Error("Fabric Offline");
      };

      // Executa 3 falhas consecutivas para forçar a abertura
      for (let i = 1; i <= 3; i++) {
        cache.limparL1();
        await cache.obterOuExecutar("chave-breaker", chamadaComFalha);
      }

      expect(chamadasRede).toBe(3);
      expect(cache.obterEstadoCircuitBreaker()).toBe("ABERTO");

      // 4ª chamada: Com o circuito ABERTO, deve servir imediatamente SNAPSHOT_DEGRADADO sem chamar a rede
      cache.limparL1();
      const resultado = await cache.obterOuExecutar("chave-breaker", chamadaComFalha);

      expect(chamadasRede).toBe(3); // Rede NÃO foi chamada!
      expect(resultado.fonte).toBe("SNAPSHOT_DEGRADADO");
      expect(resultado.dado.metadados.emModoDegradado).toBe(true);
      expect(resultado.dado.metadados.motivoModoDegradado).toBe("CIRCUIT_BREAKER_ABERTO");
      expect(resultado.dado.produtos).toHaveLength(2);
    });

    it("2.3 deve lançar erro explícito caso o Circuit Breaker esteja ABERTO e NÃO exista snapshot L2", async () => {
      const cache = new GerenciadorCacheResiliente<string>(60_000, 100, {
        limiteFalhasConsecutivas: 3,
        tempoAbertoMs: 10_000,
      });

      const chamadaFalha = async () => {
        throw new Error("Erro sem snapshot");
      };

      // Provoca 3 falhas consecutivas sem definir snapshot L2
      for (let i = 0; i < 3; i++) {
        await expect(cache.obterOuExecutar("chave-sem-snapshot", chamadaFalha)).rejects.toThrow(
          "Erro sem snapshot"
        );
      }

      expect(cache.obterEstadoCircuitBreaker()).toBe("ABERTO");

      // 4ª chamada: Circuito aberto sem snapshot
      await expect(
        cache.obterOuExecutar("chave-sem-snapshot", chamadaFalha)
      ).rejects.toThrow(/Circuit Breaker está ABERTO devido a falhas consecutivas e não há snapshot L2/);
    });

    it("2.4 deve transitar para MEIO_ABERTO após expiração do tempoAbertoMs e recuperar para FECHADO em caso de sucesso", async () => {
      const breaker = new CircuitBreakerResiliente<string>({
        limiteFalhasConsecutivas: 3,
        tempoAbertoMs: 100, // 100ms para ciclo ágil
      });

      const falha = async () => {
        throw new Error("Erro");
      };
      const fallback = async () => "FALLBACK";

      // 3 falhas para abrir
      await breaker.executar(falha, fallback);
      await breaker.executar(falha, fallback);
      await breaker.executar(falha, fallback);
      expect(breaker.obterEstado()).toBe("ABERTO");

      // Aguarda 120ms para transição para MEIO_ABERTO
      await new Promise((r) => setTimeout(r, 120));
      expect(breaker.obterEstado()).toBe("MEIO_ABERTO");

      // Prova de fogo bem sucedida na rede
      const sucesso = async () => "DADO_FRESCO_REDE";
      const resultado = await breaker.executar(sucesso, fallback);

      expect(resultado.fonte).toBe("REDE");
      expect(resultado.dado).toBe("DADO_FRESCO_REDE");
      expect(breaker.obterEstado()).toBe("FECHADO");
    });

    it("2.5 deve reabrir imediatamente para ABERTO se a sondagem em MEIO_ABERTO falhar", async () => {
      const breaker = new CircuitBreakerResiliente<string>({
        limiteFalhasConsecutivas: 3,
        tempoAbertoMs: 100,
      });

      const falha = async () => {
        throw new Error("Erro");
      };
      const fallback = async () => "FALLBACK";

      await breaker.executar(falha, fallback);
      await breaker.executar(falha, fallback);
      await breaker.executar(falha, fallback);
      expect(breaker.obterEstado()).toBe("ABERTO");

      await new Promise((r) => setTimeout(r, 120));
      expect(breaker.obterEstado()).toBe("MEIO_ABERTO");

      // Se falhar em MEIO_ABERTO, deve reabrir
      const resultado = await breaker.executar(falha, fallback);
      expect(resultado.fonte).toBe("SNAPSHOT_DEGRADADO");
      expect(breaker.obterEstado()).toBe("ABERTO");
    });
  });

  // =========================================================================
  // SEÇÃO 3: AVALANCHE CONCORRENTE & SINGLEFLIGHT (REQUEST COLLAPSING)
  // =========================================================================
  describe("3. Avalanche de Requisições Concorrentes (Singleflight Request Collapsing)", () => {
    it("3.1 deve coalescer 50 requisições simultâneas em exatamente 1 chamada de rede sob carga nominal", async () => {
      const cache = new GerenciadorCacheResiliente<string>(60_000);
      let contadorRede = 0;

      const buscaPesada = async () => {
        contadorRede++;
        await new Promise((r) => setTimeout(r, 80)); // Simula latência de 80ms
        return "CATALOGO_COMPLETO_CARREIRO_25K";
      };

      // Dispara avalanche de 50 chamadas em paralelo
      const promessas = Array.from({ length: 50 }, () =>
        cache.obterOuExecutar("catalogo-loja-concorrente", buscaPesada)
      );

      const resultados = await Promise.all(promessas);

      // Verificação empírica estrita
      expect(contadorRede).toBe(1); // APENAS UMA CHAMADA REAL DE REDE!
      expect(resultados).toHaveLength(50);

      const fontes = resultados.map((r) => r.fonte);
      const qtdRede = fontes.filter((f) => f === "REDE").length;
      const qtdSingleflight = fontes.filter((f) => f === "SINGLEFLIGHT").length;

      expect(qtdRede).toBe(1);
      expect(qtdSingleflight).toBe(49);

      for (const res of resultados) {
        expect(res.dado).toBe("CATALOGO_COMPLETO_CARREIRO_25K");
      }
    });

    it("3.2 Investigação Adversarial: Avalanche Concorrente quando a Chamada de Rede FALHA", async () => {
      const cache = new GerenciadorCacheResiliente<RespostaCargaInventario>(60_000);
      const snapshot = gerarSnapshotL2Mock("snapshot-avalanche-falha");
      cache.definirSnapshotL2("chave-avalanche-falha", snapshot);

      let chamadasRede = 0;
      const chamadaQueFalha = async () => {
        chamadasRede++;
        await new Promise((r) => setTimeout(r, 60));
        throw new Error("HTTP 500 Fabric Engine Overload");
      };

      // Dispara 10 requisições simultâneas para a mesma chave enquanto a rede falha
      const promessas = Array.from({ length: 10 }, () =>
        cache.obterOuExecutar("chave-avalanche-falha", chamadaQueFalha)
      );

      const settled = await Promise.allSettled(promessas);

      // Apenas 1 chamada de rede real foi disparada (singleflight)
      expect(chamadasRede).toBe(1);

      // Investigamos o status de cada chamador da avalanche
      const cumpridas = settled.filter((s) => s.status === "fulfilled");
      const rejeitadas = settled.filter((s) => s.status === "rejected");

      // Com o fallback resiliente no singleflight, todas as 10 requisições concorrentes sob falha são cumpridas com Snapshot L2
      expect(rejeitadas.length).toBe(0);
      expect(cumpridas.length).toBe(10);

      for (const cumprida of cumpridas) {
        const resultado = (cumprida as PromiseFulfilledResult<any>).value;
        expect(resultado.fonte).toBe("SNAPSHOT_L2");
        expect(resultado.dado.metadados.emModoDegradado).toBe(true);
      }
    });

    it("3.3 Invariante de Resiliência: Todas as requisições concorrentes coalescidas DEVEM receber Snapshot L2 degradado se a rede primária falhar", async () => {
      const cache = new GerenciadorCacheResiliente<RespostaCargaInventario>(60_000);
      const snapshot = gerarSnapshotL2Mock("snapshot-invariante");
      cache.definirSnapshotL2("chave-invariante-resiliencia", snapshot);

      const chamadaQueFalha = async () => {
        await new Promise((r) => setTimeout(r, 40));
        throw new Error("HTTP 500 Fabric Engine Crash");
      };

      // Dispara 5 requisições concorrentes
      const promessas = Array.from({ length: 5 }, () =>
        cache.obterOuExecutar("chave-invariante-resiliencia", chamadaQueFalha)
      );

      // Em um sistema verdadeiramente resiliente, NENHUMA requisição concorrente deve quebrar se há snapshot L2 disponível
      const resultados = await Promise.all(promessas);

      expect(resultados).toHaveLength(5);
      for (const res of resultados) {
        expect(res.dado.metadados.emModoDegradado).toBe(true);
      }
    });
  });

  // =========================================================================
  // SEÇÃO 4: INTEGRAÇÃO END-TO-END COM ADAPTADOR CARREIRO & CLIENTE DAX
  // =========================================================================
  describe("4. Resiliência Integrada no AdaptadorInventarioCarreiro", () => {
    it("4.1 deve servir Snapshot L2 em modo degradado quando o endpoint Fabric retornar HTTP 500", async () => {
      // Mock do fetch simulando HTTP 500 no Fabric
      const fetchComFalha500: typeof fetch = async (input, init) => {
        const url = String(input);
        if (url.includes("login.microsoftonline.com")) {
          return new Response(
            JSON.stringify({ access_token: "token-falso", expires_in: 3600 }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Internal Server Error Fabric", {
          status: 500,
          statusText: "Internal Server Error",
        });
      };

      const clienteDax = new ClienteDaxPowerBI({
        tenantId: "tenant-teste",
        clientId: "client-teste",
        clientSecret: "secret-teste",
        fetchCustomizado: fetchComFalha500,
      });

      const cache = new GerenciadorCacheResiliente<RespostaCargaInventario>(60_000);
      const snapshotMatinal = gerarSnapshotL2Mock("snapshot-matinal-e2e");

      const filtro: FiltroCargaInventario = {
        fornecedoresPermitidos: [1, 2],
        filialId: 1,
      };

      // Define o snapshot matinal no cache L2
      const chaveFiltro = cache.gerarChaveCache(filtro);
      cache.definirSnapshotL2(chaveFiltro, snapshotMatinal);

      const adaptador = new AdaptadorInventarioCarreiro({
        clienteDax,
        gerenciadorCache: cache,
      });

      // Executa a carga com a rede em falha
      const resposta = await adaptador.carregarInventarioCompleto(filtro);

      // Verificações rigorosas do contrato
      expect(resposta).toBeDefined();
      expect(resposta.metadados.emModoDegradado).toBe(true);
      expect(resposta.metadados.motivoModoDegradado).toBe("FALLBACK_ERRO_REDE");
      expect(resposta.produtos.length).toBe(2);
      expect(resposta.produtos[0].codigoSku).toBe("AMOR-001");
    });

    it("4.2 deve abrir o Circuit Breaker no AdaptadorCarreiro após 3 falhas consecutivas de rede", async () => {
      const fetchSempreFalha: typeof fetch = async (input) => {
        const url = String(input);
        if (url.includes("login.microsoftonline.com")) {
          return new Response(
            JSON.stringify({ access_token: "token-falso", expires_in: 3600 }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("HTTP 429 Quota Exceeded", { status: 429 });
      };

      const clienteDax = new ClienteDaxPowerBI({
        accessTokenFixo: "token-direto",
        fetchCustomizado: fetchSempreFalha,
      });

      const cache = new GerenciadorCacheResiliente<RespostaCargaInventario>(60_000, 100, {
        limiteFalhasConsecutivas: 3,
        tempoAbertoMs: 50_000,
      });

      const filtro: FiltroCargaInventario = {
        fornecedoresPermitidos: null,
      };
      const chave = cache.gerarChaveCache(filtro);
      cache.definirSnapshotL2(chave, gerarSnapshotL2Mock("snapshot-429-breaker"));

      const adaptador = new AdaptadorInventarioCarreiro({
        clienteDax,
        gerenciadorCache: cache,
      });

      // 1ª falha
      cache.limparL1();
      const r1 = await adaptador.carregarInventarioCompleto(filtro);
      expect(r1.metadados.emModoDegradado).toBe(true);
      expect(cache.obterEstadoCircuitBreaker()).toBe("FECHADO");

      // 2ª falha
      cache.limparL1();
      const r2 = await adaptador.carregarInventarioCompleto(filtro);
      expect(r2.metadados.emModoDegradado).toBe(true);
      expect(cache.obterEstadoCircuitBreaker()).toBe("FECHADO");

      // 3ª falha -> Trip para ABERTO
      cache.limparL1();
      const r3 = await adaptador.carregarInventarioCompleto(filtro);
      expect(r3.metadados.emModoDegradado).toBe(true);
      expect(cache.obterEstadoCircuitBreaker()).toBe("ABERTO");

      // 4ª requisição -> Circuit Breaker ABERTO serve snapshot sem bater no cliente HTTP
      cache.limparL1();
      const r4 = await adaptador.carregarInventarioCompleto(filtro);
      expect(r4.metadados.emModoDegradado).toBe(true);
      expect(r4.metadados.motivoModoDegradado).toBe("CIRCUIT_BREAKER_ABERTO");
    });
  });
});

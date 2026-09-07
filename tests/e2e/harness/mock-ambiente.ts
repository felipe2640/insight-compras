/**
 * Harness de Teste E2E: Simulação de Ambiente (Storage, Rede & Resiliência)
 * Camada: Test Harness Opaque-Box
 */

export interface SimulaLocalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  definirLimiteBytes(limite: number | null): void;
}

/**
 * Cria uma instância isolada de localStorage em memória com suporte a simulação de QuotaExceededError.
 */
export function criarStorageIsolado(limiteBytes: number | null = null): SimulaLocalStorage {
  const store = new Map<string, string>();
  let limite = limiteBytes;

  return {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      if (limite !== null) {
        let total = 0;
        for (const [k, v] of store.entries()) {
          if (k !== key) total += k.length + v.length;
        }
        total += key.length + value.length;
        if (total > limite) {
          const erro = new Error("QuotaExceededError: O limite de armazenamento local foi excedido.");
          erro.name = "QuotaExceededError";
          throw erro;
        }
      }
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
    definirLimiteBytes(novoLimite: number | null): void {
      limite = novoLimite;
    },
  };
}

/**
 * Estado do Circuit Breaker para tolerância a falhas na API do Power BI Fabric.
 */
export type EstadoCircuitBreaker = "FECHADO" | "ABERTO" | "MEIO_ABERTO";

export interface OpcoesCircuitBreaker {
  readonly limiteFalhasConsecutivas: number;
  readonly tempoAbertoMs: number;
}

export class CircuitBreakerResiliente<T> {
  private falhasConsecutivas = 0;
  private estado: EstadoCircuitBreaker = "FECHADO";
  private timestampUltimaFalha = 0;

  constructor(
    private readonly opcoes: OpcoesCircuitBreaker = {
      limiteFalhasConsecutivas: 3,
      tempoAbertoMs: 5000,
    }
  ) {}

  obterEstado(): EstadoCircuitBreaker {
    if (
      this.estado === "ABERTO" &&
      Date.now() - this.timestampUltimaFalha >= this.opcoes.tempoAbertoMs
    ) {
      this.estado = "MEIO_ABERTO";
    }
    return this.estado;
  }

  registrarSucesso(): void {
    this.falhasConsecutivas = 0;
    this.estado = "FECHADO";
  }

  registrarFalha(): void {
    this.falhasConsecutivas++;
    this.timestampUltimaFalha = Date.now();
    if (this.falhasConsecutivas >= this.opcoes.limiteFalhasConsecutivas) {
      this.estado = "ABERTO";
    }
  }

  async executar(
    operacao: () => Promise<T>,
    fallbackSnapshot: () => Promise<T>
  ): Promise<{ dado: T; fonte: "REDE_PRIMARIA" | "SNAPSHOT_DEGRADADO" }> {
    const estadoAtual = this.obterEstado();

    if (estadoAtual === "ABERTO") {
      const dadoFallback = await fallbackSnapshot();
      return { dado: dadoFallback, fonte: "SNAPSHOT_DEGRADADO" };
    }

    try {
      const resultado = await operacao();
      this.registrarSucesso();
      return { dado: resultado, fonte: "REDE_PRIMARIA" };
    } catch (erro) {
      this.registrarFalha();
      const dadoFallback = await fallbackSnapshot();
      return { dado: dadoFallback, fonte: "SNAPSHOT_DEGRADADO" };
    }
  }
}

/**
 * Cache L1 (In-Memory com Coalescência de Requisições / Singleflight) e L2 (SWR).
 */
export class GerenciadorCacheResiliente<T> {
  private cacheL1 = new Map<string, { dado: T; expiracao: number }>();
  private cacheL2Snapshot = new Map<string, { dado: T; timestamp: number }>();
  private requisicoesEmAndamento = new Map<string, Promise<T>>();

  constructor(private readonly ttlL1Ms: number = 60000) {}

  definirSnapshotL2(chave: string, dado: T): void {
    this.cacheL2Snapshot.set(chave, { dado, timestamp: Date.now() });
  }

  obterSnapshotL2(chave: string): T | null {
    return this.cacheL2Snapshot.get(chave)?.dado ?? null;
  }

  async obterOuExecutar(
    chave: string,
    buscarFontePrimaria: () => Promise<T>
  ): Promise<{ dado: T; fonte: "CACHE_L1" | "SINGLEFLIGHT" | "REDE" | "SNAPSHOT_L2" }> {
    const agora = Date.now();
    const l1 = this.cacheL1.get(chave);
    if (l1 && l1.expiracao > agora) {
      return { dado: l1.dado, fonte: "CACHE_L1" };
    }

    // Coalescência de requisições concorrentes (Singleflight)
    if (this.requisicoesEmAndamento.has(chave)) {
      const dado = await this.requisicoesEmAndamento.get(chave)!;
      return { dado, fonte: "SINGLEFLIGHT" };
    }

    const promessa = (async () => {
      try {
        const dado = await buscarFontePrimaria();
        this.cacheL1.set(chave, { dado, expiracao: agora + this.ttlL1Ms });
        this.cacheL2Snapshot.set(chave, { dado, timestamp: agora });
        return dado;
      } finally {
        this.requisicoesEmAndamento.delete(chave);
      }
    })();

    this.requisicoesEmAndamento.set(chave, promessa);

    try {
      const dado = await promessa;
      return { dado, fonte: "REDE" };
    } catch (erro) {
      const snapshot = this.obterSnapshotL2(chave);
      if (snapshot !== null) {
        return { dado: snapshot, fonte: "SNAPSHOT_L2" };
      }
      throw erro;
    }
  }

  limparL1(): void {
    this.cacheL1.clear();
  }
}

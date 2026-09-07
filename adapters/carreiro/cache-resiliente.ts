/**
 * Gerenciador de Cache Multinível Resiliente & Circuit Breaker
 * Camada: Adapters / Carreiro
 * 100% em Português do Brasil (pt-BR).
 *
 * Estratégia Multinível:
 * - L1: Cache LRU em memória (O(1) com TTL configurável)
 * - Singleflight: Coalescência de requisições concorrentes idênticas
 * - L2: Snapshot local Stale-While-Revalidate (SWR) com validade estendida
 * - Circuit Breaker: Abre após 3 falhas consecutivas, servindo snapshot em modo degradado
 */

import { RespostaCargaInventario, FiltroCargaInventario } from "../AdaptadorInventario";

/**
 * Estados do Circuit Breaker.
 */
export type EstadoCircuitBreaker = "FECHADO" | "ABERTO" | "MEIO_ABERTO";

/**
 * Origem de onde o dado foi resolvido na esteira de resiliência.
 */
export type FonteDadosResiliencia =
  | "CACHE_L1"
  | "SINGLEFLIGHT"
  | "REDE"
  | "SNAPSHOT_L2"
  | "SNAPSHOT_DEGRADADO";

/**
 * Parâmetros de configuração do Circuit Breaker.
 */
export interface OpcoesCircuitBreaker {
  readonly limiteFalhasConsecutivas: number;
  readonly tempoAbertoMs: number;
}

/**
 * Entrada de item no Cache LRU L1.
 */
interface EntradaL1<T> {
  readonly valor: T;
  readonly expiraEm: number;
  readonly inseridoEm: number;
}

/**
 * Entrada de item no Snapshot L2.
 */
interface EntradaL2<T> {
  readonly valor: T;
  readonly timestamp: number;
}

/**
 * Implementação pura de Cache LRU (Least Recently Used) em memória com TTL.
 */
export class CacheLruMemoria<K, V> {
  private readonly mapa = new Map<K, V>();

  constructor(private readonly capacidadeMaxima: number = 100) {}

  public get(chave: K): V | undefined {
    const item = this.mapa.get(chave);
    if (item === undefined) return undefined;
    // Move para o final (mais recentemente utilizado)
    this.mapa.delete(chave);
    this.mapa.set(chave, item);
    return item;
  }

  public set(chave: K, valor: V): void {
    if (this.mapa.has(chave)) {
      this.mapa.delete(chave);
    } else if (this.mapa.size >= this.capacidadeMaxima) {
      // Remove o mais antigo (primeira chave na ordem de iteração)
      const primeiraChave = this.mapa.keys().next().value;
      if (primeiraChave !== undefined) {
        this.mapa.delete(primeiraChave);
      }
    }
    this.mapa.set(chave, valor);
  }

  public has(chave: K): boolean {
    return this.mapa.has(chave);
  }

  public delete(chave: K): boolean {
    return this.mapa.delete(chave);
  }

  public clear(): void {
    this.mapa.clear();
  }

  public get size(): number {
    return this.mapa.size;
  }
}

/**
 * Implementação isolada de Circuit Breaker para tolerância a falhas em APIs de terceiros.
 */
export class CircuitBreakerResiliente<T = unknown> {
  private falhasConsecutivas = 0;
  private estado: EstadoCircuitBreaker = "FECHADO";
  private timestampUltimaFalha = 0;

  constructor(
    private readonly opcoes: OpcoesCircuitBreaker = {
      limiteFalhasConsecutivas: 3,
      tempoAbertoMs: 60_000,
    }
  ) {}

  public obterEstado(): EstadoCircuitBreaker {
    if (
      this.estado === "ABERTO" &&
      Date.now() - this.timestampUltimaFalha >= this.opcoes.tempoAbertoMs
    ) {
      this.estado = "MEIO_ABERTO";
    }
    return this.estado;
  }

  public registrarSucesso(): void {
    this.falhasConsecutivas = 0;
    this.estado = "FECHADO";
  }

  public registrarFalha(): void {
    this.falhasConsecutivas++;
    this.timestampUltimaFalha = Date.now();
    if (this.falhasConsecutivas >= this.opcoes.limiteFalhasConsecutivas) {
      this.estado = "ABERTO";
    }
  }

  public resetar(): void {
    this.falhasConsecutivas = 0;
    this.estado = "FECHADO";
    this.timestampUltimaFalha = 0;
  }

  public async executar(
    operacao: () => Promise<T>,
    fallbackSnapshot: () => Promise<T>
  ): Promise<{ dado: T; fonte: "REDE" | "SNAPSHOT_DEGRADADO" }> {
    const estadoAtual = this.obterEstado();

    if (estadoAtual === "ABERTO") {
      const dadoFallback = await fallbackSnapshot();
      return { dado: dadoFallback, fonte: "SNAPSHOT_DEGRADADO" };
    }

    try {
      const resultado = await operacao();
      this.registrarSucesso();
      return { dado: resultado, fonte: "REDE" };
    } catch (erro) {
      this.registrarFalha();
      const dadoFallback = await fallbackSnapshot();
      return { dado: dadoFallback, fonte: "SNAPSHOT_DEGRADADO" };
    }
  }
}

/**
 * Resultado completo da execução com metadados de resiliência.
 */
export interface ResultadoExecucaoResiliente<T> {
  readonly dado: T;
  readonly fonte: FonteDadosResiliencia;
  readonly latenciaMs: number;
}

/**
 * Gerenciador de Cache Multinível Resiliente.
 * Unifica L1 (LRU), Singleflight, L2 (Snapshot) e Circuit Breaker.
 */
export class GerenciadorCacheResiliente<T = RespostaCargaInventario> {
  private readonly cacheL1: CacheLruMemoria<string, EntradaL1<T>>;
  private readonly cacheL2Snapshots = new Map<string, EntradaL2<T>>();
  private readonly promessasEmVoo = new Map<string, Promise<T>>();
  private readonly circuitBreaker: CircuitBreakerResiliente<T>;
  private snapshotL2MaisRecenteGlobal: T | null = null;

  constructor(
    private readonly ttlL1Ms: number = 5 * 60 * 1000, // 5 minutos
    capacidadeL1: number = 100,
    opcoesBreaker?: Partial<OpcoesCircuitBreaker>
  ) {
    this.cacheL1 = new CacheLruMemoria<string, EntradaL1<T>>(capacidadeL1);
    this.circuitBreaker = new CircuitBreakerResiliente<T>({
      limiteFalhasConsecutivas: opcoesBreaker?.limiteFalhasConsecutivas ?? 3,
      tempoAbertoMs: opcoesBreaker?.tempoAbertoMs ?? 60_000,
    });
  }

  /**
   * Converte um filtro ou chave genérica em uma string canônica de cache.
   */
  public gerarChaveCache(filtroOuChave: FiltroCargaInventario | string): string {
    if (typeof filtroOuChave === "string") {
      return filtroOuChave;
    }

    const fornecedores = filtroOuChave.fornecedoresPermitidos
      ? [...filtroOuChave.fornecedoresPermitidos].sort((a, b) => a - b).join(",")
      : "TODOS";
    const secao = filtroOuChave.secaoId !== undefined ? String(filtroOuChave.secaoId) : "TODAS";
    const filial = filtroOuChave.filialId !== undefined ? String(filtroOuChave.filialId) : "TODAS";
    const estoque = filtroOuChave.apenasComEstoqueOuVenda ? "1" : "0";

    return `inventario:f=${fornecedores}:s=${secao}:fil=${filial}:e=${estoque}`;
  }

  public definirSnapshotL2(chave: string, dado: T): void {
    this.cacheL2Snapshots.set(chave, {
      valor: dado,
      timestamp: Date.now(),
    });
    this.snapshotL2MaisRecenteGlobal = dado;
  }

  public obterSnapshotL2(chave: string): T | null {
    const entrada = this.cacheL2Snapshots.get(chave);
    if (entrada) return entrada.valor;
    return this.snapshotL2MaisRecenteGlobal;
  }

  public obterEstadoCircuitBreaker(): EstadoCircuitBreaker {
    return this.circuitBreaker.obterEstado();
  }

  public resetarCircuitBreaker(): void {
    this.circuitBreaker.resetar();
  }

  public limparL1(): void {
    this.cacheL1.clear();
  }

  /**
   * Executa a busca primária orquestrando L1, Singleflight, L2 e Circuit Breaker.
   */
  public async obterOuExecutar(
    filtroOuChave: FiltroCargaInventario | string,
    buscarFontePrimaria: () => Promise<T>
  ): Promise<ResultadoExecucaoResiliente<T>> {
    const inicio = Date.now();
    const chave = this.gerarChaveCache(filtroOuChave);
    const agora = Date.now();

    // 1. Verificação L1: Cache em Memória LRU
    const entradaL1 = this.cacheL1.get(chave);
    if (entradaL1 && entradaL1.expiraEm > agora) {
      return {
        dado: entradaL1.valor,
        fonte: "CACHE_L1",
        latenciaMs: Date.now() - inicio,
      };
    }

    // 2. Verificação do Circuit Breaker
    const estadoBreaker = this.circuitBreaker.obterEstado();
    if (estadoBreaker === "ABERTO") {
      const snapshot = this.obterSnapshotL2(chave);
      if (snapshot !== null) {
        const dadoAnotado = this.anotarModoDegradadoSeAplicavel(
          snapshot,
          "CIRCUIT_BREAKER_ABERTO"
        );
        return {
          dado: dadoAnotado,
          fonte: "SNAPSHOT_DEGRADADO",
          latenciaMs: Date.now() - inicio,
        };
      }
      throw new Error(
        "[Resiliência] Circuit Breaker está ABERTO devido a falhas consecutivas e não há snapshot L2 disponível."
      );
    }

    // 3. Singleflight Pattern: Coalescência de requisições concorrentes
    if (this.promessasEmVoo.has(chave)) {
      try {
        const dado = await this.promessasEmVoo.get(chave)!;
        return {
          dado,
          fonte: "SINGLEFLIGHT",
          latenciaMs: Date.now() - inicio,
        };
      } catch (erro) {
        // Fallback resiliente para Snapshot L2 também para requisições coalescidas
        const snapshot = this.obterSnapshotL2(chave);
        if (snapshot !== null) {
          const dadoAnotado = this.anotarModoDegradadoSeAplicavel(
            snapshot,
            "FALLBACK_ERRO_REDE"
          );
          return {
            dado: dadoAnotado,
            fonte: "SNAPSHOT_L2",
            latenciaMs: Date.now() - inicio,
          };
        }
        throw erro;
      }
    }

    // Cria a promessa única para esta chave
    const promessaVoo = (async (): Promise<T> => {
      try {
        const resultado = await buscarFontePrimaria();

        // Sucesso: reseta Circuit Breaker e grava em L1 e L2
        this.circuitBreaker.registrarSucesso();
        this.cacheL1.set(chave, {
          valor: resultado,
          expiraEm: Date.now() + this.ttlL1Ms,
          inseridoEm: Date.now(),
        });
        this.definirSnapshotL2(chave, resultado);

        return resultado;
      } catch (erro) {
        this.circuitBreaker.registrarFalha();
        throw erro;
      } finally {
        this.promessasEmVoo.delete(chave);
      }
    })();

    this.promessasEmVoo.set(chave, promessaVoo);

    try {
      const dado = await promessaVoo;
      return {
        dado,
        fonte: "REDE",
        latenciaMs: Date.now() - inicio,
      };
    } catch (erro) {
      // 4. Fallback para Snapshot L2 em caso de erro da fonte primária
      const snapshot = this.obterSnapshotL2(chave);
      if (snapshot !== null) {
        const dadoAnotado = this.anotarModoDegradadoSeAplicavel(
          snapshot,
          "FALLBACK_ERRO_REDE"
        );
        return {
          dado: dadoAnotado,
          fonte: "SNAPSHOT_L2",
          latenciaMs: Date.now() - inicio,
        };
      }
      throw erro;
    }
  }

  /**
   * Helper que, se o dado for do tipo RespostaCargaInventario, anota a flag de modo degradado.
   */
  private anotarModoDegradadoSeAplicavel(dado: T, motivo: string): T {
    if (
      dado &&
      typeof dado === "object" &&
      "metadados" in dado &&
      dado.metadados &&
      typeof dado.metadados === "object"
    ) {
      const respostaOriginal = dado as unknown as RespostaCargaInventario;
      const respostaDegradada: RespostaCargaInventario = {
        ...respostaOriginal,
        metadados: {
          ...respostaOriginal.metadados,
          emModoDegradado: true,
          motivoModoDegradado: motivo,
        },
      };
      return respostaDegradada as unknown as T;
    }
    return dado;
  }
}

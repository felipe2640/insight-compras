/**
 * Adaptador Concreto da Rede Carreiro para Power BI Fabric REST API (DAX)
 * Camada: Adapters / Carreiro
 * 100% em Português do Brasil (pt-BR).
 *
 * Implementa a interface InventoryAdapter com resiliência multinível
 * (L1 LRU + Singleflight + L2 SWR Snapshot + Circuit Breaker).
 */

import {
  InventoryAdapter,
  FiltroCargaInventario,
  RespostaCargaInventario,
} from "../AdaptadorInventario";
import { ClienteDaxPowerBI, ConfiguracaoClienteDax } from "./cliente-dax";
import { GerenciadorCacheResiliente } from "./cache-resiliente";
import {
  CONSULTA_DAX_FRESCOR,
  CONSULTA_DAX_ENTRADAS_HOJE,
  CONSULTA_DAX_SIMILARES,
  gerarConsultaDaxProdutosEstoque,
  gerarConsultaDaxHistoricoVendas,
} from "./consultas-homologadas";
import {
  mapearProdutosDax,
  mapearEstoquesDax,
  mapearHistoricoVendasDax,
  mapearEntradasNFeDax,
  mapearSimilaresDax,
} from "./mapeador-dax";
import {
  carregarSnapshotCarreiroLocal,
  localizarDiretorioSnapshot,
} from "./carregador-snapshot-local";

export interface OpcoesAdaptadorCarreiro {
  readonly configuracaoDax?: ConfiguracaoClienteDax;
  readonly clienteDax?: ClienteDaxPowerBI;
  readonly gerenciadorCache?: GerenciadorCacheResiliente<RespostaCargaInventario>;
  readonly diretorioSnapshot?: string;
}

export class AdaptadorInventarioCarreiro implements InventoryAdapter {
  private readonly clienteDax: ClienteDaxPowerBI;
  private readonly gerenciadorCache: GerenciadorCacheResiliente<RespostaCargaInventario>;
  private readonly diretorioSnapshot?: string;

  constructor(opcoes: OpcoesAdaptadorCarreiro = {}) {
    this.clienteDax =
      opcoes.clienteDax || new ClienteDaxPowerBI(opcoes.configuracaoDax);
    this.gerenciadorCache =
      opcoes.gerenciadorCache || new GerenciadorCacheResiliente<RespostaCargaInventario>();
    this.diretorioSnapshot = opcoes.diretorioSnapshot;
  }

  /**
   * Executa a carga completa do inventário da Rede Carreiro utilizando DAX
   * com proteção de cache multinível, suporte a snapshot local real e Circuit Breaker.
   */
  public async carregarInventarioCompleto(
    filtro: FiltroCargaInventario
  ): Promise<RespostaCargaInventario> {
    const resultadoResiliente = await this.gerenciadorCache.obterOuExecutar(
      filtro,
      async () => {
        // 1. Carga Online via Power BI Fabric REST API (se credenciais ativas)
        if (this.clienteDax.possuiConfiguracaoAtiva()) {
          const inicioBusca = Date.now();

          // Execução Paralela das Consultas DAX Homologadas (eliminando waterfalls)
          const [linhasProdutosEstoque, linhasHistorico, linhasEntradas, linhasSimilares] =
            await Promise.all([
              this.clienteDax.executarConsultaDax(gerarConsultaDaxProdutosEstoque(filtro)),
              this.clienteDax.executarConsultaDax(gerarConsultaDaxHistoricoVendas(filtro)),
              this.clienteDax.executarConsultaDax(CONSULTA_DAX_ENTRADAS_HOJE).catch((e) => {
                console.warn("[Adaptador Carreiro] Aviso ao consultar MOVESTOQ entradas:", e);
                return [] as readonly Record<string, unknown>[];
              }),
              this.clienteDax.executarConsultaDax(CONSULTA_DAX_SIMILARES).catch((e) => {
                console.warn("[Adaptador Carreiro] Aviso ao consultar similares:", e);
                return [] as readonly Record<string, unknown>[];
              }),
            ]);

          const produtos = mapearProdutosDax(linhasProdutosEstoque);
          const estoques = mapearEstoquesDax(linhasProdutosEstoque);
          const historicos = mapearHistoricoVendasDax(linhasHistorico);

          const mapaProdutosPorId = new Map(produtos.map((p) => [p.id, p]));

          const saldosPorProduto = new Map<number, number>();
          for (const estoque of estoques.values()) {
            const saldoAtual = saldosPorProduto.get(estoque.produtoId) ?? 0;
            saldosPorProduto.set(estoque.produtoId, saldoAtual + estoque.saldoFisico);
          }

          const entradasHoje = mapearEntradasNFeDax(linhasEntradas, mapaProdutosPorId);
          const similares = mapearSimilaresDax(
            linhasSimilares,
            mapaProdutosPorId,
            saldosPorProduto
          );

          const resposta: RespostaCargaInventario = {
            produtos,
            estoques,
            historicos,
            entradasHoje,
            similares,
            metadados: {
              provedor: "POWERBI_FABRIC_DAX",
              timestampCarga: new Date().toISOString(),
              emModoDegradado: false,
              totalSkusCarregados: produtos.length,
              latenciaMs: Date.now() - inicioBusca,
            },
          };

          return resposta;
        }

        // 2. Carga Offline a partir de Snapshot Real Extraído
        const dirSnapshot = localizarDiretorioSnapshot(this.diretorioSnapshot);
        if (dirSnapshot) {
          return await carregarSnapshotCarreiroLocal(dirSnapshot, filtro);
        }

        throw new Error(
          "[Adaptador Carreiro] Conexão com Fabric sem credenciais ativas e nenhum snapshot local encontrado."
        );
      }
    );

    return resultadoResiliente.dado;
  }

  /**
   * Verifica a conectividade e saúde da conexão com o modelo semântico ou disponibilidade do snapshot.
   */
  public async verificarSaudeConexao(): Promise<boolean> {
    if (this.clienteDax.possuiConfiguracaoAtiva()) {
      try {
        const linhasFrescor = await this.clienteDax.executarConsultaDax(CONSULTA_DAX_FRESCOR);
        return linhasFrescor.length > 0;
      } catch {
        return false;
      }
    }

    const dirSnapshot = localizarDiretorioSnapshot(this.diretorioSnapshot);
    return dirSnapshot !== null;
  }

  /**
   * Acesso interno ao gerenciador de resiliência (para diagnósticos ou testes).
   */
  public obterGerenciadorCache(): GerenciadorCacheResiliente<RespostaCargaInventario> {
    return this.gerenciadorCache;
  }
}


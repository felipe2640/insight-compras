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
import { EstoqueFilial } from "@core/dominio";
import { ClienteDaxPowerBI, ConfiguracaoClienteDax } from "./cliente-dax";
import { GerenciadorCacheResiliente } from "./cache-resiliente";
import {
  CONSULTA_DAX_FRESCOR,
  CONSULTA_DAX_ENTRADAS_HOJE,
  CONSULTA_DAX_SIMILARES,
  gerarConsultaDaxProdutosEstoque,
  gerarConsultaDaxPosicaoEstoque,
  gerarConsultaDaxHistoricoVendas,
} from "./consultas-homologadas";
import {
  NOMES_FILIAIS_CARREIRO,
  NOMES_CADEMP_CARREIRO,
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
import { lerSnapshotNormalizado } from "./snapshot-normalizado";

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
    try {
      return await this.carregarComResiliencia(filtro);
    } catch (erro) {
      // Último recurso, depois de o cache L2 e o circuit breaker já terem agido:
      // queda de rede no meio de uma apresentação não pode virar stack trace na
      // tela. Fica FORA de `obterOuExecutar` de propósito — capturar lá dentro
      // esconderia a falha do circuit breaker, que então nunca abriria.
      const snapshot = lerSnapshotNormalizado();
      if (snapshot) {
        console.warn("[Adaptador Carreiro] Carga indisponível; servindo snapshot local.", erro);
        return {
          ...snapshot,
          metadados: {
            ...snapshot.metadados,
            motivoModoDegradado:
              `Power BI indisponível no momento. ${snapshot.metadados.motivoModoDegradado ?? ""}`.trim(),
          },
        };
      }
      throw erro;
    }
  }

  private async carregarComResiliencia(
    filtro: FiltroCargaInventario
  ): Promise<RespostaCargaInventario> {
    const resultadoResiliente = await this.gerenciadorCache.obterOuExecutar(
      filtro,
      async () => {
        // 0. Modo demonstração: snapshot primeiro, sem tocar a rede.
        // Carga instantânea e imune a oscilação de conexão.
        if (process.env.CARREIRO_PREFERIR_SNAPSHOT === "true") {
          const snapshot = lerSnapshotNormalizado();
          if (snapshot) return snapshot;
          console.warn(
            "[Adaptador Carreiro] CARREIRO_PREFERIR_SNAPSHOT ativo mas nenhum snapshot encontrado; seguindo para a carga ao vivo."
          );
        }

        // 1. Carga Online via Power BI Fabric REST API (se credenciais ativas)
        if (this.clienteDax.possuiConfiguracaoAtiva()) {
          const inicioBusca = Date.now();

          // A posição de estoque é consultada UMA VEZ POR LOJA.
          // Motivo verificado ao vivo: a consulta de rede inteira estoura o limite
          // do executeQueries e volta truncada, com as medidas de estoque em branco
          // e sem erro algum — 0 itens com saldo onde existem mais de 24 mil.
          // TODAS as lojas, sempre. `filtro.filialId` é a filial em FOCO na tela,
          // não um recorte de carga: sem a posição das outras lojas o motor não
          // enxerga sobra para transferir, e a transferência é o que evita compra.
          const lojasParaCarregar = Object.keys(NOMES_FILIAIS_CARREIRO).map(Number);

          const [
            linhasAtributos,
            linhasHistorico,
            paginasPosicao,
            linhasEntradas,
            linhasSimilares,
          ] = await Promise.all([
            this.clienteDax.executarConsultaDax(gerarConsultaDaxProdutosEstoque(filtro)),
            this.clienteDax.executarConsultaDax(gerarConsultaDaxHistoricoVendas(filtro)),
            Promise.all(
              lojasParaCarregar.map(async (filialId) => {
                const nomeFilial = NOMES_FILIAIS_CARREIRO[filialId];
                // O nome oficial da loja no CADEMP difere do rótulo de exibição.
                const nomeCademp = NOMES_CADEMP_CARREIRO[filialId];
                if (!nomeCademp) return { filialId, nomeFilial, linhas: [] as readonly Record<string, unknown>[] };
                try {
                  const linhas = await this.clienteDax.executarConsultaDax(
                    gerarConsultaDaxPosicaoEstoque(nomeCademp, filtro)
                  );
                  return { filialId, nomeFilial, linhas };
                } catch (e) {
                  console.warn(
                    `[Adaptador Carreiro] Falha na posição de estoque da filial ${filialId}:`,
                    e
                  );
                  return { filialId, nomeFilial, linhas: [] as readonly Record<string, unknown>[] };
                }
              })
            ),
            this.clienteDax.executarConsultaDax(CONSULTA_DAX_ENTRADAS_HOJE).catch((e) => {
              console.warn("[Adaptador Carreiro] Aviso ao consultar MOVESTOQ entradas:", e);
              return [] as readonly Record<string, unknown>[];
            }),
            // A tabela TMP_AUDIT_PRODUTOS_SEMELHANTES_20260819 não está carregada no
            // modelo semântico do cliente (confirmado ao vivo: "não é um nome de
            // tabela válido"). Consultar a cada carga só gasta round-trip e polui o
            // log com erro esperado. Reativar quando o BI publicar a tabela.
            Promise.resolve([] as readonly Record<string, unknown>[]),
          ]);

          const produtos = mapearProdutosDax(linhasAtributos);

          // Cada página traz a filial no contexto, não em cada linha.
          const estoques = new Map<string, EstoqueFilial>();
          for (const pagina of paginasPosicao) {
            const parcial = mapearEstoquesDax(pagina.linhas, {
              filialId: pagina.filialId,
              nomeFilial: pagina.nomeFilial,
            });
            for (const [chave, valor] of parcial) {
              estoques.set(chave, valor);
            }
          }

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


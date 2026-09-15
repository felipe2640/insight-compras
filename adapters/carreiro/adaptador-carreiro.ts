/**
 * Adaptador Concreto da Rede Carreiro para Power BI Fabric REST API (DAX)
 * Camada: Adapters / Carreiro
 * 100% em Português do Brasil (pt-BR).
 *
 * Implementa a interface InventoryAdapter com resiliência multinível
 * (L1 LRU + Singleflight + L2 SWR Snapshot + Circuit Breaker).
 */

import {
  EntradaNFeDoDia,
  FiltroCargaInventario,
  FiltroRastreamentoERP,
  InventoryAdapter,
  ItemSimilarIntercambiavel,
  PedidoCompraERP,
  ItemPedidoCompraERP,
  CotacaoCompraERP,
  RespostaCargaInventario,
} from "../AdaptadorInventario";
import { EstoqueFilial } from "@core/dominio";
import { ClienteDaxPowerBI, ConfiguracaoClienteDax, normalizarLinhaDax } from "./cliente-dax";
import { GerenciadorCacheResiliente } from "./cache-resiliente";
import {
  CONSULTA_DAX_FRESCOR,
  CONSULTA_DAX_ENTRADAS_HOJE,
  CONSULTA_DAX_ULTIMO_PEDIDO,
  CONSULTA_DAX_SUGESTOES_ERP_HOJE,
  gerarConsultaDaxSimilares,
  TAMANHO_PAGINA_SIMILARES,
  gerarConsultaDaxMovimentosEstoque,
  DIAS_JANELA_RUPTURA,
  DIAS_BLOCO_MOVIMENTOS,
  gerarConsultaDaxProdutosEstoque,
  TAMANHO_PAGINA_PRODUTOS,
  gerarConsultaDaxPosicaoEstoque,
  gerarConsultaDaxHistoricoVendas,
  gerarConsultaDaxPedidosCompra,
  gerarConsultaDaxItensPedidosCompra,
  gerarConsultaDaxCotacoes,
} from "./consultas-homologadas";
import {
  NOMES_FILIAIS_CARREIRO,
  NOMES_CADEMP_CARREIRO,
  mapearFilialCarreiro,
  mapearProdutosDax,
  mapearEstoquesDax,
  mapearHistoricoVendasDax,
  mapearEntradasNFeDax,
  mapearSimilaresDax,
  mapearSugestoesErpDax,
  aplicarRupturaReconstruida,
  aplicarUltimoPedido,
  extrairIdProduto,
} from "./mapeador-dax";
import {
  carregarSnapshotCarreiroLocal,
  localizarDiretorioSnapshot,
} from "./carregador-snapshot-local";
import { lerSnapshotNormalizado } from "./snapshot-normalizado";
import type { ClasseNaoCompravelTenant, ConfiguracaoLotesTenant } from "@config/tenants/tipos";

export interface OpcoesAdaptadorCarreiro {
  readonly configuracaoDax?: ConfiguracaoClienteDax;
  readonly clienteDax?: ClienteDaxPowerBI;
  readonly gerenciadorCache?: GerenciadorCacheResiliente<RespostaCargaInventario>;
  readonly diretorioSnapshot?: string;
  readonly configuracaoLotes?: ConfiguracaoLotesTenant;
  /** Classes do ERP que não são mercadoria (serviços). Declaradas pelo tenant. */
  readonly classesNaoCompraveis?: readonly ClasseNaoCompravelTenant[];
}

export class AdaptadorInventarioCarreiro implements InventoryAdapter {
  private readonly clienteDax: ClienteDaxPowerBI;
  private readonly gerenciadorCache: GerenciadorCacheResiliente<RespostaCargaInventario>;
  private readonly diretorioSnapshot?: string;
  private readonly configuracaoLotes?: ConfiguracaoLotesTenant;
  private readonly classesNaoCompraveis?: readonly ClasseNaoCompravelTenant[];

  constructor(opcoes: OpcoesAdaptadorCarreiro = {}) {
    this.clienteDax =
      opcoes.clienteDax || new ClienteDaxPowerBI(opcoes.configuracaoDax);
    this.gerenciadorCache =
      opcoes.gerenciadorCache || new GerenciadorCacheResiliente<RespostaCargaInventario>();
    this.diretorioSnapshot = opcoes.diretorioSnapshot;
    this.configuracaoLotes = opcoes.configuracaoLotes;
    this.classesNaoCompraveis = opcoes.classesNaoCompraveis;
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
    // Na carga irrestrita, filialId só muda a perspectiva do motor e a carga
    // bruta pode ser compartilhada. Na grade operacional, porém, o catálogo é
    // recortado na própria fonte pelas vendas da filial; nesse caso a filial
    // precisa permanecer na chave para nunca servir o recorte de outra loja.
    const filtroCargaRede: FiltroCargaInventario = {
      ...filtro,
      filialId: filtro.apenasComEstoqueOuVenda ? filtro.filialId : undefined,
    };
    const resultadoResiliente = await this.gerenciadorCache.obterOuExecutar(
      filtroCargaRede,
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
            linhasMovimentos,
            linhasUltimoPedido,
            linhasSugestoesErp,
          ] = await Promise.all([
            this.carregarCatalogoPaginado(filtro),
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
            this.carregarSimilaresPaginado(),
            this.carregarMovimentosDaJanela(),
            this.clienteDax.executarConsultaDax(CONSULTA_DAX_ULTIMO_PEDIDO).catch((e) => {
              console.warn("[Adaptador Carreiro] Aviso ao consultar solicitações de compra:", e);
              return [] as readonly Record<string, unknown>[];
            }),
            this.clienteDax.executarConsultaDax(CONSULTA_DAX_SUGESTOES_ERP_HOJE).catch((e) => {
              console.warn("[Adaptador Carreiro] Aviso ao consultar sugestões de compra do ERP:", e);
              return [] as readonly Record<string, unknown>[];
            }),
          ]);

          // Constrói mapa de lotes detectados por histograma a partir de linhasHistorico (precedência ERP > Histograma > Vocabulário)
          const lotesPorProdutoId = new Map<number, number>();
          for (const linhaBruta of linhasHistorico) {
            const linha = normalizarLinhaDax(linhaBruta);
            const pId = extrairIdProduto(linha.Produto ?? linha.ACODPRODUTO ?? 0);
            const lote = Number(linha.LoteDetectado ?? linha.LoteHistograma ?? 0);
            if (pId > 0 && lote > 1) {
              const atual = lotesPorProdutoId.get(pId) ?? 0;
              if (lote > atual) lotesPorProdutoId.set(pId, lote);
            }
          }

          const produtos = aplicarUltimoPedido(
            mapearProdutosDax(linhasAtributos, {
              lotesPorProdutoId,
              configuracaoLotes: this.configuracaoLotes,
              classesNaoCompraveis: this.classesNaoCompraveis,
            }),
            linhasUltimoPedido
          );

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

          // Ruptura: o ERP não guarda saldo histórico, então é reconstruída a
          // partir do saldo de hoje e dos movimentos da janela.
          aplicarRupturaReconstruida(historicos, estoques, linhasMovimentos);

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
          const sugestoesErp = mapearSugestoesErpDax(linhasSugestoesErp);

          const resposta: RespostaCargaInventario = {
            produtos,
            estoques,
            historicos,
            entradasHoje,
            similares,
            sugestoesErp,
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
          return await carregarSnapshotCarreiroLocal(dirSnapshot, filtro, {
            classesNaoCompraveis: this.classesNaoCompraveis,
          });
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
   * Rastreia pedidos de compra formalizados no ERP.
   */
  public async listarPedidosCompraERP(filtro: FiltroRastreamentoERP = {}): Promise<readonly PedidoCompraERP[]> {
    if (!this.clienteDax.possuiConfiguracaoAtiva()) {
      return [];
    }
    try {
      const dax = gerarConsultaDaxPedidosCompra({
        dias: filtro.dias,
        fornecedorId: filtro.fornecedorId,
        limite: filtro.limite,
      });
      const linhas = await this.clienteDax.executarConsultaDax(dax);
      return linhas.map((linhaBruta) => {
        const l = normalizarLinhaDax(linhaBruta);
        const filialInfo = mapearFilialCarreiro(l.EmpresaId ?? l.ACODEMPRESA);
        return {
          id: Number(l.PedidoId ?? l.ID ?? 0),
          numero: Number(l.Numero ?? l.NUMERO ?? 0),
          dataEmissao: String(l.DataEmissao ?? l.DATAEMISSAO ?? ""),
          fornecedorId: Number(l.FornecedorId ?? l.ACODFORNECEDOR ?? 0),
          cotacaoId: l.CotacaoId ? Number(l.CotacaoId) : null,
          status: String(l.Status ?? l.STATUS ?? "A"),
          valorTotal: Number(l.ValorTotal ?? l.VALORPEDIDO ?? 0),
          filialId: filialInfo.filialId,
          filialNome: filialInfo.nomeFilial,
        };
      }).filter((p) => (!filtro.filialId || p.filialId === filtro.filialId));
    } catch (e) {
      console.warn("[Adaptador Carreiro] Falha ao listar pedidos de compra do ERP:", e);
      return [];
    }
  }

  /**
   * Lista itens de um pedido de compra específico do ERP.
   */
  public async listarItensPedidoCompraERP(pedidoId: number): Promise<readonly ItemPedidoCompraERP[]> {
    if (!this.clienteDax.possuiConfiguracaoAtiva()) {
      return [];
    }
    try {
      const dax = gerarConsultaDaxItensPedidosCompra({ pedidoId });
      const linhas = await this.clienteDax.executarConsultaDax(dax);
      return linhas.map((linhaBruta) => {
        const l = normalizarLinhaDax(linhaBruta);
        const filialInfo = mapearFilialCarreiro(l.EmpresaId ?? l.ACODEMPRESA);
        const produtoId = extrairIdProduto(l.ProdutoId ?? l.PRODUTO_ID ?? 0);
        const rawSku = String(l.SkuBase ?? l.CodigoBase ?? l.ProdutoId ?? produtoId).trim();
        const sku = rawSku.includes("|") ? rawSku.split("|")[0].trim() : rawSku;
        const itemId = Number(l.ItemId ?? l.ITEM_ID ?? 0);
        const id = Number(l.PedidoId ?? l.PEDIDO_ID ?? pedidoId) * 1000 + itemId;
        return {
          id: id || itemId,
          pedidoId: Number(l.PedidoId ?? l.PEDIDO_ID ?? pedidoId),
          produtoId,
          sku: sku || undefined,
          descricao: String(l.Descricao ?? l.DESCRICAO ?? ""),
          quantidade: Number(l.Quantidade ?? l.QTDE ?? 0),
          valorUnitario: Number(l.ValorUnitario ?? l.VALORUNIT ?? 0),
          valorTotal: Number(l.ValorTotal ?? l.VALORPEDIDO ?? 0),
          dataEmissao: String(l.DataEmissao ?? l.DATAEMISSAO ?? ""),
          filialId: filialInfo.filialId,
          fornecedorId: Number(l.FornecedorId ?? l.ACODFORNECEDOR ?? 0),
        };
      });
    } catch (e) {
      console.warn(`[Adaptador Carreiro] Falha ao listar itens do pedido ERP ${pedidoId}:`, e);
      return [];
    }
  }

  /**
   * Lista cotações de compra abertas ou concluídas no ERP.
   */
  public async listarCotacoesERP(filtro: FiltroRastreamentoERP = {}): Promise<readonly CotacaoCompraERP[]> {
    if (!this.clienteDax.possuiConfiguracaoAtiva()) {
      return [];
    }
    try {
      const dax = gerarConsultaDaxCotacoes({ dias: filtro.dias, limite: filtro.limite });
      const linhas = await this.clienteDax.executarConsultaDax(dax);
      return linhas.map((linhaBruta) => {
        const l = normalizarLinhaDax(linhaBruta);
        const filialInfo = mapearFilialCarreiro(l.ACODEMPRESA ?? l.EmpresaId);
        return {
          rowId: Number(l.ROW_ID ?? l.RowId ?? 0),
          codigo: Number(l.CODIGO ?? l.Codigo ?? 0),
          descricao: String(l.DESCRICAO ?? l.Descricao ?? ""),
          dataHora: String(l.DATAHORA ?? l.DataHora ?? ""),
          status: String(l.STATUS ?? l.Status ?? ""),
          filialId: filialInfo.filialId,
          filialNome: filialInfo.nomeFilial,
          totalItens: Number(l.TotalItens ?? 0),
          totalPropostas: Number(l.TotalPropostas ?? 0),
          propostasVencedoras: Number(l.PropostasVencedoras ?? 0),
          menorValorCotado: Number(l.MenorValorCotado ?? 0),
        };
      }).filter((c) => (!filtro.filialId || c.filialId === filtro.filialId));
    } catch (e) {
      console.warn("[Adaptador Carreiro] Falha ao listar cotações do ERP:", e);
      return [];
    }
  }

  /**
   * Lista todas as compras faturadas/emitidas no ERP na janela para calibração do aprendizado.
   */
  public async listarTodasComprasERPNaJanela(dias: number, filialId?: number): Promise<readonly ItemPedidoCompraERP[]> {
    if (!this.clienteDax.possuiConfiguracaoAtiva()) {
      return [];
    }
    try {
      const dax = gerarConsultaDaxItensPedidosCompra({ dias, limite: 5000 });
      const linhas = await this.clienteDax.executarConsultaDax(dax);
      return linhas.map((linhaBruta) => {
        const l = normalizarLinhaDax(linhaBruta);
        const filialInfo = mapearFilialCarreiro(l.EmpresaId ?? l.ACODEMPRESA);
        const produtoId = extrairIdProduto(l.ProdutoId ?? l.PRODUTO_ID ?? 0);
        const rawSku = String(l.SkuBase ?? l.CodigoBase ?? l.ProdutoId ?? produtoId).trim();
        const sku = rawSku.includes("|") ? rawSku.split("|")[0].trim() : rawSku;
        const pedId = Number(l.PedidoId ?? l.PEDIDO_ID ?? 0);
        const itemId = Number(l.ItemId ?? l.ITEM_ID ?? 0);
        const id = pedId * 1000 + itemId;
        return {
          id: id || itemId,
          pedidoId: pedId,
          produtoId,
          sku: sku || undefined,
          descricao: String(l.Descricao ?? l.DESCRICAO ?? ""),
          quantidade: Number(l.Quantidade ?? l.QTDE ?? 0),
          valorUnitario: Number(l.ValorUnitario ?? l.VALORUNIT ?? 0),
          valorTotal: Number(l.ValorTotal ?? l.VALORPEDIDO ?? 0),
          dataEmissao: String(l.DataEmissao ?? l.DATAEMISSAO ?? ""),
          filialId: filialInfo.filialId,
          fornecedorId: Number(l.FornecedorId ?? l.ACODFORNECEDOR ?? 0),
        };
      }).filter((i) => (!filialId || i.filialId === filialId));
    } catch (e) {
      console.warn("[Adaptador Carreiro] Falha ao listar compras do ERP na janela:", e);
      return [];
    }
  }

  /**
   * Acesso interno ao gerenciador de resiliência (para diagnósticos ou testes).
   */
  public obterGerenciadorCache(): GerenciadorCacheResiliente<RespostaCargaInventario> {
    return this.gerenciadorCache;
  }

  /**
   * Catálogo em páginas, por cursor no código do produto.
   *
   * O executeQueries corta a resposta por TAMANHO e não avisa. Medido ao vivo:
   * a consulta de atributos devolvia 26.362 das 126.280 linhas de PRODUTOS —
   * um terço do catálogo faltava, sempre na cauda dos códigos, porque a
   * ordenação faz o corte cair sempre nos mesmos itens. Paginar é a única
   * forma de saber que veio tudo: a última página vem menor que a página cheia.
   */
  private async carregarCatalogoPaginado(
    filtro?: FiltroCargaInventario
  ): Promise<readonly Record<string, unknown>[]> {
    const MAXIMO_PAGINAS = 40; // trava contra laço infinito se o cursor não andar
    const todas: Record<string, unknown>[] = [];
    let cursor: string | null = null;

    for (let pagina = 0; pagina < MAXIMO_PAGINAS; pagina++) {
      const linhas = await this.clienteDax.executarConsultaDax(
        gerarConsultaDaxProdutosEstoque(
          filtro,
          cursor,
          filtro?.filialId ? NOMES_CADEMP_CARREIRO[filtro.filialId] : undefined
        )
      );
      todas.push(...(linhas as Record<string, unknown>[]));
      if (linhas.length < TAMANHO_PAGINA_PRODUTOS) break;

      const ultimo = linhas[linhas.length - 1];
      const proximoCursor = ultimo?.Produto !== undefined ? String(ultimo.Produto) : null;
      // Cursor parado significa página cheia de códigos iguais: parar é melhor
      // do que repetir a mesma página para sempre.
      if (!proximoCursor || proximoCursor === cursor) break;
      cursor = proximoCursor;
    }

    return todas;
  }


  /**
   * Intercambiáveis, em páginas por ID.
   *
   * A tabela PRODUTOS_SEMELHANTES passou a existir no modelo do cliente em
   * 09/09/2026 (antes era uma temporária de auditoria, e a carga vinha vazia).
   * São 135.334 pares contra um teto de resposta de 100.000 — sem paginar,
   * 35 mil relações sumiriam em silêncio.
   *
   * Falhar aqui NÃO derruba a carga: sem similares o cockpit perde o aviso de
   * "existe equivalente com saldo", mas a compra continua decidível.
   */
  private async carregarSimilaresPaginado(): Promise<readonly Record<string, unknown>[]> {
    const MAXIMO_PAGINAS = 20;
    const todas: Record<string, unknown>[] = [];
    let cursor: number | null = null;

    try {
      for (let pagina = 0; pagina < MAXIMO_PAGINAS; pagina++) {
        const linhas = await this.clienteDax.executarConsultaDax(gerarConsultaDaxSimilares(cursor));
        todas.push(...(linhas as Record<string, unknown>[]));
        if (linhas.length < TAMANHO_PAGINA_SIMILARES) break;

        const ultimo = linhas[linhas.length - 1] as Record<string, unknown>;
        const proximo = Number(ultimo?.Id);
        if (!Number.isFinite(proximo) || proximo === cursor) break;
        cursor = proximo;
      }
    } catch (erro) {
      console.warn("[Adaptador Carreiro] Aviso ao consultar PRODUTOS_SEMELHANTES:", erro);
      return todas;
    }

    return todas;
  }


  /**
   * Movimentos da janela de ruptura, em blocos de dias.
   *
   * Sem bloco, uma janela maior encostaria no teto de resposta da API — o mesmo
   * corte silencioso que escondia um terço do catálogo. Blocos de 30 dias dão
   * cerca de 20 mil linhas cada, com folga larga.
   *
   * Falhar aqui NÃO derruba a carga: sem movimentos a ruptura fica "não medida",
   * que é exatamente o que o cockpit mostrava antes.
   */
  private async carregarMovimentosDaJanela(): Promise<readonly Record<string, unknown>[]> {
    const blocos: Array<[number, number]> = [];
    for (let de = DIAS_JANELA_RUPTURA; de > 0; de -= DIAS_BLOCO_MOVIMENTOS) {
      blocos.push([de, Math.max(0, de - DIAS_BLOCO_MOVIMENTOS)]);
    }

    try {
      const partes = await Promise.all(
        blocos.map(([de, ate]) =>
          this.clienteDax.executarConsultaDax(gerarConsultaDaxMovimentosEstoque(de, ate))
        )
      );
      return partes.flat() as readonly Record<string, unknown>[];
    } catch (erro) {
      console.warn("[Adaptador Carreiro] Aviso ao consultar movimentos de estoque:", erro);
      return [];
    }
  }

}

/**
 * Adaptador Concreto da Rede Carreiro para Power BI Fabric REST API (DAX)
 * Camada: Adapters / Carreiro
 * 100% em Português do Brasil (pt-BR).
 *
 * Implementa a interface InventoryAdapter com resiliência multinível
 * (L1 LRU + Singleflight + L2 SWR Snapshot + Circuit Breaker).
 */

import { ehAmbienteProducao } from "@config/tenants/erros";
import {
  CapacidadeCotacoesERP,
  CapacidadeEntradasConfirmadas,
  CapacidadePedidosERP,
  EntradaConfirmadaERP,
  FiltroCargaInventario,
  FiltroRastreamentoERP,
  InventoryAdapter,
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
import { buscarEntradasCarreiro } from "./entradas-confirmacao";
import type { ClasseNaoCompravelTenant, FilialCadastradaTenant } from "@config/tenants/tipos";
import { criarMapaLojasFonte, type MapaLojasFonte } from "../comum/mapa-lojas";
import { normalizarStatusERP } from "../comum/status-erp";

export interface OpcoesAdaptadorCarreiro {
  readonly configuracaoDax?: ConfiguracaoClienteDax;
  readonly clienteDax?: ClienteDaxPowerBI;
  readonly gerenciadorCache?: GerenciadorCacheResiliente<RespostaCargaInventario>;
  readonly diretorioSnapshot?: string;
  /**
   * Filiais do CADASTRO do cliente, com os identificadores que a fonte usa.
   *
   * Antes as lojas vinham de uma constante dentro do adaptador
   * (`NOMES_FILIAIS_CARREIRO`), então o cadastro do tenant era decorativo: um
   * cliente com 2 lojas continuaria carregando 5.
   */
  readonly filiais?: readonly FilialCadastradaTenant[];
  /** Nome do ERP do cliente, só para rótulo. */
  readonly nomeERP?: string;
  /** Classes do ERP que não são mercadoria (serviços). Declaradas pelo tenant. */
  readonly classesNaoCompraveis?: readonly ClasseNaoCompravelTenant[];
  /** Se deve desconsiderar produtos inativos no ERP ou com termos inativos na descrição. */
  readonly desconsiderarInativos?: boolean;
  /** Termos na descrição que identificam itens inativos. */
  readonly termosDescricaoInativos?: readonly string[];
}

/**
 * Teto de linhas das compras do ERP numa janela. Bater nele significa que a
 * janela tem mais compras do que o que voltou — e quem chama precisa saber.
 */
const LIMITE_LINHAS_COMPRAS = 5000;



export class AdaptadorInventarioCarreiro implements InventoryAdapter {
  private readonly clienteDax: ClienteDaxPowerBI;
  private readonly gerenciadorCache: GerenciadorCacheResiliente<RespostaCargaInventario>;
  private readonly diretorioSnapshot?: string;
  private readonly classesNaoCompraveis?: readonly ClasseNaoCompravelTenant[];
  private readonly desconsiderarInativos?: boolean;
  private readonly termosDescricaoInativos?: readonly string[];
  private readonly filiais: readonly FilialCadastradaTenant[];

  public readonly descricaoFonte = "Power BI";
  public readonly natureza = "real" as const;
  public readonly forneceSugestoesErp = true;

  constructor(opcoes: OpcoesAdaptadorCarreiro = {}) {
    this.clienteDax =
      opcoes.clienteDax || new ClienteDaxPowerBI(opcoes.configuracaoDax);
    this.gerenciadorCache =
      opcoes.gerenciadorCache || new GerenciadorCacheResiliente<RespostaCargaInventario>();
    this.diretorioSnapshot = opcoes.diretorioSnapshot;
    this.classesNaoCompraveis = opcoes.classesNaoCompraveis;
    this.desconsiderarInativos = opcoes.desconsiderarInativos;
    this.termosDescricaoInativos = opcoes.termosDescricaoInativos;
    this.filiais = opcoes.filiais ?? [];
  }

  /** Mapa novo a cada carga: a contagem de lojas não mapeadas é daquela carga. */
  private novoMapaLojas(): MapaLojasFonte {
    return criarMapaLojasFonte(this.filiais);
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
      /**
       * Snapshot de emergência: SÓ FORA DE PRODUÇÃO (ADR-0002).
       *
       * Servir um retrato antigo como se fosse a posição de agora é o mesmo
       * defeito do mock silencioso: o comprador decide compra sobre saldo que
       * não existe mais e nada na tela avisa. Em produção, fonte fora do ar é
       * erro; em desenvolvimento e apresentação, o snapshot segue útil.
       *
       * Fica FORA de `obterOuExecutar` de propósito — capturar lá dentro
       * esconderia a falha do circuit breaker, que então nunca abriria.
       */
      if (ehAmbienteProducao()) throw erro;

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
        if (process.env.CARREIRO_PREFERIR_SNAPSHOT === "true" && !ehAmbienteProducao()) {
          const snapshot = lerSnapshotNormalizado();
          if (snapshot) return snapshot;
          console.warn(
            "[Adaptador Carreiro] CARREIRO_PREFERIR_SNAPSHOT ativo mas nenhum snapshot encontrado; seguindo para a carga ao vivo."
          );
        }

        // 1. Carga Online via Power BI Fabric REST API (se credenciais ativas)
        if (this.clienteDax.possuiConfiguracaoAtiva()) {
          const inicioBusca = Date.now();
          const mapaLojas = this.novoMapaLojas();

          // A posição de estoque é consultada UMA VEZ POR LOJA.
          // Motivo verificado ao vivo: a consulta de rede inteira estoura o limite
          // do executeQueries e volta truncada, com as medidas de estoque em branco
          // e sem erro algum — 0 itens com saldo onde existem mais de 24 mil.
          // TODAS as lojas, sempre. `filtro.filialId` é a filial em FOCO na tela,
          // não um recorte de carga: sem a posição das outras lojas o motor não
          // enxerga sobra para transferir, e a transferência é o que evita compra.
          const lojasParaCarregar = mapaLojas.filiaisAtivas.map((f) => f.filialId);

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
            this.carregarCatalogoPaginado(filtro, mapaLojas),
            this.clienteDax.executarConsultaDax(gerarConsultaDaxHistoricoVendas(filtro)),
            Promise.all(
              lojasParaCarregar.map(async (filialId) => {
                const nomeFilial = mapaLojas.nomeExibicao(filialId);
                // O identificador da loja na fonte vem do CADASTRO do cliente.
                const identificador = mapaLojas.identificadorDeFiltro(filialId);
                if (!identificador) return { filialId, nomeFilial, linhas: [] as readonly Record<string, unknown>[] };
                try {
                  const linhas = await this.clienteDax.executarConsultaDax(
                    gerarConsultaDaxPosicaoEstoque(identificador, filtro)
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
              classesNaoCompraveis: this.classesNaoCompraveis,
              desconsiderarInativos: this.desconsiderarInativos,
              termosDescricaoInativos: this.termosDescricaoInativos,
            }),
            linhasUltimoPedido
          );

          // Cada página traz a filial no contexto, não em cada linha.
          const estoques = new Map<string, EstoqueFilial>();
          for (const pagina of paginasPosicao) {
            const parcial = mapearEstoquesDax(pagina.linhas, {
              filialId: pagina.filialId,
              nomeFilial: pagina.nomeFilial,
              mapaLojas,
            });
            for (const [chave, valor] of parcial) {
              estoques.set(chave, valor);
            }
          }

          const historicos = mapearHistoricoVendasDax(linhasHistorico, mapaLojas);

          // Ruptura: o ERP não guarda saldo histórico, então é reconstruída a
          // partir do saldo de hoje e dos movimentos da janela.
          aplicarRupturaReconstruida(historicos, estoques, linhasMovimentos, mapaLojas);

          const mapaProdutosPorId = new Map(produtos.map((p) => [p.id, p]));

          const saldosPorProduto = new Map<number, number>();
          for (const estoque of estoques.values()) {
            const saldoAtual = saldosPorProduto.get(estoque.produtoId) ?? 0;
            saldosPorProduto.set(estoque.produtoId, saldoAtual + estoque.saldoFisico);
          }

          const entradasHoje = mapearEntradasNFeDax(linhasEntradas, mapaLojas, mapaProdutosPorId);
          const similares = mapearSimilaresDax(
            linhasSimilares,
            mapaProdutosPorId,
            saldosPorProduto
          );
          const sugestoesErp = mapearSugestoesErpDax(linhasSugestoesErp, mapaLojas);

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
              lojasNaoMapeadas: mapaLojas.naoMapeadas(),
            },
          };

          return resposta;
        }

        // 2. Carga Offline a partir de Snapshot Real Extraído (fora de produção)
        const dirSnapshot = ehAmbienteProducao()
          ? null
          : localizarDiretorioSnapshot(this.diretorioSnapshot);
        if (dirSnapshot) {
          return await carregarSnapshotCarreiroLocal(dirSnapshot, filtro, {
            classesNaoCompraveis: this.classesNaoCompraveis,
            desconsiderarInativos: this.desconsiderarInativos,
            termosDescricaoInativos: this.termosDescricaoInativos,
            mapaLojas: this.novoMapaLojas(),
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

    if (ehAmbienteProducao()) return false;
    const dirSnapshot = localizarDiretorioSnapshot(this.diretorioSnapshot);
    return dirSnapshot !== null;
  }

  /**
   * CAPACIDADES DA FONTE.
   *
   * O sub-objeto só existe quando a fonte responde de fato; sem credencial
   * ativa, a capacidade simplesmente não está lá e o TypeScript obriga quem
   * chama a tratar a ausência. Era um `if (adaptador.listarPedidosCompraERP)`
   * espalhado pelas rotas, que ninguém garantia estar em todas.
   *
   * `granularidade: "loja"` foi CONFERIDO ao vivo em 17/09/2026: PEDIDOS,
   * ITEMSPEDIDO, TBL_COTACAO e TBL_SOLICITACOES_COMPRAS trazem o ACODEMPRESA
   * completo por loja (a documentação antiga dizia que vinha "1" para todas).
   */
  public get pedidosERP(): CapacidadePedidosERP | undefined {
    if (!this.clienteDax.possuiConfiguracaoAtiva()) return undefined;
    return {
      granularidade: "loja",
      listarPedidos: (filtro) => this.listarPedidos(filtro ?? {}),
      listarItensDoPedido: (pedidoId) => this.listarItensDoPedido(pedidoId),
      listarComprasNaJanela: (dias, filialId) => this.listarComprasNaJanela(dias, filialId),
    };
  }

  public get cotacoesERP(): CapacidadeCotacoesERP | undefined {
    if (!this.clienteDax.possuiConfiguracaoAtiva()) return undefined;
    return {
      granularidade: "loja",
      listarCotacoes: (filtro) => this.listarCotacoes(filtro ?? {}),
    };
  }

  public get entradasConfirmadas(): CapacidadeEntradasConfirmadas | undefined {
    if (!this.clienteDax.possuiConfiguracaoAtiva()) return undefined;
    return {
      granularidade: "loja",
      listarEntradas: (produtoIds, dias) => this.listarEntradasConfirmadas(produtoIds, dias),
    };
  }

  private async listarPedidos(
    filtro: FiltroRastreamentoERP
  ): Promise<readonly PedidoCompraERP[]> {
    const mapaLojas = this.novoMapaLojas();
    try {
      const limite = filtro.limite ?? 100;
      const dax = gerarConsultaDaxPedidosCompra({
        dias: filtro.dias,
        fornecedorId: filtro.fornecedorId,
        limite,
        // Filtro de loja DENTRO da consulta: filtrando depois, o TOPN já havia
        // cortado olhando a rede inteira e a loja pedida vinha incompleta.
        identificadorFilial: filtro.filialId
          ? mapaLojas.identificadorDeFiltro(filtro.filialId)
          : undefined,
      });
      const linhas = await this.clienteDax.executarConsultaDax(dax);
      const pedidos: PedidoCompraERP[] = [];
      for (const linhaBruta of linhas) {
        const l = normalizarLinhaDax(linhaBruta);
        const brutoLoja = l.EmpresaId ?? l.ACODEMPRESA;
        const filialId = mapaLojas.resolver(brutoLoja);
        if (filialId === null) {
          mapaLojas.registrarNaoMapeada(brutoLoja);
          continue;
        }
        const statusOriginal = String(l.Status ?? l.STATUS ?? "");
        pedidos.push({
          id: Number(l.PedidoId ?? l.ID ?? 0),
          numero: Number(l.Numero ?? l.NUMERO ?? 0),
          dataEmissao: String(l.DataEmissao ?? l.DATAEMISSAO ?? ""),
          fornecedorId: Number(l.FornecedorId ?? l.ACODFORNECEDOR ?? 0),
          cotacaoId: l.CotacaoId ? Number(l.CotacaoId) : null,
          status: normalizarStatusERP(statusOriginal),
          statusOriginal,
          valorTotal: Number(l.ValorTotal ?? l.VALORPEDIDO ?? 0),
          filialId,
          filialNome: mapaLojas.nomeExibicao(filialId),
        });
      }
      return pedidos;
    } catch (e) {
      console.warn("[Adaptador Carreiro] Falha ao listar pedidos de compra do ERP:", e);
      return [];
    }
  }

  private async listarItensDoPedido(pedidoId: number): Promise<readonly ItemPedidoCompraERP[]> {
    const mapaLojas = this.novoMapaLojas();
    try {
      const dax = gerarConsultaDaxItensPedidosCompra({ pedidoId });
      const linhas = await this.clienteDax.executarConsultaDax(dax);
      return this.mapearItensPedido(linhas, pedidoId, mapaLojas);
    } catch (e) {
      console.warn(`[Adaptador Carreiro] Falha ao listar itens do pedido ERP ${pedidoId}:`, e);
      return [];
    }
  }

  private async listarComprasNaJanela(
    dias: number,
    filialId?: number
  ): Promise<readonly ItemPedidoCompraERP[]> {
    const mapaLojas = this.novoMapaLojas();
    try {
      const dax = gerarConsultaDaxItensPedidosCompra({
        dias,
        limite: LIMITE_LINHAS_COMPRAS,
        // O filtro de loja vai DENTRO da consulta. Aplicado depois, em memória,
        // o TOPN já teria cortado olhando a rede inteira: pedindo uma loja,
        // sobravam pouquíssimas linhas dela sem nada indicar o corte.
        identificadorFilial: filialId ? mapaLojas.identificadorDeFiltro(filialId) : undefined,
      });
      const linhas = await this.clienteDax.executarConsultaDax(dax);

      /**
       * Teto atingido: existe mais compra na janela do que o que voltou.
       * Com o filtro já aplicado na fonte, isto agora significa o que diz —
       * e não "o corte pode ter sido de outra loja". A correção definitiva é
       * paginar por janela de data, como a extração de vendas já faz.
       */
      if (linhas.length >= LIMITE_LINHAS_COMPRAS) {
        console.warn(
          `[Adaptador Carreiro] Compras do ERP atingiram o teto de ${LIMITE_LINHAS_COMPRAS} linhas ` +
            `em ${dias} dias` +
            (filialId ? ` para a loja ${filialId}` : " na rede") +
            ": as mais antigas da janela ficaram de fora."
        );
      }

      return this.mapearItensPedido(linhas, 0, mapaLojas);
    } catch (e) {
      console.warn("[Adaptador Carreiro] Falha ao listar compras do ERP na janela:", e);
      return [];
    }
  }

  private mapearItensPedido(
    linhas: readonly Record<string, unknown>[],
    pedidoIdPadrao: number,
    mapaLojas: MapaLojasFonte
  ): readonly ItemPedidoCompraERP[] {
    const itens: ItemPedidoCompraERP[] = [];
    for (const linhaBruta of linhas) {
      const l = normalizarLinhaDax(linhaBruta);
      const brutoLoja = l.EmpresaId ?? l.ACODEMPRESA;
      const filialId = mapaLojas.resolver(brutoLoja);
      if (filialId === null) {
        mapaLojas.registrarNaoMapeada(brutoLoja);
        continue;
      }
      const produtoId = extrairIdProduto(l.ProdutoId ?? l.PRODUTO_ID ?? 0);
      const rawSku = String(l.SkuBase ?? l.CodigoBase ?? l.ProdutoId ?? produtoId).trim();
      const sku = rawSku.includes("|") ? rawSku.split("|")[0].trim() : rawSku;
      const pedId = Number(l.PedidoId ?? l.PEDIDO_ID ?? pedidoIdPadrao);
      const itemId = Number(l.ItemId ?? l.ITEM_ID ?? 0);
      const id = pedId * 1000 + itemId;
      itens.push({
        id: id || itemId,
        pedidoId: pedId,
        produtoId,
        sku: sku || undefined,
        descricao: String(l.Descricao ?? l.DESCRICAO ?? ""),
        quantidade: Number(l.Quantidade ?? l.QTDE ?? 0),
        valorUnitario: Number(l.ValorUnitario ?? l.VALORUNIT ?? 0),
        valorTotal: Number(l.ValorTotal ?? l.VALORPEDIDO ?? 0),
        dataEmissao: String(l.DataEmissao ?? l.DATAEMISSAO ?? ""),
        filialId,
        fornecedorId: Number(l.FornecedorId ?? l.ACODFORNECEDOR ?? 0),
      });
    }
    return itens;
  }

  private async listarCotacoes(
    filtro: FiltroRastreamentoERP
  ): Promise<readonly CotacaoCompraERP[]> {
    const mapaLojas = this.novoMapaLojas();
    try {
      const dax = gerarConsultaDaxCotacoes({
        dias: filtro.dias,
        limite: filtro.limite,
        identificadorFilial: filtro.filialId
          ? mapaLojas.identificadorDeFiltro(filtro.filialId)
          : undefined,
      });
      const linhas = await this.clienteDax.executarConsultaDax(dax);
      const cotacoes: CotacaoCompraERP[] = [];
      for (const linhaBruta of linhas) {
        const l = normalizarLinhaDax(linhaBruta);
        const brutoLoja = l.ACODEMPRESA ?? l.EmpresaId;
        const filialId = mapaLojas.resolver(brutoLoja);
        if (filialId === null) {
          mapaLojas.registrarNaoMapeada(brutoLoja);
          continue;
        }
        const statusOriginal = String(l.STATUS ?? l.Status ?? "");
        cotacoes.push({
          rowId: Number(l.ROW_ID ?? l.RowId ?? 0),
          codigo: Number(l.CODIGO ?? l.Codigo ?? 0),
          descricao: String(l.DESCRICAO ?? l.Descricao ?? ""),
          dataHora: String(l.DATAHORA ?? l.DataHora ?? ""),
          status: normalizarStatusERP(statusOriginal),
          statusOriginal,
          filialId,
          filialNome: mapaLojas.nomeExibicao(filialId),
          totalItens: Number(l.TotalItens ?? 0),
          totalPropostas: Number(l.TotalPropostas ?? 0),
          propostasVencedoras: Number(l.PropostasVencedoras ?? 0),
          menorValorCotado: Number(l.MenorValorCotado ?? 0),
        });
      }
      return cotacoes;
    } catch (e) {
      console.warn("[Adaptador Carreiro] Falha ao listar cotações do ERP:", e);
      return [];
    }
  }

  private async listarEntradasConfirmadas(
    produtoIds: readonly number[],
    dias: number
  ): Promise<readonly EntradaConfirmadaERP[]> {
    const mapaLojas = this.novoMapaLojas();
    const fim = new Date();
    const inicio = new Date(fim.getTime() - Math.max(1, dias) * 24 * 60 * 60 * 1000);
    const alvo = new Set(produtoIds);
    const entradas: EntradaConfirmadaERP[] = [];

    for (const filial of mapaLojas.filiaisAtivas) {
      const identificadorFilial = mapaLojas.identificadorDeFiltro(filial.filialId);
      if (!identificadorFilial) continue;
      try {
        const porItem = await buscarEntradasCarreiro(this.clienteDax, {
          filialId: filial.filialId,
          identificadorFilial,
          inicio,
          fim,
          produtoIds: alvo,
        });
        for (const item of porItem.values()) {
          entradas.push({
            produtoId: item.produtoId,
            filialId: item.filialId,
            quantidadeEntrada: item.qtdEntrada,
            dataEntrada: fim.toISOString(),
          });
        }
      } catch (e) {
        console.warn(
          `[Adaptador Carreiro] Falha ao consultar entradas confirmadas da filial ${filial.filialId}:`,
          e
        );
      }
    }
    return entradas;
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
    filtro: FiltroCargaInventario | undefined,
    mapaLojas: MapaLojasFonte
  ): Promise<readonly Record<string, unknown>[]> {
    const MAXIMO_PAGINAS = 40; // trava contra laço infinito se o cursor não andar
    const todas: Record<string, unknown>[] = [];
    let cursor: string | null = null;

    for (let pagina = 0; pagina < MAXIMO_PAGINAS; pagina++) {
      const linhas = await this.clienteDax.executarConsultaDax(
        gerarConsultaDaxProdutosEstoque(
          filtro,
          cursor,
          filtro?.filialId ? mapaLojas.identificadorDeFiltro(filtro.filialId) : undefined
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

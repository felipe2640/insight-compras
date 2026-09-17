/**
 * Adaptador Mock em Memória para Desenvolvimento Offline e Testes de Carga
 * Camada: Adapters / Mock
 * 100% em Português do Brasil (pt-BR).
 *
 * Provê acesso de altíssima performance aos 25.000+ SKUs sintéticos de Demonstração
 * com suporte completo a filtros RBAC de carteira, seções e status de estoque.
 */

import {
  CapacidadeCotacoesERP,
  CapacidadeEntradasConfirmadas,
  CapacidadePedidosERP,
  EntradaConfirmadaERP,
  InventoryAdapter,
  FiltroCargaInventario,
  FiltroRastreamentoERP,
  PedidoCompraERP,
  ItemPedidoCompraERP,
  CotacaoCompraERP,
  RespostaCargaInventario,
} from "../AdaptadorInventario";
import {
  gerarDatasetSintetico,
  NOMES_FILIAIS_SINTETICAS,
  OpcoesGeradorSintetico,
} from "./gerador-sintetico";

/**
 * O que esta fonte sintética entrega.
 *
 * Existe porque o mock implementava TUDO: nenhum teste passava pelos caminhos
 * de "o cliente não tem essa capacidade", que são justamente os que quebram no
 * onboarding de um cliente novo. Aqui a ausência é configurável.
 */
export interface CapacidadesMock {
  readonly pedidosERP?: boolean;
  readonly cotacoesERP?: boolean;
  readonly entradasConfirmadas?: boolean;
  readonly sugestoesErp?: boolean;
}

export interface OpcoesAdaptadorMock extends OpcoesGeradorSintetico {
  readonly capacidades?: CapacidadesMock;
}

export class AdaptadorInventarioMock implements InventoryAdapter {
  private datasetBase: RespostaCargaInventario | null = null;
  private readonly opcoesGerador: OpcoesGeradorSintetico;
  private readonly capacidades: Required<CapacidadesMock>;

  public readonly descricaoFonte = "dados sintéticos de demonstração";
  public readonly natureza = "sintetica" as const;

  constructor(opcoes: OpcoesAdaptadorMock = {}) {
    const { capacidades, ...gerador } = opcoes;
    this.opcoesGerador = gerador;
    this.capacidades = {
      pedidosERP: capacidades?.pedidosERP ?? true,
      cotacoesERP: capacidades?.cotacoesERP ?? true,
      entradasConfirmadas: capacidades?.entradasConfirmadas ?? true,
      sugestoesErp: capacidades?.sugestoesErp ?? true,
    };
  }

  public get forneceSugestoesErp(): boolean {
    return this.capacidades.sugestoesErp;
  }

  private get lojas(): readonly { filialId: number; nome: string }[] {
    return (
      this.opcoesGerador.filiais ??
      Object.entries(NOMES_FILIAIS_SINTETICAS).map(([id, nome]) => ({
        filialId: Number(id),
        nome,
      }))
    );
  }

  /**
   * Obtém ou inicializa de forma preguiçosa (lazy) o dataset em memória.
   */
  private obterDatasetBase(): RespostaCargaInventario {
    if (!this.datasetBase) {
      this.datasetBase = gerarDatasetSintetico(this.opcoesGerador);
    }
    return this.datasetBase;
  }

  /**
   * Executa a carga do inventário em memória aplicando filtros com alta velocidade (< 250ms).
   */
  public async carregarInventarioCompleto(
    filtro: FiltroCargaInventario
  ): Promise<RespostaCargaInventario> {
    const inicio = Date.now();
    const base = this.obterDatasetBase();

    // Otimização: Set para verificação O(1) de permissão de fornecedores (RBAC)
    const setFornecedores = filtro.fornecedoresPermitidos
      ? new Set(filtro.fornecedoresPermitidos)
      : null;

    // Filtra os produtos
    const produtosFiltrados = base.produtos.filter((p) => {
      // 1. Filtro de Carteira RBAC
      if (setFornecedores !== null && !setFornecedores.has(p.fornecedorId)) {
        return false;
      }

      // 2. Filtro por Seção / Categoria
      if (filtro.secaoId !== undefined && p.secaoId !== filtro.secaoId) {
        return false;
      }

      // 3. Filtro de estoque ou vendas ativas
      if (filtro.apenasComEstoqueOuVenda) {
        const est1 = base.estoques.get(`${p.id}:1`)?.saldoFisico ?? 0;
        const est2 = base.estoques.get(`${p.id}:2`)?.saldoFisico ?? 0;
        const ven1 = base.historicos.get(`${p.id}:1`)?.vendasLiquidas180dias ?? 0;
        const ven2 = base.historicos.get(`${p.id}:2`)?.vendasLiquidas180dias ?? 0;

        if (est1 <= 0 && est2 <= 0 && ven1 <= 0 && ven2 <= 0) {
          return false;
        }
      }

      return true;
    });

    const idsProdutosFiltrados = new Set(produtosFiltrados.map((p) => p.id));

    // Filtra os estoques e históricos correspondentes
    const estoquesFiltrados = new Map();
    for (const [chave, estoque] of base.estoques.entries()) {
      if (idsProdutosFiltrados.has(estoque.produtoId)) {
        if (filtro.filialId !== undefined && estoque.filialId !== filtro.filialId) {
          continue;
        }
        estoquesFiltrados.set(chave, estoque);
      }
    }

    const historicosFiltrados = new Map();
    for (const [chave, historico] of base.historicos.entries()) {
      if (idsProdutosFiltrados.has(historico.produtoId)) {
        if (filtro.filialId !== undefined && historico.filialId !== filtro.filialId) {
          continue;
        }
        historicosFiltrados.set(chave, historico);
      }
    }

    // Filtra entradas de hoje
    const entradasFiltradas = base.entradasHoje.filter((e) =>
      idsProdutosFiltrados.has(e.produtoId)
    );

    // Filtra similares
    const similaresFiltrados = new Map();
    for (const [idOrigem, listaSimilares] of base.similares.entries()) {
      if (idsProdutosFiltrados.has(idOrigem)) {
        similaresFiltrados.set(idOrigem, listaSimilares);
      }
    }

    // Filtra sugestões do ERP
    const sugestoesErpFiltradas = new Map();
    if (base.sugestoesErp) {
      for (const [chave, item] of base.sugestoesErp.entries()) {
        if (idsProdutosFiltrados.has(item.produtoId)) {
          if (filtro.filialId !== undefined && item.filialId !== filtro.filialId) {
            continue;
          }
          sugestoesErpFiltradas.set(chave, item);
        }
      }
    }

    const latenciaMs = Date.now() - inicio;

    return {
      produtos: produtosFiltrados,
      estoques: estoquesFiltrados,
      historicos: historicosFiltrados,
      entradasHoje: entradasFiltradas,
      similares: similaresFiltrados,
      sugestoesErp: sugestoesErpFiltradas,
      metadados: {
        provedor: "MOCK_SINTETICO",
        timestampCarga: new Date().toISOString(),
        emModoDegradado: false,
        totalSkusCarregados: produtosFiltrados.length,
        latenciaMs,
      },
    };
  }

  /**
   * Mock sempre possui saúde e conectividade ativas.
   */
  public async verificarSaudeConexao(): Promise<boolean> {
    return true;
  }

  /**
   * Permite resetar ou recarregar os dados mockados em testes.
   */
  public recarregar(): void {
    this.datasetBase = null;
  }

  public get pedidosERP(): CapacidadePedidosERP | undefined {
    if (!this.capacidades.pedidosERP) return undefined;
    return {
      granularidade: "loja",
      listarPedidos: (filtro) => this.listarPedidos(filtro ?? {}),
      listarItensDoPedido: (pedidoId) => this.listarItensDoPedido(pedidoId),
      listarComprasNaJanela: (dias, filialId) => this.listarComprasNaJanela(dias, filialId),
    };
  }

  public get cotacoesERP(): CapacidadeCotacoesERP | undefined {
    if (!this.capacidades.cotacoesERP) return undefined;
    return {
      granularidade: "loja",
      listarCotacoes: (filtro) => this.listarCotacoes(filtro ?? {}),
    };
  }

  public get entradasConfirmadas(): CapacidadeEntradasConfirmadas | undefined {
    if (!this.capacidades.entradasConfirmadas) return undefined;
    return {
      granularidade: "loja",
      listarEntradas: (produtoIds, dias) => this.listarEntradas(produtoIds, dias),
    };
  }

  private async listarPedidos(filtro: FiltroRastreamentoERP = {}): Promise<readonly PedidoCompraERP[]> {
    const base = this.obterDatasetBase();
    const fornecedores = Array.from(new Set(base.produtos.map((p) => p.fornecedorId)));
    const dias = filtro.dias ?? 30;
    const pedidos: PedidoCompraERP[] = [];

    const lojas = this.lojas;
    const nomesFornecedores: Record<number, string> = {
      101: "Distribuidora Pellegrino",
      102: "DPaschoal Distribuição",
      103: "Compecas Distribuidora",
      104: "Fortbras Distribuidora",
      105: "Distribuidora Central",
      106: "Auto Peças União",
    };

    let idContador = 1000;
    const agora = Date.now();

    for (let d = 0; d < Math.min(dias, 15); d++) {
      const data = new Date(agora - d * 86400000).toISOString().split("T")[0];
      for (const loja of lojas) {
        const filial = loja.filialId;
        if (filtro.filialId && filtro.filialId !== filial) continue;
        const forn = fornecedores[(idContador + filial) % fornecedores.length];
        if (filtro.fornecedorId && filtro.fornecedorId !== forn) continue;

        pedidos.push({
          id: idContador++,
          numero: 5000 + idContador,
          dataEmissao: data,
          fornecedorId: forn,
          fornecedorNome: nomesFornecedores[forn] ?? `Distribuidora Nacional ${forn}`,
          cotacaoId: idContador % 3 === 0 ? idContador * 10 : null,
          status: d < 3 ? "aberto" : "concluido",
          statusOriginal: d < 3 ? "A" : "F",
          valorTotal: 1500 + (idContador * 37) % 4500,
          filialId: filial,
          filialNome: loja.nome,
          totalItens: 3 + (idContador % 5),
        });
      }
    }

    return pedidos.slice(0, filtro.limite ?? 100);
  }

  private async listarItensDoPedido(pedidoId: number): Promise<readonly ItemPedidoCompraERP[]> {
    const base = this.obterDatasetBase();
    const skus = base.produtos.slice(0, 5);
    return skus.map((p, idx) => ({
      id: pedidoId * 100 + idx,
      pedidoId,
      produtoId: p.id,
      sku: p.codigoSku,
      descricao: p.descricao,
      quantidade: 10 * (idx + 1),
      valorUnitario: p.precoCusto,
      valorTotal: 10 * (idx + 1) * p.precoCusto,
      dataEmissao: new Date().toISOString().split("T")[0],
      filialId: this.lojas[0].filialId,
      fornecedorId: p.fornecedorId,
    }));
  }

  private async listarCotacoes(filtro: FiltroRastreamentoERP = {}): Promise<readonly CotacaoCompraERP[]> {
    const cotacoes: CotacaoCompraERP[] = [];
    const lojas = this.lojas;

    for (let i = 1; i <= 10; i++) {
      const loja = lojas[i % lojas.length];
      const filial = loja.filialId;
      if (filtro.filialId && filtro.filialId !== filial) continue;
      cotacoes.push({
        rowId: 2000 + i,
        codigo: 100 + i,
        descricao: `COTAÇÃO DE REPOSIÇÃO #${100 + i}`,
        dataHora: new Date(Date.now() - i * 86400000).toISOString(),
        status: i <= 3 ? "aberto" : "concluido",
        statusOriginal: i <= 3 ? "A" : "F",
        filialId: filial,
        filialNome: loja.nome,
        totalItens: 15 + i * 2,
        totalPropostas: 45 + i * 5,
        propostasVencedoras: i > 3 ? 15 + i * 2 : 0,
        menorValorCotado: 12.5 + i,
      });
    }

    return cotacoes;
  }

  private async listarComprasNaJanela(dias: number, filialId?: number): Promise<readonly ItemPedidoCompraERP[]> {
    const base = this.obterDatasetBase();
    const produtos = base.produtos.slice(0, 50);
    return produtos.map((p, idx) => ({
      id: 90000 + idx,
      pedidoId: 8000 + (idx % 10),
      produtoId: p.id,
      sku: p.codigoSku,
      descricao: p.descricao,
      quantidade: 5 + (idx % 15),
      valorUnitario: p.precoCusto,
      valorTotal: (5 + (idx % 15)) * p.precoCusto,
      dataEmissao: new Date(Date.now() - (idx % dias) * 86400000).toISOString().split("T")[0],
      filialId: filialId ?? this.lojas[idx % this.lojas.length].filialId,
      fornecedorId: p.fornecedorId,
    }));
  }

  private async listarEntradas(
    produtoIds: readonly number[],
    dias: number
  ): Promise<readonly EntradaConfirmadaERP[]> {
    const lojaPadrao = this.lojas[0].filialId;
    const agora = Date.now();
    return produtoIds.map((produtoId, idx) => ({
      produtoId,
      filialId: lojaPadrao,
      quantidadeEntrada: 1 + (idx % 7),
      dataEntrada: new Date(agora - (idx % Math.max(1, dias)) * 86400000).toISOString(),
    }));
  }
}

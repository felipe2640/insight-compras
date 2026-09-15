/**
 * Adaptador Mock em Memória para Desenvolvimento Offline e Testes de Carga
 * Camada: Adapters / Mock
 * 100% em Português do Brasil (pt-BR).
 *
 * Provê acesso de altíssima performance aos 25.000+ SKUs sintéticos da Rede Carreiro
 * com suporte completo a filtros RBAC de carteira, seções e status de estoque.
 */

import {
  InventoryAdapter,
  FiltroCargaInventario,
  FiltroRastreamentoERP,
  PedidoCompraERP,
  ItemPedidoCompraERP,
  CotacaoCompraERP,
  RespostaCargaInventario,
} from "../AdaptadorInventario";
import {
  gerarDatasetSinteticoCarreiro,
  OpcoesGeradorSintetico,
} from "./gerador-sintetico";

export class AdaptadorInventarioMock implements InventoryAdapter {
  private datasetBase: RespostaCargaInventario | null = null;
  private readonly opcoesGerador: OpcoesGeradorSintetico;

  constructor(opcoes: OpcoesGeradorSintetico = {}) {
    this.opcoesGerador = opcoes;
  }

  /**
   * Obtém ou inicializa de forma preguiçosa (lazy) o dataset em memória.
   */
  private obterDatasetBase(): RespostaCargaInventario {
    if (!this.datasetBase) {
      this.datasetBase = gerarDatasetSinteticoCarreiro(this.opcoesGerador);
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

  /**
   * Rastreia pedidos de compra formalizados no ERP (mock sintético).
   */
  public async listarPedidosCompraERP(filtro: FiltroRastreamentoERP = {}): Promise<readonly PedidoCompraERP[]> {
    const base = this.obterDatasetBase();
    const fornecedores = Array.from(new Set(base.produtos.map((p) => p.fornecedorId)));
    const dias = filtro.dias ?? 30;
    const pedidos: PedidoCompraERP[] = [];

    const nomesLojas: Record<number, string> = {
      1: "Carreiro Pedro II (Matriz)",
      2: "Melo / Piripiri",
      3: "Carreiro Poranga",
      4: "Ceará Auto Peças (Campo Maior)",
      5: "Carreiro José de Freitas",
    };

    let idContador = 1000;
    const agora = Date.now();

    for (let d = 0; d < Math.min(dias, 15); d++) {
      const data = new Date(agora - d * 86400000).toISOString().split("T")[0];
      for (let filial = 1; filial <= 5; filial++) {
        if (filtro.filialId && filtro.filialId !== filial) continue;
        const forn = fornecedores[(idContador + filial) % fornecedores.length];
        if (filtro.fornecedorId && filtro.fornecedorId !== forn) continue;

        pedidos.push({
          id: idContador++,
          numero: 5000 + idContador,
          dataEmissao: data,
          fornecedorId: forn,
          fornecedorNome: `Distribuidora Fornecedor ${forn}`,
          cotacaoId: idContador % 3 === 0 ? idContador * 10 : null,
          status: d < 3 ? "Aberto" : "Concluído",
          valorTotal: 1500 + (idContador * 37) % 4500,
          filialId: filial,
          filialNome: nomesLojas[filial] ?? `Loja ${filial}`,
          totalItens: 3 + (idContador % 5),
        });
      }
    }

    return pedidos.slice(0, filtro.limite ?? 100);
  }

  /**
   * Lista itens de um pedido de compra específico do ERP (mock sintético).
   */
  public async listarItensPedidoCompraERP(pedidoId: number): Promise<readonly ItemPedidoCompraERP[]> {
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
      filialId: 1,
      fornecedorId: p.fornecedorId,
    }));
  }

  /**
   * Lista cotações de compra abertas ou concluídas no ERP (mock sintético).
   */
  public async listarCotacoesERP(filtro: FiltroRastreamentoERP = {}): Promise<readonly CotacaoCompraERP[]> {
    const cotacoes: CotacaoCompraERP[] = [];
    const nomesLojas: Record<number, string> = {
      1: "Carreiro Pedro II (Matriz)",
      2: "Melo / Piripiri",
      3: "Carreiro Poranga",
      4: "Ceará Auto Peças (Campo Maior)",
      5: "Carreiro José de Freitas",
    };

    for (let i = 1; i <= 10; i++) {
      const filial = (i % 5) + 1;
      if (filtro.filialId && filtro.filialId !== filial) continue;
      cotacoes.push({
        rowId: 2000 + i,
        codigo: 100 + i,
        descricao: `COTAÇÃO DE REPOSIÇÃO #${100 + i}`,
        dataHora: new Date(Date.now() - i * 86400000).toISOString(),
        status: i <= 3 ? "Em Aberto" : "Concluída",
        filialId: filial,
        filialNome: nomesLojas[filial],
        totalItens: 15 + i * 2,
        totalPropostas: 45 + i * 5,
        propostasVencedoras: i > 3 ? 15 + i * 2 : 0,
        menorValorCotado: 12.5 + i,
      });
    }

    return cotacoes;
  }

  /**
   * Lista todas as compras faturadas/emitidas no ERP na janela para calibração do aprendizado (mock sintético).
   */
  public async listarTodasComprasERPNaJanela(dias: number, filialId?: number): Promise<readonly ItemPedidoCompraERP[]> {
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
      filialId: filialId ?? ((idx % 5) + 1),
      fornecedorId: p.fornecedorId,
    }));
  }
}

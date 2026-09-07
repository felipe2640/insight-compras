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

    const latenciaMs = Date.now() - inicio;

    return {
      produtos: produtosFiltrados,
      estoques: estoquesFiltrados,
      historicos: historicosFiltrados,
      entradasHoje: entradasFiltradas,
      similares: similaresFiltrados,
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
}

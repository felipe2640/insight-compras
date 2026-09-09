/**
 * Catálogo de Colunas Exportáveis — base comum a todos os clientes.
 * Camada: Aplicação (src/lib/exportacao)
 * 100% em Português do Brasil (pt-BR).
 *
 * Cada cliente escolhe QUAIS destas colunas saem, em que ordem e com que rótulo.
 * Para acrescentar uma coluna nova para todos os clientes, é aqui.
 */

import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import { ColunaExportavel } from "./tipos";

/** Quantidade de pedido que vale: o ajuste do comprador, senão a sugestão do motor. */
export function quantidadePedidoEfetiva(item: LinhaCockpitMatriz): number {
  return item.pedidoCustom > 0 ? item.pedidoCustom : item.sugestaoFinalCompra;
}

/** Quantidade de transferência que vale: o ajuste do comprador, senão a sugestão. */
export function quantidadeTransferenciaEfetiva(item: LinhaCockpitMatriz): number {
  return item.transferenciaCustom > 0
    ? item.transferenciaCustom
    : item.quantidadeTransferenciaSugerida;
}

const PERFIL_LEGIVEL: Record<string, string> = {
  ALTO_GIRO: "Alto giro",
  MEDIO_GIRO: "Médio giro",
  BAIXO_GIRO_INTERMITENTE: "Baixo giro",
  SEM_HISTORICO_SUFICIENTE: "Sem histórico",
};

const STATUS_LEGIVEL: Record<string, string> = {
  APROVADO_COMPRA: "Comprar",
  COBERTO_POR_TRANSFERENCIA: "Transferir",
  ESTOQUE_SUFICIENTE: "Estoque OK",
  TRAVADO_MARCA_ZUMBI: "Marca zumbi",
  TRAVADO_FAMILIA: "Família coberta",
};

const colunas: readonly ColunaExportavel[] = [
  // ---- Produto ----
  { id: "sku", rotulo: "SKU", tipo: "texto", grupo: "Produto", extrair: (i) => i.codigoSku },
  { id: "descricao", rotulo: "Descrição", tipo: "texto", grupo: "Produto", extrair: (i) => i.descricao },
  { id: "marca", rotulo: "Marca", tipo: "texto", grupo: "Produto", extrair: (i) => i.marca },
  { id: "fabricante", rotulo: "Fabricante", tipo: "texto", grupo: "Produto", extrair: (i) => i.fabricante },
  { id: "ref_fabricante", rotulo: "Ref. Fabricante", tipo: "texto", grupo: "Produto", extrair: (i) => i.referenciaFabricante },
  { id: "aplicacao", rotulo: "Aplicação", tipo: "texto", grupo: "Produto", extrair: (i) => i.aplicacaoVeicular },
  { id: "secao", rotulo: "Seção", tipo: "texto", grupo: "Produto", extrair: (i) => i.secaoNome },
  { id: "sub_grupo", rotulo: "Sub-grupo", tipo: "texto", grupo: "Produto", extrair: (i) => i.subgrupo },
  { id: "fornecedor", rotulo: "Fornecedor", tipo: "texto", grupo: "Produto", extrair: (i) => i.nomeFornecedor },
  { id: "fornecedor_id", rotulo: "Cód. Fornecedor", tipo: "inteiro", grupo: "Produto", extrair: (i) => i.fornecedorId },
  { id: "curva_abc", rotulo: "Curva ABC", tipo: "texto", grupo: "Produto", extrair: (i) => i.curvaAbc },
  { id: "perfil_giro", rotulo: "Perfil de giro", tipo: "texto", grupo: "Produto", extrair: (i) => PERFIL_LEGIVEL[i.perfilGiro] ?? i.perfilGiro },

  // ---- Estoque ----
  { id: "loja", rotulo: "Loja", tipo: "texto", grupo: "Estoque", extrair: (i) => i.filialFocoNome },
  { id: "loja_id", rotulo: "Cód. Loja", tipo: "inteiro", grupo: "Estoque", extrair: (i) => i.filialFocoId },
  { id: "estoque_loja", rotulo: "Estoque loja", tipo: "inteiro", grupo: "Estoque", extrair: (i) => i.estoqueLojaFoco },
  { id: "estoque_minimo", rotulo: "Estoque mínimo ERP", tipo: "inteiro", grupo: "Estoque", extrair: (i) => i.estoqueMinimoLojaFoco },
  { id: "estoque_rede", rotulo: "Estoque outras lojas", tipo: "inteiro", grupo: "Estoque", extrair: (i) => i.estoqueOutrasLojasRede },
  { id: "pedido_em_aberto", rotulo: "Pedido em aberto", tipo: "inteiro", grupo: "Estoque", extrair: (i) => i.quantidadeJaPedidaFoco },
  { id: "dias_sem_venda", rotulo: "Dias sem venda", tipo: "inteiro", grupo: "Estoque", extrair: (i) => i.diasSemVenda ?? null },
  { id: "ultima_venda", rotulo: "Última venda", tipo: "data", grupo: "Estoque", extrair: (i) => i.dtUltVenda ?? null },
  { id: "ultima_compra", rotulo: "Última compra", tipo: "data", grupo: "Estoque", extrair: (i) => i.dtUltimaCompra ?? null },

  // ---- Demanda ----
  { id: "vendas_30d", rotulo: "Vendas 30d", tipo: "inteiro", grupo: "Demanda", extrair: (i) => i.vendasLiquidas30d },
  { id: "vendas_90d", rotulo: "Vendas 90d", tipo: "inteiro", grupo: "Demanda", extrair: (i) => i.vendasLiquidas90d },
  { id: "vendas_180d", rotulo: "Vendas 180d", tipo: "inteiro", grupo: "Demanda", extrair: (i) => i.vendasLiquidas180d },
  { id: "consumo_diario", rotulo: "Consumo diário", tipo: "decimal", grupo: "Demanda", extrair: (i) => i.consumoDiario ?? i.consumoMedioDiario180d },
  { id: "consumo_mensal", rotulo: "Consumo mensal", tipo: "decimal", grupo: "Demanda", extrair: (i) => i.consumoMensal ?? null },
  { id: "cobertura_90d", rotulo: "Cobertura (dias)", tipo: "inteiro", grupo: "Demanda", extrair: (i) => i.diasCobertura90d },
  { id: "notas_90d", rotulo: "Notas 90d", tipo: "inteiro", grupo: "Demanda", extrair: (i) => i.notasLiquidas90d },
  { id: "frequencia", rotulo: "Frequência", tipo: "texto", grupo: "Demanda", extrair: (i) => i.classificacaoFrequencia },

  // ---- Decisão de compra ----
  { id: "qtd_sugerida", rotulo: "Qtd. sugerida", tipo: "inteiro", grupo: "Compra", extrair: (i) => i.sugestaoFinalCompra },
  { id: "qtd_pedido", rotulo: "Qtd. pedido", tipo: "inteiro", grupo: "Compra", extrair: (i) => quantidadePedidoEfetiva(i) },
  { id: "lote_multiplo", rotulo: "Múltiplo", tipo: "inteiro", grupo: "Compra", extrair: (i) => i.loteMultiplo },
  { id: "preco_custo", rotulo: "Preço custo", tipo: "moeda", grupo: "Compra", extrair: (i) => i.precoCusto },
  { id: "preco_venda", rotulo: "Preço venda", tipo: "moeda", grupo: "Compra", extrair: (i) => i.precoVenda },
  { id: "valor_total_pedido", rotulo: "Valor total pedido", tipo: "moeda", grupo: "Compra", extrair: (i) => +(quantidadePedidoEfetiva(i) * i.precoCusto).toFixed(2) },

  // ---- Transferência ----
  { id: "qtd_transferir", rotulo: "Qtd. transferir", tipo: "inteiro", grupo: "Transferência", extrair: (i) => quantidadeTransferenciaEfetiva(i) },
  { id: "loja_origem", rotulo: "Loja de origem", tipo: "texto", grupo: "Transferência", extrair: (i) => i.filialOrigemTransferenciaNome },
  { id: "loja_origem_id", rotulo: "Cód. loja origem", tipo: "inteiro", grupo: "Transferência", extrair: (i) => i.filialOrigemTransferenciaId },
  { id: "saldo_origem", rotulo: "Saldo na origem", tipo: "inteiro", grupo: "Transferência", extrair: (i) => i.saldoOrigemTransferencia },
  { id: "origem_mantem", rotulo: "Origem mantém", tipo: "inteiro", grupo: "Transferência", extrair: (i) => i.estoqueMinimoOrigemTransferencia },
  { id: "sobra_origem", rotulo: "Sobra na origem", tipo: "inteiro", grupo: "Transferência", extrair: (i) => i.sobraRealOrigemTransferencia },

  // ---- Diagnóstico ----
  { id: "status", rotulo: "Status", tipo: "texto", grupo: "Diagnóstico", extrair: (i) => STATUS_LEGIVEL[i.statusSugestao] ?? i.statusSugestao },
  { id: "motivo", rotulo: "Motivo", tipo: "texto", grupo: "Diagnóstico", extrair: (i) => i.motivoDecisao },
  { id: "marca_zumbi", rotulo: "Marca zumbi", tipo: "texto", grupo: "Diagnóstico", extrair: (i) => (i.isMarcaZumbi ? "Sim" : "Não") },
  { id: "ruptura", rotulo: "Ruptura", tipo: "texto", grupo: "Diagnóstico", extrair: (i) => i.classificacaoRuptura },
];

export const CATALOGO_COLUNAS_EXPORTACAO: ReadonlyMap<string, ColunaExportavel> = new Map(
  colunas.map((c) => [c.id, c])
);

export const IDS_COLUNAS_EXPORTACAO: readonly string[] = colunas.map((c) => c.id);

/** Grupos na ordem em que aparecem na interface de configuração. */
export const GRUPOS_COLUNAS_EXPORTACAO: readonly string[] = Array.from(
  new Set(colunas.map((c) => c.grupo))
);

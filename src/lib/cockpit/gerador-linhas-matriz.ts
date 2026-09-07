/**
 * Transformador Canônico: Converte RespostaCargaInventario em LinhaCockpitMatriz[]
 * Camada: Aplicação / Cockpit (src/lib/cockpit/gerador-linhas-matriz.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import {
  RespostaCargaInventario,
  EntradaNFeDoDia,
  ItemSimilarIntercambiavel,
} from "@adapters/AdaptadorInventario";
import { NOMES_FILIAIS_CARREIRO } from "@adapters/carreiro/mapeador-dax";
import {
  LinhaCockpitMatriz,
  SeveridadeRuptura,
  ClassificacaoFrequencia,
  TendenciaCobertura,
} from "@/tipos/cockpit";
import {
  inferirLotePadraoPorCategoria,
  ajustarQuantidadePorLote,
  aplicarTravaMarcaZumbi,
} from "@core/travas";
import { calcularNecessidadeItem } from "@core/calculo/necessidade";
import { calcularConsumoDiario, classificarPerfilGiro } from "@core/calculo/demanda-diaria";
import { calcularCurvaAbc } from "@core/calculo/curva-abc";
import { StatusSugestao, CurvaABC } from "@core/dominio";

export interface OpcoesGeracaoMatriz {
  readonly filialFocoId?: number;
  readonly leadTimePadraoDias?: number;
}

/**
 * Converte o inventário bruto carregado do adapter na matriz de decisão do cockpit,
 * calculando todos os indicadores analíticos, travas de encalhe e transferências inter-filiais.
 */
export function converterParaLinhasCockpit(
  carga: RespostaCargaInventario,
  opcoes: OpcoesGeracaoMatriz = {}
): LinhaCockpitMatriz[] {
  const filialFocoId = opcoes.filialFocoId ?? 1;
  const leadTimeDias = opcoes.leadTimePadraoDias ?? 7;
  const nomeFilialFoco = NOMES_FILIAIS_CARREIRO[filialFocoId] ?? `Loja ${filialFocoId}`;

  // 1. Agrupamento de estoques por produto para transferências entre filiais
  const estoquesPorProduto = new Map<number, Array<{ filialId: number; saldo: number; minStock: number }>>();
  for (const est of carga.estoques.values()) {
    const lista = estoquesPorProduto.get(est.produtoId) ?? [];
    lista.push({
      filialId: est.filialId,
      saldo: est.saldoFisico,
      minStock: est.estoqueMinimoSeguranca,
    });
    estoquesPorProduto.set(est.produtoId, lista);
  }

  // 2. Indexação de Entradas de NF-e do Dia por produtoId
  const mapaEntradasHoje = new Map<number, EntradaNFeDoDia[]>();
  for (const entrada of carga.entradasHoje) {
    const lista = mapaEntradasHoje.get(entrada.produtoId) ?? [];
    lista.push(entrada);
    mapaEntradasHoje.set(entrada.produtoId, lista);
  }

  // 3. Pré-cálculo da Curva ABC global por faturamento acumulado
  const itensParaCurva = carga.produtos.map((p) => {
    const chaveFoco = `${p.id}:${filialFocoId}`;
    const histFoco = carga.historicos.get(chaveFoco);
    const vendas90d = histFoco?.vendasLiquidas90dias ?? 0;
    return {
      produtoId: p.id,
      faturamento: vendas90d * p.precoVenda,
    };
  });
  const mapaCurvaAbc = calcularCurvaAbc(itensParaCurva);

  // 4. Transformação de cada Produto na Linha da Matriz de Decisão
  const linhas: LinhaCockpitMatriz[] = [];

  for (const p of carga.produtos) {
    const chaveFoco = `${p.id}:${filialFocoId}`;
    const estFoco = carga.estoques.get(chaveFoco);
    const histFoco = carga.historicos.get(chaveFoco);

    const saldoFoco = estFoco?.saldoFisico ?? 0;
    const minStockFoco = estFoco?.estoqueMinimoSeguranca ?? 0;
    const pedidosFoco = estFoco?.quantidadeJaPedida ?? 0;

    // Saldo em outras lojas da rede
    let saldoOutrasLojas = 0;
    const outrasLojas = estoquesPorProduto.get(p.id) ?? [];
    for (const est of outrasLojas) {
      if (est.filialId !== filialFocoId) {
        saldoOutrasLojas += Math.max(0, est.saldo);
      }
    }

    // Histórico da Loja Foco
    const vendas30d = histFoco?.vendasLiquidas30dias ?? 0;
    const vendas90d = histFoco?.vendasLiquidas90dias ?? 0;
    const vendas180d = histFoco?.vendasLiquidas180dias ?? 0;
    const diasObservados = histFoco?.diasObservados ?? 90;
    const notasVenda90d = histFoco?.notasFiscaisVenda90dias ?? 0;
    const notasDevolucao90d = histFoco?.notasFiscaisDevolucao90dias ?? 0;

    const cmdDiario = calcularConsumoDiario({
      vendasLiquidas180d: vendas180d,
      notasFiscais90d: notasVenda90d,
      diasObservados,
    });

    const cmd30d = vendas30d > 0 ? +(vendas30d / 30).toFixed(4) : 0;
    const cmd90d = cmdDiario > 0 ? cmdDiario : (vendas90d > 0 ? +(vendas90d / 90).toFixed(4) : 0);
    const cmd180d = vendas180d > 0 ? +(vendas180d / 180).toFixed(4) : 0;

    const cob30d = cmd30d > 0 ? Math.round(saldoFoco / cmd30d) : saldoFoco > 0 ? 999 : 0;
    const cob90d = cmd90d > 0 ? Math.round(saldoFoco / cmd90d) : saldoFoco > 0 ? 999 : 0;
    const cob180d = cmd180d > 0 ? Math.round(saldoFoco / cmd180d) : saldoFoco > 0 ? 999 : 0;

    // Perfil de Giro & Curva ABC
    const perfilGiro = classificarPerfilGiro(cmd90d, notasVenda90d, diasObservados);
    const curvaAbc: CurvaABC = mapaCurvaAbc.get(p.id)?.curva ?? "C";

    // Trava de Marca Zumbi (saldo > 0 e zero vendas em 180d)
    const checagemZumbi = aplicarTravaMarcaZumbi({
      saldoFisico: saldoFoco,
      vendasLiquidas180dias: vendas180d,
      sugestaoOriginal: 0,
      codigoSku: p.codigoSku,
    });
    const isZumbi = checagemZumbi.travado;

    // Tendência de Cobertura
    let tendenciaCobertura: TendenciaCobertura = "ESTAVEL";
    if (isZumbi) {
      tendenciaCobertura = "ZUMBI";
    } else if (cmd30d > cmd90d * 1.25 && cmd30d > 0.05) {
      tendenciaCobertura = "ALTA";
    } else if (cmd30d < cmd90d * 0.75) {
      tendenciaCobertura = "QUEDA";
    }

    // Diagnóstico de Ruptura
    const diasAnalisados = diasObservados;
    const diasZerados = histFoco?.diasRuptura90dias ?? (saldoFoco <= 0 && vendas90d > 0 ? 15 : 0);
    const rupturaPercentual = diasAnalisados > 0 ? +((diasZerados / diasAnalisados) * 100).toFixed(1) : null;

    let classificacaoRuptura: SeveridadeRuptura = "Sem histórico";
    if (rupturaPercentual !== null) {
      if (rupturaPercentual <= 5) {
        classificacaoRuptura = "Boa";
      } else if (rupturaPercentual <= 10) {
        classificacaoRuptura = "Atenção";
      } else {
        classificacaoRuptura = "Grave";
      }
    }

    const vendaPerdidaEstimada = diasZerados > 0 && cmd90d > 0
      ? +(diasZerados * cmd90d * p.precoVenda).toFixed(2)
      : 0;

    // Frequência por Notas em 90 dias
    const notasLiquidas90d = Math.max(0, notasVenda90d - notasDevolucao90d);
    const frequenciaPercentual90d = +((notasLiquidas90d / 90) * 100).toFixed(1);

    let classificacaoFrequencia: ClassificacaoFrequencia = "Baixa";
    if (frequenciaPercentual90d > 40) {
      classificacaoFrequencia = "Alta";
    } else if (frequenciaPercentual90d >= 15) {
      classificacaoFrequencia = "Média";
    }

    // Lotes e Múltiplos Industriais
    const loteMultiplo = p.loteMultiplo > 1 ? p.loteMultiplo : inferirLotePadraoPorCategoria(p.descricao);
    const embalagemMinima = 1;

    // Cálculo Numérico de Necessidade Bruta / Líquida
    const resultadoNecessidade = calcularNecessidadeItem({
      consumoDiario: cmd90d,
      perfilGiro,
      saldoFisico: saldoFoco,
      estoqueMinimoCadastrado: minStockFoco,
      quantidadeJaPedida: pedidosFoco,
      leadTimeDias,
    });

    let necessidadeCompra = resultadoNecessidade.necessidadeLiquida;

    // Oportunidade de Transferência Inter-Filiais Segura
    let melhorOrigemTransferencia: {
      filialId: number;
      nomeFilial: string;
      saldoOrigem: number;
      minStockOrigem: number;
      sobraReal: number;
      quantidade: number;
    } | null = null;

    if (necessidadeCompra > 0) {
      let maiorSobra = 0;
      for (const est of outrasLojas) {
        if (est.filialId !== filialFocoId) {
          const sobra = Math.max(0, est.saldo - est.minStock);
          if (sobra > maiorSobra) {
            maiorSobra = sobra;
            const qtdTransferir = Math.min(necessidadeCompra, sobra);
            melhorOrigemTransferencia = {
              filialId: est.filialId,
              nomeFilial: NOMES_FILIAIS_CARREIRO[est.filialId] ?? `Loja ${est.filialId}`,
              saldoOrigem: est.saldo,
              minStockOrigem: est.minStock,
              sobraReal: sobra,
              quantidade: qtdTransferir,
            };
          }
        }
      }
    }

    // Definição da Sugestão Final de Compra e Status
    let sugestaoFinalCompra = 0;
    let statusSugestao: StatusSugestao = "ESTOQUE_SUFICIENTE";
    let motivoDecisao = "Estoque suficiente para cobrir o horizonte planejado";
    let quantidadeTransferenciaSugerida = 0;

    if (isZumbi) {
      sugestaoFinalCompra = 0;
      statusSugestao = "TRAVADO_MARCA_ZUMBI";
      motivoDecisao = "TRAVA MARCA ZUMBI: Saldo em estoque sem vendas nos últimos 180 dias";
    } else if (melhorOrigemTransferencia && melhorOrigemTransferencia.quantidade >= necessidadeCompra) {
      quantidadeTransferenciaSugerida = melhorOrigemTransferencia.quantidade;
      sugestaoFinalCompra = 0;
      statusSugestao = "COBERTO_POR_TRANSFERENCIA";
      motivoDecisao = `Atendido por transferência segura de ${melhorOrigemTransferencia.nomeFilial} (Sobra Real: ${melhorOrigemTransferencia.sobraReal} un)`;
    } else {
      const necessidadeAposTransferencia = melhorOrigemTransferencia
        ? necessidadeCompra - melhorOrigemTransferencia.quantidade
        : necessidadeCompra;

      if (melhorOrigemTransferencia) {
        quantidadeTransferenciaSugerida = melhorOrigemTransferencia.quantidade;
      }

      if (necessidadeAposTransferencia > 0) {
        const ajuste = ajustarQuantidadePorLote({
          quantidadeDesejada: necessidadeAposTransferencia,
          multiploLote: loteMultiplo,
          embalagemMinima,
        });
        sugestaoFinalCompra = ajuste.quantidadeAjustada;
        statusSugestao = "APROVADO_COMPRA";
        motivoDecisao = `Demanda calculada: ${necessidadeAposTransferencia} un (Ajustado p/ múltiplo ${loteMultiplo}: ${sugestaoFinalCompra} un)`;
      } else {
        sugestaoFinalCompra = 0;
        statusSugestao = "ESTOQUE_SUFICIENTE";
        motivoDecisao = "Estoque e pedidos em aberto cobrem a demanda planejada";
      }
    }

    const entradasHoje = mapaEntradasHoje.get(p.id) ?? [];
    const similares = carga.similares.get(p.id) ?? [];

    // Cálculo das métricas das 29 colunas fiéis
    const dtUltVenda = p.dataUltimaVenda ?? null;
    const dtUltimaCompra = p.dataUltimaCompra ?? null;

    let diasSemVenda: number | null = null;
    if (dtUltVenda) {
      const ms = Date.now() - new Date(dtUltVenda).getTime();
      diasSemVenda = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
    } else if (vendas90d === 0) {
      diasSemVenda = 180;
    }

    const giroUltimaVenda =
      diasSemVenda === null
        ? "Sem venda"
        : diasSemVenda <= 30
        ? "Alta"
        : diasSemVenda <= 90
        ? "Média"
        : "Baixa";

    const consumoMensal = +(cmd90d * 30).toFixed(2);
    const vendaACadaDias = cmd90d > 0 ? +(1 / cmd90d).toFixed(1) : null;
    const classificacaoConsumo = vendas90d >= 30 ? "Alto" : vendas90d >= 10 ? "Médio" : "Baixo";
    const periodoIdeal = curvaAbc === "A" ? "30 dias" : curvaAbc === "B" ? "90 dias" : "180 dias";
    const histVendas90d = Math.max(0, Math.round(notasLiquidas90d * 0.95));
    const histProdVend90d = Math.max(0, Math.round(vendas90d * 0.95));

    const statusMovimentacao =
      statusSugestao === "APROVADO_COMPRA"
        ? "Comprar"
        : statusSugestao === "COBERTO_POR_TRANSFERENCIA"
        ? "Transferir"
        : statusSugestao === "TRAVADO_MARCA_ZUMBI"
        ? "Marca Zumbi"
        : "Estoque OK";

    linhas.push({
      produtoId: p.id,
      codigoSku: p.codigoSku,
      descricao: p.descricao,
      marca: p.marca,
      fabricante: p.fabricante,
      referenciaFabricante: p.referenciaFabricante,
      aplicacaoVeicular: p.aplicacaoVeicular,
      secaoId: p.secaoId ?? undefined,
      secaoNome: p.nomeSecao,
      fornecedorId: p.fornecedorId,
      nomeFornecedor: p.nomeFornecedor,
      precoCusto: p.precoCusto,
      precoVenda: p.precoVenda,
      curvaAbc,
      perfilGiro,

      // Ruptura
      rupturaDiasAnalisados: diasAnalisados,
      rupturaDiasZerados: diasZerados,
      rupturaPercentual,
      classificacaoRuptura,
      dataUltimoZeramento: null,
      vendaPerdidaEstimadaReais: vendaPerdidaEstimada,

      // Frequência
      notasVenda90d,
      notasDevolucao90d,
      notasLiquidas90d,
      frequenciaPercentual90d,
      classificacaoFrequencia,
      totalPecasVendidas90d: vendas90d,
      extratoFrequencia90d: [],

      // Coberturas Comparativas
      vendasLiquidas30d: vendas30d,
      consumoMedioDiario30d: cmd30d,
      diasCobertura30d: cob30d,
      vendasLiquidas90d: vendas90d,
      consumoMedioDiario90d: cmd90d,
      diasCobertura90d: cob90d,
      vendasLiquidas180d: vendas180d,
      consumoMedioDiario180d: cmd180d,
      diasCobertura180d: cob180d,
      tendenciaCobertura,
      isMarcaZumbi: isZumbi,

      // Estoques
      filialFocoId,
      filialFocoNome: nomeFilialFoco,
      estoqueLojaFoco: saldoFoco,
      estoqueMinimoLojaFoco: minStockFoco,
      quantidadeJaPedidaFoco: pedidosFoco,
      estoqueOutrasLojasRede: saldoOutrasLojas,

      // Sugestão e Decisão
      sugestaoFinalCompra,
      statusSugestao,
      motivoDecisao,

      // Ajustes e Múltiplos
      loteMultiplo,
      embalagemMinima,
      pedidoCustom: sugestaoFinalCompra,
      transferenciaCustom: quantidadeTransferenciaSugerida,

      // Transferência
      filialOrigemTransferenciaId: melhorOrigemTransferencia?.filialId ?? null,
      filialOrigemTransferenciaNome: melhorOrigemTransferencia?.nomeFilial ?? null,
      saldoOrigemTransferencia: melhorOrigemTransferencia?.saldoOrigem ?? 0,
      estoqueMinimoOrigemTransferencia: melhorOrigemTransferencia?.minStockOrigem ?? 0,
      sobraRealOrigemTransferencia: melhorOrigemTransferencia?.sobraReal ?? 0,
      necessidadeDestinoTransferencia: necessidadeCompra,
      quantidadeTransferenciaSugerida,

      // Relacionados
      similares,
      entradasHoje,

      // Propriedades Diretas das 29 Colunas da Grade
      selecionado: false,
      codigo: p.codigoSku,
      aplicacao: p.aplicacaoVeicular ?? "—",
      refFabricante: p.referenciaFabricante ?? "—",
      custo: p.precoCusto,
      dtUltVenda,
      dtUltimaCompra,
      curvaAbcSistema: curvaAbc,
      produtosVend90d: vendas90d,
      consumoDiario: cmd90d,
      consumoMensal,
      vendaACadaDias,
      consumoUltimos30DiasQtd: vendas30d,
      consumoUltimos30DiasDetalhes: [],
      giroUltimaVenda,
      frequencia: classificacaoFrequencia,
      classificacaoConsumo,
      ruptura: classificacaoRuptura,
      periodoIdeal,
      histVendas90d,
      histProdVend90d,
      diasSemVenda,
      estoqueRede: saldoOutrasLojas,
      statusMovimentacao,
      sugestaoCompra: sugestaoFinalCompra,
      sugestaoTransferencia: quantidadeTransferenciaSugerida,
      temSimilarComEstoque: similares.length > 0,
      exigeMultiploEmbalagem: loteMultiplo > 1,
    });
  }

  return linhas;
}

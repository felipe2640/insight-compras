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
import {
  LinhaCockpitMatriz,
  SeveridadeRuptura,
  ClassificacaoFrequencia,
  TendenciaCobertura,
} from "@/tipos/cockpit";
import {
  ajustarQuantidadePorLote,
  aplicarTravaMarcaZumbi,
} from "@core/travas";
import {
  calcularNecessidadeItem,
  PARAMETROS_MOTOR_PADRAO,
  ParametrosMotorCompra,
} from "@core/calculo/necessidade";
import { calcularConsumoDiario, classificarPerfilGiro } from "@core/calculo/demanda-diaria";
import { calcularCurvaAbc } from "@core/calculo/curva-abc";
import { StatusSugestao, CurvaABC, campoHistoricoDisponivel, campoEstoqueDisponivel } from "@core/dominio";

export interface OpcoesGeracaoMatriz {
  readonly filialFocoId?: number;
  readonly leadTimePadraoDias?: number;
  /**
   * Parâmetros calibrados do tenant. A LÓGICA é a mesma para todo cliente;
   * só estes VALORES mudam. Sem isso, cai no baseline não calibrado.
   */
  readonly parametrosMotor?: ParametrosMotorCompra;
  /**
   * Nomes das filiais do tenant. Injetado pelo chamador para que esta camada
   * não dependa de nenhum adapter de cliente específico.
   */
  readonly nomesFiliais?: Readonly<Record<number, string>>;
}

/**
 * Classificação de consumo por quantidade vendida na janela de 90 dias.
 * Faixas homologadas no sistema legado (`classifyConsumptionByQuantity`):
 * < 30 => Baixa; >= 100 => Alta; caso contrário Média.
 */
function classificarConsumoPorQuantidade(qtdVendida90d: number): ClassificacaoFrequencia {
  if (!Number.isFinite(qtdVendida90d) || qtdVendida90d < 30) return "Baixa";
  if (qtdVendida90d >= 100) return "Alta";
  return "Média";
}

/**
 * Período ideal de análise, derivado da CLASSIFICAÇÃO DE FREQUÊNCIA
 * (não da curva ABC). Rótulos homologados em `getIdealAnalysisPeriod`.
 */
function obterPeriodoIdealAnalise(classificacao: ClassificacaoFrequencia): string {
  if (classificacao === "Alta") return "30 dias";
  if (classificacao === "Média") return "60 a 90 dias";
  return "120 a 180 dias";
}

/**
 * Giro por dias sem venda. Sem data de última venda a resposta é
 * "Sem histórico" — nunca um número inventado.
 */
function classificarGiroPorDiasSemVenda(
  diasSemVenda: number | null
): "Alta" | "Média" | "Baixa" | "Sem histórico" {
  if (diasSemVenda === null) return "Sem histórico";
  if (diasSemVenda <= 30) return "Alta";
  if (diasSemVenda <= 90) return "Média";
  return "Baixa";
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
  const parametrosMotor = opcoes.parametrosMotor ?? PARAMETROS_MOTOR_PADRAO;
  const nomesFiliais = opcoes.nomesFiliais ?? {};
  const nomeFilialFoco = nomesFiliais[filialFocoId] ?? `Loja ${filialFocoId}`;

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

    // Pedidos em aberto: distinguir "medido e igual a zero" de "não medido".
    // Quando a fonte não expõe, o cockpit mostra "—" e o motor não desconta nada
    // (comportamento conservador: pode sobrecomprar, mas nunca deixa de repor).
    const pedidosMedidos = campoEstoqueDisponivel(estFoco, "quantidadeJaPedida");
    const pedidosFoco = pedidosMedidos ? estFoco?.quantidadeJaPedida ?? 0 : null;

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
    const diasObservados = histFoco?.diasObservados ?? 180;
    const notasVenda90d = histFoco?.notasFiscaisVenda90dias ?? 0;
    const notasDevolucao90d = histFoco?.notasFiscaisDevolucao90dias ?? 0;
    const mesesAtivos = histFoco?.mesesAtivos12meses ?? 0;
    const medianaLinha = histFoco?.medianaLinhaVenda ?? 0;

    // Taxa diária com denominador FIXO de 180 dias (igual ao backtest).
    const cmdDiario = calcularConsumoDiario({
      vendasLiquidasJanela: vendas180d,
      diasJanela: 180,
    });

    // Cada janela usa o SEU próprio denominador. Antes a coluna "90d" recebia a
    // taxa de 180 dias, o que fazia rótulo e conteúdo discordarem.
    const cmd30d = vendas30d > 0 ? +(vendas30d / 30).toFixed(4) : 0;
    const cmd90d = vendas90d > 0 ? +(vendas90d / 90).toFixed(4) : 0;
    const cmd180d = vendas180d > 0 ? +(vendas180d / 180).toFixed(4) : 0;

    // Cobertura em dias. Sem consumo não existe cobertura calculável: null, não 999.
    const cob30d = cmd30d > 0 ? Math.round(saldoFoco / cmd30d) : null;
    const cob90d = cmd90d > 0 ? Math.round(saldoFoco / cmd90d) : null;
    const cob180d = cmd180d > 0 ? Math.round(saldoFoco / cmd180d) : null;

    // Perfil de giro pela taxa de 180d + recorrência (notas distintas E meses ativos).
    const perfilGiro = classificarPerfilGiro(
      cmdDiario,
      notasVenda90d,
      mesesAtivos,
      parametrosMotor.elegibilidade
    );
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

    // Diagnóstico de Ruptura.
    // Só é calculado se a fonte REALMENTE mediu os dias de saldo zerado.
    // Não medido => null e "Sem histórico". Preencher com 0 aqui faria todo SKU
    // aparecer com 0% de ruptura e classificação "Boa", que é uma afirmação falsa.
    const rupturaMedida = campoHistoricoDisponivel(histFoco, "diasRuptura90dias");
    const diasAnalisados = rupturaMedida ? diasObservados : null;
    const diasZerados = rupturaMedida ? histFoco?.diasRuptura90dias ?? 0 : null;

    const rupturaPercentual =
      rupturaMedida && diasAnalisados && diasAnalisados > 0 && diasZerados !== null
        ? +((diasZerados / diasAnalisados) * 100).toFixed(1)
        : null;

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

    const vendaPerdidaEstimada =
      diasZerados !== null && diasZerados > 0 && cmd90d > 0
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

    // Lote/múltiplo: o adapter já resolveu a precedência (ERP > histograma > vocabulário).
    const loteMultiplo = p.loteMultiplo > 1 ? p.loteMultiplo : 1;
    const embalagemMinima = 1;

    // Cálculo da necessidade com os parâmetros CALIBRADOS do tenant.
    const resultadoNecessidade = calcularNecessidadeItem({
      consumoDiario: cmdDiario,
      perfilGiro,
      saldoFisico: saldoFoco,
      estoqueMinimoCadastrado: minStockFoco,
      medianaLinhaVenda: medianaLinha,
      quantidadeJaPedida: pedidosFoco ?? 0,
      loteMultiplo,
      parametrosMotor,
      leadTimeDias,
      // Régua de governança do processo de compra do próprio cliente.
      sinalGovernanca: estFoco?.sinalGovernancaCompra ?? null,
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
              nomeFilial: nomesFiliais[est.filialId] ?? `Loja ${est.filialId}`,
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

    const sinalGov = estFoco?.sinalGovernancaCompra ?? null;
    const cortadoPorGovernanca =
      resultadoNecessidade.necessidadeAntesGovernanca > resultadoNecessidade.necessidadeLiquida;

    if (isZumbi) {
      sugestaoFinalCompra = 0;
      statusSugestao = "TRAVADO_MARCA_ZUMBI";
      motivoDecisao = "TRAVA MARCA ZUMBI: Saldo em estoque sem vendas nos últimos 180 dias";
    } else if (sinalGov === "PAUSAR" && resultadoNecessidade.necessidadeAntesGovernanca > 0) {
      sugestaoFinalCompra = 0;
      statusSugestao = "ESTOQUE_SUFICIENTE";
      motivoDecisao =
        `GOVERNANÇA DO CLIENTE: compra pausada para este item (demanda calculada era ` +
        `${resultadoNecessidade.necessidadeAntesGovernanca} un). Origem: Decisão de Compra do Power BI.`;
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

    // Dias sem venda: preferir o valor medido pelo ERP; senão derivar da data.
    // Sem nenhuma das duas fontes o valor é null — nunca 180 chutado.
    let diasSemVenda: number | null = estFoco?.diasSemVenda ?? null;
    if (diasSemVenda === null && dtUltVenda) {
      const ms = Date.now() - new Date(dtUltVenda).getTime();
      const calculado = Math.floor(ms / (1000 * 60 * 60 * 24));
      diasSemVenda = Number.isFinite(calculado) ? Math.max(0, calculado) : null;
    }

    const giroUltimaVenda = classificarGiroPorDiasSemVenda(diasSemVenda);

    const consumoMensal = +(cmdDiario * 30).toFixed(2);
    const vendaACadaDias = cmdDiario > 0 ? +(1 / cmdDiario).toFixed(1) : null;
    const classificacaoConsumo = classificarConsumoPorQuantidade(vendas90d);
    const periodoIdeal = obterPeriodoIdealAnalise(classificacaoFrequencia);

    // Estas duas colunas exigem a janela de 90 dias ANTERIOR à última venda do item,
    // que o modelo semântico não expõe. Antes eram preenchidas com `valor * 0,95`,
    // um número inventado. Sem a consulta, o cockpit mostra "—".
    const histVendas90d: number | null = null;
    const histProdVend90d: number | null = null;

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
      consumoDiario: cmdDiario,
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

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
  aplicarGovernancaCompra,
  PARAMETROS_MOTOR_PADRAO,
  ParametrosMotorCompra,
  PrevisaoDemandaIaCalculo,
  ResultadoCalculoNecessidade,
} from "@core/calculo/necessidade";
import {
  calcularBalanceamentoRede,
  SaldoFilialParaTransferencia,
} from "@core/transferencia/balanceamento";
import { Produto } from "@core/dominio";
import { EstoqueFilial } from "@core/dominio/estoque";
import { calcularConsumoDiario, classificarPerfilGiro } from "@core/calculo/demanda-diaria";
import { calcularCurvaAbc } from "@core/calculo/curva-abc";
import { StatusSugestao, CurvaABC, campoHistoricoDisponivel, campoEstoqueDisponivel } from "@core/dominio";
import { PrevisaoDemandaIaItem } from "@/lib/previsao-ia/repositorio-previsao-ia";
import { avaliarVigenciaPrevisao } from "@/lib/previsao-ia/vigencia-previsao";

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
  /**
   * Mapa de projeções probabilísticas de demanda por Inteligência Artificial (Chronos-Bolt)
   * indexadas por `${produtoId}:${filialId}`.
   */
  readonly mapaPrevisoesIa?: ReadonlyMap<string, PrevisaoDemandaIaItem>;
}

/**
 * Classificação de consumo por quantidade vendida na janela de 90 dias.
 * Faixas homologadas no sistema legado (`classifyConsumptionByQuantity`):
 * < 30 => Baixa; >= 100 => Alta; caso contrário Média.
 */
function classificarConsumoPorQuantidade(qtdVendida90d: number | null): ClassificacaoFrequencia {
  if (qtdVendida90d === null || qtdVendida90d === undefined) return "Sem histórico";
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
  if (classificacao === "Baixa") return "120 a 180 dias";
  return "—";
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
 * Projeção de IA utilizável para um item numa filial, ou null.
 *
 * Duas travas antes de o número chegar ao motor:
 * 1. A projeção é sempre da MESMA filial — demanda de uma loja não responde por
 *    outra, e o mapa vem indexado por `produtoId:filialId`.
 * 2. A projeção precisa estar vigente: fresca, ou antiga com o item parado de um
 *    jeito compatível com o que o modelo projetou (ver `vigencia-previsao.ts`).
 *    Vencida, o item cai no motor analítico, que lê 180 dias de histórico.
 */
function resolverPrevisaoIa(
  mapaPrevisoesIa: ReadonlyMap<string, PrevisaoDemandaIaItem> | undefined,
  chave: string,
  est: EstoqueFilial | undefined,
  agora: Date = new Date()
): PrevisaoDemandaIaCalculo | null {
  const itemIa = mapaPrevisoesIa?.get(chave);
  if (!itemIa || itemIa.demandaP80 <= 0) return null;

  const vigencia = avaliarVigenciaPrevisao(itemIa, est?.diasSemVenda ?? null, agora);
  if (!vigencia.vigente) return null;

  return {
    demandaP50: itemIa.demandaP50,
    demandaP80: itemIa.demandaP80,
    // O motor reescala o total do modelo para o horizonte do perfil de giro.
    horizonteDiasPrevisao: itemIa.horizonteDias,
    modelo: itemIa.modeloUtilizado,
  };
}

/**
 * Calcula a necessidade de um produto em UMA loja qualquer, com a mesma régua
 * usada para a loja em foco. Serve ao balanceamento de rede: para decidir quem
 * doa e quem recebe, todas as lojas precisam ser avaliadas pela mesma lógica.
 *
 * Devolve null quando a loja não tem posição nem histórico para o item.
 */
function calcularNecessidadeLoja(
  p: Produto,
  filialId: number,
  carga: RespostaCargaInventario,
  parametrosMotor: ParametrosMotorCompra,
  leadTimeDias: number,
  mapaPrevisoesIa?: ReadonlyMap<string, PrevisaoDemandaIaItem>
): ResultadoCalculoNecessidade | null {
  const chave = `${p.id}:${filialId}`;
  const est = carga.estoques.get(chave);
  const hist = carga.historicos.get(chave);
  if (!est && !hist) return null;

  const previsaoDemandaIA = resolverPrevisaoIa(mapaPrevisoesIa, chave, est);

  const cmd = calcularConsumoDiario({
    vendasLiquidasJanela: hist?.vendasLiquidas180dias ?? 0,
    diasJanela: 180,
  });
  const perfil = classificarPerfilGiro(
    cmd,
    hist?.notasFiscaisVenda12meses ?? hist?.notasFiscaisVenda90dias ?? 0,
    hist?.mesesAtivos12meses ?? 0,
    parametrosMotor.elegibilidade
  );
  const pedidosMedidos = campoEstoqueDisponivel(est, "quantidadeJaPedida");

  const loteDetectado = hist?.loteDetectadoHistograma ?? 1;
  const loteMultiplo = p.loteMultiplo > 1 ? p.loteMultiplo : (loteDetectado > 1 ? loteDetectado : 1);

  return calcularNecessidadeItem({
    consumoDiario: cmd,
    perfilGiro: perfil,
    saldoFisico: est?.saldoFisico ?? 0,
    estoqueMinimoCadastrado: est?.estoqueMinimoSeguranca ?? 0,
    medianaLinhaVenda: hist?.medianaLinhaVenda ?? 0,
    quantidadeJaPedida: pedidosMedidos ? est?.quantidadeJaPedida ?? 0 : 0,
    loteMultiplo,
    parametrosMotor,
    leadTimeDias,
    sinalGovernanca: est?.sinalGovernancaCompra ?? null,
    margemRealizada: est?.margemRealizada ?? null,
    margemAlvo: est?.margemAlvo ?? null,
    previsaoDemandaIA,
  });
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
  const mapaPrevisoesIa = opcoes.mapaPrevisoesIa;

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

  // Todas as filiais conhecidas na carga (para o balanceamento de rede).
  const todasAsFiliais = new Set<number>();
  for (const est of carga.estoques.values()) todasAsFiliais.add(est.filialId);
  for (const h of carga.historicos.values()) todasAsFiliais.add(h.filialId);

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

    // Histórico da Loja Foco: distinguir "medido e igual a zero" de "não medido".
    // Invariante 1: Zero afirma "não vendeu"; não medido diz "não sabemos" (afeta ~75% das linhas).
    const temHistoricoFoco = !!histFoco;
    const vendas30d =
      temHistoricoFoco && campoHistoricoDisponivel(histFoco, "vendasLiquidas30dias")
        ? (histFoco?.vendasLiquidas30dias ?? 0)
        : null;
    const vendas90d =
      temHistoricoFoco && campoHistoricoDisponivel(histFoco, "vendasLiquidas90dias")
        ? (histFoco?.vendasLiquidas90dias ?? 0)
        : null;
    const vendas180d =
      temHistoricoFoco && campoHistoricoDisponivel(histFoco, "vendasLiquidas180dias")
        ? (histFoco?.vendasLiquidas180dias ?? 0)
        : null;
    const diasObservados = histFoco?.diasObservados ?? 180;
    const notasVenda90d =
      temHistoricoFoco && campoHistoricoDisponivel(histFoco, "notasFiscaisVenda90dias")
        ? (histFoco?.notasFiscaisVenda90dias ?? 0)
        : null;
    const notasDevolucao90d =
      temHistoricoFoco && campoHistoricoDisponivel(histFoco, "notasFiscaisDevolucao90dias")
        ? (histFoco?.notasFiscaisDevolucao90dias ?? 0)
        : null;
    const notas12m =
      temHistoricoFoco &&
      (campoHistoricoDisponivel(histFoco, "notasFiscaisVenda12meses") ||
        campoHistoricoDisponivel(histFoco, "notasFiscaisVenda90dias"))
        ? (histFoco?.notasFiscaisVenda12meses ?? histFoco?.notasFiscaisVenda90dias ?? 0)
        : null;
    const mesesAtivos =
      temHistoricoFoco && campoHistoricoDisponivel(histFoco, "mesesAtivos12meses")
        ? (histFoco?.mesesAtivos12meses ?? 0)
        : 0;
    const medianaLinha = histFoco?.medianaLinhaVenda ?? 0;

    // Taxa diária com denominador FIXO de 180 dias (para o motor, sempre numérico).
    const cmdDiarioCalculo = temHistoricoFoco && vendas180d !== null
      ? calcularConsumoDiario({
          vendasLiquidasJanela: vendas180d,
          diasJanela: 180,
        })
      : 0;
    const cmdDiario = temHistoricoFoco ? cmdDiarioCalculo : null;

    // Cada janela usa o SEU próprio denominador. Se não medido, null (—).
    const cmd30d = temHistoricoFoco && vendas30d !== null && vendas30d > 0
      ? +(vendas30d / 30).toFixed(4)
      : temHistoricoFoco
      ? 0
      : null;
    const cmd90d = temHistoricoFoco && vendas90d !== null && vendas90d > 0
      ? +(vendas90d / 90).toFixed(4)
      : temHistoricoFoco
      ? 0
      : null;
    const cmd180d = temHistoricoFoco && vendas180d !== null && vendas180d > 0
      ? +(vendas180d / 180).toFixed(4)
      : temHistoricoFoco
      ? 0
      : null;

    // Cobertura em dias. Sem consumo não existe cobertura calculável: null, não 999.
    const cob30d = cmd30d !== null && cmd30d > 0 ? Math.round(saldoFoco / cmd30d) : null;
    const cob90d = cmd90d !== null && cmd90d > 0 ? Math.round(saldoFoco / cmd90d) : null;
    const cob180d = cmd180d !== null && cmd180d > 0 ? Math.round(saldoFoco / cmd180d) : null;

    // Perfil de giro pela taxa de 180d + recorrência (notas distintas em 12m E meses ativos).
    const perfilGiro = temHistoricoFoco
      ? classificarPerfilGiro(
          cmdDiarioCalculo,
          notas12m ?? 0,
          mesesAtivos,
          parametrosMotor.elegibilidade
        )
      : "SEM_HISTORICO_SUFICIENTE";
    const curvaAbc: CurvaABC = mapaCurvaAbc.get(p.id)?.curva ?? "C";

    // Trava de Marca Zumbi (saldo > 0 e zero vendas em 180d COMPROVADAS na loja)
    // Sem histórico na loja, não afirmamos que vendeu zero: não é zumbi.
    const checagemZumbi = temHistoricoFoco && vendas180d !== null
      ? aplicarTravaMarcaZumbi({
          saldoFisico: saldoFoco,
          vendasLiquidas180dias: vendas180d,
          sugestaoOriginal: 0,
          codigoSku: p.codigoSku,
        })
      : { sugestaoAjustada: 0, travado: false, motivo: null };
    const isZumbi = checagemZumbi.travado;

    // Tendência de Cobertura
    let tendenciaCobertura: TendenciaCobertura = "ESTAVEL";
    if (isZumbi) {
      tendenciaCobertura = "ZUMBI";
    } else if (cmd30d !== null && cmd90d !== null && cmd30d > cmd90d * 1.25 && cmd30d > 0.05) {
      tendenciaCobertura = "ALTA";
    } else if (cmd30d !== null && cmd90d !== null && cmd30d < cmd90d * 0.75) {
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
      diasZerados !== null && diasZerados > 0 && cmd90d !== null && cmd90d > 0
        ? +(diasZerados * cmd90d * p.precoVenda).toFixed(2)
        : 0;

    // Frequência por Notas em 90 dias
    const notasLiquidas90d =
      temHistoricoFoco && notasVenda90d !== null && notasDevolucao90d !== null
        ? Math.max(0, notasVenda90d - notasDevolucao90d)
        : null;
    const frequenciaPercentual90d =
      notasLiquidas90d !== null ? +((notasLiquidas90d / 90) * 100).toFixed(1) : null;

    let classificacaoFrequencia: ClassificacaoFrequencia = "Sem histórico";
    if (frequenciaPercentual90d !== null) {
      if (frequenciaPercentual90d > 40) {
        classificacaoFrequencia = "Alta";
      } else if (frequenciaPercentual90d >= 15) {
        classificacaoFrequencia = "Média";
      } else {
        classificacaoFrequencia = "Baixa";
      }
    }

    // Lote/múltiplo: o adapter já resolveu a precedência (ERP > histograma > vocabulário).
    // Se o produto tiver lote cadastrado/inferido, usamos ele; se o histórico da loja tiver
    // detecção estatística dominante, também consideramos.
    const loteMultiplo =
      p.loteMultiplo > 1
        ? p.loteMultiplo
        : histFoco?.loteDetectadoHistograma && histFoco.loteDetectadoHistograma > 1
        ? histFoco.loteDetectadoHistograma
        : 1;
    const embalagemMinima = 1;

    // Necessidade de TODAS as lojas da rede para este item, pela mesma régua.
    // Sem isso não há como saber quem doa, quem recebe e quem tem prioridade.
    const necessidadesPorLoja = new Map<number, ResultadoCalculoNecessidade>();
    for (const filialId of todasAsFiliais) {
      const r = calcularNecessidadeLoja(p, filialId, carga, parametrosMotor, leadTimeDias, mapaPrevisoesIa);
      if (r) necessidadesPorLoja.set(filialId, r);
    }

    const chaveFocoIa = `${p.id}:${filialFocoId}`;
    const previsaoDemandaIAFoco = resolverPrevisaoIa(mapaPrevisoesIa, chaveFocoIa, estFoco);
    // Só é telemetria de IA o que efetivamente entrou no cálculo: projeção
    // vencida não pode aparecer no cockpit como se tivesse sido usada.
    const itemIaFoco = previsaoDemandaIAFoco ? mapaPrevisoesIa?.get(chaveFocoIa) : undefined;

    const resultadoNecessidade =
      necessidadesPorLoja.get(filialFocoId) ??
      calcularNecessidadeItem({
        consumoDiario: cmdDiarioCalculo,
        perfilGiro,
        saldoFisico: saldoFoco,
        estoqueMinimoCadastrado: minStockFoco,
        medianaLinhaVenda: medianaLinha,
        quantidadeJaPedida: pedidosFoco ?? 0,
        loteMultiplo,
        parametrosMotor,
        leadTimeDias,
        sinalGovernanca: estFoco?.sinalGovernancaCompra ?? null,
        margemRealizada: estFoco?.margemRealizada ?? null,
        margemAlvo: estFoco?.margemAlvo ?? null,
        previsaoDemandaIA: previsaoDemandaIAFoco,
      });

    let necessidadeCompra = resultadoNecessidade.necessidadeLiquida;

    // Balanceamento de rede — as regras do diário, para 5 lojas:
    //
    // 1. Prioridade para a loja que MAIS precisa (o core ordena destinos por
    //    maior necessidade e doadoras por maior sobra).
    // 2. A doadora só doa o que excede a demanda DELA: o piso é a previsão
    //    calibrada da própria loja, não o mínimo do ERP. Loja com giro guarda o
    //    que vai vender; loja onde a peça está parada doa tudo.
    // 3. Loja que tem estoque suficiente não recebe: sua necessidade é zero.
    //
    // A necessidade usada aqui é a ANTES da governança: "não compre mais disso"
    // não impede realocar o que a rede já tem. A governança volta a atuar sobre
    // o que sobrar para comprar do fornecedor.
    const filiaisParaBalanceamento: SaldoFilialParaTransferencia[] = [];
    for (const [filialId, r] of necessidadesPorLoja) {
      const est = carga.estoques.get(`${p.id}:${filialId}`);
      filiaisParaBalanceamento.push({
        filialId,
        nomeFilial: nomesFiliais[filialId] ?? `Loja ${filialId}`,
        saldoFisico: Math.max(0, est?.saldoFisico ?? 0),
        estoqueMinimo: r.previsaoCalibrada,
        necessidadeCompra: r.necessidadeAntesGovernanca,
      });
    }

    const transferenciasRede =
      filiaisParaBalanceamento.length >= 2
        ? calcularBalanceamentoRede(filiaisParaBalanceamento, {
            produtoId: p.id,
            codigoSku: p.codigoSku,
          })
        : [];

    // O que CHEGA na loja em foco (pode vir de mais de uma doadora).
    const recebimentosFoco = transferenciasRede.filter((t) => t.filialDestinoId === filialFocoId);
    const totalRecebidoFoco = recebimentosFoco.reduce((acc, t) => acc + t.quantidadeTransferir, 0);
    const principalOrigem = [...recebimentosFoco].sort(
      (a, b) => b.quantidadeTransferir - a.quantidadeTransferir
    )[0];

    // Quando mais de uma loja doa, os números de origem são AGREGADOS: saldo,
    // piso e sobra somados. Assim a conta fecha no tooltip (saldo − mantém ≥ doa).
    // Mostrar só a doadora principal com a quantidade total dava "saldo 27,
    // mantém 7, doa 26", que não fecha e mina a confiança do comprador.
    const melhorOrigemTransferencia = principalOrigem
      ? {
          filialId: principalOrigem.filialOrigemId,
          nomeFilial:
            recebimentosFoco.length > 1
              ? recebimentosFoco.map((t) => t.nomeFilialOrigem).join(" + ")
              : principalOrigem.nomeFilialOrigem,
          saldoOrigem: recebimentosFoco.reduce((acc, t) => acc + t.saldoOrigemAntes, 0),
          minStockOrigem: recebimentosFoco.reduce((acc, t) => acc + t.estoqueMinimoOrigem, 0),
          sobraReal: recebimentosFoco.reduce(
            (acc, t) => acc + (t.saldoOrigemAntes - t.estoqueMinimoOrigem),
            0
          ),
          quantidade: totalRecebidoFoco,
        }
      : null;

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
    } else {
      // Transferência primeiro; o fornecedor só entra no que a rede não cobre.
      // A governança do cliente atua sobre esse restante, não sobre a realocação.
      const necessidadeBrutaFoco = resultadoNecessidade.necessidadeAntesGovernanca;
      const restanteAposTransferencia = Math.max(0, necessidadeBrutaFoco - totalRecebidoFoco);
      const necessidadeAposTransferencia = aplicarGovernancaCompra(
        restanteAposTransferencia,
        sinalGov,
        resultadoNecessidade.fatorReducaoAplicado
      );

      if (melhorOrigemTransferencia) {
        quantidadeTransferenciaSugerida = melhorOrigemTransferencia.quantidade;
      }

      if (melhorOrigemTransferencia && restanteAposTransferencia === 0) {
        sugestaoFinalCompra = 0;
        statusSugestao = "COBERTO_POR_TRANSFERENCIA";
        motivoDecisao = `Atendido por transferência de ${melhorOrigemTransferencia.nomeFilial}: ${totalRecebidoFoco} un (a origem mantém o que vai vender)`;
      } else if (necessidadeAposTransferencia > 0) {
        const ajuste = ajustarQuantidadePorLote({
          quantidadeDesejada: necessidadeAposTransferencia,
          multiploLote: loteMultiplo,
          embalagemMinima,
        });
        sugestaoFinalCompra = ajuste.quantidadeAjustada;
        statusSugestao = "APROVADO_COMPRA";
        const rotuloDemanda =
          resultadoNecessidade.origemPrevisao === "IA" && itemIaFoco
            ? // Sem o nome do modelo, como o cockpit passou a exibir. Mas COM o
              // período: a faixa é um total de N dias, e sem isso o comprador lê
              // que a sugestão deveria ser igual a ela.
              `Demanda prevista (faixa conservadora: ${itemIaFoco.demandaP80} un/${itemIaFoco.horizonteDias}d): ${necessidadeAposTransferencia} un`
            : `Demanda calculada: ${necessidadeAposTransferencia} un`;
        motivoDecisao =
          totalRecebidoFoco > 0
            ? `Transferir ${totalRecebidoFoco} un de ${melhorOrigemTransferencia?.nomeFilial} e comprar ${sugestaoFinalCompra} un (múltiplo ${loteMultiplo})`
            : `${rotuloDemanda} (Ajustado p/ múltiplo ${loteMultiplo}: ${sugestaoFinalCompra} un)`;
      } else {
        sugestaoFinalCompra = 0;
        statusSugestao = "ESTOQUE_SUFICIENTE";
        motivoDecisao = "Estoque e pedidos em aberto cobrem a demanda planejada";
      }
    }

    const entradasHoje = mapaEntradasHoje.get(p.id) ?? [];
    const similaresBase =
      carga.similares instanceof Map || typeof (carga.similares as any)?.get === "function"
        ? (carga.similares.get(p.id) ?? [])
        : [];
    const similares = similaresBase.map((similar) => {
      const chaveSimilarFoco = `${similar.produtoIdSimilar}:${filialFocoId}`;
      const estoqueSimilarFoco = carga.estoques.get(chaveSimilarFoco);
      const historicoSimilarFoco = carga.historicos.get(chaveSimilarFoco);
      return {
        ...similar,
        saldoFisicoLojaAvaliacao: estoqueSimilarFoco?.saldoFisico ?? null,
        vendasLojaAvaliacao30dias:
          historicoSimilarFoco && campoHistoricoDisponivel(historicoSimilarFoco, "vendasLiquidas30dias")
            ? historicoSimilarFoco.vendasLiquidas30dias
            : null,
        vendasLojaAvaliacao60dias:
          historicoSimilarFoco && campoHistoricoDisponivel(historicoSimilarFoco, "vendasLiquidas60dias")
            ? historicoSimilarFoco.vendasLiquidas60dias ?? null
            : null,
        vendasLojaAvaliacao90dias:
          historicoSimilarFoco && campoHistoricoDisponivel(historicoSimilarFoco, "vendasLiquidas90dias")
            ? historicoSimilarFoco.vendasLiquidas90dias
            : null,
      };
    });

    // Sugestão de Compra ativa do ERP para a loja em foco (operação em paralelo)
    const chaveSugestaoErp = `${p.id}:${filialFocoId}`;
    const sugestaoErpItem = carga.sugestoesErp?.get(chaveSugestaoErp);
    let sugestaoQtdErp: number | null = null;
    let temSugestaoErp = false;
    const origemSugestaoErp = sugestaoErpItem?.origem ?? null;
    const dataSugestaoErp = sugestaoErpItem?.dataSugestao ?? null;

    if (sugestaoErpItem && (sugestaoErpItem.quantidadeSugerida ?? 0) > 0) {
      temSugestaoErp = true;
      // Regra de negócio informada pelo cliente: a sugestão do ERP deve respeitar
      // a quantidade mínima registrada do item (estoque mínimo cadastrado na filial,
      // ou lote múltiplo/mínimo do item), ajustada para o lote de fábrica.
      const quantidadeMinimaRegistrada = minStockFoco > 0 ? minStockFoco : loteMultiplo;
      const quantidadeBaseErp = Math.max(
        sugestaoErpItem.quantidadeSugerida,
        quantidadeMinimaRegistrada
      );
      const ajusteErp = ajustarQuantidadePorLote({
        quantidadeDesejada: quantidadeBaseErp,
        multiploLote: loteMultiplo,
        embalagemMinima,
      });
      sugestaoQtdErp = ajusteErp.quantidadeAjustada;
    }

    // Se houver solicitação ativa do ERP e não houver trava zumbi nem pausa de governança,
    // preenche a sugestão final de compra e o pedido com a quantidade mínima ajustada.
    if (temSugestaoErp && sugestaoQtdErp && sugestaoQtdErp > 0) {
      if (statusSugestao === "ESTOQUE_SUFICIENTE" && !isZumbi && sinalGov !== "PAUSAR") {
        sugestaoFinalCompra = sugestaoQtdErp;
        motivoDecisao = `Solicitação ativa do ERP atendida pela quantidade mínima registrada (${sugestaoQtdErp} un)`;
      } else if (statusSugestao === "APROVADO_COMPRA") {
        sugestaoFinalCompra = Math.max(sugestaoFinalCompra, sugestaoQtdErp);
      }
    }

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

    const consumoMensal = cmdDiario !== null ? +(cmdDiario * 30).toFixed(2) : null;
    const vendaACadaDias = cmdDiario !== null && cmdDiario > 0 ? +(1 / cmdDiario).toFixed(1) : null;
    const classificacaoConsumo = classificarConsumoPorQuantidade(vendas90d);
    const periodoIdeal = obterPeriodoIdealAnalise(classificacaoFrequencia);

    // Janela ANTERIOR de 90 dias (de 180 a 90 dias atrás), que é o termo de
    // comparação: "vendeu 12 agora contra 30 antes" conta uma história que "12"
    // sozinho não conta. Sai de 180d menos 90d, sem consulta nova.
    //
    // Se não há histórico na loja em foco, o valor é não medido (null/—),
    // respeitando a Invariante 1 (zero não é o mesmo que não medido).
    const notas180d = histFoco?.notasFiscaisVenda180dias;
    const histVendas90d: number | null =
      temHistoricoFoco && vendas180d !== null && vendas90d !== null
        ? Math.max(0, vendas180d - vendas90d)
        : null;
    const histProdVend90d: number | null =
      temHistoricoFoco && notas180d !== undefined && notasVenda90d !== null
        ? Math.max(0, notas180d - notasVenda90d)
        : null;

    const statusMovimentacao =
      statusSugestao === "APROVADO_COMPRA"
        ? "Comprar"
        : statusSugestao === "COBERTO_POR_TRANSFERENCIA"
        ? "Transferir"
        : statusSugestao === "TRAVADO_MARCA_ZUMBI"
        ? "Marca Zumbi"
        : temSugestaoErp
        ? "Sugestão ERP"
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
      subgrupo: p.subgrupoNome ?? null,
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
      dataUltimoZeramento: rupturaMedida ? histFoco?.dataUltimoZeramento ?? null : null,
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
      previsaoBrutaModelo: resultadoNecessidade.previsaoBruta,
      horizonteDiasAplicado: resultadoNecessidade.horizonteDias,
      margemSegurancaAplicada: resultadoNecessidade.margemSeguranca,
      fatorCalibracaoAplicado: resultadoNecessidade.fatorCalibracao,
      origemPrevisao: resultadoNecessidade.origemPrevisao,
      previsaoIaP50: itemIaFoco?.demandaP50 ?? null,
      previsaoIaP80: itemIaFoco?.demandaP80 ?? null,
      previsaoIaHorizonteDias: itemIaFoco?.horizonteDias ?? null,
      motivoInelegibilidade:
        perfilGiro === "SEM_HISTORICO_SUFICIENTE"
          ? temHistoricoFoco
            ? `Sem recorrência: ${notas12m ?? 0} nota(s) em 12m e ${mesesAtivos} mês(es) com venda (mínimo ${parametrosMotor.elegibilidade.minimoNotasDistintas} e ${parametrosMotor.elegibilidade.minimoMesesAtivos})`
            : "Sem histórico de vendas registrado na loja em foco"
          : null,

      // Ajustes e Múltiplos
      loteMultiplo,
      origemLoteMultiplo: p.origemLoteMultiplo,
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
      dtUltimoPedido: p.dataUltimoPedido ?? null,
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
      sugestaoQtdErp,
      temSugestaoErp,
      origemSugestaoErp,
      dataSugestaoErp,
      // COM ESTOQUE, não "existe similar cadastrado". A linha roxa manda o
      // comprador conferir antes de comprar porque há equivalente disponível na
      // rede; se todos estão zerados, não há nada para conferir e o aviso vira
      // ruído que ensina a ignorar a cor.
      temSimilarComEstoque: similares.some((s) => s.saldoFisicoDisponivelRede > 0),
      exigeMultiploEmbalagem: loteMultiplo > 1,
    });
  }

  return linhas;
}

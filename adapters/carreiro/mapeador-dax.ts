/**
 * Mapeador e Normalizador de Dados do DAX Power BI Fabric
 * Camada: Adapters / Carreiro
 * 100% em Português do Brasil (pt-BR).
 *
 * Converte payloads tabulares brutos do Power BI Fabric REST API para
 * os modelos e entidades de domínio estritos e imutáveis do Core.
 */

import {
  Produto,
  EstoqueFilial,
  HistoricoVendasFilial,
  SinalGovernancaCompra,
} from "@core/dominio";
import { inferirLotePadraoPorCategoria } from "../comum/lote-autopecas";
import { agruparMovimentosPorDia, calcularDiasEmRuptura } from "@core/calculo/ruptura";
import { DIAS_JANELA_RUPTURA } from "./consultas-homologadas";
import {
  EntradaNFeDoDia,
  ItemSimilarIntercambiavel,
} from "../AdaptadorInventario";
import { normalizarLinhaDax } from "./cliente-dax";

/**
 * Nomes e códigos oficiais das filiais da Rede Carreiro mapeados no M0.
 */
export const NOMES_FILIAIS_CARREIRO: Readonly<Record<number, string>> = {
  1: "Carreiro Pedro II (Matriz)",
  2: "Melo / Piripiri",
  3: "Carreiro Poranga",
  4: "Ceará Auto Peças (Campo Maior)",
  5: "Carreiro José de Freitas",
};

/**
 * Nome EXATO de cada filial na tabela CADEMP do modelo semântico.
 *
 * Difere do rótulo de exibição em `NOMES_FILIAIS_CARREIRO`: as consultas que
 * filtram por loja precisam do valor literal de 'CADEMP'[ANOMEFANTASIA],
 * conferido ao vivo em 07/09/2026.
 */
export const NOMES_CADEMP_CARREIRO: Readonly<Record<number, string>> = {
  1: "CARREIRO PEDRO II",
  2: "MELO DISTRIBUIDORA",
  3: "CARREIRO PORANGA",
  4: "CEARA AUTO PECAS CAMPO MAIOR",
  5: "CARREIRO JOSE DE FREITAS",
};

/**
 * Identifica o código inteiro (1 a 5) e o nome oficial da filial a partir
 * de GUIDs do CADEMP, códigos numéricos ou strings de nome.
 */
export function mapearFilialCarreiro(valor: unknown): { filialId: number; nomeFilial: string } {
  if (typeof valor === "number") {
    const id = Math.floor(valor);
    if (id >= 1 && id <= 5) {
      return { filialId: id, nomeFilial: NOMES_FILIAIS_CARREIRO[id] };
    }
  }

  const texto = String(valor ?? "").trim();

  // Mapeamento por GUIDs oficiais do CADEMP auditados no M0
  if (texto.includes("e2adc241") || texto === "1" || /pedro\s*ii/i.test(texto) || /matriz/i.test(texto)) {
    return { filialId: 1, nomeFilial: NOMES_FILIAIS_CARREIRO[1] };
  }
  if (texto.includes("cd87703f") || texto === "2" || /piripiri|melo/i.test(texto)) {
    return { filialId: 2, nomeFilial: NOMES_FILIAIS_CARREIRO[2] };
  }
  if (texto.includes("a5172ddc") || texto === "3" || /poranga/i.test(texto)) {
    return { filialId: 3, nomeFilial: NOMES_FILIAIS_CARREIRO[3] };
  }
  if (texto.includes("c9432abf") || texto === "4" || /campo\s*maior|cear[aá]/i.test(texto)) {
    return { filialId: 4, nomeFilial: NOMES_FILIAIS_CARREIRO[4] };
  }
  if (texto.includes("d624d502") || texto === "5" || /jos[eé]\s*de\s*freitas/i.test(texto)) {
    return { filialId: 5, nomeFilial: NOMES_FILIAIS_CARREIRO[5] };
  }

  // Fallback numérico
  const numeroExtraido = parseInt(texto, 10);
  if (!isNaN(numeroExtraido) && numeroExtraido >= 1 && numeroExtraido <= 5) {
    return { filialId: numeroExtraido, nomeFilial: NOMES_FILIAIS_CARREIRO[numeroExtraido] };
  }

  return { filialId: 1, nomeFilial: NOMES_FILIAIS_CARREIRO[1] };
}

/**
 * Extrai o ID numérico do produto de forma resiliente, suportando chaves compostas
 * do Power BI como "000001|a5172ddc-0dd0-4f8e-bb0d-5018183d4457", inteiros puros ou strings.
 */
export function extrairIdProduto(valor: unknown): number {
  if (typeof valor === "number") {
    return isNaN(valor) ? 0 : Math.floor(valor);
  }
  const str = String(valor ?? "").trim();
  if (!str) return 0;

  const parte = str.includes("|") ? str.split("|")[0].trim() : str;
  const parsed = parseInt(parte, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Converte linhas tabulares de produtos retornadas pelo DAX para a entidade Produto.
 * Deduplica produtos que aparecem com registros em múltiplas lojas.
 */

/** Data do DAX (ISO ou Date) em ISO curta. Vazio e sentinelas viram null. */
function normalizarDataIso(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  const t = Date.parse(texto);
  if (Number.isNaN(t)) return null;
  // O ERP usa 1900-01-01 como "nunca". Uma data assim na grade seria pior do
  // que campo vazio: parece medição.
  const ano = new Date(t).getUTCFullYear();
  if (ano < 1990) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** Fica com a data mais recente entre as lojas. */
function mesclarDatasProduto(a: Produto, b: Produto): Produto {
  const maior = (x: string | null | undefined, y: string | null | undefined) =>
    !x ? (y ?? null) : !y ? x : x >= y ? x : y;
  return {
    ...b,
    dataUltimaVenda: maior(a.dataUltimaVenda, b.dataUltimaVenda),
    dataUltimaCompra: maior(a.dataUltimaCompra, b.dataUltimaCompra),
  };
}

export function mapearProdutosDax(
  linhasDax: readonly Record<string, unknown>[]
): readonly Produto[] {
  const produtosPorId = new Map<number, Produto>();

  for (const linhaBruta of linhasDax) {
    const linha = normalizarLinhaDax(linhaBruta);

    const id = extrairIdProduto(linha.Produto ?? linha.ACODPRODUTO ?? linha.id ?? 0);
    if (!id || id <= 0 || produtosPorId.has(id)) {
      continue;
    }

    const rawSku = String(linha.ACODPRODUTO ?? linha.codigoSku ?? linha.Produto ?? id).trim();
    const codigoSku = rawSku.includes("|") ? rawSku.split("|")[0].trim() : rawSku;

    const descricao = String(linha.Descricao ?? linha.ADESCRICAO ?? linha.descricao ?? "").trim();
    const marca = String(linha.Marca ?? linha.AMARCA ?? linha.marca ?? "GENERICA").trim();
    const fabricante = String(
      linha.Fabricante ?? linha.AFABRICANTE ?? linha.fabricante ?? marca ?? "GENERICO"
    ).trim();
    const refFabricante = linha.RefFabricante ?? linha.AREFFABRICA ?? linha.referenciaFabricante;
    const refStr = refFabricante !== undefined && refFabricante !== null ? String(refFabricante).trim() : null;

    const secaoVal = linha.Secao ?? linha.ASECAO ?? linha.secaoId;
    const secaoId = secaoVal !== undefined && secaoVal !== null ? Number(secaoVal) : null;
    const nomeSecao = linha.NomeSecao ?? linha.nomeSecao ? String(linha.NomeSecao ?? linha.nomeSecao).trim() : null;

    // Sub-grupo: tipo da peça. Ausente em ~12% do catálogo da Carreiro — fica
    // null e o cockpit mostra "—", nunca um rótulo inventado.
    const subVal = linha.Subgrupo ?? linha.subgrupoId;
    const subgrupoId = subVal !== undefined && subVal !== null ? Number(subVal) : null;
    const subgrupoBruto = linha.NomeSubgrupo ?? linha.subgrupoNome;
    const subgrupoNome =
      subgrupoBruto !== undefined && subgrupoBruto !== null && String(subgrupoBruto).trim() !== ""
        ? String(subgrupoBruto).trim()
        : null;

    const fornecedorVal = linha.Fornecedor ?? linha.ACODFORNECEDOR ?? linha.fornecedorId ?? 1;
    const fornecedorId = Number(fornecedorVal) || 1;
    const nomeFornecedor = String(
      linha.NomeFornecedor ?? linha.nomeFornecedor ?? `Fornecedor ${fornecedorId}`
    ).trim();

    const precoCusto = Math.max(
      0,
      Number(linha.PrecoCompraERP ?? linha.NPRECOCOMPRA ?? linha.precoCusto ?? 0)
    );
    const precoVenda = Math.max(
      precoCusto,
      Number(linha.PrecoVenda ?? linha.precoVenda ?? precoCusto * 1.5)
    );

    const aplicacao = linha.Aplicacao ?? linha.aplicacaoVeicular ? String(linha.Aplicacao ?? linha.aplicacaoVeicular).trim() : null;
    const familia = linha.FamiliaId ?? linha.familiaId ? String(linha.FamiliaId ?? linha.familiaId).trim() : null;

    // Datas de última venda/compra. Vinham na consulta de ATRIBUTOS e eram
    // descartadas aqui; quem tentava lê-las era o mapeador de estoque, e a
    // consulta de posição não traz essas colunas. Resultado: as duas colunas da
    // grade ficavam vazias em 100% dos itens.
    const ultVendaBruta = linha.UltimaVenda ?? linha.DULTIMAVENDA ?? linha.dataUltimaVenda;
    const ultCompraBruta = linha.UltimaCompra ?? linha.DULTIMACOMPRA ?? linha.dataUltimaCompra;
    const dataUltimaVenda = normalizarDataIso(ultVendaBruta);
    const dataUltimaCompra = normalizarDataIso(ultCompraBruta);

    const loteMultiplo = inferirLotePadraoPorCategoria(descricao);

    const produto: Produto = {
      id,
      codigoSku,
      descricao,
      marca,
      fabricante,
      referenciaFabricante: refStr && refStr.length > 0 ? refStr : null,
      aplicacaoVeicular: aplicacao && aplicacao.length > 0 ? aplicacao : null,
      familiaId: familia && familia.length > 0 ? familia : null,
      secaoId,
      nomeSecao,
      subgrupoId: Number.isFinite(subgrupoId as number) ? subgrupoId : null,
      subgrupoNome,
      fornecedorId,
      nomeFornecedor,
      precoCusto,
      precoVenda,
      loteMultiplo,
      dataUltimaVenda,
      dataUltimaCompra,
    };

    // O produto aparece uma vez por empresa. Para a rede, a data que interessa é
    // a MAIS RECENTE de qualquer loja: "vendeu na semana passada em Poranga" é
    // informação, "nunca vendeu na Matriz" sozinha induz a engano.
    const jaVisto = produtosPorId.get(id);
    produtosPorId.set(id, jaVisto ? mesclarDatasProduto(jaVisto, produto) : produto);
  }

  return Array.from(produtosPorId.values());
}

/**
 * Traduz o vocabulário da medida `Decisao Compra Mercadoria` do modelo da Carreiro
 * para o sinal canônico da plataforma.
 *
 * A régua (margem alvo, uso do limite de compra, histórico de margem) é do cliente
 * e vive no Power BI dele. Aqui só normalizamos o rótulo; o motor reage ao enum.
 */
function numeroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export function normalizarDecisaoCompraCarreiro(valor: unknown): SinalGovernancaCompra | null {
  const texto = String(valor ?? "").trim().toUpperCase();
  if (!texto) return null;
  if (texto.startsWith("PAUSAR")) return "PAUSAR";
  if (texto.startsWith("REDUZIR")) return "REDUZIR";
  if (texto.startsWith("MANTER")) return "MANTER";
  // "ATENCAO - ..." são avisos, não bloqueios: seguem como MANTER.
  if (texto.startsWith("ATENCAO")) return "MANTER";
  return null;
}

/**
 * Converte linhas tabulares de produtos/estoque retornadas pelo DAX para Map de EstoqueFilial.
 * Chave do Map: `${produtoId}:${filialId}`
 */
export function mapearEstoquesDax(
  linhasDax: readonly Record<string, unknown>[],
  contexto?: { filialId?: number; nomeFilial?: string }
): Map<string, EstoqueFilial> {
  const mapaEstoques = new Map<string, EstoqueFilial>();

  for (const linhaBruta of linhasDax) {
    const linha = normalizarLinhaDax(linhaBruta);

    const produtoId = extrairIdProduto(linha.Produto ?? linha.ACODPRODUTO ?? linha.id ?? 0);
    if (!produtoId || produtoId <= 0) continue;

    // A consulta de posição é paginada POR LOJA e não repete a coluna da filial em
    // cada linha, então o contexto da página é a fonte primária da filial.
    const filial =
      contexto?.filialId !== undefined
        ? {
            filialId: contexto.filialId,
            nomeFilial: contexto.nomeFilial ?? NOMES_FILIAIS_CARREIRO[contexto.filialId],
          }
        : mapearFilialCarreiro(
            linha.Empresa ?? linha.ACODEMP ?? linha.ACODEMPRESA ?? linha.ANOMEFANTASIA ?? linha.filialId ?? 1
          );

    const chave = `${produtoId}:${filial.filialId}`;

    const saldoFisico = Number(linha.EstoqueQtd ?? linha.NESTOQATUAL ?? linha.AESTOQUE_ATUAL ?? 0);
    const estoqueMinimoSeguranca = Math.max(
      0,
      Number(linha.EstoqueMinimo ?? linha.AESTOQUE_MINIMO ?? 0)
    );
    const consumoMedioDiarioErp = Math.max(
      0,
      Number(linha.ConsumoMedioDiario ?? linha.ACONSUMO_MEDIO_DIARIO ?? 0)
    );

    // [Estoque Dias sem Venda] do modelo do cliente termina em COALESCE(..., 365),
    // e [Estoque Data Referencia Idade] usa TODAY()-365 como data de fallback.
    // Ou seja: 365 é o sentinela de "não há data de referência", não uma medição.
    // Tratar como null evita classificar item sem histórico como giro "Baixa".
    const diasSemVendaBruto = linha.DiasSemVenda;
    const diasSemVendaNumero =
      diasSemVendaBruto === null || diasSemVendaBruto === undefined
        ? null
        : Math.max(0, Number(diasSemVendaBruto));
    const diasSemVenda = diasSemVendaNumero === 365 ? null : diasSemVendaNumero;

    const ultVenda = linha.UltimaVenda ?? linha.DULTIMAVENDA ?? linha.dataUltimaVenda;
    const dataUltimaVenda = ultVenda ? String(ultVenda).trim() : null;

    const ultCompra = linha.UltimaCompra ?? linha.ADATA_ULTIMA_COMPRA ?? linha.dataUltimaCompra;
    const dataUltimaCompra = ultCompra ? String(ultCompra).trim() : null;

    const estoque: EstoqueFilial = {
      filialId: filial.filialId,
      nomeFilial: filial.nomeFilial,
      produtoId,
      saldoFisico,
      estoqueMinimoSeguranca,
      // O modelo semântico da Carreiro não expõe pedido de compra em aberto de forma
      // confiável (ITEMSPEDIDO veio com merge quebrado). Zero aqui NÃO significa
      // "não há pedidos", significa "não medido" — por isso o campo é declarado
      // indisponível abaixo e o cockpit mostra "—" em vez de 0.
      quantidadeJaPedida: 0,
      consumoMedioDiarioErp,
      diasSemVenda: Number.isFinite(diasSemVenda as number) ? diasSemVenda : null,
      sinalGovernancaCompra: normalizarDecisaoCompraCarreiro(linha.DecisaoCompra),
      usoLimiteCompra:
        linha.UsoLimiteCompra === null || linha.UsoLimiteCompra === undefined
          ? null
          : Number(linha.UsoLimiteCompra),
      margemRealizada: numeroOuNulo(linha.MargemRealizada),
      margemAlvo: numeroOuNulo(linha.MargemAlvo),
      dataUltimaVenda,
      dataUltimaCompra,
      camposIndisponiveis: ["quantidadeJaPedida"],
    };

    mapaEstoques.set(chave, estoque);
  }

  return mapaEstoques;
}

/**
 * Converte linhas tabulares de vendas/histórico retornadas pelo DAX para Map de HistoricoVendasFilial.
 * Chave do Map: `${produtoId}:${filialId}`
 */
export function mapearHistoricoVendasDax(
  linhasDax: readonly Record<string, unknown>[]
): Map<string, HistoricoVendasFilial> {
  const mapaHistoricos = new Map<string, HistoricoVendasFilial>();

  for (const linhaBruta of linhasDax) {
    const linha = normalizarLinhaDax(linhaBruta);

    const produtoId = extrairIdProduto(linha.Produto ?? linha.ACODPRODUTO ?? linha.id ?? 0);
    if (!produtoId || produtoId <= 0) continue;

    const { filialId } = mapearFilialCarreiro(
      linha.Empresa ?? linha.ACODEMP ?? linha.ACODEMPRESA ?? linha.filialId ?? 1
    );

    const chave = `${produtoId}:${filialId}`;

    // Devoluções vêm da linha da nota (QTDE_DEV) e são subtraídas para obter a
    // saída LÍQUIDA, que é o insumo do motor. Antes as vendas brutas eram usadas
    // direto e a "devolução" na verdade trazia quantidade COMPRADA.
    const devolucoes90dias = Math.max(0, Number(linha.Devolucoes90d ?? 0));

    const brutas30 = Math.max(0, Number(linha.VendasQtd30d ?? linha.QtdVenda30d ?? 0));
    const brutas90 = Math.max(0, Number(linha.VendasQtd90d ?? linha.QtdVenda90d ?? 0));
    const brutas180 = Math.max(0, Number(linha.VendasQtd180d ?? linha.QtdVenda180d ?? 0));

    const vendasLiquidas90dias = Math.max(0, brutas90 - devolucoes90dias);
    // A janela de 30 dias não pode exceder a de 90 já líquida.
    const vendasLiquidas30dias = Math.min(brutas30, vendasLiquidas90dias);
    // A devolução medida é a de 90 dias; para 180 subtraímos o mesmo montante como
    // aproximação conservadora (nunca inflar a demanda).
    const vendasLiquidas180dias = Math.max(vendasLiquidas90dias, brutas180 - devolucoes90dias);

    const notasFiscaisVenda90dias = Math.max(
      0,
      Number(linha.NotasVenda90d ?? linha.QuantidadeNotas90d ?? 0)
    );
    const notasFiscaisDevolucao90dias = Math.max(
      0,
      Number(linha.NotasDevolucao90d ?? 0)
    );
    const mesesAtivos12meses = Math.max(0, Number(linha.MesesAtivos12m ?? 0));
    const medianaLinhaVenda = Math.max(0, Number(linha.MedianaLinhaVenda ?? 0));
    const diasObservados = Math.max(1, Number(linha.DiasObservados ?? 180));

    const primVenda = linha.DataPrimeiraVenda ?? linha.dataPrimeiraVendaRegistrada;
    const dataPrimeiraVendaRegistrada = primVenda ? String(primVenda).trim() : null;

    const historico: HistoricoVendasFilial = {
      produtoId,
      filialId,
      vendasLiquidas30dias,
      vendasLiquidas90dias,
      vendasLiquidas180dias,
      devolucoes90dias,
      notasFiscaisVenda90dias,
      notasFiscaisDevolucao90dias,
      mesesAtivos12meses,
      medianaLinhaVenda,
      // O modelo não tem histórico de saldo diário: ruptura NÃO é medida.
      // Zero aqui significaria "nunca faltou", que é uma afirmação falsa.
      diasRuptura90dias: 0,
      diasObservados,
      dataPrimeiraVendaRegistrada,
      camposIndisponiveis: ["diasRuptura90dias"],
    };

    mapaHistoricos.set(chave, historico);
  }

  return mapaHistoricos;
}

/**
 * Converte linhas tabulares de MOVESTOQ (entradas do dia) para lista de EntradaNFeDoDia.
 */
export function mapearEntradasNFeDax(
  linhasDax: readonly Record<string, unknown>[],
  produtosPorId?: ReadonlyMap<number, Produto>
): readonly EntradaNFeDoDia[] {
  const entradas: EntradaNFeDoDia[] = [];

  for (const linhaBruta of linhasDax) {
    const linha = normalizarLinhaDax(linhaBruta);

    const produtoId = extrairIdProduto(linha.Produto ?? linha.ACODPRODUTO ?? 0);
    if (!produtoId || produtoId <= 0) continue;

    const { filialId } = mapearFilialCarreiro(
      linha.Filial ?? linha.ACODEMPRESA ?? linha.filialId ?? 1
    );

    const produto = produtosPorId?.get(produtoId);
    const obs = String(linha.Observacao ?? linha.AOBSERVACAO ?? "").trim();
    const numeroNota = obs.length > 0 ? obs : `NF-${Math.floor(100000 + Math.random() * 900000)}`;
    const quantidadeEntrada = Math.max(1, Number(linha.Quantidade ?? linha.NQTDEMOV ?? 1));
    const precoUnitario = produto?.precoCusto ?? 50;

    entradas.push({
      numeroNotaFiscal: numeroNota,
      produtoId,
      filialId,
      fornecedorNome: produto?.nomeFornecedor ?? "Distribuidora Carreiro",
      quantidadeEntrada,
      valorEntrada: quantidadeEntrada * precoUnitario,
      dataHoraChegada: String(linha.DataHora ?? linha.DATA_HORA ?? new Date().toISOString()),
    });
  }

  return entradas;
}

/**
 * Converte pares de produtos semelhantes para mapa indexado por produtoIdOrigem.
 */
export function mapearSimilaresDax(
  linhasDax: readonly Record<string, unknown>[],
  produtosPorId: ReadonlyMap<number, Produto>,
  saldosPorProduto: ReadonlyMap<number, number>
): Map<number, readonly ItemSimilarIntercambiavel[]> {
  const mapaSimilares = new Map<number, ItemSimilarIntercambiavel[]>();

  for (const linhaBruta of linhasDax) {
    const linha = normalizarLinhaDax(linhaBruta);

    const idOrigem = extrairIdProduto(linha.ProdutoOrigem ?? linha.ACODPRODUTO ?? 0);
    const idSimilar = extrairIdProduto(linha.ProdutoSimilar ?? linha.ACODPRODUTO_SEMELHANTE ?? 0);

    if (!idOrigem || !idSimilar || idOrigem === idSimilar) continue;

    const produtoSimilar = produtosPorId.get(idSimilar);
    if (!produtoSimilar) continue;

    const saldoDisponivel = saldosPorProduto.get(idSimilar) ?? 0;

    const itemSimilar: ItemSimilarIntercambiavel = {
      produtoIdOrigem: idOrigem,
      produtoIdSimilar: idSimilar,
      codigoSkuSimilar: produtoSimilar.codigoSku,
      descricaoSimilar: produtoSimilar.descricao,
      marcaSimilar: produtoSimilar.marca,
      saldoFisicoDisponivelRede: saldoDisponivel,
    };

    // O mesmo par aparece repetido em PRODUTOS_SEMELHANTES (uma vez por empresa).
    // Sem deduplicar, o diálogo de intercambiáveis lista a mesma peça cinco
    // vezes e o comprador acha que tem cinco alternativas onde só existe uma.
    const existentes = mapaSimilares.get(idOrigem) ?? [];
    if (!existentes.some((e) => e.produtoIdSimilar === idSimilar)) {
      existentes.push(itemSimilar);
      mapaSimilares.set(idOrigem, existentes);
    }
  }

  return mapaSimilares;
}

/**
 * Preenche a ruptura dos históricos reconstruindo o saldo dia a dia.
 *
 * O ERP da Carreiro guarda o saldo ATUAL e não o histórico — a coluna
 * `ESTOQUEATUAL` de MOVESTOQ está inteiramente vazia. O que sobra são os
 * movimentos: com o saldo de hoje e eles, o passado é aritmética. A conta em si
 * mora em `core/calculo/ruptura`, sem saber de Power BI.
 *
 * Sem movimentos, NADA é preenchido: `diasRuptura90dias` continua marcado como
 * indisponível e o cockpit segue mostrando "não medido". Preencher com zero
 * afirmaria que nenhuma peça faltou no balcão, que é diferente de não saber.
 */
export function aplicarRupturaReconstruida(
  historicos: Map<string, HistoricoVendasFilial>,
  estoques: ReadonlyMap<string, EstoqueFilial>,
  linhasMovimentos: readonly Record<string, unknown>[],
  hoje: Date = new Date()
): void {
  if (linhasMovimentos.length === 0) return;

  const movimentosPorChave = new Map<string, Array<{ data: string; delta: number }>>();
  for (const linhaBruta of linhasMovimentos) {
    const linha = normalizarLinhaDax(linhaBruta);
    const produtoId = extrairIdProduto(linha.Produto ?? linha.ACODPRODUTO);
    if (!produtoId) continue;

    const delta = Number(linha.Delta ?? linha.NQTDEMOV ?? 0);
    if (!Number.isFinite(delta) || delta === 0) continue;

    const data = linha.Data ?? linha.DATA_HORA;
    if (data === null || data === undefined || data === "") continue;

    const { filialId } = mapearFilialCarreiro(linha.Empresa ?? linha.ACODEMPRESA);
    const chave = `${produtoId}:${filialId}`;
    const lista = movimentosPorChave.get(chave);
    if (lista) lista.push({ data: String(data), delta });
    else movimentosPorChave.set(chave, [{ data: String(data), delta }]);
  }

  for (const [chave, historico] of historicos) {
    const estoque = estoques.get(chave);
    // Sem posição não há de onde partir a caminhada para trás.
    if (!estoque) continue;

    const resultado = calcularDiasEmRuptura({
      saldoAtual: estoque.saldoFisico,
      movimentos: agruparMovimentosPorDia(movimentosPorChave.get(chave) ?? []),
      diasJanela: DIAS_JANELA_RUPTURA,
      hoje,
    });

    historicos.set(chave, {
      ...historico,
      diasRuptura90dias: resultado.diasZerados,
      diasObservados: resultado.diasAnalisados,
      dataUltimoZeramento: resultado.dataUltimoZeramento,
      rupturaConfiavel: resultado.confiavel,
      camposIndisponiveis: (historico.camposIndisponiveis ?? []).filter(
        (campo: string) => campo !== "diasRuptura90dias"
      ),
    });
  }
}

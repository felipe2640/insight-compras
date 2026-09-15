/**
 * Gerador Sintético Estocástico e Determinístico para DEMONSTRAÇÃO (25.000+ SKUs)
 * Camada: Adapters / Mock
 * 100% em Português do Brasil (pt-BR).
 *
 * Características Mandatórias do Dataset:
 * 1. Escala: Exatamente 25.000 SKUs de autopeças gerados em < 500ms.
 * 2. Pareto 20/30/50: 20% Curva A (5.000), 30% Curva B (7.500), 50% Curva C (12.500).
 * 3. Picapes 35%: Exatamente 35% do catálogo voltado a picapes e utilitários (8.750 SKUs).
 * 4. 500 Marcas Zumbis: Saldo em estoque > 0 e zero vendas nos últimos 180 dias.
 * 5. 2.000 Oportunidades de Transferência: Loja doadora com sobra real (saldo - minStock > 0).
 * 6. 1.500 Rupturas Críticas: Saldo zero na loja com alta saída comprovada nos 90 dias.
 * 7. 300 Notas Fiscais de Entrada Hoje: Alerta visual de chegada de mercadoria no dia.
 */

import {
  Produto,
  EstoqueFilial,
  HistoricoVendasFilial,
} from "@core/dominio";
import { inferirLotePadraoPorCategoria } from "../comum/lote-autopecas";
import {
  EntradaNFeDoDia,
  ItemSimilarIntercambiavel,
  SugestaoCompraERPItem,
  RespostaCargaInventario,
} from "../AdaptadorInventario";
import { NOMES_FILIAIS_CARREIRO } from "../carreiro/mapeador-dax";

/**
 * Algoritmo Mulberry32: PRNG de alta velocidade e distribuição uniforme.
 */
export function criarPrng(seed: number = 42): () => number {
  let s = seed >>> 0;
  return function proximo(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Catálogo base de famílias, aplicações e peças do setor automotivo.
 */
const CATEGORIAS_AUTOPECAS = [
  {
    secaoId: 10,
    nomeSecao: "Suspensão & Direção",
    pecas: ["AMORTECEDOR DIANTEIRO", "AMORTECEDOR TRASEIRO", "PIVO SUSPENSAO", "BANDEJA SUSPENSAO", "BIELETA BARRA ESTABILIZADORA", "TERMINAL DIRECAO", "BARRA AXIAL DIRECAO"],
  },
  {
    secaoId: 20,
    nomeSecao: "Freios",
    pecas: ["DISCO DE FREIO VENTILADO", "DISCO DE FREIO SOLIDO", "PASTILHA DE FREIO DIANTEIRA", "SAPATA DE FREIO TRASEIRA", "TAMBOR DE FREIO", "CILINDRO MESTRE FREIO"],
  },
  {
    secaoId: 30,
    nomeSecao: "Motor & Injeção",
    pecas: ["VELA DE IGNICAO", "CABO DE VELA", "BOBINA DE IGNICAO", "CORREIA DENTADA", "TENSOR CORREIA DENTADA", "BOMBA D AGUA", "BICO INJETOR"],
  },
  {
    secaoId: 40,
    nomeSecao: "Lubrificação & Filtros",
    pecas: ["OLEO MOTOR 15W40 MINERAL", "OLEO MOTOR 5W30 SINTETICO", "FILTRO DE OLEO", "FILTRO DE AR MOTOR", "FILTRO DE COMBUSTIVEL", "FILTRO CABINE AR"],
  },
  {
    secaoId: 50,
    nomeSecao: "Elétrica & Baterias",
    pecas: ["BATERIA AUTOMOTIVA 60AH", "BATERIA AUTOMOTIVA 70AH", "MOTOR DE PARTIDA", "ALTERNADOR 90A", "LAMPADA FAROL H4", "RELE AUXILIAR 12V"],
  },
] as const;

const MARCAS_AUTOPECAS = [
  "COFAP", "NAKATA", "MONROE", "FRAS-LE", "BOSCH", "NGK", "FRAM", "MAHLE",
  "VALEO", "DELPHI", "MAGNETI MARELLI", "MOURA", "HELIAR", "LUK", "SACHS"
] as const;

const VEICULOS_PICAPES = [
  "FIAT STRADA", "TOYOTA HILUX", "VW SAVEIRO", "CHEVROLET S10", "FIAT TORO",
  "MITSUBISHI L200", "FORD RANGER", "CHEVROLET D20", "NISSAN FRONTIER", "VW AMAROK"
] as const;

const VEICULOS_LEVES_PASSEIO = [
  "VW GOL G5/G6", "FIAT PALIO FIRE", "FIAT UNO MILLE", "CHEVROLET ONIX", "HYUNDAI HB20",
  "FORD KA", "TOYOTA COROLLA", "HONDA CIVIC", "RENAULT SANDERO", "CHEVROLET CORSA"
] as const;

const FORNECEDORES_REDE = [
  { id: 101, nome: "Distribuidora Automotiva Pellegrino" },
  { id: 102, nome: "DPaschoal Distribuição" },
  { id: 103, nome: "Compecas Distribuidora de Autopeças" },
  { id: 104, nome: "Fortbras Distribuidora" },
  { id: 105, nome: "Distribuidora Central de Autopeças" },
  { id: 106, nome: "Auto Peças União Distribuição" },
] as const;

export interface OpcoesGeradorSintetico {
  readonly totalSkus?: number;
  readonly seed?: number;
}

/**
 * Gera de forma puramente determinística um catálogo sintético completo.
 * Nenhum nome aqui pode remeter a cliente real: este dado é o que aparece na
 * demonstração pública da plataforma.
 */
export function gerarDatasetSinteticoCarreiro(
  opcoes: OpcoesGeradorSintetico = {}
): RespostaCargaInventario {
  const inicio = Date.now();
  const totalSkus = opcoes.totalSkus ?? 25_000;
  const rand = criarPrng(opcoes.seed ?? 42);

  const produtos: Produto[] = new Array(totalSkus);
  const estoques = new Map<string, EstoqueFilial>();
  const historicos = new Map<string, HistoricoVendasFilial>();
  const entradasHoje: EntradaNFeDoDia[] = [];
  const similares = new Map<number, ItemSimilarIntercambiavel[]>();

  // Índices reservados para anomalias e distribuições obrigatórias:
  // - Picapes: 35% do catálogo (ex: 8.750 SKUs)
  // - Oportunidades de Transferência: 2.000 SKUs (índices 1.000 a 2.999)
  // - Rupturas Críticas: 1.500 SKUs (índices 3.000 a 4.499)
  // - Entradas NF-e Hoje: 300 SKUs (índices 4.500 a 4.799)
  // - Marcas Zumbis: 500 SKUs (índices 20.000 a 20.499)

  const DATA_HOJE_ISO = "2026-09-06T08:30:00.000Z";

  for (let i = 0; i < totalSkus; i++) {
    const produtoId = i + 1;
    const codigoSku = `CAR-${String(produtoId).padStart(6, "0")}`;

    // Distribuição de Picapes (35% exatos): quando (i % 100) < 35
    const ehPicape = i % 100 < 35;
    const veiculo = ehPicape
      ? VEICULOS_PICAPES[Math.floor(rand() * VEICULOS_PICAPES.length)]
      : VEICULOS_LEVES_PASSEIO[Math.floor(rand() * VEICULOS_LEVES_PASSEIO.length)];

    const categoria = CATEGORIAS_AUTOPECAS[Math.floor(rand() * CATEGORIAS_AUTOPECAS.length)];
    const pecaBase = categoria.pecas[Math.floor(rand() * categoria.pecas.length)];
    const marca = MARCAS_AUTOPECAS[Math.floor(rand() * MARCAS_AUTOPECAS.length)];
    const fornecedor = FORNECEDORES_REDE[Math.floor(rand() * FORNECEDORES_REDE.length)];

    const descricao = `${pecaBase} - ${veiculo} - ${marca}`;
    const familiaId = `FAM-${categoria.secaoId}-${veiculo.replace(/\s+/g, "_")}`;
    const loteMultiplo = inferirLotePadraoPorCategoria(descricao);

    // Determinação de Curva ABC por Pareto (20% A, 30% B, 50% C)
    let curvaAbc: "A" | "B" | "C";
    let custoBase: number;
    let precoVenda: number;

    if (i < 5_000) {
      curvaAbc = "A";
      custoBase = 120 + Math.floor(rand() * 250);
      precoVenda = Math.round(custoBase * 1.55);
    } else if (i < 12_500) {
      curvaAbc = "B";
      custoBase = 60 + Math.floor(rand() * 100);
      precoVenda = Math.round(custoBase * 1.5);
    } else {
      curvaAbc = "C";
      custoBase = 25 + Math.floor(rand() * 50);
      precoVenda = Math.round(custoBase * 1.45);
    }

    const produto: Produto = {
      id: produtoId,
      codigoSku,
      descricao,
      marca,
      fabricante: marca,
      referenciaFabricante: `REF-${Math.floor(1000 + rand() * 9000)}`,
      aplicacaoVeicular: veiculo,
      familiaId,
      secaoId: categoria.secaoId,
      nomeSecao: categoria.nomeSecao,
      fornecedorId: fornecedor.id,
      nomeFornecedor: fornecedor.nome,
      precoCusto: custoBase,
      precoVenda,
      loteMultiplo,
    };

    produtos[i] = produto;

    // Definição das variáveis de estoque e vendas para as 2 filiais principais (1: Pedro II, 2: Piripiri)
    let saldo1 = 0;
    let min1 = 5;
    let vendas30d1 = 0;
    let vendas90d1 = 0;
    let vendas180d1 = 0;
    let notas90d1 = 0;
    let diasRuptura1 = 0;

    let saldo2 = 0;
    let min2 = 5;
    let vendas30d2 = 0;
    let vendas90d2 = 0;
    let vendas180d2 = 0;
    let notas90d2 = 0;
    let diasRuptura2 = 0;

    // Regra 4: 500 Marcas Zumbis (índices 20.000 a 20.499)
    if (i >= 20_000 && i < 20_500) {
      saldo1 = 12;
      saldo2 = 8;
      min1 = 2;
      min2 = 2;
      // 0 vendas nos últimos 180 dias
      vendas30d1 = 0;
      vendas90d1 = 0;
      vendas180d1 = 0;
      notas90d1 = 0;
      vendas30d2 = 0;
      vendas90d2 = 0;
      vendas180d2 = 0;
      notas90d2 = 0;
    }
    // Regra 5: 2.000 Oportunidades de Transferência (índices 1.000 a 2.999)
    else if (i >= 1_000 && i < 2_200) {
      // 1.200 Casos: Loja 1 precisa (saldo 0, min 10, vendas 40) e Loja 2 tem excesso real (saldo 50, min 10 => sobra 40)
      saldo1 = 0;
      min1 = 10;
      vendas30d1 = 15;
      vendas90d1 = 40;
      vendas180d1 = 80;
      notas90d1 = 18;
      diasRuptura1 = 10;

      saldo2 = 50;
      min2 = 10; // Sobra da Loja 2 = 50 - 10 = 40 > 0
      vendas30d2 = 4;
      vendas90d2 = 12;
      vendas180d2 = 24;
      notas90d2 = 6;
    } else if (i >= 2_200 && i < 3_000) {
      // 800 Casos: Loja 2 precisa (saldo 0, min 8, vendas 30) e Loja 1 tem excesso real (saldo 45, min 10 => sobra 35)
      saldo2 = 0;
      min2 = 8;
      vendas30d2 = 12;
      vendas90d2 = 30;
      vendas180d2 = 60;
      notas90d2 = 15;
      diasRuptura2 = 12;

      saldo1 = 45;
      min1 = 10; // Sobra da Loja 1 = 45 - 10 = 35 > 0
      vendas30d1 = 5;
      vendas90d1 = 15;
      vendas180d1 = 30;
      notas90d1 = 7;
    }
    // Regra 6: 1.500 Rupturas Críticas (índices 3.000 a 4.499)
    else if (i >= 3_000 && i < 4_500) {
      saldo1 = 0;
      saldo2 = 0;
      min1 = 15;
      min2 = 12;
      vendas30d1 = 25;
      vendas90d1 = 70;
      vendas180d1 = 140;
      notas90d1 = 28;
      diasRuptura1 = 25; // Ruptura grave
      vendas30d2 = 20;
      vendas90d2 = 55;
      vendas180d2 = 110;
      notas90d2 = 22;
      diasRuptura2 = 22;
    }
    // Distribuição Geral Padrão
    else {
      const fatorGiro = curvaAbc === "A" ? 4 : curvaAbc === "B" ? 2 : 0.8;
      min1 = Math.max(1, Math.floor(fatorGiro * 3));
      min2 = Math.max(1, Math.floor(fatorGiro * 2));
      saldo1 = min1 + Math.floor(rand() * 15 * fatorGiro);
      saldo2 = min2 + Math.floor(rand() * 12 * fatorGiro);

      vendas30d1 = Math.floor(rand() * 10 * fatorGiro);
      vendas90d1 = vendas30d1 + Math.floor(rand() * 20 * fatorGiro);
      vendas180d1 = vendas90d1 + Math.floor(rand() * 30 * fatorGiro);
      notas90d1 = Math.min(vendas90d1, Math.floor(rand() * 15 * fatorGiro) + 3);

      vendas30d2 = Math.floor(rand() * 8 * fatorGiro);
      vendas90d2 = vendas30d2 + Math.floor(rand() * 16 * fatorGiro);
      vendas180d2 = vendas90d2 + Math.floor(rand() * 24 * fatorGiro);
      notas90d2 = Math.min(vendas90d2, Math.floor(rand() * 12 * fatorGiro) + 3);
    }

    // Regra 7: 300 Notas Fiscais de Entrada Hoje (índices 4.500 a 4.799)
    if (i >= 4_500 && i < 4_800) {
      entradasHoje.push({
        numeroNotaFiscal: `NF-${900000 + i}`,
        produtoId,
        filialId: 1,
        fornecedorNome: fornecedor.nome,
        quantidadeEntrada: 12 + (i % 24),
        valorEntrada: (12 + (i % 24)) * custoBase,
        dataHoraChegada: DATA_HOJE_ISO,
      });
    }

    // Popula Filial 1 (Pedro II / Matriz)
    const chave1 = `${produtoId}:1`;
    estoques.set(chave1, {
      filialId: 1,
      nomeFilial: NOMES_FILIAIS_CARREIRO[1],
      produtoId,
      saldoFisico: saldo1,
      estoqueMinimoSeguranca: min1,
      quantidadeJaPedida: 0,
      diasSemVenda: null,
      sinalGovernancaCompra: null,
      usoLimiteCompra: null,
      margemRealizada: null,
      margemAlvo: null,
      consumoMedioDiarioErp: vendas90d1 > 0 ? Number((vendas90d1 / 90).toFixed(3)) : 0,
      dataUltimaVenda: vendas90d1 > 0 ? "2026-09-01" : null,
      dataUltimaCompra: "2026-08-15",
    });

    historicos.set(chave1, {
      produtoId,
      filialId: 1,
      vendasLiquidas30dias: vendas30d1,
      vendasLiquidas90dias: vendas90d1,
      vendasLiquidas180dias: vendas180d1,
      devolucoes90dias: 0,
      notasFiscaisVenda90dias: notas90d1,
      notasFiscaisDevolucao90dias: 0,
      mesesAtivos12meses: 12,
      medianaLinhaVenda: 1,
      diasRuptura90dias: diasRuptura1,
      diasObservados: 180,
      dataPrimeiraVendaRegistrada: "2024-01-10",
    });

    // Popula Filial 2 (Melo / Piripiri)
    const chave2 = `${produtoId}:2`;
    estoques.set(chave2, {
      filialId: 2,
      nomeFilial: NOMES_FILIAIS_CARREIRO[2],
      produtoId,
      saldoFisico: saldo2,
      estoqueMinimoSeguranca: min2,
      quantidadeJaPedida: 0,
      diasSemVenda: null,
      sinalGovernancaCompra: null,
      usoLimiteCompra: null,
      margemRealizada: null,
      margemAlvo: null,
      consumoMedioDiarioErp: vendas90d2 > 0 ? Number((vendas90d2 / 90).toFixed(3)) : 0,
      dataUltimaVenda: vendas90d2 > 0 ? "2026-08-28" : null,
      dataUltimaCompra: "2026-08-10",
    });

    historicos.set(chave2, {
      produtoId,
      filialId: 2,
      vendasLiquidas30dias: vendas30d2,
      vendasLiquidas90dias: vendas90d2,
      vendasLiquidas180dias: vendas180d2,
      devolucoes90dias: 0,
      notasFiscaisVenda90dias: notas90d2,
      notasFiscaisDevolucao90dias: 0,
      mesesAtivos12meses: 12,
      medianaLinhaVenda: 1,
      diasRuptura90dias: diasRuptura2,
      diasObservados: 180,
      dataPrimeiraVendaRegistrada: "2024-01-15",
    });
  }

  // Gera relações de similares intercambiáveis para os primeiros 2.000 produtos
  for (let i = 0; i < 2_000; i++) {
    const pOrigem = produtos[i];
    // Encontra um similar (ex: i + 2 com a mesma categoria)
    const pSimilar = produtos[(i + 2) % totalSkus];
    const saldoSimilar =
      (estoques.get(`${pSimilar.id}:1`)?.saldoFisico ?? 0) +
      (estoques.get(`${pSimilar.id}:2`)?.saldoFisico ?? 0);

    const itemSimilar: ItemSimilarIntercambiavel = {
      produtoIdOrigem: pOrigem.id,
      produtoIdSimilar: pSimilar.id,
      codigoSkuSimilar: pSimilar.codigoSku,
      descricaoSimilar: pSimilar.descricao,
      marcaSimilar: pSimilar.marca,
      saldoFisicoDisponivelRede: saldoSimilar,
    };

    similares.set(pOrigem.id, [itemSimilar]);
  }

  // Gera sugestões de compra do ERP para os primeiros 500 produtos (operação em paralelo)
  const sugestoesErp = new Map<string, SugestaoCompraERPItem>();
  const hojeIso = new Date().toISOString();
  for (let i = 0; i < Math.min(500, totalSkus); i++) {
    const p = produtos[i];
    const filialId = (i % 2) + 1; // Distribui entre loja 1 e 2
    const qtdSugerida = (i % 5) + 1;
    sugestoesErp.set(`${p.id}:${filialId}`, {
      produtoId: p.id,
      filialId,
      quantidadeSugerida: qtdSugerida,
      dataSugestao: hojeIso,
      origem: i % 4 === 0 ? "E" : "R",
      descricao: i % 4 === 0 ? "SOLICITAÇÃO EMERGENCIAL DE BALCÃO" : "SOLICITAÇÃO PARA REPOSIÇÃO DE ESTOQUE",
      solicitador: "COMPRAS ERP",
    });
  }

  const latenciaMs = Date.now() - inicio;

  return {
    produtos,
    estoques,
    historicos,
    entradasHoje,
    similares,
    sugestoesErp,
    metadados: {
      provedor: "MOCK_SINTETICO",
      timestampCarga: new Date().toISOString(),
      emModoDegradado: false,
      totalSkusCarregados: totalSkus,
      latenciaMs,
    },
  };
}

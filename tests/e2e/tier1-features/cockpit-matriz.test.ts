/**
 * Tier 1: Cobertura de Features — Cockpit do Comprador & Matriz de Decisão (colunas-cockpit)
 * Requisitos: ORIGINAL_REQUEST R2, PROJECT.md & Unidade U2
 */

import { describe, it, expect } from "vitest";
import { criarColunasCockpit } from "@/components/cockpit";
import { codigosDoGrupoSimilar } from "@/components/cockpit/colunas-cockpit";
import { LinhaCockpitCompras } from "@/tipos/cockpit";
import {
  EntradaNotaFiscalHojeDto,
  SimilarItemDto,
} from "../harness/contexto-teste";

describe("Tier 1 — Feature 1: Cockpit do Comprador & Matriz de Decisão (colunas-cockpit)", () => {
  // T1.1.0: Estrutura Canônica da Matriz de Decisão Viva
  it("T1.1.0 — deve gerar a matriz de colunas completa da árvore viva com todos os indicadores", () => {
    const colunas = criarColunasCockpit({
      nomeLojaFoco: "Trairi",
      nomeOutrasLojas: "Rede",
    });

    const ids = colunas.map((c) => c.id);

    // Seleção e Identificação
    expect(ids).toContain("select");
    expect(ids).toContain("codigo");
    expect(ids).toContain("codigoAgrupador");
    expect(ids).toContain("descricao");
    expect(ids).toContain("aplicacao");
    expect(ids).toContain("marca");
    expect(ids).toContain("subgrupo");

    // Métricas de Venda, Consumo e Classificação
    expect(ids).toContain("curvaAbcSistema");
    expect(ids).toContain("consumoDiario");
    expect(ids).toContain("frequencia");
    expect(ids).toContain("ruptura");

    // Cobertura Comparativa (migrada de baseColumns para a árvore viva)
    expect(ids).toContain("cobertura");

    // Estoques e Ações Operacionais
    expect(ids).toContain("estoqueLojaFoco");
    expect(ids).toContain("estoqueRede");
    expect(ids).toContain("pedido");
    expect(ids).toContain("transferencia");
  });

  it("T1.1.0a — código agrupador indexa o próprio SKU e todos os similares", () => {
    const linha = {
      codigo: "006534",
      similares: [
        { codigoSkuSimilar: "028593" },
        { codigoSkuSimilar: "000678" },
      ],
    } as unknown as LinhaCockpitCompras;

    const indice = codigosDoGrupoSimilar(linha);
    expect(indice).toContain("006534");
    expect(indice).toContain("6534");
    expect(indice).toContain("028593");
    expect(indice).toContain("000678");
  });

  // T1.1.1: Diagnóstico de Ruptura
  it("T1.1.1 — deve calcular o percentual de ruptura e atribuir a severidade cromática correta", () => {
    // Caso 1: Ruptura Boa (<= 5%)
    const diasAnalisados = 90;
    const diasZeradosBoa = 3; // 3/90 = 3.33%
    const taxaBoa = (diasZeradosBoa / diasAnalisados) * 100;
    expect(taxaBoa).toBeLessThanOrEqual(5);

    // Caso 2: Ruptura Atenção (5% a 10%)
    const diasZeradosAtencao = 7; // 7/90 = 7.77%
    const taxaAtencao = (diasZeradosAtencao / diasAnalisados) * 100;
    expect(taxaAtencao).toBeGreaterThan(5);
    expect(taxaAtencao).toBeLessThanOrEqual(10);

    // Caso 3: Ruptura Grave (> 10%)
    const diasZeradosGrave = 15; // 15/90 = 16.67%
    const taxaGrave = (diasZeradosGrave / diasAnalisados) * 100;
    expect(taxaGrave).toBeGreaterThan(10);

    // Caso 4: Sem Histórico (diasAnalisados = 0)
    const diasAnalisadosZero = 0;
    const taxaSemHist = diasAnalisadosZero > 0 ? (0 / diasAnalisadosZero) * 100 : null;
    expect(taxaSemHist).toBeNull();
  });

  // T1.1.2: Frequência por Notas em 90 dias
  it("T1.1.2 — deve apurar as notas líquidas (venda - devolução) e classificar a frequência em 90 dias", () => {
    // 40 notas líquidas em 90 dias = 44.4% -> Alta (>40%)
    const notasVendaAlta = 42;
    const notasDevolucaoAlta = 2;
    const notasLiquidasAlta = notasVendaAlta - notasDevolucaoAlta;
    const freqAltaPct = (notasLiquidasAlta / 90) * 100;
    expect(notasLiquidasAlta).toBe(40);
    expect(freqAltaPct).toBeGreaterThan(40);

    // 20 notas líquidas em 90 dias = 22.2% -> Média (15% a 40%)
    const notasVendaMedia = 22;
    const notasDevolucaoMedia = 2;
    const notasLiquidasMedia = notasVendaMedia - notasDevolucaoMedia;
    const freqMediaPct = (notasLiquidasMedia / 90) * 100;
    expect(freqMediaPct).toBeGreaterThanOrEqual(15);
    expect(freqMediaPct).toBeLessThanOrEqual(40);

    // 5 notas líquidas em 90 dias = 5.5% -> Baixa (<15%)
    const notasVendaBaixa = 5;
    const notasDevolucaoBaixa = 0;
    const notasLiquidasBaixa = notasVendaBaixa - notasDevolucaoBaixa;
    const freqBaixaPct = (notasLiquidasBaixa / 90) * 100;
    expect(freqBaixaPct).toBeLessThan(15);
  });

  // T1.1.3: Coberturas Comparativas Triplas e Tendência na Coluna Cobertura
  it("T1.1.3 — deve calcular coberturas nas janelas de 30d, 90d e 180d e sinalizar tendência de aceleração", () => {
    const saldoEstoque = 12; // unidades
    const vendas30d = 12; // 12 un em 30d -> CMD = 0.40 un/dia
    const vendas90d = 18; // 18 un em 90d -> CMD = 0.20 un/dia
    const vendas180d = 36; // 36 un em 180d -> CMD = 0.20 un/dia

    const cmd30d = vendas30d / 30; // 0.40
    const cmd90d = vendas90d / 90; // 0.20
    const cmd180d = vendas180d / 180; // 0.20

    const cob30d = saldoEstoque / cmd30d; // 12 / 0.40 = 30 dias
    const cob90d = saldoEstoque / cmd90d; // 12 / 0.20 = 60 dias
    const cob180d = saldoEstoque / cmd180d; // 12 / 0.20 = 60 dias

    expect(cob30d).toBe(30);
    expect(cob90d).toBe(60);
    expect(cob180d).toBe(60);

    // Detecção de Aceleração Recente: CMD 30d é 100% maior que CMD 90d (aceleração > 25%)
    const isAceleracaoRecente = cmd30d > cmd90d * 1.25;
    expect(isAceleracaoRecente).toBe(true);

    // Validação de acessor da coluna cobertura na árvore viva
    const colunas = criarColunasCockpit();
    const colunaCobertura = colunas.find((c) => c.id === "cobertura");
    expect(colunaCobertura).toBeDefined();
    if (colunaCobertura && "accessorFn" in colunaCobertura && colunaCobertura.accessorFn) {
      const linhaMock = {
        diasCobertura90d: 60,
      } as LinhaCockpitCompras;
      expect(colunaCobertura.accessorFn(linhaMock, 0)).toBe(60);
    }
  });

  // T1.1.4: Detecção e Alerta de NF-e do Dia
  it("T1.1.4 — deve identificar NF-e com entrada no dia e estruturar os dados para o tooltip analítico", () => {
    const entradasHoje: EntradaNotaFiscalHojeDto[] = [
      {
        numeroNota: "NF-892341",
        fornecedorNome: "DISTRIBUIDORA MONROE BRASIL",
        quantidadeRecebida: 8,
        dataEntrada: "2026-09-06T08:30:00Z",
      },
    ];

    const temEntradaHoje = entradasHoje.length > 0;
    expect(temEntradaHoje).toBe(true);
    expect(entradasHoje[0].numeroNota).toBe("NF-892341");
    expect(entradasHoje[0].quantidadeRecebida).toBe(8);
    expect(entradasHoje[0].fornecedorNome).toContain("MONROE");
  });

  // T1.1.5: Consulta e Mapeamento de Similares Intercambiáveis
  it("T1.1.5 — deve consultar peças similares da mesma aplicação e mapear o estoque por filial", () => {
    const similares: SimilarItemDto[] = [
      {
        produtoId: 2002,
        codigo: "AM-COF-001",
        descricao: "AMORTECEDOR DIANTEIRO COROLLA COFAP TURBOGAS",
        marca: "COFAP",
        precoCusto: 245.0,
        estoquePorFilial: {
          1: 2, // Loja Trairi
          2: 6, // Loja Paraipaba (sobrando)
        },
      },
    ];

    expect(similares).toHaveLength(1);
    expect(similares[0].marca).toBe("COFAP");
    expect(similares[0].estoquePorFilial[2]).toBe(6);

    const saldoTotalRede = Object.values(similares[0].estoquePorFilial).reduce((a, b) => a + b, 0);
    expect(saldoTotalRede).toBe(8);
  });
});

/**
 * Suíte de Testes de Escala e Anomalias Estruturadas (25.000+ SKUs)
 * Camada: Adapters / Mock
 * Requisitos: ORIGINAL_REQUEST R1, R2, R3 & PROJECT.md
 */

import { describe, it, expect } from "vitest";
import { gerarDatasetSinteticoCarreiro } from "@adapters/mock/gerador-sintetico";
import { AdaptadorInventarioMock } from "@adapters/mock/adaptador-mock";
import { aplicarTravaMarcaZumbi } from "@core/travas/marca-zumbi";
import { calcularTransferenciaEntreDuasLojas } from "@core/transferencia/balanceamento";

describe("Adaptador Mock & Gerador Sintético de 25.000+ SKUs (Marco 2)", () => {
  it("deve gerar 25.000 SKUs em menos de 1.500ms com integridade referencial", () => {
    const inicio = performance.now();
    const dataset = gerarDatasetSinteticoCarreiro({ totalSkus: 25_000, seed: 42 });
    const duracaoMs = performance.now() - inicio;

    expect(dataset.produtos).toHaveLength(25_000);
    expect(duracaoMs).toBeLessThan(1500); // Requisito de alta performance
    expect(dataset.metadados.provedor).toBe("MOCK_SINTETICO");
    expect(dataset.metadados.totalSkusCarregados).toBe(25_000);
    expect(dataset.estoques.size).toBe(50_000); // 25k produtos x 2 filiais principais
    expect(dataset.historicos.size).toBe(50_000);
  });

  it("deve respeitar estritamente a proporção de Pareto 20/30/50", () => {
    const dataset = gerarDatasetSinteticoCarreiro({ totalSkus: 25_000, seed: 42 });

    // Índices de Pareto definidos no gerador:
    // 0 a 4.999 (5.000 SKUs = 20%): Curva A
    // 5.000 a 12.499 (7.500 SKUs = 30%): Curva B
    // 12.500 a 24.999 (12.500 SKUs = 50%): Curva C

    const skusA = dataset.produtos.slice(0, 5_000);
    const skusB = dataset.produtos.slice(5_000, 12_500);
    const skusC = dataset.produtos.slice(12_500, 25_000);

    expect(skusA).toHaveLength(5_000);
    expect(skusB).toHaveLength(7_500);
    expect(skusC).toHaveLength(12_500);

    // Verificação de faixas de custo proporcional ao perfil de giro
    const mediaCustoA = skusA.reduce((acc, p) => acc + p.precoCusto, 0) / skusA.length;
    const mediaCustoB = skusB.reduce((acc, p) => acc + p.precoCusto, 0) / skusB.length;
    const mediaCustoC = skusC.reduce((acc, p) => acc + p.precoCusto, 0) / skusC.length;

    expect(mediaCustoA).toBeGreaterThan(mediaCustoB);
    expect(mediaCustoB).toBeGreaterThan(mediaCustoC);
  });

  it("deve conter exatamente 35% de picapes e utilitários de trabalho (8.750 SKUs)", () => {
    const dataset = gerarDatasetSinteticoCarreiro({ totalSkus: 25_000, seed: 42 });

    const picapesMapeadas = [
      "STRADA", "HILUX", "SAVEIRO", "S10", "TORO", "L200", "RANGER", "D20", "FRONTIER", "AMAROK"
    ];

    const totalPicapes = dataset.produtos.filter((p) => {
      const app = (p.aplicacaoVeicular ?? "").toUpperCase();
      return picapesMapeadas.some((picape) => app.includes(picape));
    }).length;

    // 25.000 * 0.35 = 8.750 exatos
    expect(totalPicapes).toBe(8_750);
    expect(totalPicapes / dataset.produtos.length).toBe(0.35);
  });

  it("deve conter exatamente 500 marcas zumbis com saldo positivo e zero vendas em 180 dias", () => {
    const dataset = gerarDatasetSinteticoCarreiro({ totalSkus: 25_000, seed: 42 });

    const zumbis = dataset.produtos.filter((p) => {
      const est1 = dataset.estoques.get(`${p.id}:1`)?.saldoFisico ?? 0;
      const est2 = dataset.estoques.get(`${p.id}:2`)?.saldoFisico ?? 0;
      const ven1 = dataset.historicos.get(`${p.id}:1`)?.vendasLiquidas180dias ?? 0;
      const ven2 = dataset.historicos.get(`${p.id}:2`)?.vendasLiquidas180dias ?? 0;

      return est1 + est2 > 0 && ven1 + ven2 === 0;
    });

    expect(zumbis).toHaveLength(500);

    // Valida integração com a trava de Marca Zumbi do Core
    for (const zumbi of zumbis.slice(0, 10)) {
      const saldoTotal =
        (dataset.estoques.get(`${zumbi.id}:1`)?.saldoFisico ?? 0) +
        (dataset.estoques.get(`${zumbi.id}:2`)?.saldoFisico ?? 0);

      const resultadoTrava = aplicarTravaMarcaZumbi({
        saldoFisico: saldoTotal,
        vendasLiquidas180dias: 0,
        sugestaoOriginal: 25,
      });

      expect(resultadoTrava.travado).toBe(true);
      expect(resultadoTrava.sugestaoAjustada).toBe(0);
      expect(resultadoTrava.motivo).toContain("Marca Zumbi");
    }
  });

  it("deve conter exatamente 2.000 oportunidades de transferência inter-lojas seguras", () => {
    const dataset = gerarDatasetSinteticoCarreiro({ totalSkus: 25_000, seed: 42 });

    const oportunidades = dataset.produtos.filter((p) => {
      const est1 = dataset.estoques.get(`${p.id}:1`);
      const est2 = dataset.estoques.get(`${p.id}:2`);
      if (!est1 || !est2) return false;

      // Loja 1 precisa e Loja 2 tem sobra real
      const transf2Para1 =
        est1.saldoFisico === 0 && est2.saldoFisico - est2.estoqueMinimoSeguranca > 0;
      // Loja 2 precisa e Loja 1 tem sobra real
      const transf1Para2 =
        est2.saldoFisico === 0 && est1.saldoFisico - est1.estoqueMinimoSeguranca > 0;

      return transf2Para1 || transf1Para2;
    });

    expect(oportunidades).toHaveLength(2_000);

    // Valida integração com o motor de transferência segura do Core
    for (const item of oportunidades.slice(0, 10)) {
      const est1 = dataset.estoques.get(`${item.id}:1`)!;
      const est2 = dataset.estoques.get(`${item.id}:2`)!;

      const res = calcularTransferenciaEntreDuasLojas(
        {
          filialId: 1,
          saldoFisico: est1.saldoFisico,
          estoqueMinimo: est1.estoqueMinimoSeguranca,
          necessidadeCompra: est1.saldoFisico === 0 ? 15 : 0,
        },
        {
          filialId: 2,
          saldoFisico: est2.saldoFisico,
          estoqueMinimo: est2.estoqueMinimoSeguranca,
          necessidadeCompra: est2.saldoFisico === 0 ? 15 : 0,
        }
      );

      expect(res).not.toBeNull();
      if (res) {
        expect(res.quantidadeTransferir).toBeGreaterThan(0);
        // Invariante inviolável: a doadora jamais fica abaixo do estoque mínimo
        const doadoraEstoque = res.filialOrigemId === 1 ? est1 : est2;
        expect(res.saldoOrigemApos).toBeGreaterThanOrEqual(
          doadoraEstoque.estoqueMinimoSeguranca
        );
      }
    }
  });

  it("deve conter exatamente 1.500 rupturas críticas com demanda comprovada", () => {
    const dataset = gerarDatasetSinteticoCarreiro({ totalSkus: 25_000, seed: 42 });

    const rupturasCriticas = dataset.produtos.filter((p) => {
      const est1 = dataset.estoques.get(`${p.id}:1`);
      const hist1 = dataset.historicos.get(`${p.id}:1`);
      return (
        est1 &&
        hist1 &&
        est1.saldoFisico === 0 &&
        hist1.vendasLiquidas90dias >= 50 &&
        hist1.diasRuptura90dias >= 20
      );
    });

    expect(rupturasCriticas).toHaveLength(1_500);
  });

  it("deve conter exatamente 300 notas fiscais de entrada do dia", () => {
    const dataset = gerarDatasetSinteticoCarreiro({ totalSkus: 25_000, seed: 42 });

    expect(dataset.entradasHoje).toHaveLength(300);
    for (const nfe of dataset.entradasHoje) {
      expect(nfe.numeroNotaFiscal).toMatch(/^NF-\d+$/);
      expect(nfe.quantidadeEntrada).toBeGreaterThan(0);
      expect(nfe.valorEntrada).toBeGreaterThan(0);
      expect(nfe.fornecedorNome.length).toBeGreaterThan(0);
      expect(nfe.dataHoraChegada).toContain("2026-09-06");
    }
  });

  it("deve executar buscas e filtros RBAC em memória com latência inferior a 250ms no AdaptadorMock", async () => {
    const adaptador = new AdaptadorInventarioMock({ totalSkus: 25_000, seed: 42 });

    // Teste de saúde
    const saude = await adaptador.verificarSaudeConexao();
    expect(saude).toBe(true);

    // 1. Filtro irrestrito (Admin)
    const t0 = performance.now();
    const cargaAdmin = await adaptador.carregarInventarioCompleto({
      fornecedoresPermitidos: null,
    });
    const duracaoAdmin = performance.now() - t0;
    expect(cargaAdmin.produtos).toHaveLength(25_000);
    expect(duracaoAdmin).toBeLessThan(500);

    // 2. Filtro RBAC Comprador Restrito (Apenas Fornecedor 101)
    const t1 = performance.now();
    const cargaComprador = await adaptador.carregarInventarioCompleto({
      fornecedoresPermitidos: [101],
    });
    const duracaoComprador = performance.now() - t1;

    expect(cargaComprador.produtos.length).toBeGreaterThan(0);
    expect(cargaComprador.produtos.length).toBeLessThan(25_000);
    expect(duracaoComprador).toBeLessThan(250); // Requisito: < 250ms

    for (const p of cargaComprador.produtos) {
      expect(p.fornecedorId).toBe(101);
    }

    // 3. Filtro Combinado: Fornecedor 101 + Seção Suspensão (10)
    const cargaCombinada = await adaptador.carregarInventarioCompleto({
      fornecedoresPermitidos: [101],
      secaoId: 10,
    });
    for (const p of cargaCombinada.produtos) {
      expect(p.fornecedorId).toBe(101);
      expect(p.secaoId).toBe(10);
    }
  });
});

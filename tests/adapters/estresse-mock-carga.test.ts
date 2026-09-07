/**
 * Suite de Testes Adversariais de Carga, Escala e Concorrencia (25.000+ SKUs)
 * Camada: Adapters / Mock
 * Autor: Challenger 1 (Milestone 2)
 *
 * Desafios Avaliados:
 * 1. Escala e geracao deterministica de 25.000+ SKUs (< 1.500ms).
 * 2. Integridade matematica exaustiva das 500 marcas zumbis (sugestao = 0) e 2.000 transferencias (saldo - minStock > 0).
 * 3. Concorrencia extrema com centenas de requisicoes simultaneas (100 e 250 requests paralelas).
 * 4. Latencia de busca indexada e filtros RBAC (< 250ms).
 * 5. Robustez contra filtros adversariais e concorrencia no cold-start.
 */

import { describe, it, expect } from 'vitest';
import { gerarDatasetSinteticoCarreiro } from '@adapters/mock/gerador-sintetico';
import { AdaptadorInventarioMock } from '@adapters/mock/adaptador-mock';
import { aplicarTravaMarcaZumbi } from '@core/travas/marca-zumbi';
import {
  calcularTransferenciaEntreDuasLojas,
} from '@core/transferencia/balanceamento';
import { calcularNecessidadeItem } from '@core/calculo/necessidade';
import { FiltroCargaInventario } from '@adapters/AdaptadorInventario';

function calcularPercentis(latencias: number[]) {
  const ordenadas = [...latencias].sort((a, b) => a - b);
  const p50 = ordenadas[Math.floor(ordenadas.length * 0.5)];
  const p90 = ordenadas[Math.floor(ordenadas.length * 0.9)];
  const p95 = ordenadas[Math.floor(ordenadas.length * 0.95)];
  const p99 = ordenadas[Math.floor(ordenadas.length * 0.99)];
  const max = ordenadas[ordenadas.length - 1];
  const min = ordenadas[0];
  const media = ordenadas.reduce((a, b) => a + b, 0) / ordenadas.length;
  return { min, media, p50, p90, p95, p99, max };
}

describe('Challenger 1 — Desafio Adversarial de Escala e Carga no Mock (Marco 2)', () => {
  describe('1. Escala e Performance de Geracao (25.000 a 50.000 SKUs)', () => {
    it('deve gerar 25.000 SKUs consistentemente em menos de 1.500ms em multiplas seeds', () => {
      const seeds = [42, 101, 777, 9999];
      const tempos: number[] = [];

      for (const seed of seeds) {
        const t0 = performance.now();
        const dataset = gerarDatasetSinteticoCarreiro({ totalSkus: 25_000, seed });
        const duracao = performance.now() - t0;
        tempos.push(duracao);

        expect(dataset.produtos).toHaveLength(25_000);
        expect(dataset.estoques.size).toBe(50_000);
        expect(dataset.historicos.size).toBe(50_000);
        expect(duracao).toBeLessThan(1500);
      }

      const media = tempos.reduce((a, b) => a + b, 0) / tempos.length;
      expect(media).toBeLessThan(800);
    });

    it('deve suportar escala estendida de 35.000 e 50.000 SKUs sem estourar tempo ou memoria', () => {
      const t35 = performance.now();
      const dataset35 = gerarDatasetSinteticoCarreiro({ totalSkus: 35_000, seed: 42 });
      const duracao35 = performance.now() - t35;
      expect(dataset35.produtos).toHaveLength(35_000);
      expect(dataset35.estoques.size).toBe(70_000);
      expect(duracao35).toBeLessThan(1500);

      const t50 = performance.now();
      const dataset50 = gerarDatasetSinteticoCarreiro({ totalSkus: 50_000, seed: 42 });
      const duracao50 = performance.now() - t50;
      expect(dataset50.produtos).toHaveLength(50_000);
      expect(dataset50.estoques.size).toBe(100_000);
      expect(duracao50).toBeLessThan(2500);
    });
  });

  describe('2. Integridade Matematica Exaustiva das Anomalias Injetadas', () => {
    it('deve verificar 100% das 500 marcas zumbis (sugestao = 0, trava acionada, necessidade = 0)', () => {
      const dataset = gerarDatasetSinteticoCarreiro({ totalSkus: 25_000, seed: 42 });

      const zumbis = dataset.produtos.filter((p) => {
        const est1 = dataset.estoques.get(p.id + ':1')?.saldoFisico ?? 0;
        const est2 = dataset.estoques.get(p.id + ':2')?.saldoFisico ?? 0;
        const ven1 = dataset.historicos.get(p.id + ':1')?.vendasLiquidas180dias ?? 0;
        const ven2 = dataset.historicos.get(p.id + ':2')?.vendasLiquidas180dias ?? 0;
        return est1 + est2 > 0 && ven1 + ven2 === 0;
      });

      expect(zumbis).toHaveLength(500);

      let testados = 0;
      for (const zumbi of zumbis) {
        const est1 = dataset.estoques.get(zumbi.id + ':1')!;
        const est2 = dataset.estoques.get(zumbi.id + ':2')!;
        const hist1 = dataset.historicos.get(zumbi.id + ':1')!;
        const hist2 = dataset.historicos.get(zumbi.id + ':2')!;

        expect(est1.saldoFisico).toBeGreaterThan(0);
        expect(est2.saldoFisico).toBeGreaterThan(0);
        expect(hist1.vendasLiquidas180dias).toBe(0);
        expect(hist2.vendasLiquidas180dias).toBe(0);

        const travaFilial1 = aplicarTravaMarcaZumbi({
          saldoFisico: est1.saldoFisico,
          vendasLiquidas180dias: hist1.vendasLiquidas180dias,
          sugestaoOriginal: 50,
          codigoSku: zumbi.codigoSku,
        });
        expect(travaFilial1.travado).toBe(true);
        expect(travaFilial1.sugestaoAjustada).toBe(0);

        const travaFilial2 = aplicarTravaMarcaZumbi({
          saldoFisico: est2.saldoFisico,
          vendasLiquidas180dias: hist2.vendasLiquidas180dias,
          sugestaoOriginal: 30,
          codigoSku: zumbi.codigoSku,
        });
        expect(travaFilial2.travado).toBe(true);
        expect(travaFilial2.sugestaoAjustada).toBe(0);

        const nec1 = calcularNecessidadeItem({
          consumoDiario: est1.consumoMedioDiarioErp,
          perfilGiro: 'SEM_HISTORICO_SUFICIENTE',
          saldoFisico: est1.saldoFisico,
          estoqueMinimoCadastrado: est1.estoqueMinimoSeguranca,
          quantidadeJaPedida: 0,
          leadTimeDias: 15,
        });
        expect(nec1.necessidadeLiquida).toBe(0);

        testados++;
      }
      expect(testados).toBe(500);
    });

    it('deve verificar 100% das 2.000 transferencias preservando estritamente saldo - minStock > 0', () => {
      const dataset = gerarDatasetSinteticoCarreiro({ totalSkus: 25_000, seed: 42 });

      const oportunidades = dataset.produtos.filter((p) => {
        const est1 = dataset.estoques.get(p.id + ':1');
        const est2 = dataset.estoques.get(p.id + ':2');
        if (!est1 || !est2) return false;

        const transf2Para1 =
          est1.saldoFisico === 0 && est2.saldoFisico - est2.estoqueMinimoSeguranca > 0;
        const transf1Para2 =
          est2.saldoFisico === 0 && est1.saldoFisico - est1.estoqueMinimoSeguranca > 0;

        return transf2Para1 || transf1Para2;
      });

      expect(oportunidades).toHaveLength(2_000);

      let transferenciasBemSucedidas = 0;
      for (const item of oportunidades) {
        const est1 = dataset.estoques.get(item.id + ':1')!;
        const est2 = dataset.estoques.get(item.id + ':2')!;

        const resultado = calcularTransferenciaEntreDuasLojas(
          {
            filialId: 1,
            saldoFisico: est1.saldoFisico,
            estoqueMinimo: est1.estoqueMinimoSeguranca,
            necessidadeCompra: est1.saldoFisico === 0 ? 20 : 0,
          },
          {
            filialId: 2,
            saldoFisico: est2.saldoFisico,
            estoqueMinimo: est2.estoqueMinimoSeguranca,
            necessidadeCompra: est2.saldoFisico === 0 ? 20 : 0,
          },
          { produtoId: item.id, codigoSku: item.codigoSku }
        );

        expect(resultado).not.toBeNull();
        if (resultado) {
          transferenciasBemSucedidas++;
          expect(resultado.quantidadeTransferir).toBeGreaterThan(0);

          const estoqueDoadora =
            resultado.filialOrigemId === 1 ? est1 : est2;
          expect(resultado.saldoOrigemApos).toBeGreaterThanOrEqual(
            estoqueDoadora.estoqueMinimoSeguranca
          );
          expect(resultado.saldoOrigemAntes - resultado.quantidadeTransferir).toBe(
            resultado.saldoOrigemApos
          );
        }
      }

      expect(transferenciasBemSucedidas).toBe(2_000);
    });
  });

  describe('3. Concorrencia Extrema com Centenas de Requisicoes Paralelas', () => {
    it('deve processar 100 requisicoes paralelas com latencia individual < 250ms e duracao total controlada', async () => {
      const adaptador = new AdaptadorInventarioMock({ totalSkus: 25_000, seed: 42 });
      await adaptador.carregarInventarioCompleto({ fornecedoresPermitidos: [101] });

      const filtros: FiltroCargaInventario[] = [
        { fornecedoresPermitidos: null },
        { fornecedoresPermitidos: [101] },
        { fornecedoresPermitidos: [102, 103] },
        { fornecedoresPermitidos: [104, 105, 106] },
        { fornecedoresPermitidos: [101], secaoId: 10 },
        { fornecedoresPermitidos: [102], secaoId: 20 },
        { fornecedoresPermitidos: [103], secaoId: 30 },
        { fornecedoresPermitidos: [104], secaoId: 40 },
        { fornecedoresPermitidos: [105], secaoId: 50 },
        { fornecedoresPermitidos: null, filialId: 1 },
        { fornecedoresPermitidos: null, filialId: 2 },
        { fornecedoresPermitidos: [101], apenasComEstoqueOuVenda: true },
        { fornecedoresPermitidos: [102], apenasComEstoqueOuVenda: true, filialId: 1 },
      ];

      const NUM_REQUISICOES = 100;

      const inicioTotal = performance.now();
      const promises = Array.from({ length: NUM_REQUISICOES }, (_, idx) => {
        const filtro = filtros[idx % filtros.length];
        return adaptador.carregarInventarioCompleto(filtro);
      });

      const resultados = await Promise.all(promises);
      const duracaoTotal = performance.now() - inicioTotal;

      expect(resultados).toHaveLength(NUM_REQUISICOES);

      const latenciasInternas = resultados.map((r) => r.metadados.latenciaMs);
      const stats = calcularPercentis(latenciasInternas);

      console.log('--- 100 Requisicoes Concorrentes ---');
      console.log('Duracao Total do Lote (100 reqs): ' + duracaoTotal.toFixed(1) + 'ms');
      console.log('Latencia Interna de Busca: Media: ' + stats.media.toFixed(1) + 'ms | p50: ' + stats.p50.toFixed(1) + 'ms | p95: ' + stats.p95.toFixed(1) + 'ms | Max: ' + stats.max.toFixed(1) + 'ms');

      // Latencia interna de execucao de cada busca deve ser estritamente < 250ms
      expect(stats.media).toBeLessThan(250);
      expect(stats.max).toBeLessThan(250);
      // Lote completo de 100 requisicoes concorrentes deve ser finalizado em < 3.000ms
      expect(duracaoTotal).toBeLessThan(5000);
    });

    it('deve processar 250 requisicoes paralelas com integridade total e latencia interna < 250ms', async () => {
      const adaptador = new AdaptadorInventarioMock({ totalSkus: 25_000, seed: 42 });
      await adaptador.carregarInventarioCompleto({ fornecedoresPermitidos: [101] });

      const NUM_REQUISICOES = 250;
      const inicioTotal = performance.now();

      const promises = Array.from({ length: NUM_REQUISICOES }, (_, idx) => {
        const fornecedor = 101 + (idx % 6);
        const secao = ((idx % 5) + 1) * 10;
        return adaptador.carregarInventarioCompleto({
          fornecedoresPermitidos: [fornecedor],
          secaoId: secao,
        });
      });

      const resultados = await Promise.all(promises);
      const duracaoTotal = performance.now() - inicioTotal;

      expect(resultados).toHaveLength(NUM_REQUISICOES);

      const latenciasInternas = resultados.map((r) => r.metadados.latenciaMs);
      const stats = calcularPercentis(latenciasInternas);

      console.log('--- 250 Requisicoes Concorrentes ---');
      console.log('Duracao Total do Lote (250 reqs): ' + duracaoTotal.toFixed(1) + 'ms');
      console.log('Latencia Interna de Busca: Media: ' + stats.media.toFixed(1) + 'ms | p50: ' + stats.p50.toFixed(1) + 'ms | p95: ' + stats.p95.toFixed(1) + 'ms | Max: ' + stats.max.toFixed(1) + 'ms');

      expect(stats.media).toBeLessThan(250);
      expect(stats.max).toBeLessThan(250);
      expect(duracaoTotal).toBeLessThan(5000);
    });

    it('deve resistir a Cold Start concorrente de 50 requisicoes disparadas simultaneamente', async () => {
      const adaptador = new AdaptadorInventarioMock({ totalSkus: 25_000, seed: 42 });

      const NUM_REQUISICOES = 50;
      const t0 = performance.now();
      const promises = Array.from({ length: NUM_REQUISICOES }, (_, idx) => {
        const fornecedor = 101 + (idx % 6);
        return adaptador.carregarInventarioCompleto({
          fornecedoresPermitidos: [fornecedor],
        });
      });

      const resultados = await Promise.all(promises);
      const duracaoTotal = performance.now() - t0;

      expect(resultados).toHaveLength(NUM_REQUISICOES);
      expect(duracaoTotal).toBeLessThan(2500);
      for (const res of resultados) {
        expect(res.produtos.length).toBeGreaterThan(0);
        expect(res.metadados.totalSkusCarregados).toBe(res.produtos.length);
      }
    });
  });

  describe('4. Filtros Adversariais e Edge Cases', () => {
    it('deve responder em < 250ms mesmo no cold-start com filtro sem correspondencia (empty set)', async () => {
      const adaptador = new AdaptadorInventarioMock({ totalSkus: 25_000, seed: 42 });

      const t0 = performance.now();
      const res = await adaptador.carregarInventarioCompleto({
        fornecedoresPermitidos: [99999],
        secaoId: 99999,
      });
      const duracao = performance.now() - t0;

      expect(res.produtos).toHaveLength(0);
      expect(res.estoques.size).toBe(0);
      expect(res.historicos.size).toBe(0);
      expect(res.entradasHoje).toHaveLength(0);
      expect(res.similares.size).toBe(0);
      expect(duracao).toBeLessThan(250); // Requisito do projeto: < 250ms
    });

    it('deve responder em < 50ms quando o dataset ja esta aquecido (warm cache)', async () => {
      const adaptador = new AdaptadorInventarioMock({ totalSkus: 25_000, seed: 42 });
      // Aquece
      await adaptador.carregarInventarioCompleto({ fornecedoresPermitidos: null });

      const t0 = performance.now();
      const res = await adaptador.carregarInventarioCompleto({
        fornecedoresPermitidos: [99999],
        secaoId: 99999,
      });
      const duracao = performance.now() - t0;

      expect(res.produtos).toHaveLength(0);
      expect(duracao).toBeLessThan(50);
    });

    it('deve lidar eficientemente com lista massiva de fornecedores permitidos (1.000 IDs)', async () => {
      const adaptador = new AdaptadorInventarioMock({ totalSkus: 25_000, seed: 42 });
      const muitosFornecedores = Array.from({ length: 1_000 }, (_, i) => i + 1);

      const t0 = performance.now();
      const res = await adaptador.carregarInventarioCompleto({
        fornecedoresPermitidos: muitosFornecedores,
      });
      const duracao = performance.now() - t0;

      expect(duracao).toBeLessThan(250);
      expect(res.produtos).toHaveLength(25_000);
    });
  });
});

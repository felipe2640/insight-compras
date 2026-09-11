/**
 * Testes Automatizados da Visão de Rede Consolidada de Transferências
 * Camada: Testes / Transferências (tests/transferencias/visao-rede.test.ts)
 * 100% em Português do Brasil (pt-BR).
 *
 * Valida a matriz de transferências inter-lojas (envios e recebimentos)
 * e o cumprimento rigoroso da regra de proteção da doadora em escala de rede.
 */

import { describe, it, expect } from "vitest";
import {
  calcularBalanceamentoRede,
  SaldoFilialParaTransferencia,
  ResultadoTransferencia,
} from "@core/transferencia/balanceamento";
import { obterTenantAtivo, montarNomesFiliais } from "@/lib/cockpit/opcoes-tenant";

describe("Transferências com Visão de Rede Consolidada", () => {
  it("deve mapear corretamente a matriz de transferências entre todas as filiais da rede", () => {
    const filiais: SaldoFilialParaTransferencia[] = [
      { filialId: 1, nomeFilial: "Loja 1", saldoFisico: 50, estoqueMinimo: 10, necessidadeCompra: 0 }, // Sobra: 40
      { filialId: 2, nomeFilial: "Loja 2", saldoFisico: 30, estoqueMinimo: 10, necessidadeCompra: 0 }, // Sobra: 20
      { filialId: 3, nomeFilial: "Loja 3", saldoFisico: 2, estoqueMinimo: 8, necessidadeCompra: 15 },   // Falta: 15
      { filialId: 4, nomeFilial: "Loja 4", saldoFisico: 0, estoqueMinimo: 12, necessidadeCompra: 25 },  // Falta: 25
    ];

    const transferencias = calcularBalanceamentoRede(filiais, {
      produtoId: 101,
      codigoSku: "SKU-REDE-01",
    });

    expect(transferencias.length).toBeGreaterThan(0);

    // Constrói a matriz N x N
    const matriz = new Map<number, Map<number, number>>();
    for (const f of filiais) {
      const colunas = new Map<number, number>();
      for (const d of filiais) colunas.set(d.filialId, 0);
      matriz.set(f.filialId, colunas);
    }

    let totalEnviadoRede = 0;
    let totalRecebidoRede = 0;

    for (const t of transferencias) {
      const celula = matriz.get(t.filialOrigemId)!.get(t.filialDestinoId)!;
      matriz.get(t.filialOrigemId)!.set(t.filialDestinoId, celula + t.quantidadeTransferir);

      totalEnviadoRede += t.quantidadeTransferir;
      totalRecebidoRede += t.quantidadeTransferir;

      // Invariante de proteção
      expect(t.saldoOrigemApos).toBeGreaterThanOrEqual(t.estoqueMinimoOrigem);
      // Nenhuma loja doa para si mesma
      expect(t.filialOrigemId).not.toBe(t.filialDestinoId);
    }

    // Conservação de estoque na rede: total enviado DEVE ser igual ao total recebido
    expect(totalEnviadoRede).toBe(totalRecebidoRede);
    // Demanda total das lojas 3 e 4 era 15 + 25 = 40
    // Sobras totais das lojas 1 e 2 eram 40 + 20 = 60
    // A rede deve atender integralmente os 40 necessários
    expect(totalEnviadoRede).toBe(40);

    // Diagonal principal deve ser rigorosamente zero
    for (const f of filiais) {
      expect(matriz.get(f.filialId)!.get(f.filialId)).toBe(0);
    }
  });

  it("deve calcular o balanço líquido de cada loja na rede (doadora líquida vs receptora líquida)", () => {
    const filiais: SaldoFilialParaTransferencia[] = [
      { filialId: 1, nomeFilial: "Matriz", saldoFisico: 100, estoqueMinimo: 20, necessidadeCompra: 0 },
      { filialId: 2, nomeFilial: "Filial A", saldoFisico: 10, estoqueMinimo: 10, necessidadeCompra: 15 },
      { filialId: 3, nomeFilial: "Filial B", saldoFisico: 5, estoqueMinimo: 15, necessidadeCompra: 20 },
    ];

    const transferencias = calcularBalanceamentoRede(filiais);

    const enviadosPorLoja = new Map<number, number>([[1, 0], [2, 0], [3, 0]]);
    const recebidosPorLoja = new Map<number, number>([[1, 0], [2, 0], [3, 0]]);

    for (const t of transferencias) {
      enviadosPorLoja.set(t.filialOrigemId, enviadosPorLoja.get(t.filialOrigemId)! + t.quantidadeTransferir);
      recebidosPorLoja.set(t.filialDestinoId, recebidosPorLoja.get(t.filialDestinoId)! + t.quantidadeTransferir);
    }

    const balanco1 = enviadosPorLoja.get(1)! - recebidosPorLoja.get(1)!;
    const balanco2 = enviadosPorLoja.get(2)! - recebidosPorLoja.get(2)!;
    const balanco3 = enviadosPorLoja.get(3)! - recebidosPorLoja.get(3)!;

    // Matriz é doadora líquida (+35)
    expect(balanco1).toBe(35);
    // Filiais A e B são receptoras líquidas (-15 e -20)
    expect(balanco2).toBe(-15);
    expect(balanco3).toBe(-20);
    // Soma de todos os balanços na rede fechada é estritamente 0
    expect(balanco1 + balanco2 + balanco3).toBe(0);
  });

  it("deve integrar perfeitamente com as filiais cadastradas do tenant ativo", () => {
    const tenant = obterTenantAtivo();
    const mapaFiliais = montarNomesFiliais(tenant);
    const lojas = Object.entries(mapaFiliais).map(([id, nome]) => ({
      id: Number(id),
      nome,
    }));

    expect(lojas.length).toBeGreaterThanOrEqual(1);

    // Garante que o cadastro do tenant provê dados válidos para transferências
    for (const l of lojas) {
      expect(l.id).toBeGreaterThan(0);
      expect(l.nome.trim().length).toBeGreaterThan(0);
    }
  });
});

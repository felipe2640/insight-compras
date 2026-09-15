/**
 * Testes Automatizados: Rastreamento de Pedidos do ERP e Aprendizado com Compras Reais
 * Camada: Testes / Pedidos (tests/pedidos/pedidos-erp.test.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { AdaptadorInventarioMock } from "@adapters/mock/adaptador-mock";
import { GET as getHistorico } from "@/app/api/pedidos/historico/route";
import { GET as getComparativo } from "@/app/api/aprendizado/comparativo/route";
import * as servidorAuth from "@/lib/autenticacao/servidor";

describe("Rastreamento de Pedidos e Ciclo de Compras pelo ERP", () => {
  let mockAdapter: AdaptadorInventarioMock;

  beforeEach(() => {
    mockAdapter = new AdaptadorInventarioMock();

    vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue({
      id: "usr-gestor-01",
      nome: "Gestor Carreiro",
      email: "gestor@carreiro.com.br",
      role: "GESTOR",
      allowedSupplierIds: null,
      tenantId: "carreiro",
    });
  });

  describe("1. Métodos do Adaptador de Compras ERP", () => {
    it("deve listar pedidos de compra formalizados no ERP", async () => {
      const pedidos = await mockAdapter.listarPedidosCompraERP({ dias: 30, filialId: 1 });
      expect(pedidos).toBeDefined();
      expect(Array.isArray(pedidos)).toBe(true);
      expect(pedidos.length).toBeGreaterThan(0);

      const p = pedidos[0];
      expect(p.id).toBeDefined();
      expect(p.numero).toBeDefined();
      expect(p.valorTotal).toBeGreaterThan(0);
      expect(p.filialId).toBe(1);
      expect(p.filialNome).toContain("Carreiro");
    });

    it("deve listar itens de um pedido de compra do ERP", async () => {
      const itens = await mockAdapter.listarItensPedidoCompraERP(1001);
      expect(Array.isArray(itens)).toBe(true);
      expect(itens.length).toBeGreaterThan(0);

      const item = itens[0];
      expect(item.pedidoId).toBe(1001);
      expect(item.quantidade).toBeGreaterThan(0);
      expect(item.valorUnitario).toBeGreaterThan(0);
      expect(item.valorTotal).toBeGreaterThan(0);
    });

    it("deve listar cotações de compra abertas e concluídas do ERP", async () => {
      const cotacoes = await mockAdapter.listarCotacoesERP({ dias: 30 });
      expect(Array.isArray(cotacoes)).toBe(true);
      expect(cotacoes.length).toBeGreaterThan(0);

      const c = cotacoes[0];
      expect(c.rowId).toBeDefined();
      expect(c.codigo).toBeDefined();
      expect(c.totalItens).toBeGreaterThan(0);
      expect(c.descricao).toContain("COTAÇÃO");
    });

    it("deve listar todas as compras do ERP na janela para o aprendizado", async () => {
      const compras = await mockAdapter.listarTodasComprasERPNaJanela(30, 1);
      expect(Array.isArray(compras)).toBe(true);
      expect(compras.length).toBeGreaterThan(0);
      expect(compras[0].quantidade).toBeGreaterThan(0);
    });
  });

  describe("2. Rota /api/pedidos/historico com Suporte a ERP Real", () => {
    it("deve retornar pedidos do ERP quando origem=erp for solicitada", async () => {
      const req = new NextRequest("http://localhost:3000/api/pedidos/historico?origem=erp&dias=30");
      const res = await getHistorico(req);

      expect(res.status).toBe(200);
      const corpo = await res.json();
      expect(corpo.origem).toBe("erp");
      expect(Array.isArray(corpo.pedidos)).toBe(true);
      expect(corpo.pedidos.length).toBeGreaterThan(0);
      expect(corpo.pedidos[0].origem).toBe("erp");
    });

    it("deve retornar cotações do ERP quando tipo=cotacoes for solicitado", async () => {
      const req = new NextRequest("http://localhost:3000/api/pedidos/historico?tipo=cotacoes&dias=30");
      const res = await getHistorico(req);

      expect(res.status).toBe(200);
      const corpo = await res.json();
      expect(corpo.tipo).toBe("cotacoes");
      expect(Array.isArray(corpo.cotacoes)).toBe(true);
      expect(corpo.cotacoes.length).toBeGreaterThan(0);
    });
  });

  describe("3. Rota /api/aprendizado/comparativo com Compras Reais do ERP", () => {
    it("deve cruzar sugestões do modelo com compras reais do ERP quando fonte=erp", async () => {
      const req = new NextRequest("http://localhost:3000/api/aprendizado/comparativo?fonte=erp&dias=30");
      const res = await getComparativo(req);

      expect(res.status).toBe(200);
      const corpo = await res.json();
      expect(corpo.fonte).toBe("erp");
      expect(Array.isArray(corpo.itens)).toBe(true);
      expect(corpo.itens.length).toBeGreaterThan(0);
      expect(corpo.resumo).toBeDefined();
      expect(corpo.resumo.total).toBe(corpo.itens.length);
    });
  });
});

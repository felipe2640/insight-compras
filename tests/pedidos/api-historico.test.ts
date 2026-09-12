/**
 * Testes Automatizados da API de Histórico e Ciclo de Vida de Pedidos
 * Camada: Testes / Pedidos (tests/pedidos/api-historico.test.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/pedidos/historico/route";
import { definirRepositorioPedidos, RepositorioPedidosMemoria, reiniciarRepositorioPedidos } from "@/lib/pedidos";
import * as servidorAuth from "@/lib/autenticacao/servidor";

describe("API /api/pedidos/historico — Consulta e Transição de Ciclo de Vida", () => {
  let repo: RepositorioPedidosMemoria;

  beforeEach(() => {
    reiniciarRepositorioPedidos();
    repo = new RepositorioPedidosMemoria(true); // com demo data
    definirRepositorioPedidos(repo);

    vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue({
      id: "usr-comp-01",
      nome: "Carlos Comprador",
      email: "carlos@carreiro.com.br",
      role: "COMPRADOR",
      allowedSupplierIds: [501],
      tenantId: "carreiro",
    });
  });

  it("GET sem parâmetros deve retornar lista de pedidos do tenant", async () => {
    const req = new NextRequest("http://localhost:3000/api/pedidos/historico?dias=30");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(Array.isArray(corpo.pedidos)).toBe(true);
    expect(corpo.pedidos.length).toBeGreaterThanOrEqual(4);
    // `configurado` passou a significar PERSISTIDO, não "tem o que listar".
    // Sem banco, o histórico vive na memória e some no próximo reinício — e a
    // tela precisa poder avisar. Antes a rota respondia sempre `true`, então o
    // aviso que já existia na interface nunca aparecia.
    expect(corpo.configurado).toBe(false);
  });

  it("GET com pedidoId deve retornar o pedido e sua lista de itens", async () => {
    const req = new NextRequest("http://localhost:3000/api/pedidos/historico?pedidoId=1001");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.pedido).toBeDefined();
    expect(corpo.pedido.id).toBe(1001);
    expect(Array.isArray(corpo.itens)).toBe(true);
    expect(corpo.itens.length).toBeGreaterThanOrEqual(2);
  });

  it("PATCH deve avançar com sucesso o estado do pedido", async () => {
    // Pedido 1004 está em "exportado"
    const req = new NextRequest("http://localhost:3000/api/pedidos/historico", {
      method: "PATCH",
      body: JSON.stringify({
        pedidoId: 1004,
        novoStatus: "enviado",
        observacao: "Ordem transmitida por e-mail",
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const corpo = await res.json();

    expect(corpo.sucesso).toBe(true);
    expect(corpo.pedido.status).toBe("enviado");
    expect(corpo.pedido.enviadoPor).toContain("Carlos Comprador");
    expect(corpo.pedido.historico.length).toBe(1);
    expect(corpo.pedido.historico[0].observacao).toBe("Ordem transmitida por e-mail");
  });

  it("PATCH com transição inválida deve retornar status 400", async () => {
    // Tenta pular de "exportado" direto para "recebido"
    const req = new NextRequest("http://localhost:3000/api/pedidos/historico", {
      method: "PATCH",
      body: JSON.stringify({
        pedidoId: 1004,
        novoStatus: "recebido",
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const corpo = await res.json();
    expect(corpo.sucesso).toBe(false);
    expect(corpo.erro).toContain("Transição inválida");
  });

  it("PATCH com pedido inexistente deve retornar status 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/pedidos/historico", {
      method: "PATCH",
      body: JSON.stringify({
        pedidoId: 99999,
        novoStatus: "enviado",
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const corpo = await res.json();
    expect(corpo.sucesso).toBe(false);
    expect(corpo.erro).toContain("não encontrado");
  });
});

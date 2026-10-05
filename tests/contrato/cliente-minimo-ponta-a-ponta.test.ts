/**
 * Um cliente MÍNIMO percorrendo as rotas de ponta a ponta.
 *
 * 2 lojas com ids 7 e 9 (nenhuma é a 1) e nenhuma capacidade de ERP. É o
 * cliente que o onboarding produz e que a suíte nunca tinha: onde qualquer
 * `?? 1` remanescente vira um número plausível e errado, e onde cada
 * capacidade ausente precisa responder "não tenho" em vez de quebrar.
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registrarTenant } from "@config/tenants";
import { limparInstanciasAdaptadores } from "@adapters/index";
import { limparCacheValidacaoAmbiente } from "@/lib/ambiente/validacao-ambiente";
import type { UsuarioAutenticado } from "@/lib/rbac/tipos";
import * as servidorAuth from "@/lib/autenticacao/servidor";
import { tenantMinimo } from "../ajuda/clientes-teste";

const TENANT_MINIMO = tenantMinimo();

const gestorDoMinimo: UsuarioAutenticado = {
  id: "usr-minimo",
  nome: "Gestora do Cliente Mínimo",
  email: "gestora@minimo.com.br",
  role: "GESTOR",
  allowedSupplierIds: null,
  tenantId: "minimo",
};

function requisicao(caminho: string): NextRequest {
  return new NextRequest(`http://localhost:3000${caminho}`, {
    headers: { "x-tenant-id": "minimo" },
  });
}

beforeEach(() => {
  registrarTenant(TENANT_MINIMO);
  limparInstanciasAdaptadores();
  limparCacheValidacaoAmbiente();
  vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue(gestorDoMinimo);
  vi.spyOn(servidorAuth, "podeGerirAprendizado").mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cliente mínimo, ponta a ponta", () => {
  it("o cockpit abre na loja do CADASTRO e só traz lojas cadastradas", async () => {
    const { GET } = await import("@/app/api/compras/route");
    const res = await GET(requisicao("/api/compras?formato=tabular"));

    expect(res.status).toBe(200);
    const corpo = await res.json();

    // A loja em foco é a 7, do cadastro. Antes o padrão era a filial 1, que
    // neste cliente não existe.
    expect(corpo.filialFocoId).toBe(7);
    expect(corpo.sucesso).toBe(true);
    expect(corpo.grade).toBeDefined();
    // Grade vazia passava despercebida: o recorte da fonte sintética olhava as
    // lojas 1 e 2 fixas e descartava todo item deste cliente.
    expect(corpo.total).toBeGreaterThan(0);
  });

  it("transferências entre as lojas do cliente não citam filial inexistente", async () => {
    const { GET } = await import("@/app/api/transferencias/route");
    const res = await GET(requisicao("/api/transferencias"));

    expect(res.status).toBe(200);
    const corpo = await res.json();

    expect(Array.isArray(corpo.dados)).toBe(true);
    // Sem transferência nenhuma, o laço abaixo não verificaria nada.
    expect(corpo.dados.length).toBeGreaterThan(0);
    for (const transferencia of corpo.dados) {
      expect([7, 9]).toContain(transferencia.filialDestinoId);
      expect([7, 9]).toContain(transferencia.filialOrigemId);
    }
  });

  it("transferências pedem à fonte só itens com estoque ou venda, com teto de 300 s", async () => {
    // A rota cortava em 60 s e carregava o catálogo INTEIRO da rede: medido ao
    // vivo, 130,8 s sem recorte contra 64,1 s com ele, e as mesmas 1.302
    // transferências. A tela mostrava "a consulta demorou mais de 60 segundos".
    const { AdaptadorInventarioMock } = await import("@adapters/mock/adaptador-mock");
    const espiao = vi.spyOn(AdaptadorInventarioMock.prototype, "carregarInventarioCompleto");

    const rota = await import("@/app/api/transferencias/route");
    const res = await rota.GET(requisicao("/api/transferencias"));

    expect(res.status).toBe(200);
    expect(rota.maxDuration).toBe(300);
    expect(espiao).toHaveBeenCalled();
    expect(espiao.mock.calls[0][0].apenasComEstoqueOuVenda).toBe(true);
  });

  it("sem capacidade de ERP, o histórico responde 'não configurado' em vez de quebrar", async () => {
    const { GET } = await import("@/app/api/pedidos/historico/route");
    const res = await GET(requisicao("/api/pedidos/historico?origem=erp&dias=30"));

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.temProcessoERP).toBe(false);
    expect(corpo.pedidos).toEqual([]);
  });

  it("sem capacidade de ERP, as cotações respondem vazio declarado", async () => {
    const { GET } = await import("@/app/api/pedidos/historico/route");
    const res = await GET(requisicao("/api/pedidos/historico?tipo=cotacoes&dias=30"));

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.configurado).toBe(false);
    expect(corpo.cotacoes).toEqual([]);
  });

  it("o comparativo de aprendizado não inventa compra de ERP que não existe", async () => {
    const { GET } = await import("@/app/api/aprendizado/comparativo/route");
    const res = await GET(requisicao("/api/aprendizado/comparativo?fonte=erp&dias=30"));

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.temProcessoERP).toBe(false);
    expect(corpo.itens).toEqual([]);
  });

  it("comprador sem carteira enxerga grade vazia, não o catálogo do cliente", async () => {
    vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue({
      ...gestorDoMinimo,
      id: "usr-comprador",
      role: "COMPRADOR",
      allowedSupplierIds: [],
    });

    const { GET } = await import("@/app/api/compras/route");
    const res = await GET(requisicao("/api/compras"));

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.total).toBe(0);
    expect(corpo.contagens.acionaveis).toBe(0);
  });

  it("sessão de outro cliente não acessa este", async () => {
    vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue({
      ...gestorDoMinimo,
      tenantId: "demonstracao",
    });

    const { GET } = await import("@/app/api/compras/route");
    const res = await GET(requisicao("/api/compras"));

    expect(res.status).toBe(403);
    const corpo = await res.json();
    expect(corpo.motivo).toBe("tenant_divergente");
  });
});

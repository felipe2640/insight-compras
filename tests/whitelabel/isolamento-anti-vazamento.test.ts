/**
 * Suíte de Testes Automatizados: Blindagem Anti-Vazamento Multi-Tenant
 *
 * Garante de forma categórica e irrestrita que NENHUM dado do ERP do cliente real
 * (Rede Carreiro / Connectsoft) vaze para o tenant de demonstração ("demonstracao")
 * ou para adaptadores sintéticos.
 *
 * 100% em Português do Brasil (pt-BR).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { AdaptadorInventarioMock } from "@adapters/mock/adaptador-mock";
import {
  gerarDatasetSintetico,
  NOMES_FILIAIS_SINTETICAS,
} from "@adapters/mock/gerador-sintetico";
import { obterAdaptadorInventario, limparInstanciasAdaptadores } from "@adapters/index";
import { TENANT_DEMONSTRACAO, TENANT_CARREIRO } from "@config/tenants";

const TERMOS_PROIBIDOS_DEMONSTRACAO = [
  "carreiro",
  "pedro ii",
  "piripiri",
  "poranga",
  "campo maior",
  "josé de freitas",
  "jose de freitas",
  "connectsoft",
  "ceará auto peças",
  "ceara auto pecas",
  "melo / piripiri",
] as const;

function contemTermoProibido(texto: string): string | null {
  const normalizado = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const termo of TERMOS_PROIBIDOS_DEMONSTRACAO) {
    const termoNormalizado = termo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalizado.includes(termoNormalizado)) {
      return termo;
    }
  }
  return null;
}

describe("Blindagem Anti-Vazamento: Isolamento Estrito Cliente Real × Demonstração", () => {
  beforeEach(() => {
    limparInstanciasAdaptadores();
  });

  afterEach(() => {
    limparInstanciasAdaptadores();
  });

  describe("1. Adaptador Mock e Gerador Sintético", () => {
    it("NOMES_FILIAIS_SINTETICAS deve conter apenas nomes fictícios neutros", () => {
      for (const [id, nome] of Object.entries(NOMES_FILIAIS_SINTETICAS)) {
        const termo = contemTermoProibido(nome);
        expect(termo, `Filial sintética #${id} contém termo proibido: "${nome}"`).toBeNull();
      }
      expect(NOMES_FILIAIS_SINTETICAS[1]).toBe("Loja Matriz");
      expect(NOMES_FILIAIS_SINTETICAS[2]).toBe("Loja Norte");
    });

    it("gerarDatasetSintetico não deve conter nomes reais em estoques de filiais", () => {
      const dataset = gerarDatasetSintetico({ totalSkus: 50 });

      for (const [chave, estoque] of dataset.estoques.entries()) {
        const termo = contemTermoProibido(estoque.nomeFilial);
        expect(
          termo,
          `Estoque sintético [${chave}] vazou nome real: "${estoque.nomeFilial}"`
        ).toBeNull();
      }
    });

    it("AdaptadorInventarioMock.listarPedidosCompraERP não deve vazar nomes de lojas ou ERP real", async () => {
      const mock = new AdaptadorInventarioMock({ totalSkus: 50 });
      const pedidos = await mock.pedidosERP!.listarPedidos({ dias: 30, limite: 50 });

      expect(pedidos.length).toBeGreaterThan(0);
      for (const p of pedidos) {
        expect(contemTermoProibido(p.filialNome ?? "")).toBeNull();
        expect(contemTermoProibido(p.fornecedorNome ?? "")).toBeNull();
        expect(p.filialNome).toMatch(/^Loja (Matriz|Norte|Sul|Leste|Oeste)$/);
      }
    });

    it("AdaptadorInventarioMock.listarCotacoesERP não deve vazar nomes de lojas ou fornecedores reais", async () => {
      const mock = new AdaptadorInventarioMock({ totalSkus: 50 });
      const cotacoes = await mock.cotacoesERP!.listarCotacoes({ dias: 30 });

      expect(cotacoes.length).toBeGreaterThan(0);
      for (const c of cotacoes) {
        expect(contemTermoProibido(c.filialNome ?? "")).toBeNull();
        expect(contemTermoProibido(c.descricao)).toBeNull();
        expect(c.filialNome).toMatch(/^Loja (Matriz|Norte|Sul|Leste|Oeste)$/);
      }
    });
  });

  describe("2. Resolução do Adaptador de Demonstração", () => {
    it("obterAdaptadorInventario para tenant 'demonstracao' sempre entrega AdaptadorInventarioMock", () => {
      const adaptador = obterAdaptadorInventario({ tenant: "demonstracao" });
      expect(adaptador).toBeInstanceOf(AdaptadorInventarioMock);
    });

    it("obterAdaptadorInventario para objeto TENANT_DEMONSTRACAO entrega AdaptadorInventarioMock", () => {
      const adaptador = obterAdaptadorInventario({ tenant: TENANT_DEMONSTRACAO });
      expect(adaptador).toBeInstanceOf(AdaptadorInventarioMock);
    });

    it("Adaptador da demonstração nunca deve expor métodos específicos de cliente real", async () => {
      const adaptador = obterAdaptadorInventario({ tenant: "demonstracao" });
      const pedidos = await adaptador.pedidosERP!.listarPedidos({ dias: 7 });

      for (const p of pedidos) {
        expect(p.filialNome).not.toContain("Carreiro");
        expect(p.filialNome).not.toContain("Pedro II");
        expect(p.filialNome).not.toContain("Piripiri");
      }
    });
  });

  describe("3. Configurações White-Label e Tenant Demonstração", () => {
    it("TENANT_DEMONSTRACAO não deve ter nenhuma filial com nome da Rede Carreiro", () => {
      for (const filial of TENANT_DEMONSTRACAO.filiais) {
        expect(contemTermoProibido(filial.nome)).toBeNull();
        expect(contemTermoProibido(filial.cidade ?? "")).toBeNull();
      }
    });

    it("a demonstração não nomeia o ERP de cliente nenhum", () => {
      // O rótulo do ERP virou um campo do cadastro, e o da demonstração é
      // vazio de propósito: sem nome de ERP, não há nome de cliente a vazar.
      expect(TENANT_DEMONSTRACAO.fonte.nomeERP).toBeUndefined();
      expect(TENANT_DEMONSTRACAO.fonte.adaptador).toBe("sintetica");
    });

    it("o cliente real nomeia o próprio ERP, e isso é só rótulo", () => {
      expect(TENANT_CARREIRO.fonte.nomeERP).toBe("ConnectSoft ShopCash");
      expect(TENANT_CARREIRO.fonte.adaptador).toBe("powerbi-dax");
    });
  });

  describe("4. Rotas de API — Blindagem de Rótulos de ERP por Tenant", () => {
    it("/api/pedidos/historico: tenant 'demonstracao' deve responder com ERP Integrado e sem menções a Connectsoft", async () => {
      const { GET } = await import("@/app/api/pedidos/historico/route");
      const servidorAuth = await import("@/lib/autenticacao/servidor");

      vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue({
        id: "usr-demo",
        nome: "Comprador Demo",
        email: "demo@insightd.com.br",
        role: "COMPRADOR",
        allowedSupplierIds: null,
        tenantId: "demonstracao",
      });

      const req = new NextRequest("http://localhost:3000/api/pedidos/historico?origem=erp&dias=30");
      const res = await GET(req);
      expect(res.status).toBe(200);

      const dados = await res.json();
      expect(dados.pedidos.length).toBeGreaterThan(0);
      for (const p of dados.pedidos) {
        expect(p.usuario).toBe("ERP integrado");
        expect(p.modeloId).toBe("erp");
        expect(contemTermoProibido(p.usuario)).toBeNull();
        expect(contemTermoProibido(p.filialNome ?? "")).toBeNull();
      }
    });

    it("/api/pedidos/historico: cliente real SEM credencial responde erro, nunca dado sintético", async () => {
      const { GET } = await import("@/app/api/pedidos/historico/route");
      const servidorAuth = await import("@/lib/autenticacao/servidor");

      vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue({
        id: "usr-carreiro",
        nome: "Comprador do Cliente",
        email: "comprador@cliente.com.br",
        role: "COMPRADOR",
        allowedSupplierIds: null,
        tenantId: "carreiro",
      });

      const req = new NextRequest("http://localhost:3000/api/pedidos/historico?origem=erp&dias=30");
      const res = await GET(req);

      // Antes, a fábrica caía no mock em silêncio e esta rota devolvia pedidos
      // SINTÉTICOS para um cliente real, com aparência de pedido de verdade.
      expect(res.status).toBe(503);
      const dados = await res.json();
      expect(dados.motivo).toBe("configuracao_incompleta");
      expect(dados.pedidos).toBeUndefined();
    });

    it("/api/aprendizado/comparativo: tenant 'demonstracao' deve usar rótulo 'ERP Integrado (Compra Real)'", async () => {
      const { GET } = await import("@/app/api/aprendizado/comparativo/route");
      const servidorAuth = await import("@/lib/autenticacao/servidor");

      vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue({
        id: "usr-demo",
        nome: "Comprador Demo",
        email: "demo@insightd.com.br",
        role: "GESTOR",
        allowedSupplierIds: null,
        tenantId: "demonstracao",
      });

      const req = new NextRequest("http://localhost:3000/api/aprendizado/comparativo?fonte=erp&dias=30");
      const res = await GET(req);
      expect(res.status).toBe(200);

      const dados = await res.json();
      expect(dados.itens.length).toBeGreaterThan(0);
      for (const item of dados.itens) {
        expect(item.usuario).toBe("ERP integrado (compra real)");
        expect(contemTermoProibido(item.usuario)).toBeNull();
      }
    });

    it("/api/aprendizado/confirmar: a demonstração fecha o ciclo pela fonte sintética, sem tocar no Power BI", async () => {
      const { POST } = await import("@/app/api/aprendizado/confirmar/route");
      const servidorAuth = await import("@/lib/autenticacao/servidor");
      const repositorioAprendizado = await import("@/lib/aprendizado/repositorio");

      vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue({
        id: "usr-demo",
        nome: "Gestor Demo",
        email: "gestor@insightd.com.br",
        role: "GESTOR",
        allowedSupplierIds: null,
        tenantId: "demonstracao",
      });
      vi.spyOn(servidorAuth, "podeGerirAprendizado").mockReturnValue(true);
      vi.spyOn(repositorioAprendizado, "aprendizadoConfigurado").mockReturnValue(true);
      vi.spyOn(repositorioAprendizado, "listarItensParaConfirmar").mockResolvedValue([]);

      const req = new NextRequest("http://localhost:3000/api/aprendizado/confirmar?janela=10&dias=45", {
        method: "POST",
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const dados = await res.json();
      // A rota deixou de importar o cliente do Power BI e de perguntar "é a
      // Carreiro?": ela usa a capacidade da FONTE do tenant, que aqui é
      // sintética. Sem itens pendentes, não há consulta nenhuma.
      expect(dados.ok).toBe(true);
      expect(dados.consultas).toBe(0);
      expect(dados.itens).toBe(0);
    });
  });
});

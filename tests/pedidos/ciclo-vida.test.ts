/**
 * Testes Automatizados do Ciclo de Vida de Pedidos e Rastreabilidade
 * Camada: Testes / Pedidos (tests/pedidos/ciclo-vida.test.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  FLUXO_STATUS_PEDIDO,
  ItemPedido,
  Pedido,
  RepositorioPedidosMemoria,
  StatusPedido,
  obterProximoStatus,
  obterStatusAnterior,
  validarTransicaoStatus,
  obterRepositorioPedidos,
  definirRepositorioPedidos,
  reiniciarRepositorioPedidos,
  atualizarStatusPedido,
  listarPedidosExportados,
  listarItensDoPedido,
  obterPedidoPorId,
} from "@/lib/pedidos";

describe("U3: Ciclo de Vida Completo de Pedidos (exportado -> enviado -> confirmado -> recebido)", () => {
  beforeEach(() => {
    reiniciarRepositorioPedidos();
  });

  describe("1. Máquina de Estados e Regras Puras de Transição", () => {
    it("deve definir a ordem sequencial estrita dos estados", () => {
      expect(FLUXO_STATUS_PEDIDO).toEqual(["exportado", "enviado", "confirmado", "recebido"]);
    });

    it("deve obter corretamente o próximo estado na esteira", () => {
      expect(obterProximoStatus("exportado")).toBe("enviado");
      expect(obterProximoStatus("enviado")).toBe("confirmado");
      expect(obterProximoStatus("confirmado")).toBe("recebido");
      expect(obterProximoStatus("recebido")).toBeNull();
    });

    it("deve obter corretamente o estado anterior", () => {
      expect(obterStatusAnterior("exportado")).toBeNull();
      expect(obterStatusAnterior("enviado")).toBe("exportado");
      expect(obterStatusAnterior("confirmado")).toBe("enviado");
      expect(obterStatusAnterior("recebido")).toBe("confirmado");
    });

    it("deve validar transições permitidas", () => {
      expect(validarTransicaoStatus("exportado", "enviado").valido).toBe(true);
      expect(validarTransicaoStatus("enviado", "confirmado").valido).toBe(true);
      expect(validarTransicaoStatus("confirmado", "recebido").valido).toBe(true);
    });

    it("deve bloquear transições que pulam etapas", () => {
      const pularParaConfirmado = validarTransicaoStatus("exportado", "confirmado");
      expect(pularParaConfirmado.valido).toBe(false);
      expect(pularParaConfirmado.motivo).toContain("Transição inválida");

      const pularParaRecebido = validarTransicaoStatus("exportado", "recebido");
      expect(pularParaRecebido.valido).toBe(false);

      const pularEnviadoParaRecebido = validarTransicaoStatus("enviado", "recebido");
      expect(pularEnviadoParaRecebido.valido).toBe(false);
    });

    it("deve bloquear transições para o mesmo estado", () => {
      const mesmoEstado = validarTransicaoStatus("enviado", "enviado");
      expect(mesmoEstado.valido).toBe(false);
      expect(mesmoEstado.motivo).toContain("já se encontra no estado");
    });

    it("deve bloquear retrocesso de estado", () => {
      const retrocesso = validarTransicaoStatus("recebido", "exportado");
      expect(retrocesso.valido).toBe(false);
    });
  });

  describe("2. Transição com Gravação de Data, Responsável e Histórico", () => {
    let repo: RepositorioPedidosMemoria;

    beforeEach(() => {
      repo = new RepositorioPedidosMemoria(false); // limpo
      definirRepositorioPedidos(repo);
    });

    it("deve avançar pedido de 'exportado' para 'enviado' gravando data e responsável", async () => {
      const dataExportacao = new Date(Date.now() - 3600000).toISOString();
      const pedidoInicial: Pedido = {
        id: 501,
        tenantId: "carreiro",
        exportadoEm: dataExportacao,
        usuario: "comprador@carreiro.com.br",
        filialId: 1,
        modeloId: "pedido_fornecedor",
        formato: "xlsx",
        totalItens: 5,
        status: "exportado",
        historico: [],
      };

      repo.adicionarPedido(pedidoInicial);

      const dataEnvio = new Date().toISOString();
      const pedidoAtualizado = await atualizarStatusPedido({
        tenantId: "carreiro",
        pedidoId: 501,
        novoStatus: "enviado",
        responsavel: "Carlos Gestor (carlos@carreiro.com.br)",
        observacao: "Pedido formal transmitido ao representante comercial.",
        dataHora: dataEnvio,
      });

      expect(pedidoAtualizado.status).toBe("enviado");
      expect(pedidoAtualizado.enviadoEm).toBe(dataEnvio);
      expect(pedidoAtualizado.enviadoPor).toBe("Carlos Gestor (carlos@carreiro.com.br)");
      expect(pedidoAtualizado.confirmadoEm).toBeNull();
      expect(pedidoAtualizado.recebidoEm).toBeNull();

      expect(pedidoAtualizado.historico).toHaveLength(1);
      expect(pedidoAtualizado.historico[0]).toEqual({
        de: "exportado",
        para: "enviado",
        dataHora: dataEnvio,
        responsavel: "Carlos Gestor (carlos@carreiro.com.br)",
        observacao: "Pedido formal transmitido ao representante comercial.",
      });
    });

    it("deve completar o ciclo total de 4 etapas registrando todas as transições", async () => {
      const pedido: Pedido = {
        id: 502,
        tenantId: "carreiro",
        exportadoEm: new Date(Date.now() - 100000).toISOString(),
        usuario: "comprador@carreiro.com.br",
        filialId: 2,
        modeloId: "pedido_fornecedor",
        formato: "csv",
        totalItens: 10,
        status: "exportado",
        historico: [],
      };
      repo.adicionarPedido(pedido);

      // 1. Exportado -> Enviado
      const posEnvio = await atualizarStatusPedido({
        tenantId: "carreiro",
        pedidoId: 502,
        novoStatus: "enviado",
        responsavel: "comprador@carreiro.com.br",
        observacao: "Enviado ao fornecedor",
      });
      expect(posEnvio.status).toBe("enviado");
      expect(posEnvio.enviadoEm).toBeTruthy();

      // 2. Enviado -> Confirmado
      const posConfirmacao = await atualizarStatusPedido({
        tenantId: "carreiro",
        pedidoId: 502,
        novoStatus: "confirmado",
        responsavel: "comprador@carreiro.com.br",
        observacao: "Fornecedor confirmou faturamento NF 9912",
      });
      expect(posConfirmacao.status).toBe("confirmado");
      expect(posConfirmacao.confirmadoEm).toBeTruthy();

      // 3. Confirmado -> Recebido
      const posRecebimento = await atualizarStatusPedido({
        tenantId: "carreiro",
        pedidoId: 502,
        novoStatus: "recebido",
        responsavel: "conferente.estoque@carreiro.com.br",
        observacao: "Carga descarregada e conferida no galpão",
      });
      expect(posRecebimento.status).toBe("recebido");
      expect(posRecebimento.recebidoEm).toBeTruthy();
      expect(posRecebimento.recebidoPor).toBe("conferente.estoque@carreiro.com.br");

      expect(posRecebimento.historico).toHaveLength(3);
      expect(posRecebimento.historico.map((h) => `${h.de}->${h.para}`)).toEqual([
        "exportado->enviado",
        "enviado->confirmado",
        "confirmado->recebido",
      ]);
    });

    it("deve rejeitar transição para pedido inexistente", async () => {
      await expect(
        atualizarStatusPedido({
          tenantId: "carreiro",
          pedidoId: 99999,
          novoStatus: "enviado",
          responsavel: "usuario",
        })
      ).rejects.toThrow("não encontrado");
    });
  });

  describe("3. Listagem, Filtros e Modo Demonstração", () => {
    it("deve carregar pedidos demo nos 4 estados quando em modo demonstração", async () => {
      const repoDemo = new RepositorioPedidosMemoria(true);
      definirRepositorioPedidos(repoDemo);

      const pedidos = await listarPedidosExportados({
        tenantId: "carreiro",
        dias: 30,
      });

      expect(pedidos.length).toBeGreaterThanOrEqual(4);

      const estadosPresentes = new Set(pedidos.map((p) => p.status));
      expect(estadosPresentes.has("exportado")).toBe(true);
      expect(estadosPresentes.has("enviado")).toBe(true);
      expect(estadosPresentes.has("confirmado")).toBe(true);
      expect(estadosPresentes.has("recebido")).toBe(true);
    });

    it("deve filtrar pedidos por status", async () => {
      const repoDemo = new RepositorioPedidosMemoria(true);
      definirRepositorioPedidos(repoDemo);

      const exportados = await listarPedidosExportados({
        tenantId: "carreiro",
        dias: 30,
        status: "exportado",
      });
      expect(exportados.every((p) => p.status === "exportado")).toBe(true);

      const recebidos = await listarPedidosExportados({
        tenantId: "carreiro",
        dias: 30,
        status: "recebido",
      });
      expect(recebidos.every((p) => p.status === "recebido")).toBe(true);
    });

    it("deve retornar itens de um pedido com cálculo correto de totais", async () => {
      const repoDemo = new RepositorioPedidosMemoria(true);
      definirRepositorioPedidos(repoDemo);

      const itens = await listarItensDoPedido("carreiro", 1001);
      expect(itens.length).toBeGreaterThanOrEqual(2);
      expect(itens[0].sku).toBe("AM-MON-001");
      expect(itens[0].valorTotal).toBe(1800.0);
    });
  });
});

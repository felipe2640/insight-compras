// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  MOTIVOS_REJEICAO_COMPRA,
  obterMotivoRejeicao,
  ehMotivoRejeicaoValido,
} from "@core/aprendizado";
import { motivoValido } from "@core/aprendizado";
import { SeletorMotivoRejeicao, BarraAcoesSelecao, criarColunasCockpit } from "@/components/cockpit";
import { quantidadePedidoEfetiva } from "@/lib/exportacao/catalogo-colunas";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";

describe("Cockpit — Seleção de Motivo de Rejeição de Itens de Compra", () => {
  describe("1. Taxonomia de Motivos de Rejeição", () => {
    it("deve conter os motivos requeridos: item similar tem estoque, item obsoleto e modelo superestimado", () => {
      const ids = MOTIVOS_REJEICAO_COMPRA.map((m) => m.id);
      expect(ids).toContain("ja_tem_similar");
      expect(ids).toContain("item_obsoleto");
      expect(ids).toContain("modelo_superestimou");

      const motivoSimilar = obterMotivoRejeicao("ja_tem_similar");
      expect(motivoSimilar?.rotulo).toBe("Item similar tem estoque");

      const motivoObsoleto = obterMotivoRejeicao("item_obsoleto");
      expect(motivoObsoleto?.rotulo).toBe("Item obsoleto");

      const motivoSuperestimado = obterMotivoRejeicao("modelo_superestimou");
      expect(motivoSuperestimado?.rotulo).toBe("Modelo superestimado");
    });

    it("todos os motivos de rejeição devem ser válidos na taxonomia do ciclo de aprendizado", () => {
      for (const motivo of MOTIVOS_REJEICAO_COMPRA) {
        expect(motivoValido(motivo.id)).toBe(true);
        expect(ehMotivoRejeicaoValido(motivo.id)).toBe(true);
      }
    });

    it("deve retornar falso para motivo inválido", () => {
      expect(ehMotivoRejeicaoValido("motivo_inexistente")).toBe(false);
      expect(obterMotivoRejeicao("motivo_inexistente")).toBeUndefined();
    });
  });

  describe("2. Componente SeletorMotivoRejeicao", () => {
    it("deve renderizar botão para rejeitar quando o item não estiver rejeitado", () => {
      render(
        <SeletorMotivoRejeicao
          skuId="SKU-001"
          rejeitado={false}
          onSelecionarMotivo={vi.fn()}
          onDesfazerRejeicao={vi.fn()}
        />
      );

      const botaoRejeitar = screen.getByRole("button", {
        name: /rejeitar compra do sku sku-001/i,
      });
      expect(botaoRejeitar).toBeDefined();
    });

    function abrirMenu(botao: HTMLElement) {
      fireEvent.pointerDown(botao, { button: 0 });
      fireEvent.keyDown(botao, { key: "Enter", code: "Enter" });
    }

    it("deve abrir o menu de motivos ao clicar no botão de rejeição", () => {
      render(
        <SeletorMotivoRejeicao
          skuId="SKU-001"
          rejeitado={false}
          aberto={true}
          onSelecionarMotivo={vi.fn()}
          onDesfazerRejeicao={vi.fn()}
        />
      );

      expect(screen.getByText("Item similar tem estoque")).toBeDefined();
      expect(screen.getByText("Item obsoleto")).toBeDefined();
      expect(screen.getByText("Modelo superestimado")).toBeDefined();
    });

    it("deve disparar onSelecionarMotivo ao escolher 'Item similar tem estoque'", () => {
      const onSelecionar = vi.fn();
      render(
        <SeletorMotivoRejeicao
          skuId="SKU-001"
          rejeitado={false}
          aberto={true}
          onSelecionarMotivo={onSelecionar}
          onDesfazerRejeicao={vi.fn()}
        />
      );

      const opcaoSimilar = screen.getByText("Item similar tem estoque");
      fireEvent.click(opcaoSimilar);

      expect(onSelecionar).toHaveBeenCalledWith("ja_tem_similar", "Item similar tem estoque");
    });

    it("deve disparar onSelecionarMotivo ao escolher 'Item obsoleto'", () => {
      const onSelecionar = vi.fn();
      render(
        <SeletorMotivoRejeicao
          skuId="SKU-002"
          rejeitado={false}
          aberto={true}
          onSelecionarMotivo={onSelecionar}
          onDesfazerRejeicao={vi.fn()}
        />
      );

      const opcaoObsoleto = screen.getByText("Item obsoleto");
      fireEvent.click(opcaoObsoleto);

      expect(onSelecionar).toHaveBeenCalledWith("item_obsoleto", "Item obsoleto");
    });

    it("deve disparar onSelecionarMotivo ao escolher 'Modelo superestimado'", () => {
      const onSelecionar = vi.fn();
      render(
        <SeletorMotivoRejeicao
          skuId="SKU-003"
          rejeitado={false}
          aberto={true}
          onSelecionarMotivo={onSelecionar}
          onDesfazerRejeicao={vi.fn()}
        />
      );

      const opcaoSuperestimado = screen.getByText("Modelo superestimado");
      fireEvent.click(opcaoSuperestimado);

      expect(onSelecionar).toHaveBeenCalledWith("modelo_superestimou", "Modelo superestimado");
    });

    it("deve renderizar badge com o motivo selecionado quando o item estiver rejeitado", () => {
      render(
        <SeletorMotivoRejeicao
          skuId="SKU-001"
          rejeitado={true}
          motivoAtual="ja_tem_similar"
          rotuloAtual="Item similar tem estoque"
          onSelecionarMotivo={vi.fn()}
          onDesfazerRejeicao={vi.fn()}
        />
      );

      expect(screen.getByText("Item similar tem estoque")).toBeDefined();
    });

    it("deve permitir desfazer a rejeição ao clicar no botão de reset", () => {
      const onDesfazer = vi.fn();
      render(
        <SeletorMotivoRejeicao
          skuId="SKU-001"
          rejeitado={true}
          motivoAtual="item_obsoleto"
          rotuloAtual="Item obsoleto"
          onSelecionarMotivo={vi.fn()}
          onDesfazerRejeicao={onDesfazer}
        />
      );

      const botaoDesfazer = screen.getByRole("button", {
        name: /desfazer rejeição do sku sku-001/i,
      });
      fireEvent.click(botaoDesfazer);

      expect(onDesfazer).toHaveBeenCalled();
    });
  });

  describe("3. Componente BarraAcoesSelecao (Ações em Lote durante Seleção)", () => {
    it("não deve renderizar quando totalSelecionados for 0", () => {
      const { container } = render(
        <BarraAcoesSelecao
          totalSelecionados={0}
          onRejeitarSelecionados={vi.fn()}
          onRestaurarSelecionados={vi.fn()}
          onLimparSelecao={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("deve exibir a barra e a contagem correta quando houver itens selecionados", () => {
      render(
        <BarraAcoesSelecao
          totalSelecionados={4}
          onRejeitarSelecionados={vi.fn()}
          onRestaurarSelecionados={vi.fn()}
          onLimparSelecao={vi.fn()}
        />
      );

      expect(screen.getByText("4 itens selecionados")).toBeDefined();
      expect(screen.getByText("Rejeitar selecionados")).toBeDefined();
    });

    it("deve abrir menu com motivos e permitir rejeitar os selecionados em lote", () => {
      const onRejeitarLote = vi.fn();
      render(
        <BarraAcoesSelecao
          totalSelecionados={3}
          aberto={true}
          onRejeitarSelecionados={onRejeitarLote}
          onRestaurarSelecionados={vi.fn()}
          onLimparSelecao={vi.fn()}
        />
      );

      const opcaoSimilar = screen.getByText("Item similar tem estoque");
      fireEvent.click(opcaoSimilar);

      expect(onRejeitarLote).toHaveBeenCalledWith("ja_tem_similar", "Item similar tem estoque");
    });

    it("deve disparar onRestaurarSelecionados e onLimparSelecao", () => {
      const onRestaurar = vi.fn();
      const onLimpar = vi.fn();

      render(
        <BarraAcoesSelecao
          totalSelecionados={2}
          onRejeitarSelecionados={vi.fn()}
          onRestaurarSelecionados={onRestaurar}
          onLimparSelecao={onLimpar}
        />
      );

      fireEvent.click(screen.getByText("Restaurar sugestões"));
      expect(onRestaurar).toHaveBeenCalled();

      fireEvent.click(screen.getByText("Desmarcar"));
      expect(onLimpar).toHaveBeenCalled();
    });
  });

  describe("4. Regras de Negócio e Exportação (quantidadePedidoEfetiva)", () => {
    const itemBase: LinhaCockpitMatriz = {
      produtoId: 101,
      codigoSku: "BIELETA-01",
      descricao: "BIELETA DIANTEIRA ESTABILIZADORA",
      marca: "COFAP",
      fabricante: "COFAP",
      referenciaFabricante: "BLT-101",
      aplicacaoVeicular: "GOL G5 / VOYAGE",
      secaoNome: "Suspensão",
      subgrupo: "Bieletas",
      precoCusto: 45,
      precoVenda: 75,
      curvaAbc: "A",
      perfilGiro: "ALTO_GIRO",
      rupturaDiasAnalisados: 90,
      rupturaDiasZerados: 0,
      rupturaPercentual: 0,
      classificacaoRuptura: "Boa",
      dataUltimoZeramento: null,
      vendaPerdidaEstimadaReais: 0,
      notasVenda90d: 30,
      notasDevolucao90d: 0,
      notasLiquidas90d: 30,
      frequenciaPercentual90d: 85,
      classificacaoFrequencia: "Alta",
      totalPecasVendidas90d: 60,
      extratoFrequencia90d: [],
      vendasLiquidas30d: 20,
      consumoMedioDiario30d: 0.67,
      diasCobertura30d: 15,
      vendasLiquidas90d: 60,
      consumoMedioDiario90d: 0.67,
      diasCobertura90d: 15,
      vendasLiquidas180d: 120,
      consumoMedioDiario180d: 0.67,
      diasCobertura180d: 15,
      tendenciaCobertura: "ESTAVEL",
      isMarcaZumbi: false,
      filialFocoId: 1,
      filialFocoNome: "Matriz",
      estoqueLojaFoco: 10,
      estoqueMinimoLojaFoco: 15,
      quantidadeJaPedidaFoco: 0,
      estoqueOutrasLojasRede: 5,
      sugestaoFinalCompra: 12,
      previsaoBrutaModelo: 12,
      horizonteDiasAplicado: 30,
      margemSegurancaAplicada: 1.2,
      fatorCalibracaoAplicado: 1.0,
      motivoInelegibilidade: null,
      statusSugestao: "APROVADO_COMPRA",
      motivoDecisao: "Consumo comprovado com risco de ruptura",
      loteMultiplo: 1,
      pedidoCustom: 0,
      transferenciaCustom: 0,
      filialOrigemTransferenciaId: null,
      filialOrigemTransferenciaNome: null,
      saldoOrigemTransferencia: 0,
      estoqueMinimoOrigemTransferencia: 0,
      sobraRealOrigemTransferencia: 0,
      necessidadeDestinoTransferencia: 0,
      quantidadeTransferenciaSugerida: 0,
      similares: [],
      entradasHoje: [],
    };

    it("deve retornar sugestaoFinalCompra quando não há ajuste e nem rejeição", () => {
      expect(quantidadePedidoEfetiva(itemBase)).toBe(12);
    });

    it("deve retornar 0 para quantidadePedidoEfetiva quando o item for rejeitado", () => {
      const itemRejeitado: LinhaCockpitMatriz = {
        ...itemBase,
        rejeitado: true,
        motivoRejeicao: "ja_tem_similar",
        rotuloMotivoRejeicao: "Item similar tem estoque",
        pedidoCustom: 0,
      };

      expect(quantidadePedidoEfetiva(itemRejeitado)).toBe(0);
    });

    it("deve retornar a quantidade personalizada quando o comprador altera o pedido manualmente", () => {
      const itemCustomizado: LinhaCockpitMatriz = {
        ...itemBase,
        pedidoCustom: 20,
      };

      expect(quantidadePedidoEfetiva(itemCustomizado)).toBe(20);
    });
  });

  describe("5. Integração com Colunas Cockpit", () => {
    it("deve criar as colunas com suporte a callbacks de rejeição", () => {
      const onRejeitar = vi.fn();
      const onDesfazer = vi.fn();

      const colunas = criarColunasCockpit({
        nomeLojaFoco: "Matriz",
        onRejeitarCommit: onRejeitar,
        onDesfazerRejeicaoCommit: onDesfazer,
      });

      const colunaPedido = colunas.find((c) => c.id === "pedido");
      expect(colunaPedido).toBeDefined();
      expect(colunaPedido?.size).toBe(135);
    });
  });
});

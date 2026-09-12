// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BarraFiltrosCockpit, areVirtualRowPropsEqual } from "@/components/cockpit";
import { VirtualRowProps } from "@/components/cockpit/VirtualRow";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";

/** Lojas fictícias: a barra recebe a lista do cadastro, nunca a inventa. */
const LOJAS_TESTE = [
  { id: 1, nome: "Loja Matriz" },
  { id: 2, nome: "Loja Norte" },
];

describe("Cockpit — BarraFiltrosCockpit e Memoização de Linha VirtualRow", () => {
  describe("BarraFiltrosCockpit", () => {
    it("deve renderizar campo de busca, contadores e acionar onQueryChange", () => {
      const onQueryChange = vi.fn();
      render(
        <BarraFiltrosCockpit
          queryBusca="amortecedor"
          onQueryChange={onQueryChange}
          statusFiltro="ALL"
          onStatusChange={vi.fn()}
          lojas={LOJAS_TESTE}
          totalItens={25000}
          totalFiltrados={350}
          lojaFocoId={1}
          onLojaFocoChange={vi.fn()}
        />
      );

      const input = screen.getByRole("textbox", { name: /buscar/i }) as HTMLInputElement;
      expect(input.value).toBe("amortecedor");

      fireEvent.change(input, { target: { value: "disco freio" } });
      expect(onQueryChange).toHaveBeenCalledWith("disco freio");

      expect(screen.getByText("350")).toBeTruthy();
      expect(screen.getByText("25000 SKUs")).toBeTruthy();
    });

    it("deve alternar status operacional ao clicar nos chips de filtro", () => {
      const onStatusChange = vi.fn();
      render(
        <BarraFiltrosCockpit
          queryBusca=""
          onQueryChange={vi.fn()}
          statusFiltro="ALL"
          onStatusChange={onStatusChange}
          lojas={LOJAS_TESTE}
          totalItens={100}
          totalFiltrados={100}
          contagensStatus={{
            total: 100,
            pedir: 25,
            transferir: 10,
            ruptura: 8,
            zumbi: 5,
          }}
          lojaFocoId={1}
          onLojaFocoChange={vi.fn()}
        />
      );

      const chipComprar = screen.getByRole("button", { name: /comprar/i });
      fireEvent.click(chipComprar);
      expect(onStatusChange).toHaveBeenCalledWith("PEDIR");

      const chipTransferir = screen.getByRole("button", { name: /transferir/i });
      fireEvent.click(chipTransferir);
      expect(onStatusChange).toHaveBeenCalledWith("TRANSFERIR");

      const chipRuptura = screen.getByRole("button", { name: /ruptura/i });
      fireEvent.click(chipRuptura);
      expect(onStatusChange).toHaveBeenCalledWith("RUPTURA");

      const chipZumbi = screen.getByRole("button", { name: /marca zumbi/i });
      fireEvent.click(chipZumbi);
      expect(onStatusChange).toHaveBeenCalledWith("ZUMBI");
    });

    it("deve permitir alterar a loja em foco no dropdown", () => {
      const onLojaFocoChange = vi.fn();
      render(
        <BarraFiltrosCockpit
          queryBusca=""
          onQueryChange={vi.fn()}
          statusFiltro="ALL"
          onStatusChange={vi.fn()}
          lojas={LOJAS_TESTE}
          totalItens={100}
          totalFiltrados={100}
          lojaFocoId={1}
          onLojaFocoChange={onLojaFocoChange}
        />
      );

      const select = screen.getByLabelText("Loja em Foco:") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "2" } });
      expect(onLojaFocoChange).toHaveBeenCalledWith(2);
    });
  });

  describe("areVirtualRowPropsEqual (Memoização Estrita)", () => {
    const itemOriginal1: Partial<LinhaCockpitMatriz> = {
      produtoId: 1,
      codigoSku: "AM-01",
      pedidoCustom: 4,
    };

    const itemOriginal2: Partial<LinhaCockpitMatriz> = {
      produtoId: 1,
      codigoSku: "AM-01",
      pedidoCustom: 6, // modificado
    };

    const propsBase: VirtualRowProps = {
      row: {
        id: "row-1",
        original: itemOriginal1 as LinhaCockpitMatriz,
      } as any,
      virtualRowIndex: 0,
      isSelected: false,
      visibleColumnsKey: "col-all",
      rowHeight: 48,
      rowClassName: "classe-padrao",
    };

    it("deve retornar true quando todas as propriedades forem estritamente idênticas", () => {
      const prev = { ...propsBase };
      const next = { ...propsBase };
      expect(areVirtualRowPropsEqual(prev, next)).toBe(true);
    });

    it("deve retornar false quando row.original mudar (re-renderiza apenas a linha modificada)", () => {
      const prev = { ...propsBase };
      const next = {
        ...propsBase,
        row: {
          ...propsBase.row,
          original: itemOriginal2 as LinhaCockpitMatriz,
        },
      };
      expect(areVirtualRowPropsEqual(prev, next)).toBe(false);
    });

    it("deve retornar false quando isSelected mudar", () => {
      const prev = { ...propsBase, isSelected: false };
      const next = { ...propsBase, isSelected: true };
      expect(areVirtualRowPropsEqual(prev, next)).toBe(false);
    });

    it("deve retornar false quando virtualRowIndex mudar (durante scroll)", () => {
      const prev = { ...propsBase, virtualRowIndex: 0 };
      const next = { ...propsBase, virtualRowIndex: 1 };
      expect(areVirtualRowPropsEqual(prev, next)).toBe(false);
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { moverColuna } from "@/components/ui/data-grid";

function coluna(id: string, fixacao: "left" | "right" | false = false) {
  return { id, getIsPinned: () => fixacao };
}

describe("ordenação manual das colunas", () => {
  it("move colunas centrais para a esquerda e direita", () => {
    const colunas = [coluna("select", "left"), coluna("aplicacao"), coluna("marca"), coluna("pedido", "right")];
    const setColumnOrder = vi.fn();
    const table = {
      getColumn: (id: string) => colunas.find((item) => item.id === id),
      getAllLeafColumns: () => colunas,
      getCenterLeafColumns: () => [colunas[1], colunas[2]],
      getState: () => ({ columnPinning: { left: ["select"], right: ["pedido"] } }),
      setColumnOrder,
      setColumnPinning: vi.fn(),
    };

    moverColuna(table as any, "aplicacao", 1);

    expect(setColumnOrder).toHaveBeenCalledWith(["select", "marca", "aplicacao", "pedido"]);
  });

  it("reordena colunas fixadas sem perder a fixação", () => {
    const colunas = [coluna("select", "left"), coluna("codigo", "left"), coluna("descricao", "left")];
    const setColumnPinning = vi.fn();
    const table = {
      getColumn: (id: string) => colunas.find((item) => item.id === id),
      getState: () => ({ columnPinning: { left: ["select", "codigo", "descricao"], right: [] } }),
      setColumnPinning,
    };

    moverColuna(table as any, "descricao", -1);

    expect(setColumnPinning).toHaveBeenCalledWith({
      left: ["select", "descricao", "codigo"],
      right: [],
    });
  });
});

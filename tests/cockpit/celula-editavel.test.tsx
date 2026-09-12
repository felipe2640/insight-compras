// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditableCell } from "@/components/cockpit";

describe("Cockpit — EditableCell (Célula Editável com Múltiplos e Teclado)", () => {
  it("deve renderizar input com valor inicial sugerido", () => {
    render(
      <EditableCell
        initialValue={10}
        skuId="AM-MON-001"
        onCommit={vi.fn()}
      />
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("10");
  });

  it("deve aplicar arredondamento para par (múltiplo de 2) ao desfocar", () => {
    const onCommit = vi.fn();
    render(
      <EditableCell
        initialValue={4}
        skuId="AM-MON-001"
        minMultiplo={2}
        onCommit={onCommit}
      />
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    // Comprador digita 5 (ímpar)
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.blur(input);

    // Arredonda para cima no múltiplo de 2 -> 6
    expect(input.value).toBe("6");
    expect(onCommit).toHaveBeenCalledWith(
      "AM-MON-001",
      6,
      expect.stringMatching(/múltiplo de embalagem fechada \(2 un\)|par \(múltiplo de 2 un\)/)
    );
  });

  it("deve aplicar embalagem mínima do fabricante (ex: caixa com 10 un)", () => {
    const onCommit = vi.fn();
    render(
      <EditableCell
        initialValue={0}
        skuId="OLEO-5W30"
        embalagemMinima={10}
        minMultiplo={1}
        onCommit={onCommit}
      />
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.blur(input);

    // Como embalagem mínima é 10, ajusta para 10
    expect(input.value).toBe("10");
    expect(onCommit).toHaveBeenCalledWith(
      "OLEO-5W30",
      10,
      expect.stringContaining("embalagem mínima")
    );
  });

  it("deve aplicar estilo com fundo #FFFFCC quando minMultiplo > 1", () => {
    render(
      <EditableCell
        initialValue={2}
        skuId="AM-MON-001"
        minMultiplo={2}
        onCommit={vi.fn()}
      />
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.style.backgroundColor).toBe("rgb(255, 255, 204)"); // #FFFFCC
    expect(screen.getByText("par")).toBeTruthy();
  });

  it("deve destacar borda quando valor diferir da sugestão original do sistema (isDirty)", () => {
    render(
      <EditableCell
        initialValue={12}
        skuId="VELA-NGK"
        valorSugeridoSistema={8}
        onCommit={vi.fn()}
      />
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.className).toContain("border-blue-600");
  });

  it("deve confirmar e disparar blur ao pressionar Enter", () => {
    const onCommit = vi.fn();
    render(
      <EditableCell
        initialValue={4}
        skuId="AM-MON-001"
        onCommit={onCommit}
      />
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCommit).toHaveBeenCalledWith("AM-MON-001", 8, null);
  });

  it("deve cancelar a edição e restaurar o valor inicial ao pressionar Escape sem disparar onCommit", () => {
    const onCommit = vi.fn();
    render(
      <EditableCell
        initialValue={4}
        skuId="AM-MON-001"
        onCommit={onCommit}
      />
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    // Comprador comete um erro de digitação
    fireEvent.change(input, { target: { value: "999" } });
    expect(input.value).toBe("999");

    // Pressiona Escape
    fireEvent.keyDown(input, { key: "Escape" });

    // Restaura valor original e cancela
    expect(input.value).toBe("4");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("deve sanitizar entradas não numéricas e números negativos", () => {
    const onCommit = vi.fn();
    render(
      <EditableCell
        initialValue={5}
        skuId="TESTE-01"
        onCommit={onCommit}
      />
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;

    // Digita número negativo
    fireEvent.change(input, { target: { value: "-15" } });
    fireEvent.blur(input);
    expect(input.value).toBe("0");
    expect(onCommit).toHaveBeenCalledWith("TESTE-01", 0, null);

    onCommit.mockClear();

    // Digita texto alfabético puro
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.blur(input);
    expect(input.value).toBe("0");
  });

  it("deve truncar decimais para números inteiros (autopeças são unidades físicas)", () => {
    const onCommit = vi.fn();
    render(
      <EditableCell
        initialValue={0}
        skuId="TESTE-02"
        onCommit={onCommit}
      />
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "7,8" } });
    fireEvent.blur(input);

    expect(input.value).toBe("7");
    expect(onCommit).toHaveBeenCalledWith("TESTE-02", 7, null);
  });

  it("deve navegar entre inputs na grade com a tecla Tab e Shift+Tab", () => {
    render(
      <div>
        <EditableCell initialValue={1} skuId="ITEM-01" onCommit={vi.fn()} />
        <EditableCell initialValue={2} skuId="ITEM-02" onCommit={vi.fn()} />
        <EditableCell initialValue={3} skuId="ITEM-03" onCommit={vi.fn()} />
      </div>
    );

    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs).toHaveLength(3);

    // Foca no primeiro input
    inputs[0].focus();
    expect(document.activeElement).toBe(inputs[0]);

    // Pressiona Tab no primeiro input -> deve focar no segundo
    fireEvent.keyDown(inputs[0], { key: "Tab" });
    expect(document.activeElement).toBe(inputs[1]);

    // Pressiona Shift+Tab no segundo input -> deve voltar para o primeiro
    fireEvent.keyDown(inputs[1], { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(inputs[0]);
  });
});

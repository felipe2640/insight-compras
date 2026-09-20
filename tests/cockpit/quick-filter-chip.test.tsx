import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QuickFilterChip } from "@/components/cockpit/quick-filter-chip";

describe("QuickFilterChip", () => {
  it("altera opções de Curva ABC e aplica o conjunto desmarcado", () => {
    const onApply = vi.fn();
    render(
      <QuickFilterChip
        label="Curva ABC"
        options={["A", "B", "C"]}
        deselected={new Set()}
        onApply={onApply}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Curva ABC" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "A" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect([...onApply.mock.calls[0][0]]).toEqual(["A"]);
  });

  it("altera opções de Marca e permite selecionar nenhuma", () => {
    const onApply = vi.fn();
    render(
      <QuickFilterChip
        label="Marca"
        options={["BOSCH", "COFAP"]}
        deselected={new Set()}
        onApply={onApply}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Marca" }));
    fireEvent.click(screen.getByRole("button", { name: "Nenhum" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect([...onApply.mock.calls[0][0]]).toEqual(["BOSCH", "COFAP"]);
  });
});

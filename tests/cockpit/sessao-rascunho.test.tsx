// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import { BannerRascunho } from "@/components/cockpit";
import { RascunhoSessaoPayload } from "@/tipos/cockpit";

describe("Cockpit — useSessionDraft & BannerRascunho (Persistência Resiliente)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("deve salvar rascunho sob chave multi-tenant 'insight-compras-draft-${tenantId}-${userId}' com debounce", () => {
    const deltasIniciais = {};

    const { result, rerender } = renderHook(
      ({ deltas }) =>
        useSessionDraft({
          tenantId: "carreiro",
          userId: "comprador-01",
          deltas,
          debounceMs: 1500,
        }),
      { initialProps: { deltas: deltasIniciais } }
    );

    // Nada deve ser salvo se deltas estiver vazio
    expect(localStorage.getItem("insight-compras-draft-carreiro-comprador-01")).toBeNull();

    // Comprador edita 2 SKUs
    const novosDeltas = {
      "AM-MON-001": { quantidade: 6, modificadoEm: Date.now() },
      "VEL-NGK-002": { quantidade: 12, modificadoEm: Date.now() },
    };

    rerender({ deltas: novosDeltas });

    // Antes do debounce de 1500ms, ainda não gravou
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(localStorage.getItem("insight-compras-draft-carreiro-comprador-01")).toBeNull();

    // Completa o debounce de 1500ms
    act(() => {
      vi.advanceTimersByTime(600);
    });

    const salvo = localStorage.getItem("insight-compras-draft-carreiro-comprador-01");
    expect(salvo).not.toBeNull();

    const payload: RascunhoSessaoPayload = JSON.parse(salvo!);
    expect(payload.tenantId).toBe("carreiro");
    expect(payload.userId).toBe("comprador-01");
    expect(payload.versao).toBe(1);
    expect(payload.deltas["AM-MON-001"].quantidade).toBe(6);
    expect(payload.deltas["VEL-NGK-002"].quantidade).toBe(12);

    // Isolamento multi-tenant: não existe chave para outro usuário
    expect(localStorage.getItem("insight-compras-draft-carreiro-comprador-02")).toBeNull();
  });

  it("deve restaurar rascunho existente na montagem se dentro do TTL de 1 hora", () => {
    const agora = Date.now();
    const rascunhoValido: RascunhoSessaoPayload = {
      versao: 1,
      timestamp: agora - 30 * 60 * 1000, // 30 minutos atrás (válido)
      tenantId: "carreiro",
      userId: "comprador-01",
      deltas: {
        "DISCO-FREIO-01": { quantidade: 8, modificadoEm: agora - 30 * 60 * 1000 },
      },
    };

    localStorage.setItem(
      "insight-compras-draft-carreiro-comprador-01",
      JSON.stringify(rascunhoValido)
    );

    const { result } = renderHook(() =>
      useSessionDraft({
        tenantId: "carreiro",
        userId: "comprador-01",
        deltas: {},
      })
    );

    expect(result.current.draftAvailable).not.toBeNull();
    expect(result.current.draftAvailable?.deltas["DISCO-FREIO-01"].quantidade).toBe(8);

    // Executa restauração
    let restaurado: RascunhoSessaoPayload | null = null;
    act(() => {
      restaurado = result.current.restaurarRascunho();
    });

    expect(restaurado).not.toBeNull();
    expect(result.current.draftAvailable).toBeNull(); // Banner ocultado após restaurar
  });

  it("deve descartar automaticamente rascunho com mais de 1 hora de idade (TTL)", () => {
    const agora = Date.now();
    const rascunhoExpirado: RascunhoSessaoPayload = {
      versao: 1,
      timestamp: agora - 65 * 60 * 1000, // 65 minutos atrás (expirado > 1h)
      tenantId: "carreiro",
      userId: "comprador-01",
      deltas: {
        "AM-MON-001": { quantidade: 10, modificadoEm: agora - 65 * 60 * 1000 },
      },
    };

    localStorage.setItem(
      "insight-compras-draft-carreiro-comprador-01",
      JSON.stringify(rascunhoExpirado)
    );

    const { result } = renderHook(() =>
      useSessionDraft({
        tenantId: "carreiro",
        userId: "comprador-01",
        deltas: {},
      })
    );

    // O rascunho expirado deve ser limpo e não disponibilizado
    expect(result.current.draftAvailable).toBeNull();
    expect(localStorage.getItem("insight-compras-draft-carreiro-comprador-01")).toBeNull();
  });

  it("deve descartar rascunho quando o comprador acionar descartarRascunho()", () => {
    const agora = Date.now();
    const rascunho: RascunhoSessaoPayload = {
      versao: 1,
      timestamp: agora,
      tenantId: "carreiro",
      userId: "comprador-01",
      deltas: {
        "AM-MON-001": { quantidade: 4, modificadoEm: agora },
      },
    };

    localStorage.setItem(
      "insight-compras-draft-carreiro-comprador-01",
      JSON.stringify(rascunho)
    );

    const { result } = renderHook(() =>
      useSessionDraft({
        tenantId: "carreiro",
        userId: "comprador-01",
        deltas: {},
      })
    );

    expect(result.current.draftAvailable).not.toBeNull();

    act(() => {
      result.current.descartarRascunho();
    });

    expect(result.current.draftAvailable).toBeNull();
    expect(localStorage.getItem("insight-compras-draft-carreiro-comprador-01")).toBeNull();
  });

  it("deve tratar QuotaExceededError sem quebrar a aplicação", () => {
    // Simula estouro de cota no localStorage
    const spySetItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    });

    const { result, rerender } = renderHook(
      ({ deltas }) =>
        useSessionDraft({
          tenantId: "carreiro",
          userId: "comprador-01",
          deltas,
          debounceMs: 500,
        }),
      { initialProps: { deltas: {} } }
    );

    rerender({
      deltas: { "SKU-PESADO": { quantidade: 100, modificadoEm: Date.now() } },
    });

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.saveError).not.toBeNull();
    expect(result.current.saveError?.tipo).toBe("QUOTA");
    expect(result.current.saveError?.mensagem).toContain("cota de armazenamento");

    spySetItem.mockRestore();
  });

  // --------------------------------------------------------------------------
  // BannerRascunho Component Tests
  // --------------------------------------------------------------------------
  describe("BannerRascunho", () => {
    it("deve renderizar contagem de itens e acionar callbacks de restaurar e descartar", () => {
      const onRestaurar = vi.fn();
      const onDescartar = vi.fn();

      const rascunho: RascunhoSessaoPayload = {
        versao: 1,
        timestamp: new Date("2026-09-06T14:30:00Z").getTime(),
        tenantId: "carreiro",
        userId: "comprador-01",
        deltas: {
          "AM-01": { quantidade: 4, modificadoEm: Date.now() },
          "AM-02": { quantidade: 8, modificadoEm: Date.now() },
          "DISC-01": { quantidade: 2, modificadoEm: Date.now() },
        },
      };

      render(
        <BannerRascunho
          draft={rascunho}
          onRestaurar={onRestaurar}
          onDescartar={onDescartar}
        />
      );

      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText(/3 itens modificados/)).toBeTruthy();

      // Clica em restaurar
      const botaoRestaurar = screen.getByText("Restaurar Rascunho");
      fireEvent.click(botaoRestaurar);
      expect(onRestaurar).toHaveBeenCalled();

      // Clica em descartar
      const botaoDescartar = screen.getByText("Descartar");
      fireEvent.click(botaoDescartar);
      expect(onDescartar).toHaveBeenCalled();
    });
  });
});

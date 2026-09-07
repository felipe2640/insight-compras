// @vitest-environment jsdom
/**
 * Suíte de Testes Adversariais — Gate M3 (Challenger 2)
 * Alvos: EditableCell, useSessionDraft e Regras de Lotes/Pares
 * 
 * Foco:
 * 1. Entradas extremas em EditableCell (negativos, letras, decimais, gigantes, Escape)
 * 2. Arredondamento estrito de amortecedores e discos de freio para pares
 * 3. Estresse de useSessionDraft (QuotaExceededError, payloads corrompidos, TTL 1h, concorrência rápida)
 */

import { inferirLotePadraoPorCategoria } from "@adapters/comum/lote-autopecas";
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { EditableCell, BannerRascunho } from "@/components/cockpit";
import { useSessionDraft, VERSAO_SCHEMA_RASCUNHO } from "@/hooks/useSessionDraft";
import * as LoteMultiplo from "@core/travas/lote-multiplo";
import {
  arredondarParaMultiplo,
  ajustarQuantidadePorLote,
} from "@core/travas/lote-multiplo";
import { RascunhoSessaoPayload, ItemDeltaRascunho } from "@/tipos/cockpit";

describe("Gate M3 — Desafio Adversarial: EditableCell, Lotes e useSessionDraft", () => {
  // ==========================================================================
  // 1. ENTRADAS EXTREMAS EM EditableCell
  // ==========================================================================
  describe("1. Entradas Extremas em EditableCell", () => {
    it("deve sanitizar números negativos (-10, -999, -0) para 0", () => {
      const onCommit = vi.fn();
      const { rerender } = render(
        <EditableCell
          initialValue={15}
          skuId="SKU-NEGATIVO"
          onCommit={onCommit}
        />
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;

      // Caso 1: -10 -> sanitizado para 0 (diferente de initialValue 15 -> comita)
      fireEvent.change(input, { target: { value: "-10" } });
      fireEvent.blur(input);
      expect(input.value).toBe("0");
      expect(onCommit).toHaveBeenCalledWith("SKU-NEGATIVO", 0, null);

      onCommit.mockClear();

      // Atualiza initialValue no componente para refletir a nova quantidade
      rerender(
        <EditableCell
          initialValue={0}
          skuId="SKU-NEGATIVO"
          onCommit={onCommit}
        />
      );

      // Caso 2: -999999 -> sanitizado para 0 (igual a initialValue 0 -> não comita)
      fireEvent.change(input, { target: { value: "-999999" } });
      fireEvent.blur(input);
      expect(input.value).toBe("0");
      expect(onCommit).not.toHaveBeenCalled();

      onCommit.mockClear();

      // Caso 3: -0 -> sanitizado para 0
      fireEvent.change(input, { target: { value: "-0" } });
      fireEvent.blur(input);
      expect(input.value).toBe("0");
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("deve tratar strings alfabéticas ('abc') e alfanuméricas ('12a3', 'a12') com segurança", () => {
      const onCommit = vi.fn();
      render(
        <EditableCell
          initialValue={5}
          skuId="SKU-ALFA"
          onCommit={onCommit}
        />
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;

      // Caso 1: "abc" puramente alfabético -> sanitizado para 0
      fireEvent.change(input, { target: { value: "abc" } });
      fireEvent.blur(input);
      expect(input.value).toBe("0");
      expect(onCommit).toHaveBeenCalledWith("SKU-ALFA", 0, null);

      onCommit.mockClear();

      // Caso 2: "a12" iniciando com letra -> parseFloat avalia NaN -> 0 (já é 0)
      fireEvent.change(input, { target: { value: "a12" } });
      fireEvent.blur(input);
      expect(input.value).toBe("0");

      onCommit.mockClear();

      // Caso 3: "12a3" número seguido de letra -> parseFloat lê o prefixo numérico 12
      fireEvent.change(input, { target: { value: "12a3" } });
      fireEvent.blur(input);
      expect(input.value).toBe("12");
      expect(onCommit).toHaveBeenCalledWith("SKU-ALFA", 12, null);

      onCommit.mockClear();

      // Caso 4: Símbolos especiais e injeção ("<script>", "DROP TABLE") -> sanitiza para 0
      fireEvent.change(input, { target: { value: "<script>alert(1)</script>" } });
      fireEvent.blur(input);
      expect(input.value).toBe("0");
      expect(onCommit).toHaveBeenCalledWith("SKU-ALFA", 0, null);
    });

    it("deve truncar decimais (4.5, 4,5, 3.99) para inteiros respeitando múltiplos", () => {
      const onCommit = vi.fn();
      render(
        <EditableCell
          initialValue={0}
          skuId="SKU-DECIMAL"
          minMultiplo={2}
          onCommit={onCommit}
        />
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;

      // Caso 1: "4.5" com ponto -> floor(4.5) = 4 -> par = 4
      fireEvent.change(input, { target: { value: "4.5" } });
      fireEvent.blur(input);
      expect(input.value).toBe("4");
      expect(onCommit).toHaveBeenCalledWith("SKU-DECIMAL", 4, null);

      onCommit.mockClear();

      // Caso 2: "3,9" com vírgula -> floor(3.9) = 3 -> ajustado para par superior 4
      fireEvent.change(input, { target: { value: "3,9" } });
      fireEvent.blur(input);
      expect(input.value).toBe("4");
      // Como initialValue ainda é 0 e valorFinal é 4 com motivo de par
      expect(onCommit).toHaveBeenCalledWith(
        "SKU-DECIMAL",
        4,
        expect.stringContaining("par (múltiplo de 2 un)")
      );

      onCommit.mockClear();

      // Caso 3: "5.1" -> floor(5.1) = 5 -> par de 5 = 6
      fireEvent.change(input, { target: { value: "5.1" } });
      fireEvent.blur(input);
      expect(input.value).toBe("6");
      expect(onCommit).toHaveBeenCalledWith(
        "SKU-DECIMAL",
        6,
        expect.stringContaining("par (múltiplo de 2 un)")
      );
    });

    it("deve lidar com valores gigantes (1000000, 1e6) e demonstrar comportamento com separador de milhar '1.000.000'", () => {
      const onCommit = vi.fn();
      render(
        <EditableCell
          initialValue={10}
          skuId="SKU-GIGANTE"
          onCommit={onCommit}
        />
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;

      // Caso 1: 1 milhão numérico puro ("1000000")
      fireEvent.change(input, { target: { value: "1000000" } });
      fireEvent.blur(input);
      expect(input.value).toBe("1000000");
      expect(onCommit).toHaveBeenCalledWith("SKU-GIGANTE", 1000000, null);

      onCommit.mockClear();

      // Caso 2: Notação com pontos de milhar brasileira ("1.000.000")
      // OBSERVAÇÃO FORENSE: parseFloat("1.000.000") para no primeiro '.', resultando em 1
      fireEvent.change(input, { target: { value: "1.000.000" } });
      fireEvent.blur(input);
      expect(input.value).toBe("1");
      expect(onCommit).toHaveBeenCalledWith("SKU-GIGANTE", 1, null);

      onCommit.mockClear();

      // Caso 3: Notação científica "1e6" -> parseFloat avalia 1000000
      fireEvent.change(input, { target: { value: "1e6" } });
      fireEvent.blur(input);
      expect(input.value).toBe("1000000");

      onCommit.mockClear();

      // Caso 4: "Infinity" -> Number.isFinite é falso -> sanitiza para 0
      fireEvent.change(input, { target: { value: "Infinity" } });
      fireEvent.blur(input);
      expect(input.value).toBe("0");
      expect(onCommit).toHaveBeenCalledWith("SKU-GIGANTE", 0, null);
    });

    it("deve cancelar edição imediatamente ao pressionar Escape durante digitação rápida e reverter valor", () => {
      const onCommit = vi.fn();
      render(
        <EditableCell
          initialValue={8}
          skuId="SKU-ESCAPE"
          onCommit={onCommit}
        />
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;

      // Digitação rápida
      fireEvent.change(input, { target: { value: "9" } });
      fireEvent.change(input, { target: { value: "99" } });
      fireEvent.change(input, { target: { value: "999" } });
      expect(input.value).toBe("999");

      // Pressiona Escape
      fireEvent.keyDown(input, { key: "Escape" });

      // O valor deve ser restaurado instantaneamente para 8
      expect(input.value).toBe("8");
      // onCommit NUNCA deve ser chamado ao cancelar com Escape
      expect(onCommit).not.toHaveBeenCalled();

      // Simula o evento de blur subsequente que o navegador dispara ao desfocar
      fireEvent.blur(input);
      expect(onCommit).not.toHaveBeenCalled();

      // Verifica que uma nova edição posterior funciona normalmente
      fireEvent.change(input, { target: { value: "14" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(input.value).toBe("14");
      expect(onCommit).toHaveBeenCalledWith("SKU-ESCAPE", 14, null);
    });

    it("deve evidenciar a dependência do evento blur após Escape para desbloquear cancelRef", () => {
      const onCommit = vi.fn();
      render(
        <EditableCell
          initialValue={10}
          skuId="SKU-ESCAPE-BLUR"
          onCommit={onCommit}
        />
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;

      // Usuário digita e aperta Escape
      fireEvent.change(input, { target: { value: "50" } });
      fireEvent.keyDown(input, { key: "Escape" });
      expect(input.value).toBe("10");

      // SE o evento blur NÃO for disparado (ex: o blur do elemento não disparou o listener onBlur do React),
      // a flag cancelRef.current permanece true.
      // O próximo Enter acionará handleBlur(), que consumirá a flag cancelRef e não comitará:
      fireEvent.change(input, { target: { value: "25" } });
      fireEvent.keyDown(input, { key: "Enter" });

      // Como o cancelRef estava true, a alteração foi descartada na primeira tentativa
      expect(onCommit).not.toHaveBeenCalled();

      // Agora que handleBlur resetou cancelRef.current para false, o próximo commit funcionará:
      fireEvent.change(input, { target: { value: "30" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onCommit).toHaveBeenCalledWith("SKU-ESCAPE-BLUR", 30, null);
    });
  });

  // ==========================================================================
  // 2. LOTES DE AMORTECEDORES E DISCOS DE FREIO (PARES E MÚLTIPLOS)
  // ==========================================================================
  describe("2. Lotes de Amortecedores e Discos de Freio (applyMinMultiplo e Pares)", () => {
    it("deve verificar se applyMinMultiplo está disponível ou documentar mapeamento canônico", () => {
      // DESCOBERTA FORENSE: 'applyMinMultiplo' foi especificado em TEST_INFRA.md (T1.4.1),
      // porém o Core puro implementou o método em Português como 'arredondarParaMultiplo' (R1: 100% pt-BR),
      // sem prover o alias de compatibilidade 'applyMinMultiplo'.
      const aliasExportado = (LoteMultiplo as Record<string, unknown>)["applyMinMultiplo"];
      expect(aliasExportado).toBeUndefined();

      // Função canônica no Core Puro:
      const funcaoCalculo = arredondarParaMultiplo;
      expect(typeof funcaoCalculo).toBe("function");

      // Validação estrita dos casos do contrato de pares (lote = 2):
      // 1 -> 2, 3 -> 4, 5 -> 6, 0 -> 0
      expect(funcaoCalculo(1, 2)).toBe(2);
      expect(funcaoCalculo(3, 2)).toBe(4);
      expect(funcaoCalculo(5, 2)).toBe(6);
      expect(funcaoCalculo(0, 2)).toBe(0);

      // Casos de fronteira adicionais
      expect(funcaoCalculo(-1, 2)).toBe(0);
      expect(funcaoCalculo(-10, 2)).toBe(0);
      expect(funcaoCalculo(1.1, 2)).toBe(2);
      expect(funcaoCalculo(2.1, 2)).toBe(4);
    });

    it("deve arredondar estritamente para pares todos os inteiros de 0 a 10 com lote = 2", () => {
      // 0 -> 0 (não força compra de item sem demanda)
      expect(arredondarParaMultiplo(0, 2)).toBe(0);
      // 1 -> 2
      expect(arredondarParaMultiplo(1, 2)).toBe(2);
      // 2 -> 2 (já é par)
      expect(arredondarParaMultiplo(2, 2)).toBe(2);
      // 3 -> 4
      expect(arredondarParaMultiplo(3, 2)).toBe(4);
      // 4 -> 4 (já é par)
      expect(arredondarParaMultiplo(4, 2)).toBe(4);
      // 5 -> 6
      expect(arredondarParaMultiplo(5, 2)).toBe(6);
      // 6 -> 6
      expect(arredondarParaMultiplo(6, 2)).toBe(6);
      // 7 -> 8
      expect(arredondarParaMultiplo(7, 2)).toBe(8);
      // 8 -> 8
      expect(arredondarParaMultiplo(8, 2)).toBe(8);
      // 9 -> 10
      expect(arredondarParaMultiplo(9, 2)).toBe(10);
      // 10 -> 10
      expect(arredondarParaMultiplo(10, 2)).toBe(10);
    });

    it("deve inferir lote 2 compulsoriamente para categorias automotivas de substituição simétrica", () => {
      const categoriasPar = [
        "AMORTECEDOR DIANTEIRO ESQUERDO COFAP",
        "AMORTECEDOR TRASEIRO MONROE GAS",
        "DISCO DE FREIO DIANTEIRO VENTILADO FREMAX",
        "DISCO DE FREIO SOLIDO TRW",
        "TAMBOR DE FREIO TRASEIRO HIPPER FREIOS",
        "MOLA HELICOIDAL DIANTEIRA COFAP",
        "SAPATA DE FREIO COM LONA SYL",
      ];

      for (const desc of categoriasPar) {
        expect(inferirLotePadraoPorCategoria(desc)).toBe(2);
      }
    });

    it("deve ajustar quantidade via ajustarQuantidadePorLote gerando justificativa semântica para pares", () => {
      const casos = [
        { entrada: 1, esperado: 2, temMotivo: true },
        { entrada: 2, esperado: 2, temMotivo: false },
        { entrada: 3, esperado: 4, temMotivo: true },
        { entrada: 5, esperado: 6, temMotivo: true },
        { entrada: 0, esperado: 0, temMotivo: false },
        { entrada: -4, esperado: 0, temMotivo: false },
      ];

      for (const c of casos) {
        const res = ajustarQuantidadePorLote({
          quantidadeDesejada: c.entrada,
          multiploLote: 2,
        });
        expect(res.quantidadeAjustada).toBe(c.esperado);
        if (c.temMotivo) {
          expect(res.motivoAjuste).toContain("par (múltiplo de 2 un)");
        } else {
          expect(res.motivoAjuste).toBeNull();
        }
      }
    });
  });

  // ==========================================================================
  // 3. ESTRESSE DE useSessionDraft
  // ==========================================================================
  describe("3. Estresse de useSessionDraft (Persistência, Falhas e TTL)", () => {
    beforeEach(() => {
      localStorage.clear();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      localStorage.clear();
    });

    it("deve capturar QuotaExceededError (e NS_ERROR_DOM_QUOTA_REACHED) sem crash e expor saveError com tipo QUOTA", () => {
      const spySetItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        const err = new Error("The quota has been exceeded.");
        err.name = "QuotaExceededError";
        throw err;
      });

      const { result, rerender } = renderHook(
        ({ deltas }) =>
          useSessionDraft({
            tenantId: "carreiro",
            userId: "comprador-estresse",
            deltas,
            debounceMs: 500,
          }),
        { initialProps: { deltas: {} as Record<string, ItemDeltaRascunho> } }
      );

      rerender({
        deltas: {
          "SKU-CARGA-1": { quantidade: 100, modificadoEm: Date.now() },
        },
      });

      // Avança debounce
      act(() => {
        vi.advanceTimersByTime(600);
      });

      // Aplicação não sofreu unhandled exception
      expect(result.current.isSaving).toBe(false);
      expect(result.current.saveError).not.toBeNull();
      expect(result.current.saveError?.tipo).toBe("QUOTA");
      expect(result.current.saveError?.mensagem).toContain("cota de armazenamento local");

      spySetItem.mockRestore();
    });

    it("deve lidar com payload corrompido no storage (JSON inválido) de forma tolerante a falhas", () => {
      const storageKey = "insight-compras-draft-carreiro-comprador-01";
      // Injeta JSON truncado/corrompido no localStorage
      localStorage.setItem(storageKey, '{"versao": 1, "tenantId": "carreiro", "deltas": { INVALID_JSON');

      const { result } = renderHook(() =>
        useSessionDraft({
          tenantId: "carreiro",
          userId: "comprador-01",
          deltas: {},
        })
      );

      // O hook não deve lançar exceção não tratada na montagem
      expect(result.current.draftAvailable).toBeNull();
      expect(result.current.saveError).not.toBeNull();
      expect(result.current.saveError?.tipo).toBe("DESCONHECIDO");
    });

    it("deve invalidar e expurgar payloads com schema incompatível ou tenant/user trocado", () => {
      const storageKey = "insight-compras-draft-carreiro-comprador-01";

      // Payload com versão incompatível (schema v99)
      const payloadIncompativel = {
        versao: 99,
        timestamp: Date.now(),
        tenantId: "carreiro",
        userId: "comprador-01",
        deltas: { "AM-01": { quantidade: 4 } },
      };
      localStorage.setItem(storageKey, JSON.stringify(payloadIncompativel));

      const { result } = renderHook(() =>
        useSessionDraft({
          tenantId: "carreiro",
          userId: "comprador-01",
          deltas: {},
        })
      );

      // Deve rejeitar e limpar chave
      expect(result.current.draftAvailable).toBeNull();
      expect(localStorage.getItem(storageKey)).toBeNull();
    });

    it("deve evidenciar a fragilidade de validação de timestamp corrupto (NaN ou string) no payload salvo", () => {
      const storageKey = "insight-compras-draft-carreiro-comprador-01";

      // Payload corrompido com timestamp não-numérico
      const payloadTimestampCorrupto = {
        versao: VERSAO_SCHEMA_RASCUNHO,
        timestamp: "DATA_CORROMPIDA_NAO_NUMERICA",
        tenantId: "carreiro",
        userId: "comprador-01",
        deltas: { "AM-01": { quantidade: 4, modificadoEm: Date.now() } },
      };
      localStorage.setItem(storageKey, JSON.stringify(payloadTimestampCorrupto));

      const { result } = renderHook(() =>
        useSessionDraft({
          tenantId: "carreiro",
          userId: "comprador-01",
          deltas: {},
        })
      );

      // DESCOBERTA FORENSE: Como useSessionDraft calcula 'Date.now() - parsed.timestamp' resultando em NaN,
      // a checagem 'idadeMs > ttlMs' avalia falso (NaN > ttlMs === false).
      // Logo, o rascunho com timestamp corrupto é disponibilizado em draftAvailable!
      expect(result.current.draftAvailable).not.toBeNull();

      // E ao renderizar BannerRascunho com este rascunho corrompido:
      // Intl.DateTimeFormat tenta formatar new Date("DATA_CORROMPIDA_NAO_NUMERICA")
      // resultando em RangeError: Invalid time value
      expect(() => {
        render(
          <BannerRascunho
            draft={result.current.draftAvailable!}
            onRestaurar={vi.fn()}
            onDescartar={vi.fn()}
          />
        );
      }).toThrow(/Invalid time value/);
    });

    it("deve respeitar rigorosamente a fronteira de TTL de 1 hora (3.600.000 ms)", () => {
      const agora = Date.now();
      const storageKey = "insight-compras-draft-carreiro-comprador-01";

      // Teste 1: Rascunho com 59 minutos e 50 segundos (DENTRO do TTL de 1 hora)
      const rascunhoValido: RascunhoSessaoPayload = {
        versao: VERSAO_SCHEMA_RASCUNHO,
        timestamp: agora - (59 * 60 + 50) * 1000,
        tenantId: "carreiro",
        userId: "comprador-01",
        deltas: {
          "AM-MON-001": { quantidade: 6, modificadoEm: agora },
        },
      };
      localStorage.setItem(storageKey, JSON.stringify(rascunhoValido));

      const { result: hookValido } = renderHook(() =>
        useSessionDraft({
          tenantId: "carreiro",
          userId: "comprador-01",
          deltas: {},
        })
      );

      expect(hookValido.current.draftAvailable).not.toBeNull();
      expect(hookValido.current.draftAvailable?.deltas["AM-MON-001"].quantidade).toBe(6);

      // Limpa para o próximo teste
      localStorage.clear();

      // Teste 2: Rascunho com 60 minutos e 1 segundo (EXPIRADO > 1 hora)
      const rascunhoExpirado: RascunhoSessaoPayload = {
        versao: VERSAO_SCHEMA_RASCUNHO,
        timestamp: agora - (60 * 60 + 1) * 1000,
        tenantId: "carreiro",
        userId: "comprador-01",
        deltas: {
          "AM-MON-001": { quantidade: 6, modificadoEm: agora },
        },
      };
      localStorage.setItem(storageKey, JSON.stringify(rascunhoExpirado));

      const { result: hookExpirado } = renderHook(() =>
        useSessionDraft({
          tenantId: "carreiro",
          userId: "comprador-01",
          deltas: {},
        })
      );

      expect(hookExpirado.current.draftAvailable).toBeNull();
      expect(localStorage.getItem(storageKey)).toBeNull(); // Expurgado do storage
    });

    it("deve gerenciar concorrência rápida de salvamento cancelando debounces intermediários e persistindo apenas o estado final", () => {
      const storageKey = "insight-compras-draft-carreiro-comprador-01";
      const spySetItem = vi.spyOn(Storage.prototype, "setItem");

      const { rerender } = renderHook(
        ({ deltas }) =>
          useSessionDraft({
            tenantId: "carreiro",
            userId: "comprador-01",
            deltas,
            debounceMs: 1500,
          }),
        { initialProps: { deltas: {} as Record<string, ItemDeltaRascunho> } }
      );

      // Dispara 20 alterações consecutivas em rajada rápida (a cada 50ms)
      for (let i = 1; i <= 20; i++) {
        const novosDeltas: Record<string, ItemDeltaRascunho> = {};
        for (let j = 1; j <= i; j++) {
          novosDeltas[`SKU-BURST-${j}`] = { quantidade: j * 2, modificadoEm: Date.now() };
        }

        rerender({ deltas: novosDeltas });

        act(() => {
          vi.advanceTimersByTime(50);
        });
      }

      // Durante a rajada rápida, nenhuma gravação definitiva deve ter ocorrido
      expect(localStorage.getItem(storageKey)).toBeNull();

      // Avança o debounce completo de 1500ms após a última alteração
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      // Agora a gravação deve ter ocorrido exatamente com o estado final (20 itens)
      const salvo = localStorage.getItem(storageKey);
      expect(salvo).not.toBeNull();

      const payload: RascunhoSessaoPayload = JSON.parse(salvo!);
      expect(Object.keys(payload.deltas)).toHaveLength(20);
      expect(payload.deltas["SKU-BURST-20"].quantidade).toBe(40);

      // O storage foi acionado apenas uma única vez para consolidar o estado final
      expect(spySetItem).toHaveBeenCalledTimes(1);

      spySetItem.mockRestore();
    });

    it("deve permitir salvarImediatamente() cancelando qualquer debounce pendente", () => {
      const storageKey = "insight-compras-draft-carreiro-comprador-01";

      const { result, rerender } = renderHook(
        ({ deltas }) =>
          useSessionDraft({
            tenantId: "carreiro",
            userId: "comprador-01",
            deltas,
            debounceMs: 5000, // Debounce longo
          }),
        { initialProps: { deltas: {} as Record<string, ItemDeltaRascunho> } }
      );

      rerender({
        deltas: {
          "SKU-URGENTE": { quantidade: 10, modificadoEm: Date.now() },
        },
      });

      // Antes do debounce, ainda está vazio
      expect(localStorage.getItem(storageKey)).toBeNull();

      // Executa salvarImediatamente
      act(() => {
        result.current.salvarImediatamente();
      });

      // Deve estar salvo imediatamente no localStorage sem esperar 5000ms
      const salvo = localStorage.getItem(storageKey);
      expect(salvo).not.toBeNull();
      const payload: RascunhoSessaoPayload = JSON.parse(salvo!);
      expect(payload.deltas["SKU-URGENTE"].quantidade).toBe(10);
    });
  });
});

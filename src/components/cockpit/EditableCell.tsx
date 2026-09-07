"use client";

import React, { memo, useState, useEffect, useRef, useCallback } from "react";
import { EditableCellProps } from "@/tipos/cockpit";
import { cn } from "@/lib/utils";
import { ajustarQuantidadePorLote } from "@core/travas/lote-multiplo";

export const EditableCell = memo(function EditableCell({
  initialValue,
  skuId,
  minMultiplo = 1,
  embalagemMinima = 1,
  valorSugeridoSistema,
  onCommit,
  rotuloAcessibilidade,
  disabled = false,
  className,
}: EditableCellProps) {
  // Estado local desacoplado da matriz global para digitação fluida a 60fps
  const [localValue, setLocalValue] = useState<string>(() => String(initialValue ?? 0));
  const cancelRef = useRef<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincroniza estado local se initialValue mudar externamente (ex: restauração de rascunho)
  useEffect(() => {
    setLocalValue(String(initialValue ?? 0));
  }, [initialValue]);

  // Identificação semântica de regras e estados
  const isMultiplo = minMultiplo > 1;
  const numLocal = Number(localValue);
  const isDirty =
    valorSugeridoSistema !== undefined &&
    Number.isFinite(numLocal) &&
    numLocal !== valorSugeridoSistema;

  // Confirmação com sanitização e aplicação de múltiplos
  const handleBlur = useCallback(() => {
    // Se o usuário cancelou a edição com Escape, descarta e não executa onCommit
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }

    // 1. Sanitização estrita de entrada
    const textoLimpo = localValue.trim().replace(",", ".");
    let valorNumerico = parseFloat(textoLimpo);

    if (!Number.isFinite(valorNumerico) || isNaN(valorNumerico) || valorNumerico < 0) {
      valorNumerico = 0;
    } else {
      valorNumerico = Math.floor(valorNumerico);
    }

    // 2. Aplicação de múltiplos e embalagens mínimas via Core Puro
    let valorFinal = valorNumerico;
    let motivoAjuste: string | null = null;

    if (valorNumerico > 0 && (minMultiplo > 1 || embalagemMinima > 1)) {
      const ajuste = ajustarQuantidadePorLote({
        quantidadeDesejada: valorNumerico,
        multiploLote: minMultiplo,
        embalagemMinima,
      });
      valorFinal = ajuste.quantidadeAjustada;
      motivoAjuste = ajuste.motivoAjuste;
    }

    // Atualiza estado local com o valor final ajustado
    setLocalValue(String(valorFinal));

    // Notifica alteração caso o valor final seja diferente do original
    if (valorFinal !== initialValue) {
      onCommit(skuId, valorFinal, motivoAjuste);
    }
  }, [localValue, initialValue, minMultiplo, embalagemMinima, skuId, onCommit]);

  // Navegação ágil por teclado
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // 1. Tab / Shift+Tab: Navegação direta entre inputs na área visível
      if (e.key === "Tab") {
        e.preventDefault();

        const inputs = Array.from(
          document.querySelectorAll<HTMLInputElement>(".editable-cell-input:not([disabled])")
        );
        const currentIndex = inputs.indexOf(e.currentTarget);
        if (currentIndex === -1) return;

        const direction = e.shiftKey ? -1 : 1;
        const nextIndex = currentIndex + direction;
        const nextInput = inputs[nextIndex];

        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
        return;
      }

      // 2. Enter: Confirma e desfoca
      if (e.key === "Enter") {
        e.preventDefault();
        handleBlur();
        e.currentTarget.blur();
        return;
      }

      // 3. Escape: Cancela e restaura o valor anterior
      if (e.key === "Escape") {
        e.preventDefault();
        cancelRef.current = true;
        setLocalValue(String(initialValue ?? 0));
        e.currentTarget.blur();
        return;
      }
    },
    [initialValue, handleBlur]
  );

  return (
    <div className="relative inline-flex items-center justify-center">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={disabled}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onFocus={(e) => e.target.select()}
        className={cn(
          "editable-cell-input h-8 w-20 rounded border text-center font-mono text-xs font-medium transition-colors outline-none",
          isMultiplo
            ? "border-amber-300 text-amber-950 dark:border-amber-700 dark:text-amber-200"
            : "bg-white text-slate-900 border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100",
          isDirty && "border-blue-600 ring-1 ring-blue-500/40 font-bold",
          "focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500/30",
          disabled && "cursor-not-allowed opacity-50 bg-slate-100 dark:bg-slate-800",
          className
        )}
        style={isMultiplo ? { backgroundColor: "#FFFFCC" } : undefined}
        aria-label={rotuloAcessibilidade ?? `Quantidade para SKU ${skuId}`}
        title={
          isMultiplo
            ? `Item com múltiplo de fábrica: ${minMultiplo} un${embalagemMinima > 1 ? ` (mínimo: ${embalagemMinima} un)` : ""}`
            : undefined
        }
      />
      {isMultiplo && (
        <span
          className="absolute -top-1.5 -right-1.5 flex h-3.5 items-center justify-center rounded-full bg-amber-200 px-1 text-[9px] font-bold text-amber-900 border border-amber-300 dark:bg-amber-800 dark:text-amber-100 dark:border-amber-600 shadow-sm"
          title={`Múltiplo de fábrica: ${minMultiplo} un`}
        >
          {minMultiplo === 2 ? "par" : `${minMultiplo}x`}
        </span>
      )}
    </div>
  );
}, (prev, next) => {
  return (
    prev.initialValue === next.initialValue &&
    prev.skuId === next.skuId &&
    prev.minMultiplo === next.minMultiplo &&
    prev.embalagemMinima === next.embalagemMinima &&
    prev.valorSugeridoSistema === next.valorSugeridoSistema &&
    prev.disabled === next.disabled &&
    prev.className === next.className
  );
});

EditableCell.displayName = "EditableCell";

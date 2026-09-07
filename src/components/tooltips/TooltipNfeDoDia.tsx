"use client";

import React, { useState, useRef, useId, useCallback } from "react";
import { PropsTooltipNfeDoDia } from "@/tipos/cockpit";
import { cn } from "@/lib/utils";

export function TooltipNfeDoDia({ entradas = [], delayDuration = 0, children }: PropsTooltipNfeDoDia) {
  const [visivel, setVisivel] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipId = useId();

  const totalPecasRecebidas = entradas.reduce((acc, cur) => acc + cur.quantidadeEntrada, 0);

  const abrir = useCallback(() => {
    if (entradas.length === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (delayDuration === 0) {
      setVisivel(true);
    } else {
      timerRef.current = setTimeout(() => setVisivel(true), delayDuration);
    }
  }, [entradas.length, delayDuration]);

  const fechar = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisivel(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        fechar();
      }
    },
    [fechar]
  );

  // Se não há entradas hoje, renderiza apenas o elemento filho sem gatilhos nem tooltip
  if (!entradas || entradas.length === 0) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative inline-flex items-center cursor-pointer"
      onMouseEnter={abrir}
      onMouseLeave={fechar}
      onFocus={abrir}
      onBlur={fechar}
      onKeyDown={handleKeyDown}
      aria-describedby={visivel ? tooltipId : undefined}
      tabIndex={0}
      role="button"
      aria-label={`Alerta de NF-e do Dia: ${entradas.length} nota(s) fiscal(is) recebida(s) hoje, somando ${totalPecasRecebidas} unidades`}
    >
      {children}

      {visivel && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-80 rounded-md border border-red-300 bg-white p-3 text-xs shadow-2xl transition-opacity dark:border-red-800 dark:bg-slate-900 dark:text-slate-100"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-red-100 dark:border-red-900">
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold">
              <span className="flex h-2 w-2 rounded-full bg-red-600 animate-pulse" />
              <span>Entrada de NF-e no Dia</span>
            </div>
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800 border border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800">
              +{totalPecasRecebidas} un
            </span>
          </div>

          <div className="mt-2 text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">
              {entradas.length} {entradas.length === 1 ? "nota fiscal recebida" : "notas fiscais recebidas"} hoje:
            </span>
          </div>

          <div className="mt-1.5 max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {entradas.map((entrada, idx) => (
              <div
                key={`${entrada.numeroNotaFiscal}-${idx}`}
                className="rounded border border-red-200 bg-red-50/60 p-2 dark:border-red-800/60 dark:bg-red-950/20"
              >
                <div className="flex justify-between items-center text-[11px] font-mono">
                  <span className="font-bold text-red-950 dark:text-red-200">NF #{entrada.numeroNotaFiscal}</span>
                  <span className="font-bold text-red-700 dark:text-red-400">+{entrada.quantidadeEntrada} un</span>
                </div>
                <div className="text-[10px] text-slate-600 dark:text-slate-300 font-sans truncate mt-0.5">
                  {entrada.fornecedorNome}
                </div>
                {entrada.dataHoraChegada && (
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    Entrada: {entrada.dataHoraChegada}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-2.5 rounded bg-amber-50 p-2 text-[10px] text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800">
            <span className="font-bold">Aviso Preventivo:</span> Mercadoria acabou de dar entrada fiscal/física hoje.
            Verifique o recebimento antes de emitir nova compra externa para prevenir sobreestoque e duplicidade.
          </div>
        </div>
      )}
    </div>
  );
}

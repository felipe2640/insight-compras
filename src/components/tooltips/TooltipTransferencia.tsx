"use client";

import React, { useState, useRef, useId, useCallback } from "react";
import { PropsTooltipTransferencia } from "@/tipos/cockpit";
import { cn } from "@/lib/utils";

export function TooltipTransferencia({
  filialOrigemNome,
  saldoOrigem,
  estoqueMinimoOrigem,
  sobraRealOrigem,
  filialDestinoNome,
  necessidadeDestino,
  quantidadeTransferirRecomendada,
  motivo,
  delayDuration = 0,
  children,
}: PropsTooltipTransferencia) {
  const [visivel, setVisivel] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipId = useId();

  // Sobra real estritamente calculada como saldo - minStock > 0
  const sobraRealCalculada = Math.max(0, saldoOrigem - estoqueMinimoOrigem);
  const transferenciaEfetiva = Math.min(necessidadeDestino, sobraRealCalculada);
  const saldoOrigemApos = saldoOrigem - transferenciaEfetiva;

  const abrir = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (delayDuration === 0) {
      setVisivel(true);
    } else {
      timerRef.current = setTimeout(() => setVisivel(true), delayDuration);
    }
  }, [delayDuration]);

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

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={abrir}
      onMouseLeave={fechar}
      onFocus={abrir}
      onBlur={fechar}
      onKeyDown={handleKeyDown}
      aria-describedby={visivel ? tooltipId : undefined}
    >
      {children}

      {visivel && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-80 rounded-md border border-slate-200 bg-white p-3 text-xs shadow-xl transition-opacity dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-white">Transferência entre Lojas</span>
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-800">
              Inter-Filiais
            </span>
          </div>

          <div className="mt-2 space-y-2">
            {/* Doadora / Origem */}
            <div className="rounded bg-slate-50 p-2 border border-slate-200 dark:bg-slate-800/40 dark:border-slate-700">
              <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>Origem (Doadora):</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{filialOrigemNome || "—"}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                <div>Saldo Atual: <span className="font-bold">{saldoOrigem} un</span></div>
                <div>Mínimo: <span className="font-bold">{estoqueMinimoOrigem} un</span></div>
              </div>
              <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-700 flex justify-between text-[11px]">
                <span className="text-slate-500">Sobra Real Doadora:</span>
                <span className={cn("font-mono font-bold", sobraRealCalculada > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                  {sobraRealCalculada} un
                </span>
              </div>
            </div>

            {/* Receptora / Destino */}
            <div className="rounded bg-slate-50 p-2 border border-slate-200 dark:bg-slate-800/40 dark:border-slate-700">
              <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>Destino (Foco):</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{filialDestinoNome || "Loja Foco"}</span>
              </div>
              <div className="mt-1 flex justify-between text-[11px] font-mono">
                <span className="text-slate-500">Necessidade Calculada:</span>
                <span className="font-bold text-slate-900 dark:text-white">{necessidadeDestino} un</span>
              </div>
            </div>

            {/* Decisão / Recomendação */}
            <div className="rounded bg-indigo-50/70 p-2 border border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-indigo-950 dark:text-indigo-200">Transferência Recomendada:</span>
                <span className="font-mono font-bold text-sm text-indigo-700 dark:text-indigo-300">
                  {quantidadeTransferirRecomendada} un
                </span>
              </div>
              <div className="mt-1 text-[10px] text-indigo-800 dark:text-indigo-300 flex justify-between">
                <span>Saldo Origem após remanejamento:</span>
                <span className="font-mono font-bold">{saldoOrigemApos} un ({">="} mín {estoqueMinimoOrigem})</span>
              </div>
              {motivo && (
                <div className="mt-1 text-[10px] text-slate-600 dark:text-slate-400 italic">
                  Motivo: {motivo}
                </div>
              )}
            </div>
          </div>

          <div className="mt-2.5 rounded bg-emerald-50/60 p-2 text-[10px] text-emerald-900 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800">
            <span className="font-bold">Regra de Proteção da Origem:</span> A loja doadora só transfere se mantiver
            saldo estritamente acima do estoque mínimo de segurança (<code className="font-mono">saldo - minStock &gt; 0</code>). Jamais desabastece a origem.
          </div>
        </div>
      )}
    </div>
  );
}

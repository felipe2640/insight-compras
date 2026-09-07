"use client";

import React, { useState, useRef, useId, useCallback } from "react";
import { PropsTooltipFrequencia, ClassificacaoFrequencia } from "@/tipos/cockpit";
import { cn } from "@/lib/utils";

const ESTILOS_CLASSIFICACAO: Record<ClassificacaoFrequencia, { badge: string; texto: string }> = {
  Alta: {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
    texto: "Alta (> 40%) - Recorrente",
  },
  Média: {
    badge: "bg-blue-100 text-blue-800 border-blue-300",
    texto: "Média (15% a 40%) - Regular",
  },
  Baixa: {
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    texto: "Baixa (< 15%) - Intermitente",
  },
};

export function TooltipFrequencia({
  notasVenda,
  notasDevolucao,
  notasLiquidas,
  frequenciaPercentual,
  classificacao,
  totalPecasVendidas,
  extratoMovimentacoes = [],
  delayDuration = 0,
  children,
}: PropsTooltipFrequencia) {
  const [visivel, setVisivel] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipId = useId();

  const estilo = ESTILOS_CLASSIFICACAO[classificacao] ?? ESTILOS_CLASSIFICACAO["Baixa"];
  const notasLiquidasCalculadas = notasVenda - notasDevolucao;

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
            <span className="font-semibold text-slate-900 dark:text-white">Frequência em 90 Dias</span>
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold border", estilo.badge)}>
              {classificacao}
            </span>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded bg-emerald-50 p-1.5 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800">
              <div className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Vendas</div>
              <div className="font-mono font-bold text-emerald-900 dark:text-emerald-200">{notasVenda}</div>
            </div>
            <div className="rounded bg-red-50 p-1.5 border border-red-200 dark:bg-red-950/40 dark:border-red-800">
              <div className="text-[10px] font-medium text-red-700 dark:text-red-400">Devoluções</div>
              <div className="font-mono font-bold text-red-900 dark:text-red-200">{notasDevolucao}</div>
            </div>
            <div className="rounded bg-blue-50 p-1.5 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800">
              <div className="text-[10px] font-medium text-blue-700 dark:text-blue-400">Líquidas</div>
              <div className="font-mono font-bold text-blue-900 dark:text-blue-200">{notasLiquidasCalculadas}</div>
            </div>
          </div>

          <div className="mt-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Índice de Recorrência (90d):</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {frequenciaPercentual.toFixed(1).replace(".", ",")}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Volume Total Transacionado:</span>
              <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                {totalPecasVendidas} peças
              </span>
            </div>
          </div>

          {/* Extrato de Movimentações */}
          <div className="mt-2.5 border-t border-slate-100 pt-2 dark:border-slate-800">
            <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
              Extrato Recente de Notas
            </div>
            {extratoMovimentacoes.length > 0 ? (
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
                {extratoMovimentacoes.slice(0, 10).map((item, idx) => (
                  <div
                    key={`${item.numeroNota}-${idx}`}
                    className={cn(
                      "flex items-center justify-between rounded px-1.5 py-0.5 border",
                      item.tipo === "venda"
                        ? "bg-emerald-50/70 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
                        : "bg-red-50/70 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300"
                    )}
                  >
                    <span className="truncate max-w-[130px] font-sans" title={item.nomeCliente}>
                      {item.nomeCliente}
                    </span>
                    <span className="font-bold">
                      {item.tipo === "venda" ? `+${item.quantidade}` : `-${item.quantidade}`} un (NF #{item.numeroNota})
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] italic text-slate-400 text-center py-1">
                Sem movimentação de notas nos últimos 90 dias
              </div>
            )}
          </div>

          <p className="mt-2 text-[10px] text-slate-400 leading-tight">
            Mede a recorrência real de clientes. Um produto com 50 peças vendidas em 1 nota indica compra pontual; 50 peças em 30 notas indica alta demanda de balcão.
          </p>
        </div>
      )}
    </div>
  );
}

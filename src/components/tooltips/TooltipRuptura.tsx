"use client";

import React from "react";
import { PropsTooltipRuptura, SeveridadeRuptura } from "@/tipos/cockpit";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


const ESTILOS_SEVERIDADE: Record<SeveridadeRuptura, { badge: string; borda: string; texto: string }> = {
  Boa: {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
    borda: "border-l-emerald-500",
    texto: "Boa (Ruptura <= 5%)",
  },
  Atenção: {
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    borda: "border-l-amber-500",
    texto: "Atenção (Ruptura 5% a 10%)",
  },
  Grave: {
    badge: "bg-red-100 text-red-800 border-red-300",
    borda: "border-l-red-500",
    texto: "Grave (Ruptura > 10%)",
  },
  "Sem histórico": {
    badge: "bg-slate-100 text-slate-700 border-slate-300",
    borda: "border-l-slate-400",
    texto: "Sem histórico suficiente",
  },
};

export function TooltipRuptura({
  diasAnalisados,
  diasZerados,
  percentualRuptura,
  classificacao,
  dataUltimoZeramento,
  vendaPerdidaEstimadaReais,
  consumoDiarioReferencia,
  precoVenda,
  delayDuration = 0,
  children,
}: PropsTooltipRuptura) {

  // Calcula taxa de ruptura dinamicamente se não informada ou valida integridade
  const taxaCalculada =
    percentualRuptura !== null && percentualRuptura !== undefined
      ? percentualRuptura
      : diasAnalisados !== null && diasZerados !== null && diasAnalisados > 0
        ? (diasZerados / diasAnalisados) * 100
        : null;

  // Calcula estimativa de perda financeira se não fornecida diretamente
  const perdaFinanceira =
    vendaPerdidaEstimadaReais > 0
      ? vendaPerdidaEstimadaReais
      : consumoDiarioReferencia && precoVenda && diasZerados !== null && diasZerados > 0
        ? consumoDiarioReferencia * diasZerados * precoVenda
        : 0;

  const estilo = ESTILOS_SEVERIDADE[classificacao] ?? ESTILOS_SEVERIDADE["Sem histórico"];

  return (
    <TooltipProvider>
      <Tooltip delayDuration={delayDuration}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="w-80 p-3 text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-white">Diagnóstico de Ruptura</span>
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold border", estilo.badge)}>
              {classificacao}
            </span>
          </div>

          <div className="mt-2 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Dias com Estoque Zero:</span>
              <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
                {diasZerados === null || diasAnalisados === null ? "não medido" : `${diasZerados} de ${diasAnalisados} dias`}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Taxa de Ruptura:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {taxaCalculada !== null ? `${taxaCalculada.toFixed(1).replace(".", ",")}%` : "Sem histórico"}
              </span>
            </div>

            {dataUltimoZeramento && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Último Zeramento:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{dataUltimoZeramento}</span>
              </div>
            )}

            {perdaFinanceira > 0 && (
              <div className="mt-2 rounded bg-red-50 p-2 border border-red-200 dark:bg-red-950/40 dark:border-red-800">
                <div className="text-[10px] font-semibold text-red-700 dark:text-red-300">
                  Demanda Reprimida Estimada:
                </div>
                <div className="font-mono text-xs font-bold text-red-900 dark:text-red-200">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(perdaFinanceira)}
                </div>
              </div>
            )}
          </div>

          <p className="mt-2 text-[10px] text-slate-400 leading-tight">
            Mede a frequência de dias zerados. Ruptura acima de 10% é considerada grave com perda de faturamento.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

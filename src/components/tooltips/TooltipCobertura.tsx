"use client";

import React from "react";
import { PropsTooltipCobertura, TendenciaCobertura } from "@/tipos/cockpit";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


function formatarCobertura(dias: number | null, cmd: number): string {
  if (dias === null || cmd <= 0 || !Number.isFinite(dias)) {
    return "Sem consumo";
  }
  if (dias >= 999) {
    return "999+ dias";
  }
  return `${Math.round(dias)} dias`;
}

export function TooltipCobertura({
  saldoEstoqueAtual,
  leadTimeDias = 15,
  vendas30d,
  cmd30d,
  cobertura30dDias,
  vendas90d,
  cmd90d,
  cobertura90dDias,
  vendas180d,
  cmd180d,
  cobertura180dDias,
  tendencia,
  isMarcaZumbi,
  delayDuration = 0,
  children,
}: PropsTooltipCobertura) {

  const isZumbiEfetivo = isMarcaZumbi || (saldoEstoqueAtual > 0 && vendas180d === 0);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={delayDuration}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent variante="painel" side="top" className="w-80 p-3 text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-white">Coberturas Comparativas</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-bold border",
                isZumbiEfetivo
                  ? "bg-red-950 text-red-200 border-red-700"
                  : tendencia === "ALTA"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : tendencia === "QUEDA"
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-slate-100 text-slate-700 border-slate-300"
              )}
            >
              {isZumbiEfetivo ? "⚠ MARCA ZUMBI" : `Tendência ${tendencia}`}
            </span>
          </div>

          <div className="mt-2 text-slate-600 dark:text-slate-300 flex justify-between">
            <span>Saldo Físico Atual:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{saldoEstoqueAtual} unidades</span>
          </div>

          {/* Tabela de 3 Janelas */}
          <div className="mt-2 rounded border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-[10px] text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-1.5">Janela</th>
                  <th className="p-1.5 text-right">Vendas</th>
                  <th className="p-1.5 text-right">CMD (un/d)</th>
                  <th className="p-1.5 text-right">Cobertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                <tr className={cmd30d > cmd90d * 1.25 ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}>
                  <td className="p-1.5 font-sans font-medium text-slate-900 dark:text-slate-200">30d (Aceleração)</td>
                  <td className="p-1.5 text-right">{vendas30d}</td>
                  <td className="p-1.5 text-right">{cmd30d.toFixed(2).replace(".", ",")}</td>
                  <td className="p-1.5 text-right font-bold">{formatarCobertura(cobertura30dDias, cmd30d)}</td>
                </tr>
                <tr>
                  <td className="p-1.5 font-sans font-medium text-slate-900 dark:text-slate-200">90d (Giro Médio)</td>
                  <td className="p-1.5 text-right">{vendas90d}</td>
                  <td className="p-1.5 text-right">{cmd90d.toFixed(2).replace(".", ",")}</td>
                  <td className="p-1.5 text-right font-bold">{formatarCobertura(cobertura90dDias, cmd90d)}</td>
                </tr>
                <tr className={isZumbiEfetivo ? "bg-red-50 dark:bg-red-950/30" : ""}>
                  <td className="p-1.5 font-sans font-medium text-slate-900 dark:text-slate-200">180d (Defesa)</td>
                  <td className="p-1.5 text-right">{vendas180d}</td>
                  <td className="p-1.5 text-right">{cmd180d.toFixed(2).replace(".", ",")}</td>
                  <td className="p-1.5 text-right font-bold">{formatarCobertura(cobertura180dDias, cmd180d)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Diagnóstico de Tendência Automatizado */}
          <div className="mt-2">
            {isZumbiEfetivo ? (
              <div className="rounded bg-red-100 p-2 text-[10px] text-red-900 border border-red-300 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800">
                <span className="font-bold">TRAVA MARCA ZUMBI / ENCALHE:</span> Saldo positivo ({saldoEstoqueAtual} un)
                sem nenhuma saída registrada nos últimos 180 dias. Compra bloqueada estritamente em zero para proteção de capital de giro.
              </div>
            ) : cmd30d > cmd90d * 1.25 ? (
              <div className="rounded bg-emerald-50 p-1.5 text-[10px] text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span className="font-bold">Tendência de ALTA / ACELERAÇÃO:</span> Saídas recentes (+
                {Math.round(((cmd30d - cmd90d) / (cmd90d || 1)) * 100)}%) acima do giro médio. Risco iminente de desabastecimento se não reforçar estoque.
              </div>
            ) : cmd30d < cmd90d * 0.75 && cmd30d > 0 ? (
              <div className="rounded bg-amber-50 p-1.5 text-[10px] text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                <span className="font-bold">Tendência de QUEDA / DESACELERAÇÃO:</span> Ritmo recente em desaceleração (-
                {Math.round(((cmd90d - cmd30d) / (cmd90d || 1)) * 100)}%). Risco de sobrecompra se basear pedido apenas no histórico antigo.
              </div>
            ) : (
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                Ritmo de consumo regular e estável (oscilação dentro da faixa regular de ±25%).
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

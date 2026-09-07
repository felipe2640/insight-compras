"use client";

import React from "react";
import { RascunhoSessaoPayload } from "@/tipos/cockpit";
import { cn } from "@/lib/utils";

export interface BannerRascunhoProps {
  draft: RascunhoSessaoPayload;
  onRestaurar: () => void;
  onDescartar: () => void;
  className?: string;
}

export function BannerRascunho({
  draft,
  onRestaurar,
  onDescartar,
  className,
}: BannerRascunhoProps) {
  const qtdDeltas = Object.keys(draft.deltas ?? {}).length;
  const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(draft.timestamp));

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50/90 px-4 py-2.5 text-xs text-blue-950 shadow-sm dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">
          💾
        </span>
        <div>
          <span className="font-semibold">Rascunho de sessão disponível:</span>{" "}
          <span>
            Salvo em <strong>{dataFormatada}</strong> ({qtdDeltas}{" "}
            {qtdDeltas === 1 ? "item modificado" : "itens modificados"}). Deseja restaurar suas alterações?
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRestaurar}
          className="rounded bg-blue-600 px-3 py-1 font-semibold text-white shadow hover:bg-blue-700 active:bg-blue-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
        >
          Restaurar Rascunho
        </button>
        <button
          type="button"
          onClick={onDescartar}
          className="rounded border border-blue-300 bg-white px-2.5 py-1 font-medium text-blue-900 hover:bg-blue-100 active:bg-blue-200 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

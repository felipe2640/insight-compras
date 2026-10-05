"use client";

import React from "react";
import { StatusFilterOption } from "@/tipos/cockpit";
import { ContagensStatusGrade } from "@/lib/cockpit/escopo-grade";
import { cn } from "@/lib/utils";

export interface BarraFiltrosCockpitProps {
  queryBusca: string;
  onQueryChange: (query: string) => void;
  statusFiltro: StatusFilterOption;
  onStatusChange: (status: StatusFilterOption) => void;
  totalItens: number;
  totalFiltrados: number;
  contagensStatus?: ContagensStatusGrade;
  /**
   * Lojas da rede, SEMPRE do cadastro do tenant.
   *
   * Aqui havia uma lista fixa como valor padrão — cinco lojas de uma rede que
   * não é a deste cadastro (Trairi, Paraipaba, Itapipoca...). Quem esquecesse
   * de passar a prop mostrava ao cliente as lojas de outro. Sem padrão, o
   * compilador cobra.
   */
  lojas: Array<{ id: number; nome: string }>;
  lojaFocoId: number;
  onLojaFocoChange: (id: number) => void;
  onLimparFiltros?: () => void;
  isPending?: boolean;
}

export function BarraFiltrosCockpit({
  queryBusca,
  onQueryChange,
  statusFiltro,
  onStatusChange,
  totalItens,
  totalFiltrados,
  contagensStatus,
  lojas,
  lojaFocoId,
  onLojaFocoChange,
  onLimparFiltros,
  isPending = false,
}: BarraFiltrosCockpitProps) {
  const statusOptions: Array<{ id: StatusFilterOption; rotulo: string; count?: number; badgeCor?: string }> = [
    { id: "ALL", rotulo: "Todos", count: contagensStatus?.total ?? totalItens },
    {
      id: "PEDIR",
      rotulo: "Comprar",
      count: contagensStatus?.pedir,
      badgeCor: "bg-emerald-100 text-emerald-800",
    },
    {
      id: "TRANSFERIR",
      rotulo: "Transferir",
      count: contagensStatus?.transferir,
      badgeCor: "bg-indigo-100 text-indigo-800",
    },
    {
      id: "SUGESTAO_ERP",
      rotulo: "Sugestão ERP",
      count: contagensStatus?.sugestaoErp,
      badgeCor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    },
    {
      id: "RUPTURA",
      rotulo: "Ruptura",
      count: contagensStatus?.ruptura,
      badgeCor: "bg-red-100 text-red-800",
    },
    {
      id: "ZUMBI",
      rotulo: "Marca Zumbi",
      count: contagensStatus?.zumbi,
      badgeCor: "bg-slate-800 text-red-200",
    },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Campo de Busca Rápida */}
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={queryBusca}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar por código, descrição, marca ou aplicação..."
            className="w-full rounded-md border border-slate-300 bg-slate-50 py-1.5 pl-9 pr-8 text-xs text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400"
            aria-label="Buscar produtos no cockpit"
          />
          {queryBusca && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Limpar termo de busca"
            >
              ✕
            </button>
          )}
        </div>

        {/* Seletor de Loja em Foco */}
        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="select-loja-foco" className="font-semibold text-slate-700 dark:text-slate-300">
            Loja em Foco:
          </label>
          <select
            id="select-loja-foco"
            value={lojaFocoId}
            onChange={(e) => onLojaFocoChange(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Contador de Itens */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
          <span>
            Exibindo: <strong className="text-slate-900 dark:text-white font-bold">{totalFiltrados}</strong> de{" "}
            <span>{totalItens} SKUs</span>
          </span>
          {isPending && (
            <span className="text-blue-500 font-sans text-[11px] animate-pulse">
              (filtrando...)
            </span>
          )}
        </div>
      </div>

      {/* Chips de Filtro por Status Operacional */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mr-1">
            Status:
          </span>
          {statusOptions.map((opt) => {
            const ativo = statusFiltro === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onStatusChange(opt.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors outline-none",
                  ativo
                    ? "bg-slate-900 text-white shadow-sm dark:bg-blue-600"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                )}
              >
                <span>{opt.rotulo}</span>
                {opt.count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-bold font-mono",
                      ativo ? "bg-white/20 text-white" : opt.badgeCor ?? "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                    )}
                  >
                    {opt.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {(queryBusca || statusFiltro !== "ALL") && onLimparFiltros && (
          <button
            type="button"
            onClick={onLimparFiltros}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400 font-medium"
          >
            Limpar todos os filtros
          </button>
        )}
      </div>
    </div>
  );
}

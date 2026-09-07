"use client";

import React from "react";
import { Table as TanstackTable } from "@tanstack/react-table";
import { DataGrid } from "@/components/ui/data-grid";
import { LinhaCockpitCompras } from "@/tipos/cockpit";
import { cn } from "@/lib/utils";

export type DataTableSectionProps = {
  table: TanstackTable<LinhaCockpitCompras>;
  filteredCount: number;
  totalCount: number;
  rowHeight: "compact" | "default" | "relaxed";
  className?: string;
};

export function DataTableSection({
  table,
  filteredCount,
  totalCount,
  rowHeight,
  className,
}: DataTableSectionProps) {
  return (
    <section className={cn("flex flex-col flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}>
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 px-4 py-2.5 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30">
        <div className="space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Grade Operacional de Compras & Transferências
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Exibindo <strong className="font-semibold text-slate-900 dark:text-white">{table.getRowModel().rows.length}</strong> de{" "}
            <strong className="font-semibold text-slate-900 dark:text-white">{filteredCount}</strong> itens filtrados
            {filteredCount !== totalCount && ` • Catálogo total: ${totalCount} SKUs`}.
          </p>
        </div>
      </div>

      <DataGrid
        table={table}
        rowHeight={rowHeight}
        emptyMessage="Nenhum produto corresponde aos filtros selecionados."
        rowClassName={(row) => {
          const item = row.original;
          const temSimilarComSaldo = item.temSimilarComEstoque;
          const exigeMultiplo = item.exigeMultiploEmbalagem;
          const isMarcaZumbi = item.isMarcaZumbi;

          if (isMarcaZumbi) {
            return "bg-slate-50/70 border-l-4 border-slate-400 opacity-90";
          }
          if (temSimilarComSaldo) {
            return "bg-purple-50/60 border-l-4 border-purple-400 hover:bg-purple-50/90";
          }
          if (exigeMultiplo) {
            return "bg-[#FFFFCC]/40 border-l-4 border-amber-300 hover:bg-[#FFFFCC]/70";
          }
          return undefined;
        }}
      />
    </section>
  );
}

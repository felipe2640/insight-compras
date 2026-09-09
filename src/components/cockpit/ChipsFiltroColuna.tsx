"use client";

/**
 * Chips dos filtros de coluna ativos, com a contagem do que sobrou.
 * Camada: Interface (src/components/cockpit).
 *
 * Um filtro que some da vista é um filtro que engana: o comprador vê 12 linhas,
 * esquece que filtrou por marca e conclui que a rede só tem 12 itens. Cada
 * filtro ativo aparece aqui, dizendo o que faz, e sai com um clique.
 */

import React from "react";
import { X, Filter } from "lucide-react";
import type { Table } from "@tanstack/react-table";
import { descreverFiltroColuna, filtroEstaCompleto } from "@/lib/cockpit/filtros-coluna";
import { lerFiltroDaColuna, varianteDaColuna } from "@/lib/cockpit/filtro-tanstack";
import { cn } from "@/lib/utils";

export interface ChipsFiltroColunaProps<TData> {
  readonly table: Table<TData>;
  readonly className?: string;
}

export function ChipsFiltroColuna<TData>({ table, className }: ChipsFiltroColunaProps<TData>) {
  // Só os filtros que de fato filtram. Uma linha pela metade no construtor
  // ("Custo é maior que ___") não deve virar chip: anunciaria um recorte que
  // não está acontecendo.
  const filtros = table
    .getState()
    .columnFilters.filter((f) => filtroEstaCompleto(lerFiltroDaColuna(f.value)));
  if (filtros.length === 0) return null;

  const totalAntes = table.getPreFilteredRowModel().rows.length;
  const totalDepois = table.getFilteredRowModel().rows.length;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <Filter className="h-3 w-3" />
        Filtros de coluna
      </span>

      {filtros.map((filtroAtivo) => {
        const coluna = table.getColumn(filtroAtivo.id);
        const filtro = lerFiltroDaColuna(filtroAtivo.value);
        if (!coluna || !filtro) return null;
        const meta = coluna.columnDef.meta as { label?: string } | undefined;
        const rotulo = meta?.label ?? coluna.id;

        return (
          <span
            key={filtroAtivo.id}
            className="flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
          >
            {descreverFiltroColuna(rotulo, filtro, varianteDaColuna(coluna.columnDef.meta))}
            <button
              type="button"
              onClick={() => coluna.setFilterValue(undefined)}
              aria-label={`Remover filtro de ${rotulo}`}
              className="rounded p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-900 dark:hover:bg-blue-900"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      <span className="text-[11px] text-slate-500 dark:text-slate-400">
        {totalDepois.toLocaleString("pt-BR")} de {totalAntes.toLocaleString("pt-BR")} linhas
      </span>

      <button
        type="button"
        onClick={() => table.resetColumnFilters()}
        className="text-[11px] font-semibold text-rose-600 hover:underline"
      >
        Limpar colunas
      </button>
    </div>
  );
}

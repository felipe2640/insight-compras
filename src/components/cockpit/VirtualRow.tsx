"use client";

import React, { memo } from "react";
import { Row, flexRender } from "@tanstack/react-table";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import { cn } from "@/lib/utils";

export interface VirtualRowProps {
  row: Row<LinhaCockpitMatriz>;
  virtualRowIndex: number;
  measureRef?: (node: HTMLElement | null) => void;
  isSelected?: boolean;
  visibleColumnsKey?: string;
  rowHeight?: number | string;
  rowClassName?: string;
}

function VirtualRowImpl({
  row,
  virtualRowIndex,
  measureRef,
  isSelected,
  rowClassName,
}: VirtualRowProps) {
  return (
    <tr
      ref={measureRef}
      data-index={virtualRowIndex}
      className={cn(
        "h-12 border-b border-slate-200 transition-colors hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/50",
        isSelected
          ? "bg-blue-50/70 hover:bg-blue-50 dark:bg-blue-950/40 dark:hover:bg-blue-950/60"
          : virtualRowIndex % 2 === 0
            ? "bg-white dark:bg-slate-900"
            : "bg-slate-50/30 dark:bg-slate-900/50",
        rowClassName
      )}
    >
      {row.getVisibleCells().map((cell) => {
        const isPinned = cell.column.getIsPinned();
        const isLastPinnedLeft = cell.column.getIsLastColumn("left");
        const startLeft = cell.column.getStart("left");

        return (
          <td
            key={cell.id}
            style={{
              width: cell.column.getSize(),
              // `width` numa <td> é apenas sugestão: sem maxWidth o conteúdo
              // transborda e escreve por cima da coluna vizinha (Aplicação
              // invadindo Ref. Fabricante e Marca). Fixar o teto e cortar aqui
              // conserta todas as colunas de uma vez, em vez de remendar célula
              // por célula com `truncate`.
              maxWidth: cell.column.getSize(),
              left: isPinned === "left" ? `${startLeft}px` : undefined,
            }}
            className={cn(
              "px-3 py-1.5 text-xs align-middle overflow-hidden whitespace-nowrap text-ellipsis",
              isPinned === "left" && [
                "sticky z-10",
                isSelected
                  ? "bg-blue-50 dark:bg-slate-900"
                  : virtualRowIndex % 2 === 0
                    ? "bg-white dark:bg-slate-900"
                    : "bg-slate-50 dark:bg-slate-900",
              ],
              isLastPinnedLeft &&
                "shadow-[3px_0_5px_-2px_rgba(0,0,0,0.12)] border-r border-slate-300 dark:border-slate-700"
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        );
      })}
    </tr>
  );
}

export function areVirtualRowPropsEqual(prev: VirtualRowProps, next: VirtualRowProps): boolean {
  return (
    prev.row.id === next.row.id &&
    prev.virtualRowIndex === next.virtualRowIndex &&
    prev.isSelected === next.isSelected &&
    prev.row.original === next.row.original &&
    prev.visibleColumnsKey === next.visibleColumnsKey &&
    prev.rowHeight === next.rowHeight &&
    prev.rowClassName === next.rowClassName
  );
}

export const VirtualRow = memo(VirtualRowImpl, areVirtualRowPropsEqual);

VirtualRow.displayName = "VirtualRow";

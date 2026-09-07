"use client";

import React, { useRef, useState, useMemo, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  ColumnPinningState,
  flexRender,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import { criarBaseColumns } from "./baseColumns";
import { VirtualRow } from "./VirtualRow";
import { DialogSimilares } from "@/components/tooltips/DialogSimilares";
import { cn } from "@/lib/utils";

export interface GridCockpitVirtualizadoProps {
  dados: readonly LinhaCockpitMatriz[];
  onCommitPedido?: (skuId: string | number, quantidade: number, motivo: string | null) => void;
  onCommitTransferencia?: (skuId: string | number, quantidade: number, motivo: string | null) => void;
  alturaContainer?: number | string;
  className?: string;
}

export function GridCockpitVirtualizado({
  dados,
  onCommitPedido,
  onCommitTransferencia,
  alturaContainer = "calc(100vh - 240px)",
  className,
}: GridCockpitVirtualizadoProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});

  // Diálogo de Similares
  const [dialogSimilaresAberto, setDialogSimilaresAberto] = useState(false);
  const [itemSimilaresSelecionado, setItemSimilaresSelecionado] = useState<LinhaCockpitMatriz | null>(null);

  const handleAbrirSimilares = useCallback((item: LinhaCockpitMatriz) => {
    setItemSimilaresSelecionado(item);
    setDialogSimilaresAberto(true);
  }, []);

  // Definição das colunas baseColumns
  const columns = useMemo(() => {
    return criarBaseColumns({
      onAbrirSimilares: handleAbrirSimilares,
      onCommitPedido,
      onCommitTransferencia,
    });
  }, [handleAbrirSimilares, onCommitPedido, onCommitTransferencia]);

  // Fixação de colunas: selecao, codigo e descricao à esquerda
  const columnPinning: ColumnPinningState = useMemo(() => ({
    left: ["selecao", "codigo", "descricao"],
  }), []);

  // Inicialização do TanStack Table v8
  const table = useReactTable({
    data: dados as LinhaCockpitMatriz[],
    columns,
    state: {
      sorting,
      columnPinning,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  // Configuração do Virtualizador: 48px por linha, overscan de 10 linhas para 60fps
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 48,
    overscan: 10,
    initialRect: { width: 1200, height: 600 },
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Cálculo dos espaçadores superior e inferior via linhas de padding
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

  const visibleColumnsCount = table.getVisibleLeafColumns().length;

  return (
    <div className={cn("relative flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}>
      {/* Contêiner com rolagem independente */}
      <div
        ref={tableContainerRef}
        style={{ height: alturaContainer }}
        className="overflow-auto focus:outline-none"
        tabIndex={0}
        aria-label="Tabela virtualizada de compras de autopeças"
      >
        <table className="w-full border-collapse text-left border-spacing-0">
          {/* Cabeçalho Fixo (Sticky Header com Column Pinning) */}
          <thead className="sticky top-0 z-20 bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-200 dark:border-slate-700">
                {headerGroup.headers.map((header) => {
                  const isPinned = header.column.getIsPinned();
                  const isLastPinnedLeft = header.column.getIsLastColumn("left");
                  const startLeft = header.column.getStart("left");

                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{
                        width: header.getSize(),
                        left: isPinned === "left" ? `${startLeft}px` : undefined,
                      }}
                      className={cn(
                        "px-3 py-2.5 select-none whitespace-nowrap",
                        isPinned === "left" && [
                          "sticky z-30 bg-slate-50 dark:bg-slate-800",
                        ],
                        isLastPinnedLeft &&
                          "shadow-[3px_0_5px_-2px_rgba(0,0,0,0.12)] border-r border-slate-300 dark:border-slate-700"
                      )}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            header.column.getCanSort() ? "cursor-pointer" : ""
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: " 🔼",
                            desc: " 🔽",
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Corpo da Tabela com Virtualização e Linhas Espaçadoras */}
          <tbody className="divide-y divide-slate-200 text-xs dark:divide-slate-800">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumnsCount}
                  className="h-40 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  Nenhum produto encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              <>
                {/* Espaçador Superior */}
                {paddingTop > 0 && (
                  <tr style={{ height: `${paddingTop}px` }}>
                    <td colSpan={visibleColumnsCount} className="p-0 border-0" />
                  </tr>
                )}

                {/* Linhas Visíveis Virtuais Renderizadas */}
                {virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <VirtualRow
                      key={row.id}
                      row={row}
                      virtualRowIndex={virtualRow.index}
                      measureRef={rowVirtualizer.measureElement}
                      isSelected={row.getIsSelected()}
                    />
                  );
                })}

                {/* Espaçador Inferior */}
                {paddingBottom > 0 && (
                  <tr style={{ height: `${paddingBottom}px` }}>
                    <td colSpan={visibleColumnsCount} className="p-0 border-0" />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Diálogo de Similares Intercambiáveis */}
      {itemSimilaresSelecionado && (
        <DialogSimilares
          aberto={dialogSimilaresAberto}
          onOpenChange={setDialogSimilaresAberto}
          produtoPrincipalCodigo={itemSimilaresSelecionado.codigoSku}
          produtoPrincipalDescricao={itemSimilaresSelecionado.descricao}
          similares={itemSimilaresSelecionado.similares}
        />
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import { useRef, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Cell,
  Column,
  Header,
  Row,
  Table as TanstackTable,
  flexRender,
} from "@tanstack/react-table";
import {
  ArrowDown01,
  ArrowUp01,
  ArrowUpDown,
  ChevronDown,
  Columns3,
  EyeOff,
  Filter,
  Keyboard,
  Pin,
  PinOff,
  Rows4,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ColumnMeta = {
  label?: string;
  align?: "left" | "center" | "right";
  width?: number | string;
  pinned?: "left" | "right" | false;
  [key: string]: unknown;
};

type DataGridProps<TData> = {
  table: TanstackTable<TData>;
  emptyMessage?: string;
  rowHeight?: "compact" | "default" | "relaxed";
  rowClassName?: (row: Row<TData>) => string | undefined;
  cellClassName?: (cell: Cell<TData, unknown>) => string | undefined;
  containerClassName?: string;
};

type VirtualRowProps<TData> = {
  row: Row<TData>;
  virtualRowIndex: number;
  measureRef: (el: Element | null) => void;
  rowPadding: string;
  isSelected: boolean;
  visibleColumnsKey: string;
  rowClassName?: (row: Row<TData>) => string | undefined;
  cellClassName?: (cell: Cell<TData, unknown>) => string | undefined;
};

function VirtualRowImpl<TData>({
  row,
  virtualRowIndex,
  measureRef,
  rowPadding,
  visibleColumnsKey: _visibleColumnsKey,
  rowClassName,
  cellClassName,
}: VirtualRowProps<TData>) {
  return (
    <TableRow
      key={row.id}
      data-index={virtualRowIndex}
      ref={measureRef}
      className={cn(
        "border-b border-slate-200 text-xs transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60",
        rowClassName?.(row)
      )}
    >
      {row.getVisibleCells().map((cell) => {
        const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
        const align = (meta?.align as "left" | "center" | "right") ?? "center";
        const size = cell.column.getSize();
        const isPinned = cell.column.getIsPinned();

        return (
          <TableCell
            key={cell.id}
            className={cn(
              "border-r border-slate-200 px-2.5 text-xs text-slate-800 dark:border-slate-800 dark:text-slate-200",
              rowPadding,
              align === "center" && "text-center",
              align === "left" && "text-left",
              align === "right" && "text-right",
              isPinned &&
                "sticky z-10 bg-white shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] dark:bg-slate-900",
              cellClassName?.(cell)
            )}
            style={{
              width: size ? `${size}px` : meta?.width,
              minWidth: size ? `${size}px` : meta?.width,
              maxWidth: size ? `${size}px` : meta?.width,
              left: isPinned === "left" ? `${cell.column.getStart("left")}px` : undefined,
              right: isPinned === "right" ? `${cell.column.getAfter("right")}px` : undefined,
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

const VirtualRow = memo(
  VirtualRowImpl,
  (prev, next) =>
    prev.row === next.row &&
    prev.virtualRowIndex === next.virtualRowIndex &&
    prev.rowPadding === next.rowPadding &&
    prev.isSelected === next.isSelected &&
    prev.visibleColumnsKey === next.visibleColumnsKey &&
    prev.rowClassName === next.rowClassName &&
    prev.cellClassName === next.cellClassName
) as typeof VirtualRowImpl;

type ColumnMenuTriggerProps<TData> = {
  header: Header<TData, unknown>;
  align?: "left" | "center" | "right";
  label?: React.ReactNode;
};

export function ColumnMenuTrigger<TData>({
  header,
  align = "center",
  label,
}: ColumnMenuTriggerProps<TData>) {
  const meta = header.column.columnDef.meta as ColumnMeta | undefined;
  const displayLabel =
    label ??
    (typeof header.column.columnDef.header === "string"
      ? header.column.columnDef.header
      : meta?.label ?? header.column.id);

  const isSorted = header.column.getIsSorted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs font-semibold text-slate-700 outline-none transition-colors hover:bg-slate-200/60 dark:text-slate-200 dark:hover:bg-slate-700",
            align === "center" && "justify-center",
            align === "right" && "justify-end"
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <span className="flex shrink-0 items-center text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">
            {isSorted === "asc" ? (
              <ArrowUp01 className="h-3.5 w-3.5 text-blue-600" />
            ) : isSorted === "desc" ? (
              <ArrowDown01 className="h-3.5 w-3.5 text-blue-600" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 opacity-40 transition-opacity group-hover:opacity-100" />
            )}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align === "right" ? "end" : "start"} className="w-48 text-xs">
        <DropdownMenuLabel className="text-[11px] uppercase text-slate-400">
          Opções da Coluna
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => header.column.toggleSorting(false)}>
          <ArrowUp01 className="mr-2 h-3.5 w-3.5 text-blue-600" />
          Ordenar crescente
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => header.column.toggleSorting(true)}>
          <ArrowDown01 className="mr-2 h-3.5 w-3.5 text-blue-600" />
          Ordenar decrescente
        </DropdownMenuItem>
        {isSorted && (
          <DropdownMenuItem onClick={() => header.column.clearSorting()}>
            <X className="mr-2 h-3.5 w-3.5 text-slate-400" />
            Limpar ordenação
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => header.column.pin("left")}>
          <Pin className="mr-2 h-3.5 w-3.5 text-amber-600" />
          Fixar à esquerda
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => header.column.pin("right")}>
          <Pin className="mr-2 h-3.5 w-3.5 text-amber-600" />
          Fixar à direita
        </DropdownMenuItem>
        {header.column.getIsPinned() && (
          <DropdownMenuItem onClick={() => header.column.pin(false)}>
            <PinOff className="mr-2 h-3.5 w-3.5 text-slate-400" />
            Liberar fixação
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => header.column.toggleVisibility(false)}>
          <EyeOff className="mr-2 h-3.5 w-3.5 text-slate-400" />
          Ocultar coluna
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DataGrid<TData>({
  table,
  emptyMessage = "Nenhum item disponível.",
  rowHeight = "default",
  rowClassName,
  cellClassName,
  containerClassName,
}: DataGridProps<TData>) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowPadding =
    rowHeight === "compact"
      ? "py-1"
      : rowHeight === "relaxed"
      ? "py-3"
      : "py-2";

  const visibleColumns = table.getVisibleLeafColumns().length || 1;
  const visibleColumnsKey = table
    .getVisibleLeafColumns()
    .map((column) => column.id)
    .join("|");
  const resizingColumn = table.getState().columnSizingInfo.isResizingColumn;

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () =>
      rowHeight === "compact" ? 36 : rowHeight === "relaxed" ? 56 : 44,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - virtualRows[virtualRows.length - 1].end
      : 0;

  return (
    <div
      ref={tableContainerRef}
      className={cn("relative max-h-[75vh] overflow-auto focus:outline-none", containerClassName)}
      tabIndex={0}
      aria-label="Grade de Dados de Compras"
    >
      <Table className="w-full border-separate border-spacing-0 text-xs">
        <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-[0_1px_0_0_rgba(0,0,0,0.08)] dark:bg-slate-800">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-b border-slate-200 dark:border-slate-700">
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                const align = (meta?.align as "left" | "center" | "right") ?? "center";
                const size = header.getSize();
                const isPinned = header.column.getIsPinned();

                const renderedHeader = header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext());

                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "group relative border-r border-slate-200 bg-slate-50 px-1 py-1 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
                      align === "center" && "text-center",
                      align === "left" && "text-left",
                      align === "right" && "text-right",
                      isPinned && "sticky z-30 bg-slate-100 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)] dark:bg-slate-800"
                    )}
                    style={{
                      width: size ? `${size}px` : meta?.width,
                      minWidth: size ? `${size}px` : meta?.width,
                      maxWidth: size ? `${size}px` : meta?.width,
                      left: isPinned === "left" ? `${header.column.getStart("left")}px` : undefined,
                      right: isPinned === "right" ? `${header.column.getAfter("right")}px` : undefined,
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex w-full items-center gap-1">
                        {typeof renderedHeader === "string" ? (
                          <ColumnMenuTrigger header={header} align={align} label={renderedHeader} />
                        ) : (
                          renderedHeader ?? <ColumnMenuTrigger header={header} align={align} />
                        )}
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            "absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none opacity-0 transition-opacity group-hover:opacity-100",
                            resizingColumn === header.column.id && "opacity-100 bg-blue-500/20"
                          )}
                        >
                          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-300 dark:bg-slate-600" />
                        </div>
                      </div>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length ? (
            <>
              {paddingTop > 0 && (
                <TableRow style={{ height: `${paddingTop}px` }}>
                  <TableCell colSpan={visibleColumns} className="p-0 border-0" />
                </TableRow>
              )}
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <VirtualRow
                    key={row.id}
                    row={row}
                    virtualRowIndex={virtualRow.index}
                    measureRef={rowVirtualizer.measureElement}
                    rowPadding={rowPadding}
                    isSelected={row.getIsSelected()}
                    visibleColumnsKey={visibleColumnsKey}
                    rowClassName={rowClassName}
                    cellClassName={cellClassName}
                  />
                );
              })}
              {paddingBottom > 0 && (
                <TableRow style={{ height: `${paddingBottom}px` }}>
                  <TableCell colSpan={visibleColumns} className="p-0 border-0" />
                </TableRow>
              )}
            </>
          ) : (
            <TableRow>
              <TableCell
                colSpan={visibleColumns}
                className="py-12 text-center text-xs text-slate-500 dark:text-slate-400"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

type DataGridFilterMenuProps = {
  activeFilters: number;
  onReset?: () => void;
  children: React.ReactNode;
};

export function DataGridFilterMenu({
  activeFilters,
  onReset,
  children,
}: DataGridFilterMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
          <Filter className="h-3.5 w-3.5" />
          Filtros
          {activeFilters > 0 && (
            <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-700">
              {activeFilters}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <DropdownMenuLabel className="text-xs uppercase text-slate-400">
            Ajustar filtros
          </DropdownMenuLabel>
          {onReset && activeFilters > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onReset}
              title="Limpar filtros"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="space-y-3">{children}</div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type SortOption = {
  id: string;
  label: string;
  desc?: boolean;
};

type DataGridSortMenuProps = {
  value: string;
  onChange: (optionId: string, desc?: boolean) => void;
  options: SortOption[];
};

export function DataGridSortMenu({
  value,
  onChange,
  options,
}: DataGridSortMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
          <ArrowUpDown className="h-3.5 w-3.5" />
          Ordenar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 text-xs">
        <DropdownMenuLabel className="text-[11px] uppercase text-slate-400">
          Ordenar por
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(option) => {
            const found = options.find((opt) => opt.id === option);
            if (found) onChange(found.id, found.desc);
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.id}
              value={option.id}
              className="flex items-center gap-2 cursor-pointer text-xs"
            >
              {option.desc ? (
                <ArrowDown01 className="h-3.5 w-3.5 text-blue-600" />
              ) : (
                <ArrowUp01 className="h-3.5 w-3.5 text-blue-600" />
              )}
              <span>{option.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type DataGridRowHeightMenuProps = {
  value: "compact" | "default" | "relaxed";
  onChange: (value: "compact" | "default" | "relaxed") => void;
};

export function DataGridRowHeightMenu({
  value,
  onChange,
}: DataGridRowHeightMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
          <Rows4 className="h-3.5 w-3.5" />
          Altura
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 text-xs">
        <DropdownMenuLabel className="text-[11px] uppercase text-slate-400">
          Altura das linhas
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(val) => onChange(val as typeof value)}
        >
          <DropdownMenuRadioItem value="compact" className="cursor-pointer text-xs">
            Compacta (36px)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="default" className="cursor-pointer text-xs">
            Padrão (44px)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="relaxed" className="cursor-pointer text-xs">
            Ampla (56px)
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type DataGridViewMenuProps<TData> = {
  table: TanstackTable<TData>;
};

export function DataGridViewMenu<TData>({
  table,
}: DataGridViewMenuProps<TData>) {
  const columns = table
    .getAllLeafColumns()
    .filter(
      (column) => typeof column.accessorFn !== "undefined" || column.getCanHide()
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
          <Columns3 className="h-3.5 w-3.5" />
          Colunas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto text-xs" align="end">
        <DropdownMenuLabel className="text-[11px] uppercase text-slate-400">
          Exibir / Ocultar Colunas
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => {
          const meta = column.columnDef.meta as ColumnMeta | undefined;
          const label =
            typeof column.columnDef.header === "string"
              ? column.columnDef.header
              : meta?.label ?? column.id;

          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="cursor-pointer text-xs"
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
            >
              {label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DataGridKeyboardShortcuts() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs h-8"
        onClick={() => setOpen(true)}
      >
        <Keyboard className="h-3.5 w-3.5" />
        Atalhos
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Atalhos de Navegação no Cockpit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <p>Use os atalhos abaixo para navegar e editar com agilidade:</p>
            <ul className="list-disc space-y-2 pl-4">
              <li>
                <strong className="text-slate-900 dark:text-white">Ctrl + F</strong> ou{" "}
                <strong className="text-slate-900 dark:text-white">/</strong>: Focar no campo de busca de produtos.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Tab</strong> /{" "}
                <strong className="text-slate-900 dark:text-white">Shift + Tab</strong>: Mover entre inputs de pedido e células editáveis.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Enter</strong>: Confirmar quantidade digitada e salvar rascunho.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Esc</strong>: Cancelar edição ou fechar tooltips/diálogos.
              </li>
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

type DataGridMenuBarProps = {
  children: React.ReactNode;
  className?: string;
};

export function DataGridMenuBar({ children, className }: DataGridMenuBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  );
}

export { ColumnMenuTrigger as DataGridColumnHeader };

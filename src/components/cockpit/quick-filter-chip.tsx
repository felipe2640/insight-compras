"use client";

import React, { useState, useMemo, memo } from "react";
import { Plus, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type QuickFilterChipProps = {
  label: string;
  options: string[];
  deselected: Set<string>;
  counts?: Map<string, number>;
  onApply: (newDeselected: Set<string>) => void;
};

export const QuickFilterChip = memo(function QuickFilterChip({
  label,
  options,
  deselected,
  counts,
  onApply,
}: QuickFilterChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [localDeselected, setLocalDeselected] = useState(deselected);

  const onOpenChange = (open: boolean) => {
    if (open) {
      setLocalDeselected(deselected);
      setSearchTerm("");
    }
    setIsOpen(open);
  };

  const handleToggle = (option: string) => {
    setLocalDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(option)) {
        next.delete(option);
      } else {
        next.add(option);
      }
      return next;
    });
  };

  const handleSelectAll = () => setLocalDeselected(new Set());
  const handleSelectNone = () => setLocalDeselected(new Set(options));

  const handleApply = () => {
    onApply(localDeselected);
    setIsOpen(false);
  };

  const selectedCount = Math.max(0, options.length - deselected.size);
  const isAllSelected = deselected.size === 0;

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const lower = searchTerm.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(lower));
  }, [options, searchTerm]);

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs border-dashed border-slate-300 gap-1.5 px-2.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          type="button"
        >
          <Plus className="h-3 w-3 text-slate-500" />
          <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
          {!isAllSelected && selectedCount > 0 && (
            <>
              <Separator orientation="vertical" className="mx-1 h-3.5" />
              <Badge
                variant="secondary"
                className="h-4 rounded px-1 text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
              >
                {selectedCount}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 text-xs" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-slate-800 dark:text-white">Filtrar {label}</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
              >
                Todos
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleSelectNone}
                className="text-[11px] text-slate-500 hover:underline dark:text-slate-400"
              >
                Nenhum
              </button>
            </div>
          </div>

          <input
            type="text"
            placeholder={`Buscar ${label.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
          />

          <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
            {filteredOptions.length === 0 ? (
              <p className="py-2 text-center text-[11px] text-slate-400">Nenhuma opção</p>
            ) : (
              filteredOptions.map((option) => {
                const isChecked = !localDeselected.has(option);
                const count = counts?.get(option);

                return (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center justify-between rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className={cn(
                          "flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors",
                          isChecked
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                        )}
                      >
                        {isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>
                      <span className="truncate text-xs text-slate-700 dark:text-slate-200" title={option}>
                        {option}
                      </span>
                    </div>
                    {count !== undefined && (
                      <span className="font-mono text-[10px] text-slate-400 ml-1">
                        {count}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] px-2"
              onClick={() => setIsOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-6 text-[11px] px-3 bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleApply}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

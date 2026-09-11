"use client";

/**
 * Lista de valores distintos de uma coluna, com contagem, para o operador
 * "é um de". Camada: Interface (src/components/ui).
 *
 * Compartilhado pelo funil do cabeçalho e pelo construtor central de filtros —
 * duas telas para a mesma escolha precisam se comportar igual.
 */

import React, { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SeletorValoresFacetadosProps {
  readonly opcoes: ReadonlyArray<readonly [string, number]>;
  readonly selecionados: ReadonlySet<string>;
  readonly onAlternar: (valor: string) => void;
  readonly className?: string;
}

export function SeletorValoresFacetados({
  opcoes,
  selecionados,
  onAlternar,
  className,
}: SeletorValoresFacetadosProps) {
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    if (!busca) return opcoes;
    const b = busca.toLowerCase();
    return opcoes.filter(([v]) => v.toLowerCase().includes(b));
  }, [opcoes, busca]);

  return (
    <div className={cn("space-y-1", className)}>
      <input
        type="text"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar valor..."
        aria-label="Buscar valor"
        className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
      />
      <div className="max-h-40 space-y-0.5 overflow-y-auto pr-1">
        {visiveis.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-slate-400">Nenhum valor</p>
        ) : (
          visiveis.map(([opcao, quantas]) => {
            const marcado = selecionados.has(opcao);
            return (
              <label
                key={opcao}
                className="flex cursor-pointer items-center justify-between rounded px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                      marcado
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                    )}
                  >
                    {marcado && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                  </span>
                  <span className="truncate" title={opcao}>
                    {opcao}
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={marcado}
                  onChange={() => onAlternar(opcao)}
                />
                <span className="ml-1 shrink-0 font-mono text-[10px] text-slate-400">{quantas}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * Tooltip que explica POR QUE um item foi classificado como Alta, Média ou Baixa.
 * Camada: Interface (src/components/tooltips).
 *
 * Vem do diário: a coluna mostra o rótulo, o mouse mostra a conta. Sem isso o
 * comprador vê "Baixa" e não sabe se é porque vendeu pouco, porque devolveram,
 * ou porque a fonte não mediu nada — três situações que pedem decisões
 * diferentes. A régua aparece inteira, com a faixa aplicada em destaque, para
 * que ninguém precise decorar limiar.
 */

import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface FaixaCriterio {
  readonly rotulo: string;
  readonly condicao: string;
}

export interface MedidaCriterio {
  readonly rotulo: string;
  /** Já formatado. `null` = a fonte do cliente não mede este campo. */
  readonly valor: string | null;
  readonly destaque?: boolean;
}

export interface TooltipCriterioProps {
  readonly titulo: string;
  /** `undefined` = a linha não trouxe a classificação; não se inventa um rótulo. */
  readonly classificacao: string | undefined;
  readonly medidas: readonly MedidaCriterio[];
  readonly faixas: readonly FaixaCriterio[];
  /** Texto quando não há o que medir. Some a régua e explica o motivo. */
  readonly semMedida?: string | null;
  readonly children: React.ReactNode;
}

export function TooltipCriterio({
  titulo,
  classificacao,
  medidas,
  faixas,
  semMedida = null,
  children,
}: TooltipCriterioProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={120}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[300px] p-0 text-xs">
          <div className="border-b border-slate-200 px-3 py-1.5 dark:border-slate-700">
            <p className="font-semibold text-slate-800 dark:text-white">{titulo}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Classificado como{" "}
              <strong className="text-slate-700 dark:text-slate-200">
                {classificacao ?? "não informado"}
              </strong>
            </p>
          </div>

          {semMedida ? (
            <p className="px-3 py-2 text-[11px] leading-snug text-amber-700 dark:text-amber-400">{semMedida}</p>
          ) : (
            <>
              <dl className="space-y-0.5 px-3 py-2">
                {medidas.map((m) => (
                  <div key={m.rotulo} className="flex items-baseline justify-between gap-3">
                    <dt className="text-[11px] text-slate-500 dark:text-slate-400">{m.rotulo}</dt>
                    <dd
                      className={cn(
                        "font-mono text-[11px] tabular-nums",
                        m.valor === null
                          ? "text-slate-400 italic"
                          : m.destaque
                            ? "font-bold text-slate-900 dark:text-white"
                            : "text-slate-700 dark:text-slate-200"
                      )}
                      // "—" aqui quer dizer NÃO MEDIDO, não zero.
                      title={m.valor === null ? "A fonte do cliente não mede este campo" : undefined}
                    >
                      {m.valor ?? "—"}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="border-t border-slate-200 px-3 py-1.5 dark:border-slate-700">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Régua
                </p>
                {faixas.map((f) => {
                  const aplicada = f.rotulo === classificacao;
                  return (
                    <p
                      key={f.rotulo}
                      className={cn(
                        "flex items-baseline justify-between gap-3 text-[11px]",
                        aplicada
                          ? "font-semibold text-slate-900 dark:text-white"
                          : "text-slate-500 dark:text-slate-400"
                      )}
                    >
                      <span>
                        {aplicada ? "▸ " : "  "}
                        {f.rotulo}
                      </span>
                      <span className="text-right">{f.condicao}</span>
                    </p>
                  );
                })}
              </div>
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

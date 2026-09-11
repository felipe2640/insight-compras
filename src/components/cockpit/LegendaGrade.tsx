"use client";

/**
 * Legenda das cores da grade, inline no cabeçalho.
 * Camada: Interface (src/components/cockpit).
 *
 * Vem do diário: a linha muda de cor por um motivo operacional, e quem está
 * comprando precisa ler esse motivo sem perguntar a ninguém. Cor sem legenda é
 * enfeite; com legenda, é informação. As três regras aqui espelham exatamente
 * o `rowClassName` da grade — se uma mudar, a outra tem que mudar junto.
 */

import React from "react";
import { cn } from "@/lib/utils";

interface ItemLegenda {
  readonly rotulo: string;
  readonly explicacao: string;
  readonly amostra: string;
}

export const ITENS_LEGENDA_GRADE: readonly ItemLegenda[] = [
  {
    rotulo: "Trava anti-encalhe",
    explicacao: "Tem saldo e não vendeu nos últimos 180 dias — o sistema não sugere compra.",
    amostra: "bg-slate-100 border-slate-400",
  },
  {
    rotulo: "Tem similar com estoque",
    explicacao: "Existe peça intercambiável com saldo na rede: confira antes de comprar.",
    amostra: "bg-purple-100 border-purple-400",
  },
  {
    rotulo: "Múltiplo de embalagem",
    explicacao: "A quantidade foi arredondada para a caixa fechada do fornecedor.",
    amostra: "bg-destaqueMultiplo border-amber-300",
  },
];

export function LegendaGrade({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Cores da linha
      </span>
      {ITENS_LEGENDA_GRADE.map((item) => (
        <span
          key={item.rotulo}
          title={item.explicacao}
          className="flex cursor-help items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300"
        >
          <span className={cn("h-3 w-3 shrink-0 rounded-sm border-l-4", item.amostra)} />
          {item.rotulo}
        </span>
      ))}
    </div>
  );
}

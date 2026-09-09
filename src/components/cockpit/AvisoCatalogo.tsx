"use client";

/**
 * Estado da carga do catálogo, dito na cara do usuário.
 * Camada: Interface (src/components/cockpit).
 *
 * O cockpit abre com o que pede decisão e completa o catálogo em segundo plano.
 * Enquanto isso, a busca e os filtros alcançam menos itens do que os chips
 * anunciam — e quem está comprando precisa saber disso. Silenciar seria pior do
 * que esperar: o comprador buscaria um código, não acharia, e concluiria que o
 * item não existe.
 */

import React from "react";
import { Loader2, AlertTriangle, CheckCheck } from "lucide-react";
import { EstadoCatalogo } from "@/hooks/useGradeProgressiva";
import { cn } from "@/lib/utils";

export interface AvisoCatalogoProps {
  readonly estado: EstadoCatalogo;
  readonly totalCatalogo: number;
  readonly totalCarregado: number;
  readonly erro: string | null;
  readonly onTentarNovamente: () => void;
  readonly className?: string;
}

export function AvisoCatalogo({
  estado,
  totalCatalogo,
  totalCarregado,
  erro,
  onTentarNovamente,
  className,
}: AvisoCatalogoProps) {
  if (estado === "completo") return null;

  const numero = (n: number) => n.toLocaleString("pt-BR");

  if (estado === "falhou") {
    return (
      <div
        role="alert"
        className={cn(
          "flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-900",
          className
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
        <span>
          Mostrando os {numero(totalCarregado)} itens que pedem decisão. O restante do catálogo não
          carregou{erro ? ` (${erro})` : ""}.
        </span>
        <button
          type="button"
          onClick={onTentarNovamente}
          className="font-semibold underline underline-offset-2 hover:text-amber-950"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  const restante = Math.max(0, totalCatalogo - totalCarregado);
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600",
        className
      )}
    >
      {estado === "carregando" ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600" />
      ) : (
        <CheckCheck className="h-3.5 w-3.5 shrink-0 text-blue-600" />
      )}
      <span>
        {numero(totalCarregado)} itens que pedem decisão já na tela
        {restante > 0 ? ` — carregando os outros ${numero(restante)} do catálogo para busca` : ""}.
      </span>
    </div>
  );
}

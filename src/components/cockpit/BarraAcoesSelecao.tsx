"use client";

import React, { memo } from "react";
import {
  Ban,
  RotateCcw,
  X,
  CheckSquare,
  ChevronDown,
  Boxes,
  Hourglass,
  TrendingDown,
  DollarSign,
  Truck,
  Package,
  AlertOctagon,
  Briefcase,
  HelpCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MOTIVOS_REJEICAO_COMPRA, MotivoRejeicaoItemDef } from "@/tipos/cockpit";
import { cn } from "@/lib/utils";

export interface BarraAcoesSelecaoProps {
  readonly totalSelecionados: number;
  readonly aberto?: boolean;
  readonly onOpenChange?: (aberto: boolean) => void;
  readonly onRejeitarSelecionados: (motivoId: string, rotuloMotivo: string) => void;
  readonly onRestaurarSelecionados: () => void;
  readonly onLimparSelecao: () => void;
  readonly className?: string;
}

function obterIconeMotivo(id: string) {
  switch (id) {
    case "ja_tem_similar":
      return Boxes;
    case "item_obsoleto":
      return Hourglass;
    case "modelo_superestimou":
      return TrendingDown;
    case "sem_verba":
      return DollarSign;
    case "fornecedor_indisponivel":
      return Truck;
    case "lote_minimo_fornecedor":
      return Package;
    case "item_errado":
      return AlertOctagon;
    case "decisao_interna":
      return Briefcase;
    default:
      return HelpCircle;
  }
}

export const BarraAcoesSelecao = memo(function BarraAcoesSelecao({
  totalSelecionados,
  aberto,
  onOpenChange,
  onRejeitarSelecionados,
  onRestaurarSelecionados,
  onLimparSelecao,
  className,
}: BarraAcoesSelecaoProps) {
  if (totalSelecionados === 0) return null;

  return (
    <div
      role="region"
      aria-label="Ações para itens selecionados"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/90 px-3.5 py-2 text-xs shadow-sm dark:border-blue-900/60 dark:bg-blue-950/40 animate-in fade-in slide-in-from-top-1 duration-150",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white shadow-xs">
          {totalSelecionados}
        </span>
        <span className="font-semibold text-blue-950 dark:text-blue-100">
          {totalSelecionados === 1 ? "1 item selecionado" : `${totalSelecionados} itens selecionados`}
        </span>
        <span className="text-[11px] text-blue-700/80 dark:text-blue-300/80">
          durante a revisão de compra
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Menu de Rejeição em Lote com seleção direta de motivo */}
        <DropdownMenu open={aberto} onOpenChange={onOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 border-rose-300 bg-white font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-400 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 shadow-xs gap-1.5"
            >
              <Ban className="h-3.5 w-3.5 text-rose-600" />
              <span>Rejeitar selecionados</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Motivo de rejeição para {totalSelecionados} {totalSelecionados === 1 ? "item" : "itens"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {MOTIVOS_REJEICAO_COMPRA.map((motivo: MotivoRejeicaoItemDef) => {
              const Icone = obterIconeMotivo(motivo.id);

              return (
                <DropdownMenuItem
                  key={motivo.id}
                  onClick={() => onRejeitarSelecionados(motivo.id, motivo.rotulo)}
                  className="flex items-start gap-2 py-1.5 text-xs cursor-pointer focus:bg-rose-50 dark:focus:bg-rose-950/40"
                >
                  <Icone className="h-3.5 w-3.5 mt-0.5 text-slate-500 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {motivo.rotulo}
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-1">
                      {motivo.descricao}
                    </p>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Restaurar sugestões dos selecionados */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRestaurarSelecionados}
          title="Restaurar a sugestão de compra original calculada pelo motor"
          className="h-7 border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 shadow-xs gap-1.5"
        >
          <RotateCcw className="h-3 w-3 text-slate-500" />
          <span>Restaurar sugestões</span>
        </Button>

        {/* Limpar seleção de linhas */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onLimparSelecao}
          title="Limpar seleção de linhas"
          className="h-7 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 px-2 gap-1"
        >
          <X className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Desmarcar</span>
        </Button>
      </div>
    </div>
  );
});

BarraAcoesSelecao.displayName = "BarraAcoesSelecao";

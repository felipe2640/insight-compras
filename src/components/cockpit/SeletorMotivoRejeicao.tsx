"use client";

import React, { memo } from "react";
import {
  Ban,
  RotateCcw,
  Sparkles,
  Boxes,
  Hourglass,
  TrendingDown,
  DollarSign,
  Truck,
  Package,
  AlertOctagon,
  Briefcase,
  HelpCircle,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MOTIVOS_REJEICAO_COMPRA, MotivoRejeicaoItemDef } from "@/tipos/cockpit";
import { cn } from "@/lib/utils";

export interface SeletorMotivoRejeicaoProps {
  readonly skuId: string | number;
  readonly motivoAtual?: string | null;
  readonly rotuloAtual?: string | null;
  readonly rejeitado?: boolean;
  readonly temSimilarComEstoque?: boolean;
  readonly disabled?: boolean;
  readonly aberto?: boolean;
  readonly onOpenChange?: (aberto: boolean) => void;
  readonly onSelecionarMotivo: (motivoId: string, rotulo: string) => void;
  readonly onDesfazerRejeicao: () => void;
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

export const SeletorMotivoRejeicao = memo(function SeletorMotivoRejeicao({
  skuId,
  motivoAtual,
  rotuloAtual,
  rejeitado = false,
  temSimilarComEstoque = false,
  disabled = false,
  aberto,
  onOpenChange,
  onSelecionarMotivo,
  onDesfazerRejeicao,
  className,
}: SeletorMotivoRejeicaoProps) {
  const rotuloExibicao =
    rotuloAtual ||
    MOTIVOS_REJEICAO_COMPRA.find((m) => m.id === motivoAtual)?.rotulo ||
    "Item rejeitado";

  if (rejeitado) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50/90 px-1.5 py-0.5 text-[11px] font-semibold text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-200 shadow-sm",
          className
        )}
      >
        <DropdownMenu open={aberto} onOpenChange={onOpenChange}>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <button
              type="button"
              className="flex items-center gap-1 text-left hover:underline focus:outline-none"
              title={`Rejeitado: ${rotuloExibicao}. Clique para alterar o motivo.`}
              aria-label={`Motivo da rejeição para SKU ${skuId}: ${rotuloExibicao}. Clique para alterar.`}
            >
              <Ban className="h-3 w-3 text-rose-600 shrink-0" />
              <span className="max-w-[120px] truncate">{rotuloExibicao}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Alterar motivo de rejeição
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {MOTIVOS_REJEICAO_COMPRA.map((motivo: MotivoRejeicaoItemDef) => {
              const Icone = obterIconeMotivo(motivo.id);
              const selecionado = motivo.id === motivoAtual;
              const sugerido = motivo.id === "ja_tem_similar" && temSimilarComEstoque;

              return (
                <DropdownMenuItem
                  key={motivo.id}
                  onClick={() => onSelecionarMotivo(motivo.id, motivo.rotulo)}
                  className={cn(
                    "flex items-start gap-2 py-1.5 text-xs cursor-pointer",
                    selecionado && "bg-rose-50 font-bold text-rose-900 dark:bg-rose-950/60",
                    sugerido && !selecionado && "bg-purple-50 text-purple-900 dark:bg-purple-950/40"
                  )}
                >
                  <Icone className="h-3.5 w-3.5 mt-0.5 text-slate-500 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span>{motivo.rotulo}</span>
                      {sugerido && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-purple-700 bg-purple-100 px-1 rounded border border-purple-200">
                          <Sparkles className="h-2 w-2" />
                          Rede tem
                        </span>
                      )}
                      {selecionado && <Check className="h-3.5 w-3.5 text-rose-600" />}
                    </div>
                    <p className="text-[10px] text-slate-400 font-normal line-clamp-1">
                      {motivo.descricao}
                    </p>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          disabled={disabled}
          onClick={onDesfazerRejeicao}
          title="Desfazer rejeição e restaurar sugestão original de compra"
          aria-label={`Desfazer rejeição do SKU ${skuId}`}
          className="ml-0.5 flex h-4 w-4 items-center justify-center rounded hover:bg-rose-200 text-rose-600 hover:text-rose-900 transition-colors focus:outline-none"
        >
          <RotateCcw className="h-2.5 w-2.5" />
        </button>
      </div>
    );
  }

  return (
    <DropdownMenu open={aberto} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-400 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-rose-800 dark:hover:bg-rose-950/50",
            temSimilarComEstoque && "hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700",
            className
          )}
          title={
            temSimilarComEstoque
              ? "Rejeitar compra (peça similar identificada com estoque na rede)"
              : "Rejeitar compra deste item e selecionar motivo"
          }
          aria-label={`Rejeitar compra do SKU ${skuId}`}
        >
          <Ban className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Rejeitar sugestão de compra
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MOTIVOS_REJEICAO_COMPRA.map((motivo: MotivoRejeicaoItemDef) => {
          const Icone = obterIconeMotivo(motivo.id);
          const sugerido = motivo.id === "ja_tem_similar" && temSimilarComEstoque;

          return (
            <DropdownMenuItem
              key={motivo.id}
              onClick={() => onSelecionarMotivo(motivo.id, motivo.rotulo)}
              className={cn(
                "flex items-start gap-2 py-1.5 text-xs cursor-pointer",
                sugerido && "bg-purple-50 text-purple-900 font-semibold dark:bg-purple-950/40"
              )}
            >
              <Icone className="h-3.5 w-3.5 mt-0.5 text-slate-500 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span>{motivo.rotulo}</span>
                  {sugerido && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-purple-700 bg-purple-100 px-1 rounded border border-purple-200">
                      <Sparkles className="h-2 w-2" />
                      Rede tem
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-normal line-clamp-1">
                  {motivo.descricao}
                </p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

SeletorMotivoRejeicao.displayName = "SeletorMotivoRejeicao";

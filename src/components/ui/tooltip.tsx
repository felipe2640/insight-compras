"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

/**
 * Duas superfícies, por um motivo:
 *
 * - `dica` é a etiqueta escura de uma linha, para explicar um ícone.
 * - `painel` é a ficha analítica: tabela de números, régua de faixas, cabeçalho.
 *   Esse conteúdo é escrito com a paleta clara do resto do sistema, e sobre
 *   fundo escuro os valores em destaque (slate-900 sobre slate-900) ficavam
 *   INVISÍVEIS. Fundo branco aqui não é exceção: é a mesma superfície de
 *   leitura das outras telas.
 */
export type VarianteTooltip = "dica" | "painel";

const ANIMACAO =
  "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";

const SUPERFICIE: Record<VarianteTooltip, string> = {
  dica: "bg-slate-900 px-3 py-1.5 text-slate-100 shadow-md dark:bg-slate-800 dark:text-slate-100 dark:border dark:border-slate-700",
  painel:
    "border border-slate-200 bg-white text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
};

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    variante?: VarianteTooltip;
  }
>(({ className, sideOffset = 4, variante = "dica", ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md text-xs",
        ANIMACAO,
        SUPERFICIE[variante],
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };

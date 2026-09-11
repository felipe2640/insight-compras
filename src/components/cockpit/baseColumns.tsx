"use client";

import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import {
  TooltipRuptura,
  TooltipFrequencia,
  TooltipCobertura,
  TooltipTransferencia,
  TooltipNfeDoDia,
} from "@/components/tooltips";
import { EditableCell } from "./EditableCell";
import { cn } from "@/lib/utils";

export interface CriarColunasMatrizOpcoes {
  onAbrirSimilares?: (item: LinhaCockpitMatriz) => void;
  onCommitPedido?: (skuId: string | number, quantidade: number, motivo: string | null) => void;
  onCommitTransferencia?: (skuId: string | number, quantidade: number, motivo: string | null) => void;
}

export function criarBaseColumns({
  onAbrirSimilares,
  onCommitPedido,
  onCommitTransferencia,
}: CriarColunasMatrizOpcoes = {}): ColumnDef<LinhaCockpitMatriz, unknown>[] {
  return [
    // 1. Seleção (Checkbox)
    {
      id: "selecao",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate" === "indeterminate")}
          onChange={table.getToggleAllRowsSelectedHandler()}
          aria-label="Selecionar todos os itens da página"
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          aria-label={`Selecionar SKU ${row.original.codigoSku}`}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      ),
      size: 44,
      enablePinning: true,
    },

    // 2. Código SKU (com Badges de Similares e Alerta de NF-e do Dia)
    {
      id: "codigo",
      accessorKey: "codigoSku",
      header: "Código SKU",
      size: 145,
      enablePinning: true,
      cell: ({ row }) => {
        const item = row.original;
        const temSimilares = item.similares && item.similares.length > 0;
        const temNfeHoje = item.entradasHoje && item.entradasHoje.length > 0;

        return (
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
            <span className="truncate">{item.codigoSku}</span>

            {/* Badge de Similares Intercambiáveis */}
            {temSimilares && (
              <button
                type="button"
                onClick={() => onAbrirSimilares?.(item)}
                className="flex items-center gap-0.5 rounded bg-purple-100 px-1 py-0.2 text-[10px] font-bold text-purple-800 hover:bg-purple-200 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 transition-colors"
                title={`${item.similares.length} peça(s) similar(es) com saldo na rede`}
                aria-label={`Abrir diálogo de similares para SKU ${item.codigoSku}`}
              >
                <span>✨</span>
                <span>{item.similares.length}</span>
              </button>
            )}

            {/* Alerta de NF-e do Dia */}
            {temNfeHoje && (
              <TooltipNfeDoDia entradas={item.entradasHoje}>
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-red-700 font-bold text-[10px] border border-red-300 animate-pulse dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                  title="Atenção: mercadoria com entrada física/fiscal hoje"
                >
                  ⚠
                </span>
              </TooltipNfeDoDia>
            )}
          </div>
        );
      },
    },

    // 3. Descrição e Aplicação Veicular
    {
      id: "descricao",
      accessorKey: "descricao",
      header: "Descrição do Item",
      size: 240,
      enablePinning: true,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="truncate text-xs" title={item.descricao}>
            <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{item.descricao}</div>
            {item.aplicacaoVeicular && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {item.aplicacaoVeicular}
              </div>
            )}
          </div>
        );
      },
    },

    // 4. Marca e Curva ABC
    {
      id: "marcaCurva",
      header: "Marca / Curva",
      size: 120,
      cell: ({ row }) => {
        const item = row.original;
        const estiloCurva =
          item.curvaAbc === "A"
            ? "bg-amber-100 text-amber-900 border-amber-300 font-bold dark:bg-amber-950 dark:text-amber-300"
            : item.curvaAbc === "B"
              ? "bg-blue-100 text-blue-900 border-blue-300 font-semibold dark:bg-blue-950 dark:text-blue-300"
              : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300";

        return (
          <div className="flex items-center justify-center gap-1.5 text-xs">
            <span className="truncate max-w-[70px] text-slate-700 dark:text-slate-300 font-medium" title={item.marca}>
              {item.marca}
            </span>
            <span className={cn("rounded px-1.5 py-0.2 text-[10px] border font-mono", estiloCurva)}>
              {item.curvaAbc}
            </span>
          </div>
        );
      },
    },

    // 5. Giro Médio Diário (CMD)
    {
      id: "giroMedio",
      accessorKey: "consumoMedioDiario90d",
      header: "Giro Diário (CMD)",
      size: 110,
      cell: ({ row }) => {
        const cmd = row.original.consumoMedioDiario90d ?? 0;
        const cmdMensal = cmd * 30;
        return (
          <div className="text-right font-mono text-xs">
            <div className="font-bold text-slate-900 dark:text-slate-100">
              {cmd.toFixed(4).replace(".", ",")}
            </div>
            <div className="text-[10px] text-slate-400">
              ~{cmdMensal.toFixed(1).replace(".", ",")} un/mês
            </div>
          </div>
        );
      },
    },

    // 6. Diagnóstico de Ruptura (com TooltipRuptura)
    {
      id: "diagnosticoRuptura",
      header: "Ruptura",
      size: 120,
      cell: ({ row }) => {
        const item = row.original;
        const estiloBadge =
          item.classificacaoRuptura === "Boa"
            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
            : item.classificacaoRuptura === "Atenção"
              ? "bg-amber-100 text-amber-800 border-amber-300"
              : item.classificacaoRuptura === "Grave"
                ? "bg-red-100 text-red-800 border-red-300"
                : "bg-slate-100 text-slate-600 border-slate-300";

        const taxaFormatada =
          item.rupturaPercentual !== null
            ? `${item.rupturaPercentual.toFixed(1).replace(".", ",")}%`
            : "—";

        return (
          <div className="flex justify-center">
            <TooltipRuptura
              diasAnalisados={item.rupturaDiasAnalisados}
              diasZerados={item.rupturaDiasZerados}
              percentualRuptura={item.rupturaPercentual}
              classificacao={item.classificacaoRuptura}
              dataUltimoZeramento={item.dataUltimoZeramento}
              vendaPerdidaEstimadaReais={item.vendaPerdidaEstimadaReais}
              consumoDiarioReferencia={item.consumoMedioDiario90d}
              precoVenda={item.precoVenda}
            >
              <button
                type="button"
                className={cn("rounded px-2 py-0.5 text-xs font-semibold border cursor-help outline-none focus-visible:ring-2", estiloBadge)}
                aria-label={`Ruptura: ${item.classificacaoRuptura} (${taxaFormatada})`}
              >
                {taxaFormatada} ({item.classificacaoRuptura})
              </button>
            </TooltipRuptura>
          </div>
        );
      },
    },

    // 7. Frequência em 90 dias (com TooltipFrequencia)
    {
      id: "frequencia90d",
      header: "Freq. 90d (Notas)",
      size: 130,
      cell: ({ row }) => {
        const item = row.original;
        const corTexto =
          item.classificacaoFrequencia === "Alta"
            ? "text-emerald-700 dark:text-emerald-400 font-bold"
            : item.classificacaoFrequencia === "Média"
              ? "text-blue-700 dark:text-blue-400 font-semibold"
              : "text-amber-700 dark:text-amber-400";

        return (
          <div className="flex justify-center">
            <TooltipFrequencia
              notasVenda={item.notasVenda90d}
              notasDevolucao={item.notasDevolucao90d}
              notasLiquidas={item.notasLiquidas90d}
              frequenciaPercentual={item.frequenciaPercentual90d}
              classificacao={item.classificacaoFrequencia}
              totalPecasVendidas={item.totalPecasVendidas90d}
              extratoMovimentacoes={item.extratoFrequencia90d}
            >
              <button
                type="button"
                className={cn("rounded px-1.5 py-0.5 text-xs border border-transparent hover:border-slate-300 dark:hover:border-slate-700 cursor-help font-mono", corTexto)}
                aria-label={`Frequência: ${item.notasLiquidas90d} notas líquidas (${item.frequenciaPercentual90d.toFixed(1)}%)`}
              >
                {item.notasLiquidas90d} notas ({item.frequenciaPercentual90d.toFixed(1).replace(".", ",")}%)
              </button>
            </TooltipFrequencia>
          </div>
        );
      },
    },

    // 8. Coberturas Comparativas (30d / 90d / 180d com TooltipCobertura)
    {
      id: "coberturasComparativas",
      header: "Cobertura (dias)",
      size: 140,
      cell: ({ row }) => {
        const item = row.original;
        const iconeTendencia = item.isMarcaZumbi
          ? "⚠"
          : item.tendenciaCobertura === "ALTA"
            ? "▲"
            : item.tendenciaCobertura === "QUEDA"
              ? "▼"
              : "●";

        const corTendencia = item.isMarcaZumbi
          ? "text-red-600 dark:text-red-400 font-bold animate-pulse"
          : item.tendenciaCobertura === "ALTA"
            ? "text-emerald-600 dark:text-emerald-400 font-bold"
            : item.tendenciaCobertura === "QUEDA"
              ? "text-amber-600 dark:text-amber-400"
              : "text-slate-500";

        const cobFormatada =
          item.consumoMedioDiario90d > 0 && item.diasCobertura90d !== null
            ? `${Math.round(item.diasCobertura90d)}d`
            : "—";

        return (
          <div className="flex justify-center">
            <TooltipCobertura
              saldoEstoqueAtual={item.estoqueLojaFoco}
              vendas30d={item.vendasLiquidas30d}
              cmd30d={item.consumoMedioDiario30d}
              cobertura30dDias={item.diasCobertura30d}
              vendas90d={item.vendasLiquidas90d}
              cmd90d={item.consumoMedioDiario90d}
              cobertura90dDias={item.diasCobertura90d}
              vendas180d={item.vendasLiquidas180d}
              cmd180d={item.consumoMedioDiario180d}
              cobertura180dDias={item.diasCobertura180d}
              tendencia={item.tendenciaCobertura}
              isMarcaZumbi={item.isMarcaZumbi}
            >
              <button
                type="button"
                className={cn("flex items-center gap-1 font-mono text-xs px-1.5 py-0.5 rounded border border-transparent hover:border-slate-300 dark:hover:border-slate-700 cursor-help", corTendencia)}
                aria-label={`Cobertura de estoque: ${cobFormatada}, Tendência: ${item.tendenciaCobertura}`}
              >
                <span>{cobFormatada}</span>
                <span className="text-[10px]">{iconeTendencia}</span>
                {item.isMarcaZumbi && <span className="text-[9px] font-bold uppercase">Zumbi</span>}
              </button>
            </TooltipCobertura>
          </div>
        );
      },
    },

    // 9. Estoque Atual (Loja Foco vs Rede)
    {
      id: "estoqueLojas",
      header: "Estoque Foco / Rede",
      size: 130,
      cell: ({ row }) => {
        const item = row.original;
        const estoqueFoco = item.estoqueLojaFoco;
        const estoqueRede = item.estoqueOutrasLojasRede;

        return (
          <div className="text-right font-mono text-xs">
            <span
              className={cn(
                "font-bold",
                estoqueFoco <= 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-slate-900 dark:text-slate-100"
              )}
            >
              {estoqueFoco} un
            </span>
            <span className="text-slate-400 mx-1">/</span>
            <span className="text-slate-500 dark:text-slate-400">{estoqueRede} un</span>
          </div>
        );
      },
    },

    // 10. Sugestão e Decisão do Motor
    {
      id: "sugestaoMotor",
      header: "Sugestão Motor",
      size: 120,
      cell: ({ row }) => {
        const item = row.original;
        const estiloBadge =
          item.statusSugestao === "APROVADO_COMPRA"
            ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200"
            : item.statusSugestao === "COBERTO_POR_TRANSFERENCIA"
              ? "bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200"
              : item.statusSugestao === "TRAVADO_MARCA_ZUMBI"
                ? "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-200"
                : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300";

        return (
          <div className="flex flex-col items-center justify-center text-xs">
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {item.sugestaoFinalCompra} un
            </span>
            <span
              className={cn("rounded px-1.5 py-0.2 text-[9px] font-bold border mt-0.5 uppercase tracking-wide", estiloBadge)}
              title={item.motivoDecisao}
            >
              {item.statusSugestao === "APROVADO_COMPRA"
                ? "Pedir"
                : item.statusSugestao === "COBERTO_POR_TRANSFERENCIA"
                  ? "Transferir"
                  : item.statusSugestao === "TRAVADO_MARCA_ZUMBI"
                    ? "Zumbi (0)"
                    : "Estoque OK"}
            </span>
          </div>
        );
      },
    },

    // 11. Pedido de Compra Editável (EditableCell)
    {
      id: "pedidoEditavel",
      header: "Pedido Compra",
      size: 120,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex justify-center">
            <EditableCell
              initialValue={item.pedidoCustom ?? item.sugestaoFinalCompra}
              skuId={item.produtoId}
              minMultiplo={item.loteMultiplo}
              embalagemMinima={item.embalagemMinima}
              valorSugeridoSistema={item.sugestaoFinalCompra}
              onCommit={(skuId, novoValor, motivo) => {
                onCommitPedido?.(skuId, novoValor, motivo);
              }}
              rotuloAcessibilidade={`Quantidade de compra para SKU ${item.codigoSku}`}
            />
          </div>
        );
      },
    },

    // 12. Transferência Recomendada (com TooltipTransferencia)
    {
      id: "transferenciaRecomendada",
      header: "Transferir",
      size: 130,
      cell: ({ row }) => {
        const item = row.original;
        const temTransferencia = item.quantidadeTransferenciaSugerida > 0;

        return (
          <div className="flex items-center justify-center gap-1">
            <EditableCell
              initialValue={item.transferenciaCustom ?? item.quantidadeTransferenciaSugerida}
              skuId={item.produtoId}
              onCommit={(skuId, novoValor, motivo) => {
                onCommitTransferencia?.(skuId, novoValor, motivo);
              }}
              disabled={!temTransferencia && item.sobraRealOrigemTransferencia <= 0}
              rotuloAcessibilidade={`Quantidade de transferência para SKU ${item.codigoSku}`}
            />

            {item.filialOrigemTransferenciaNome && (
              <TooltipTransferencia
                filialOrigemNome={item.filialOrigemTransferenciaNome}
                saldoOrigem={item.saldoOrigemTransferencia}
                estoqueMinimoOrigem={item.estoqueMinimoOrigemTransferencia}
                sobraRealOrigem={item.sobraRealOrigemTransferencia}
                filialDestinoNome={item.filialFocoNome}
                necessidadeDestino={item.necessidadeDestinoTransferencia}
                quantidadeTransferirRecomendada={item.quantidadeTransferenciaSugerida}
                motivo={item.motivoDecisao}
              >
                <button
                  type="button"
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold hover:bg-indigo-200 border border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800"
                  aria-label="Ver detalhes da transferência recomendada"
                >
                  ?
                </button>
              </TooltipTransferencia>
            )}
          </div>
        );
      },
    },
  ];
}

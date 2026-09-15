"use client";

import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Sparkles, AlertTriangle, ArrowLeftRight } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataGridColumnHeader } from "@/components/ui/data-grid";
import { LinhaCockpitCompras } from "@/tipos/cockpit";
import { cn } from "@/lib/utils";
import {
  TooltipCriterio,
  TooltipFrequencia,
  TooltipRuptura,
  TooltipTransferencia,
  TooltipCobertura,
  TooltipNfeDoDia,
} from "@/components/tooltips";

export interface OpcoesColunasCockpit {
  nomeLojaFoco?: string;
  nomeOutrasLojas?: string;
  onAbrirSimilares?: (linha: LinhaCockpitCompras) => void;
  onPedirCommit?: (skuId: string, valor: number) => void;
  onTransferirCommit?: (skuId: string, valor: number) => void;
}

function formatarDataPtBr(dataStr: string | null | undefined): string {
  if (!dataStr) return "—";
  try {
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  } catch {
    return "—";
  }
}

function formatarMoedaPtBr(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarNumero(valor: number, decimais = 0): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  });
}

export function criarColunasCockpit({
  // Rótulo neutro: quem chama sempre passa o nome vindo do cadastro do tenant.
  // O padrão era "Pedro II" — uma loja de um cliente específico, que aparecia
  // no cabeçalho da coluna de estoque de qualquer instalação.
  nomeLojaFoco = "Loja Foco",
  nomeOutrasLojas = "Rede",
  onAbrirSimilares,
  onPedirCommit,
  onTransferirCommit,
}: OpcoesColunasCockpit = {}): ColumnDef<LinhaCockpitCompras, unknown>[] {
  const rotuloEstoqueFoco = `Est ${nomeLojaFoco}`;
  const rotuloEstoqueOutra = `Disp ${nomeOutrasLojas}`;

  return [
    // 1. Selecionado (Checkbox)
    {
      id: "select",
      enableHiding: false,
      enableSorting: false,
      size: 40,
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Selecionar todas as linhas"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Selecionar linha"
          />
        </div>
      ),
      meta: {
        label: "Selecionad",
        align: "center",
        pinned: "left",
      },
    },

    // 2. Código SKU
    {
      id: "codigo",
      accessorFn: (row) => row.codigo,
      size: 130,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="left" label="Código" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const totalSimilares = item.similares.length;
        const temEntradaHoje = item.entradasHoje && item.entradasHoje.length > 0;

        return (
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
            <span className="truncate">{item.codigo}</span>

            {totalSimilares > 0 && (
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onAbrirSimilares?.(item)}
                      className="inline-flex h-5 items-center gap-0.5 rounded bg-purple-100 px-1 text-[10px] font-bold text-purple-800 hover:bg-purple-200 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 transition-colors"
                      aria-label={`Ver ${totalSimilares} similares com estoque`}
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      <span>{totalSimilares}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{totalSimilares} peça(s) similar(es) com saldo na rede</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {temEntradaHoje && (
              <TooltipNfeDoDia entradas={item.entradasHoje}>
                <span
                  className="inline-flex text-amber-600 cursor-help"
                  aria-label="Chegou hoje no estoque"
                  tabIndex={0}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
              </TooltipNfeDoDia>
            )}
          </div>
        );
      },
      meta: { variante: "texto",
        label: "Código",
        align: "left",
        pinned: "left",
      },
      enableSorting: true,
    },

    // 3. Descrição
    {
      id: "descricao",
      accessorFn: (row) => row.descricao,
      size: 240,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="left" label="Descrição" />
      ),
      cell: ({ row }) => (
        <div className="truncate text-xs font-medium text-slate-900 dark:text-white" title={row.original.descricao}>
          {row.original.descricao}
        </div>
      ),
      meta: { variante: "texto",
        label: "Descrição",
        align: "left",
        pinned: "left",
      },
      enableSorting: true,
    },

    // 4. Aplicação
    {
      id: "aplicacao",
      accessorFn: (row) => row.aplicacao,
      size: 130,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="left" label="Aplicação" />
      ),
      cell: ({ row }) => {
        const aplicacao = row.original.aplicacao || "—";
        if (aplicacao.length <= 16) {
          return <span className="truncate text-xs text-slate-500">{aplicacao}</span>;
        }
        return (
          <TooltipProvider>
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <span className="truncate text-xs text-slate-500 cursor-help underline decoration-dotted">
                  {aplicacao}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm text-xs">
                <p>{aplicacao}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
      meta: { variante: "texto",
        label: "Aplicação",
        align: "left",
      },
      enableSorting: true,
    },

    // 5. Ref. Fabricante
    {
      id: "refFabricante",
      accessorFn: (row) => row.refFabricante,
      size: 110,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="left" label="Ref. Fabric" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
          {row.original.refFabricante || "—"}
        </span>
      ),
      meta: { variante: "texto", label: "Ref. Fabric", align: "left" },
      enableSorting: true,
    },

    // 6. Marca
    {
      id: "marca",
      accessorFn: (row) => row.marca,
      size: 100,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="left" label="Marca" />
      ),
      cell: ({ row }) => (
        <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
          {row.original.marca || "—"}
        </span>
      ),
      meta: { variante: "texto", label: "Marca", align: "left" },
      enableSorting: true,
    },

    // Sub-grupo: o tipo da peça, como o ERP classifica. É por aqui que o
    // comprador agrupa ("todas as bieletas"), não por fornecedor — fornecedor
    // muda, o tipo da peça não.
    {
      id: "subgrupo",
      accessorFn: (row) => row.subgrupo ?? "",
      size: 130,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="left" label="Sub-grupo" />
      ),
      cell: ({ row }) => {
        const sub = row.original.subgrupo;
        return sub ? (
          <span className="block truncate text-xs text-slate-700 dark:text-slate-300" title={sub}>
            {sub}
          </span>
        ) : (
          <span className="text-xs text-slate-400" title="O ERP do cliente não classificou este item">
            —
          </span>
        );
      },
      meta: { variante: "selecao", label: "Sub-grupo", align: "left" },
      enableSorting: true,
    },

    // 7. Custo (R$)
    {
      id: "custo",
      accessorFn: (row) => row.custo,
      size: 90,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="right" label="Custo" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
          {formatarMoedaPtBr(row.original.custo ?? row.original.precoCusto ?? 0)}
        </span>
      ),
      meta: { variante: "numero", label: "Custo", align: "right" },
      enableSorting: true,
    },

    // 8. Dt Ult Venda
    {
      id: "dtUltVenda",
      accessorFn: (row) => row.dtUltVenda ?? "",
      size: 95,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Dt Ult Venda" />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {formatarDataPtBr(row.original.dtUltVenda)}
        </span>
      ),
      meta: { variante: "data", label: "Dt Ult Venda", align: "center" },
      enableSorting: true,
    },

    // 9. Última compra
    {
      id: "dtUltimaCompra",
      accessorFn: (row) => row.dtUltimaCompra ?? "",
      size: 95,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Última compra" />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {formatarDataPtBr(row.original.dtUltimaCompra)}
        </span>
      ),
      meta: { variante: "data", label: "Última compra", align: "center" },
      enableSorting: true,
    },

    // Último pedido: quando alguém pediu esta peça pela última vez.
    // Nível de PRODUTO, não de loja — a fonte do cliente não separa quem pediu.
    {
      id: "dtUltimoPedido",
      accessorFn: (row) => row.dtUltimoPedido ?? "",
      size: 100,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Último pedido" />
      ),
      cell: ({ row }) => {
        const data = row.original.dtUltimoPedido;
        return (
          <div className="flex justify-center">
            {data ? (
              <span className="text-xs text-slate-700 dark:text-slate-300">
                {new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR")}
              </span>
            ) : (
              <span className="text-xs text-slate-400" title="Nenhuma solicitação de compra registrada para este item">
                —
              </span>
            )}
          </div>
        );
      },
      meta: { variante: "data", label: "Último pedido", align: "center" },
      enableSorting: true,
    },

    // 10. Curva ABC sistema
    {
      id: "curvaAbcSistema",
      accessorFn: (row) => row.curvaAbcSistema,
      size: 90,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Curva ABC" />
      ),
      cell: ({ row }) => {
        const curva = row.original.curvaAbcSistema;
        const color =
          curva === "A"
            ? "bg-amber-100 text-amber-900 border-amber-300 font-bold"
            : curva === "B"
            ? "bg-blue-100 text-blue-900 border-blue-300 font-semibold"
            : "bg-slate-100 text-slate-700 border-slate-300";
        return (
          <div className="flex justify-center">
            <span className={cn("rounded px-2 py-0.2 font-mono text-[10px] border", color)}>
              {curva}
            </span>
          </div>
        );
      },
      meta: { variante: "selecao", label: "Curva ABC", align: "center" },
      enableSorting: true,
    },

    // 11. Produtos Vend 90d
    {
      id: "produtosVend90d",
      accessorFn: (row) => row.produtosVend90d ?? undefined,
      sortUndefined: "last",
      size: 105,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Produtos Vend 90d" />
      ),
      cell: ({ row }) => {
        const val = row.original.produtosVend90d;
        if (val == null) {
          return (
            <div className="flex justify-center">
              <span className="font-mono text-xs text-slate-400">—</span>
            </div>
          );
        }
        return (
          <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {formatarNumero(val, 0)}
          </span>
        );
      },
      meta: { variante: "numero", label: "Produtos Vend 90d", align: "center" },
      enableSorting: true,
    },

    // 12. Notas Líq. 90d
    {
      id: "notasLiquidas90d",
      accessorFn: (row) => row.notasLiquidas90d ?? undefined,
      sortUndefined: "last",
      size: 95,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Notas Líq. 90d" />
      ),
      cell: ({ row }) => {
        const val = row.original.notasLiquidas90d;
        if (val == null) {
          return (
            <div className="flex justify-center">
              <span className="font-mono text-xs text-slate-400">—</span>
            </div>
          );
        }
        return (
          <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
            {formatarNumero(val, 0)}
          </span>
        );
      },
      meta: { variante: "numero", label: "Notas Líq. 90d", align: "center" },
      enableSorting: true,
    },

    // 13. Consumo Diário
    {
      id: "consumoDiario",
      accessorFn: (row) => row.consumoDiario ?? undefined,
      sortUndefined: "last",
      size: 95,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Consumo Diário" />
      ),
      cell: ({ row }) => {
        const val = row.original.consumoDiario;
        if (val == null) {
          return (
            <div className="flex justify-center">
              <span className="font-mono text-xs text-slate-400">—</span>
            </div>
          );
        }
        return (
          <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
            {val.toFixed(4)}
          </span>
        );
      },
      meta: { variante: "numero", label: "Consumo Diário", align: "center" },
      enableSorting: true,
    },

    // 14. Consumo Mensal
    {
      id: "consumoMensal",
      accessorFn: (row) => row.consumoMensal ?? undefined,
      sortUndefined: "last",
      size: 100,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Consumo Mensal" />
      ),
      cell: ({ row }) => {
        const val = row.original.consumoMensal;
        if (val == null) {
          return (
            <div className="flex justify-center">
              <span className="font-mono text-xs text-slate-400">—</span>
            </div>
          );
        }
        return (
          <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
            {val.toFixed(2)}
          </span>
        );
      },
      meta: { variante: "numero", label: "Consumo Mensal", align: "center" },
      enableSorting: true,
    },

    // 15. Venda a cada
    {
      id: "vendaACadaDias",
      accessorFn: (row) => row.vendaACadaDias ?? undefined,
      sortUndefined: "last",
      size: 95,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Venda a cada" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
          {row.original.consumoDiario == null
            ? "—"
            : row.original.vendaACadaDias == null
            ? "Sem saída"
            : `${row.original.vendaACadaDias.toFixed(1)} d`}
        </span>
      ),
      meta: { variante: "numero", label: "Venda a cada", align: "center" },
      enableSorting: true,
    },

    // 16. Consumo Últ. 30 Dias (qtd)
    {
      id: "consumoUltimos30DiasQtd",
      accessorFn: (row) => row.consumoUltimos30DiasQtd ?? undefined,
      sortUndefined: "last",
      size: 120,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Consumo Últ. 30d" />
      ),
      cell: ({ row }) => {
        const val = row.original.consumoUltimos30DiasQtd;
        if (val == null) {
          return (
            <div className="flex justify-center">
              <span className="font-mono text-xs text-slate-400">—</span>
            </div>
          );
        }
        return (
          <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
            {formatarNumero(val, 0)}
          </span>
        );
      },
      meta: { variante: "numero", label: "Consumo Últ. 30 Dias (qtd)", align: "center" },
      enableSorting: true,
    },

    // 17. Giro últ. venda
    {
      id: "giroUltimaVenda",
      accessorFn: (row) => row.giroUltimaVenda,
      size: 90,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Giro últ. venda" />
      ),
      cell: ({ row }) => {
        const giro = row.original.giroUltimaVenda;
        const color =
          giro === "Alta"
            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
            : giro === "Média"
            ? "text-blue-700 bg-blue-50 border-blue-200"
            : "text-slate-500 bg-slate-50 border-slate-200";
        const dias = row.original.diasSemVenda;
        return (
          <div className="flex justify-center">
            <TooltipCriterio
              titulo="Giro pela última venda"
              classificacao={giro}
              semMedida={
                giro === "Sem histórico"
                  ? "Sem data de última venda na fonte do cliente. Não é o mesmo que parado: é não medido."
                  : null
              }
              medidas={[
                { rotulo: "Dias sem venda", valor: dias === null || dias === undefined ? null : String(dias), destaque: true },
                { rotulo: "Última venda", valor: row.original.dtUltVenda ?? null },
              ]}
              faixas={[
                { rotulo: "Alta", condicao: "até 30 dias" },
                { rotulo: "Média", condicao: "31 a 90 dias" },
                { rotulo: "Baixa", condicao: "mais de 90 dias" },
              ]}
            >
              <span className={cn("cursor-help rounded px-1.5 py-0.2 text-[10px] font-semibold border", color)}>
                {giro}
              </span>
            </TooltipCriterio>
          </div>
        );
      },
      meta: { variante: "selecao", label: "Giro últ. venda", align: "center" },
      enableSorting: true,
    },

    // 18. Frequência
    {
      id: "frequencia",
      accessorFn: (row) => row.frequencia,
      size: 85,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Frequência" />
      ),
      cell: ({ row }) => {
        const freq = row.original.frequencia;
        const color =
          freq === "Alta"
            ? "text-emerald-700 font-bold"
            : freq === "Média"
            ? "text-blue-700 font-semibold"
            : "text-slate-500";
        const item = row.original;
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
              <span className={cn("cursor-help text-xs", color)}>{freq}</span>
            </TooltipFrequencia>
          </div>
        );
      },
      meta: { variante: "selecao", label: "Frequência", align: "center" },
      enableSorting: true,
    },

    // 19. Consumo
    {
      id: "classificacaoConsumo",
      accessorFn: (row) => row.classificacaoConsumo,
      size: 80,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Consumo" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex justify-center">
            <TooltipCriterio
              titulo="Consumo pela quantidade vendida"
              classificacao={item.classificacaoConsumo}
              medidas={[
                { rotulo: "Vendas líquidas 90d", valor: item.vendasLiquidas90d !== null ? `${item.vendasLiquidas90d} un` : null, destaque: true },
                { rotulo: "Vendas líquidas 30d", valor: item.vendasLiquidas30d !== null ? `${item.vendasLiquidas30d} un` : null },
                { rotulo: "Vendas líquidas 180d", valor: item.vendasLiquidas180d !== null ? `${item.vendasLiquidas180d} un` : null },
                { rotulo: "Peças vendidas 90d", valor: item.totalPecasVendidas90d !== null ? `${item.totalPecasVendidas90d} un` : null },
              ]}
              faixas={[
                { rotulo: "Alta", condicao: "100 un ou mais em 90d" },
                { rotulo: "Média", condicao: "30 a 99 un em 90d" },
                { rotulo: "Baixa", condicao: "menos de 30 un em 90d" },
              ]}
            >
              <span className="cursor-help text-xs text-slate-700 dark:text-slate-300">
                {item.classificacaoConsumo}
              </span>
            </TooltipCriterio>
          </div>
        );
      },
      meta: { variante: "selecao", label: "Consumo", align: "center" },
      enableSorting: true,
    },

    // 20. Ruptura
    {
      id: "ruptura",
      accessorFn: (row) => row.ruptura,
      size: 85,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Ruptura" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const rup = item.ruptura;
        // "Sem histórico" NÃO é vermelho. Antes caía no ramo final e ficava
        // pintado como ruptura grave — o cockpit gritava perigo onde só faltava
        // medição. Não medido é cinza, e o tooltip diz de quem é a lacuna.
        const color =
          rup === "Boa"
            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
            : rup === "Atenção"
            ? "text-amber-700 bg-amber-50 border-amber-200 font-semibold"
            : rup === "Grave"
            ? "text-rose-700 bg-rose-50 border-rose-200 font-bold"
            : "text-slate-500 bg-slate-50 border-slate-200 border-dashed";
        const rotulo =
          item.rupturaPercentual !== null
            ? `${item.rupturaPercentual.toFixed(1).replace(".", ",")}%`
            : rup;
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
              <span className={cn("cursor-help rounded px-1.5 py-0.2 text-[10px] border", color)}>
                {rotulo}
              </span>
            </TooltipRuptura>
          </div>
        );
      },
      meta: { variante: "selecao", label: "Ruptura", align: "center" },
      enableSorting: true,
    },

    // 21. Coberturas Comparativas (30d / 90d / 180d com TooltipCobertura)
    {
      id: "cobertura",
      accessorFn: (row) => row.diasCobertura90d ?? undefined,
      sortUndefined: "last",
      size: 130,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Cobertura (dias)" />
      ),
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
          (item.consumoMedioDiario90d ?? 0) > 0 &&
          item.diasCobertura90d !== null &&
          item.diasCobertura90d !== undefined
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
                className={cn(
                  "flex items-center gap-1 font-mono text-xs px-1.5 py-0.5 rounded border border-transparent hover:border-slate-300 dark:hover:border-slate-700 cursor-help",
                  corTendencia
                )}
                aria-label={`Cobertura de estoque: ${cobFormatada}, Tendência: ${item.tendenciaCobertura}`}
              >
                <span>{cobFormatada}</span>
                <span className="text-[10px]">{iconeTendencia}</span>
                {item.isMarcaZumbi && (
                  <span className="text-[9px] font-bold uppercase">Zumbi</span>
                )}
              </button>
            </TooltipCobertura>
          </div>
        );
      },
      meta: { variante: "numero", label: "Cobertura (dias)", align: "center" },
      enableSorting: true,
    },

    // 22. Período ideal
    {
      id: "periodoIdeal",
      accessorFn: (row) => row.periodoIdeal,
      size: 85,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Período ideal" />
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {row.original.periodoIdeal}
          </span>
        </div>
      ),
      meta: { variante: "selecao", label: "Período ideal", align: "center" },
      enableSorting: true,
    },

    // 22. Hist vendas 90d
    {
      id: "histVendas90d",
      accessorFn: (row) => row.histVendas90d ?? undefined,
      sortUndefined: "last",
      size: 90,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Vendas 90d anteriores" />
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
            {row.original.histVendas90d != null ? row.original.histVendas90d : "—"}
          </span>
        </div>
      ),
      meta: { variante: "numero", label: "Vendas 90d anteriores", align: "center" },
      enableSorting: true,
    },

    // 23. Hist prod vend 90d
    {
      id: "histProdVend90d",
      accessorFn: (row) => row.histProdVend90d ?? undefined,
      sortUndefined: "last",
      size: 95,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Hist prod vend" />
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
            {row.original.histProdVend90d != null ? row.original.histProdVend90d : "—"}
          </span>
        </div>
      ),
      meta: { variante: "numero", label: "Notas 90d anteriores", align: "center" },
      enableSorting: true,
    },

    // 24. Dias sem venda
    {
      id: "diasSemVenda",
      accessorFn: (row) => row.diasSemVenda ?? undefined,
      sortUndefined: "last",
      size: 85,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Dias s/ venda" />
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
            {row.original.diasSemVenda == null ? "—" : `${row.original.diasSemVenda}d`}
          </span>
        </div>
      ),
      meta: { variante: "numero", label: "Dias sem venda", align: "center" },
      enableSorting: true,
    },

    // 25. Est [Loja Foco] — o nome vem do cadastro de filiais do tenant
    {
      id: "estoqueLojaFoco",
      accessorFn: (row) => row.estoqueLojaFoco,
      size: 95,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label={rotuloEstoqueFoco} />
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
            {formatarNumero(row.original.estoqueLojaFoco)}
          </span>
        </div>
      ),
      meta: { variante: "numero", label: rotuloEstoqueFoco, align: "center" },
      enableSorting: true,
    },

    // 26. Disp [Rede / Outra] (ex: Disp APP / Disp Rede)
    {
      id: "estoqueRede",
      accessorFn: (row) => row.estoqueRede,
      size: 95,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label={rotuloEstoqueOutra} />
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
            {formatarNumero(row.original.estoqueRede ?? 0)}
          </span>
        </div>
      ),
      meta: { variante: "numero", label: rotuloEstoqueOutra, align: "center" },
      enableSorting: true,
    },

    // 27. Mov nova
    {
      id: "statusMovimentacao",
      accessorFn: (row) => row.statusMovimentacao,
      size: 110,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Mov nova" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const mov = item.statusMovimentacao;
        const color =
          mov === "Comprar"
            ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold"
            : mov === "Transferir"
            ? "bg-indigo-100 text-indigo-800 border-indigo-300 font-bold"
            : mov === "Marca Zumbi"
            ? "bg-slate-800 text-rose-200 border-slate-700 font-bold"
            : "bg-slate-100 text-slate-700 border-slate-200";

        const temIa =
          item.origemPrevisao === "IA" ||
          (item.previsaoIaP80 !== null && item.previsaoIaP80 !== undefined && item.previsaoIaP80 > 0);

        return (
          <div className="flex flex-col items-center gap-0.5">
            <span className={cn("rounded px-2 py-0.2 text-[10px] border uppercase tracking-wider", color)}>
              {mov}
            </span>
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
              <span>
                P {item.sugestaoCompra} / T {item.sugestaoTransferencia}
              </span>
              {item.sugestaoQtdErp != null && item.sugestaoQtdErp > 0 && (
                <span
                  className="rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                  title={`Sugestão do ERP: ${item.sugestaoQtdErp} un${item.origemSugestaoErp ? ` (${item.origemSugestaoErp})` : ""}`}
                >
                  ERP {item.sugestaoQtdErp}
                </span>
              )}
              {temIa && (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="cursor-help inline-flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-700 transition-colors"
                        aria-label="Previsão de demanda por Inteligência Artificial"
                      >
                        <Sparkles className="h-3 w-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs space-y-1 bg-slate-900 text-slate-100 p-2.5 rounded shadow-xl border border-purple-500/30">
                      <p className="font-bold flex items-center gap-1 text-purple-300">
                        <Sparkles className="h-3.5 w-3.5" />
                        Previsão de demanda
                      </p>
                      <p className="text-[11px] text-slate-300">
                        Demanda P80 (Conservadora): <strong className="text-white">{item.previsaoIaP80} un</strong>
                      </p>
                      {item.previsaoIaP50 !== null && item.previsaoIaP50 !== undefined && (
                        <p className="text-[11px] text-slate-300">
                          Demanda P50 (Mediana): <strong className="text-white">{item.previsaoIaP50} un</strong>
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 border-t border-slate-700/60 pt-1">
                        Horizonte: 30 dias • Cálculo probabilístico sobre o histórico de vendas
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        );
      },
      meta: { variante: "selecao", label: "Mov nova", align: "center" },
      enableSorting: true,
    },

    // 28. Pedido (Editável com Múltiplo)
    {
      id: "pedido",
      accessorFn: (row) => row.sugestaoCompra,
      size: 95,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Pedido" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const exigeMultiplo = item.exigeMultiploEmbalagem;
        const temSugestaoErp = (item.sugestaoQtdErp ?? 0) > 0;

        return (
          <div className="flex flex-col items-center justify-center">
            <div className="relative inline-flex items-center justify-center">
              <input
                // `key` pela SKU: a grade é virtualizada e o React reaproveita o
                // <input> do slot quando a linha muda. Como o valor é `defaultValue`
                // (não controlado), sem a key o input mostrava a quantidade da
                // linha ANTERIOR naquele slot ao trocar de aba ou rolar.
                key={item.codigoSku}
                type="number"
                min="0"
                defaultValue={item.pedidoCustom ?? item.sugestaoCompra}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 0) {
                    onPedirCommit?.(item.codigoSku, val);
                  }
                }}
                className={cn(
                  "h-7 w-16 rounded border text-center font-mono text-xs font-semibold outline-none transition-colors focus:ring-1 focus:ring-blue-500",
                  exigeMultiplo
                    ? "bg-destaqueMultiplo border-amber-300 text-amber-950 font-bold"
                    : "bg-white border-slate-300 text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                )}
                aria-label={`Quantidade de pedido para SKU ${item.codigoSku}`}
              />
              {exigeMultiplo && (
                <span
                  className="absolute -top-1.5 -right-2 flex h-3.5 items-center justify-center rounded-full bg-amber-200 px-1 text-[8px] font-bold text-amber-900 border border-amber-300 shadow-sm"
                  title={`Múltiplo de compra: ${item.loteMultiplo} un · Origem: ${
                    item.origemLoteMultiplo === "CONFIGURACAO"
                      ? "configuração do SKU"
                      : item.origemLoteMultiplo === "ERP"
                        ? "cadastro do ERP"
                        : item.origemLoteMultiplo === "HISTOGRAMA"
                          ? "histórico de vendas"
                          : item.origemLoteMultiplo === "VOCABULARIO"
                            ? "descrição do produto"
                            : "padrão"
                  }`}
                >
                  {item.loteMultiplo}x
                </span>
              )}
            </div>
            {temSugestaoErp && (
              <span
                className="mt-0.5 inline-flex items-center rounded px-1 text-[9px] font-mono font-semibold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                title={`Sugestão hoje do ERP: ${item.sugestaoQtdErp} un${item.origemSugestaoErp ? ` (${item.origemSugestaoErp})` : ""}`}
              >
                ERP: {item.sugestaoQtdErp}
              </span>
            )}
          </div>
        );
      },
      meta: { label: "Pedido", align: "center", pinned: "right" },
      enableSorting: true,
    },

    // 29. Transferência (Editável)
    {
      id: "transferencia",
      accessorFn: (row) => row.sugestaoTransferencia,
      size: 95,
      header: ({ header }) => (
        <DataGridColumnHeader header={header} align="center" label="Transferência" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const podeTransferir = (item.sugestaoTransferencia ?? 0) > 0;

        const origem = item.filialOrigemTransferenciaNome;

        const campo = (
          <input
            // Mesma razão da coluna Pedido: sem `key` o slot virtualizado
            // mantinha o valor da linha anterior (aba Transferir mostrava 0
            // em itens com transferência sugerida).
            key={item.codigoSku}
            type="number"
            min="0"
            disabled={!podeTransferir}
            defaultValue={item.transferenciaCustom ?? item.sugestaoTransferencia}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 0) {
                onTransferirCommit?.(item.codigoSku, val);
              }
            }}
            className={cn(
              "h-7 w-16 rounded border text-center font-mono text-xs font-semibold outline-none transition-colors",
              podeTransferir
                ? "bg-indigo-50 border-indigo-300 text-indigo-900 focus:ring-1 focus:ring-indigo-500"
                : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:border-slate-700"
            )}
            aria-label={
              podeTransferir && origem
                ? `Transferir ${item.sugestaoTransferencia} un de ${origem} para ${item.filialFocoNome}, SKU ${item.codigoSku}`
                : `Quantidade de transferência para SKU ${item.codigoSku}`
            }
          />
        );

        // Sem os dois lados na tela, "5" não diz nada: o comprador precisa saber
        // de onde a peça sai e para onde vai antes de confirmar.
        if (!podeTransferir || !origem) {
          return <div className="flex justify-center">{campo}</div>;
        }

        // Ao LADO do campo, não abaixo: na altura compacta a linha tem 36px e
        // uma segunda linha seria cortada justamente onde está a informação.
        return (
          <div className="flex items-center justify-center gap-1">
            {campo}
            <TooltipTransferencia
              filialOrigemNome={origem}
              saldoOrigem={item.saldoOrigemTransferencia}
              estoqueMinimoOrigem={item.estoqueMinimoOrigemTransferencia}
              sobraRealOrigem={item.sobraRealOrigemTransferencia}
              filialDestinoNome={item.filialFocoNome}
              necessidadeDestino={item.necessidadeDestinoTransferencia}
              quantidadeTransferirRecomendada={item.sugestaoTransferencia ?? 0}
              motivo={item.motivoDecisao}
            >
              <button
                type="button"
                aria-label={`De ${origem} para ${item.filialFocoNome}. Ver detalhes da transferência.`}
                title={`De ${origem} para ${item.filialFocoNome}`}
                className="flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                <ArrowLeftRight className="h-3 w-3" />
              </button>
            </TooltipTransferencia>
          </div>
        );
      },
      meta: { label: "Transferência", align: "center", pinned: "right" },
      enableSorting: true,
    },
  ];
}

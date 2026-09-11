"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  ColumnFiltersState,
  SortingState,
  ColumnPinningState,
  VisibilityState,
  RowSelectionState,
  ColumnSizingState,
} from "@tanstack/react-table";
import {
  Search,
  X,
  Download,
  PackageCheck,
  ArrowLeftRight,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

import { LinhaCockpitMatriz, ItemDeltaRascunho, LinhaCockpitCompras } from "@/tipos/cockpit";
import { useFiltrosCockpit } from "@/hooks/useFiltrosCockpit";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import { AppSidebar, UsuarioSidebar } from "@/components/layout/app-sidebar";
import { PayloadGradeTabular, PAYLOAD_TABULAR_VAZIO } from "@/lib/cockpit/codificacao-tabular";
import { funcaoFiltroColuna } from "@/lib/cockpit/filtro-tanstack";
import { ChipsFiltroColuna } from "@/components/cockpit/ChipsFiltroColuna";
import { MenuFiltrosGrade } from "@/components/ui/menu-filtros-grade";
import { LegendaGrade } from "@/components/cockpit/LegendaGrade";
import { ContagensStatusGrade } from "@/lib/cockpit/escopo-grade";
import { useGradeProgressiva } from "@/hooks/useGradeProgressiva";
import { AvisoCatalogo } from "@/components/cockpit/AvisoCatalogo";
import { BotoesExportacao } from "@/components/cockpit/BotoesExportacao";
import { DataTableSection } from "@/components/cockpit/data-table-section";
import { criarColunasCockpit } from "@/components/cockpit/colunas-cockpit";
import { QuickFilterChip } from "@/components/cockpit/quick-filter-chip";
import {
  DataGridMenuBar,
  DataGridSortMenu,
  DataGridRowHeightMenu,
  DataGridViewMenu,
  DataGridKeyboardShortcuts,
} from "@/components/ui/data-grid";
import { DialogSimilares } from "@/components/tooltips/DialogSimilares";
import { BannerRascunho } from "./BannerRascunho";
import { DialogExportacao } from "./DialogExportacao";
import { obterTenantAtivo, montarNomesFiliais } from "@/lib/cockpit/opcoes-tenant";
import type { ContextoExportacao } from "@/lib/exportacao/tipos";
import { CurvaABC } from "@core/dominio";
import { cn } from "@/lib/utils";

export interface CockpitPrincipalProps {
  /**
   * Linhas já prontas. Caminho direto, usado em teste e em telas que não fazem
   * carga progressiva. Em produção o cockpit recebe `gradeInicial`.
   */
  itensIniciais?: readonly LinhaCockpitMatriz[];
  /**
   * Linhas ACIONÁVEIS em formato tabular. O catálogo completo vem depois, pela
   * /api/compras — ver useGradeProgressiva para o porquê.
   */
  gradeInicial?: PayloadGradeTabular;
  /** Contagens do catálogo inteiro, do servidor: os chips não podem mentir na espera. */
  contagensCatalogo?: ContagensStatusGrade;
  fornecedoresPermitidosInicial?: readonly number[] | null;
  filialFocoIdInicial?: number;
  /** Sessão resolvida no servidor: evita o rodapé "vazio" enquanto a página hidrata. */
  usuarioSessao?: UsuarioSidebar | null;
}

const CONTAGENS_VAZIAS: ContagensStatusGrade = {
  total: 0,
  pedir: 0,
  transferir: 0,
  ruptura: 0,
  zumbi: 0,
};

const CARTEIRAS_DEMO = [
  { id: "GESTOR", nome: "Gestor Geral (Visão Completa da Rede)", fornecedores: null },
  { id: "COMPRADOR_SUSPENSAO", nome: "Comprador: Suspensão & Freios", fornecedores: [500, 501, 502, 503, 504] },
  { id: "COMPRADOR_MOTOR", nome: "Comprador: Motor & Injeção", fornecedores: [505, 506, 507, 508] },
  { id: "COMPRADOR_ELETRICA", nome: "Comprador: Baterias & Lubrificantes", fornecedores: [509, 510, 511, 512] },
];

const OPCOES_ORDENACAO = [
  { id: "custo-desc", label: "Maior Custo (R$)", desc: true },
  { id: "custo-asc", label: "Menor Custo (R$)", desc: false },
  { id: "consumoDiario-desc", label: "Maior Consumo Diário", desc: true },
  { id: "produtosVend90d-desc", label: "Mais Vendidos (90d)", desc: true },
  { id: "diasSemVenda-desc", label: "Mais Dias Sem Venda", desc: true },
  { id: "codigo-asc", label: "Código SKU (A-Z)", desc: false },
];

export function CockpitPrincipal({
  itensIniciais,
  gradeInicial,
  contagensCatalogo,
  fornecedoresPermitidosInicial = null,
  filialFocoIdInicial = 1,
  usuarioSessao = null,
}: CockpitPrincipalProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Identidade e cadastro do cliente ativo. Fica no topo porque a lista de
  // lojas e a exportação dependem dele.
  const tenantAtivo = useMemo(() => obterTenantAtivo(), []);
  const nomesFiliaisTenant = useMemo(() => montarNomesFiliais(tenantAtivo), [tenantAtivo]);

  // 0. Grade: acionáveis agora, catálogo completo em segundo plano.
  const grade = useGradeProgressiva({
    gradeInicial: gradeInicial ?? PAYLOAD_TABULAR_VAZIO,
    contagensCatalogo: contagensCatalogo ?? CONTAGENS_VAZIAS,
    filialId: filialFocoIdInicial,
    automatico: gradeInicial !== undefined,
  });
  const linhasBase = itensIniciais ?? grade.itens;

  // 1. Estado de Carteira / Comprador Selecionado (RBAC)
  const [carteiraSelecionada, setCarteiraSelecionada] = useState<string>("GESTOR");
  const fornecedoresAtivos = useMemo(() => {
    const c = CARTEIRAS_DEMO.find((item) => item.id === carteiraSelecionada);
    return c ? c.fornecedores : fornecedoresPermitidosInicial;
  }, [carteiraSelecionada, fornecedoresPermitidosInicial]);

  // 2. Estado de Deltas / Ajustes do Comprador
  const [deltas, setDeltas] = useState<Record<string, ItemDeltaRascunho>>({});

  // 3. Hook de Rascunho de Sessão em LocalStorage com Debounce
  const {
    draftAvailable,
    isSaving,
    restaurarRascunho,
    descartarRascunho,
  } = useSessionDraft({
    tenantId: "carreiro",
    userId: carteiraSelecionada,
    deltas,
  });

  const handleRestaurarRascunho = useCallback(() => {
    const rascunho = restaurarRascunho();
    if (rascunho?.deltas) {
      setDeltas(rascunho.deltas);
    }
  }, [restaurarRascunho]);

  const handleDescartarRascunho = useCallback(() => {
    descartarRascunho();
    setDeltas({});
  }, [descartarRascunho]);

  // 4. Aplicação dos Deltas sobre a base de dados
  const itensComOverrides = useMemo(() => {
    if (Object.keys(deltas).length === 0) return linhasBase;

    return linhasBase.map((item) => {
      const delta = deltas[item.codigoSku] ?? deltas[String(item.produtoId)];
      if (!delta) return item;

      if (delta.tipo === "transferir") {
        return {
          ...item,
          transferenciaCustom: delta.quantidade,
          motivoDecisao: delta.motivoAjuste
            ? `[Ajuste Humano Transferência] ${delta.motivoAjuste}`
            : item.motivoDecisao,
        };
      }

      return {
        ...item,
        pedidoCustom: delta.quantidade,
        motivoDecisao: delta.motivoAjuste
          ? `[Ajuste Humano Pedido] ${delta.motivoAjuste}`
          : item.motivoDecisao,
      };
    });
  }, [linhasBase, deltas]);

  // 5. Hook de Filtros de Alta Performance (< 250ms para 25.000 SKUs)
  const {
    rawQuery,
    setRawQuery,
    statusFiltro,
    alterarStatus,
    lojaFocoId,
    setLojaFocoId,
    itensFiltrados,
    facetas,
    marcasDeselecionadas,
    curvasDeselecionadas,
    definirMarcasDeselecionadas,
    definirCurvasDeselecionadas,
    limparFiltros,
    isPending,
  } = useFiltrosCockpit({
    itens: itensComOverrides,
    fornecedoresPermitidos: fornecedoresAtivos,
    lojaFocoIdInicial: filialFocoIdInicial,
    contagensCatalogo: gradeInicial ? grade.contagens : undefined,
  });

  // 6. Callbacks de Ajuste de Pedido e Transferência
  const handleCommitPedido = useCallback(
    (skuId: string | number, quantidade: number, motivo: string | null) => {
      setDeltas((prev) => ({
        ...prev,
        [String(skuId)]: {
          quantidade,
          modificadoEm: Date.now(),
          tipo: "pedir",
          motivoAjuste: motivo,
        },
      }));
    },
    []
  );

  const handleCommitTransferencia = useCallback(
    (skuId: string | number, quantidade: number, motivo: string | null) => {
      setDeltas((prev) => ({
        ...prev,
        [String(skuId)]: {
          quantidade,
          modificadoEm: Date.now(),
          tipo: "transferir",
          motivoAjuste: motivo,
        },
      }));
    },
    []
  );

  // 7. KPIs Consolidados do Cabeçalho
  const kpis = useMemo(() => {
    let valorTotalSugerido = 0;
    let pecasTotaisSugeridas = 0;
    let totalRupturas = 0;
    let totalTransferencias = 0;
    let totalZumbis = 0;
    // A ruptura só é exibível se a fonte do cliente REALMENTE mediu dias zerados.
    // Quando não mede, o cockpit mostra "—": um zero aqui afirmaria que nenhuma
    // peça faltou no balcão, que é diferente de "não sabemos".
    let rupturaMedida = false;

    // Os KPIs resumem a REDE, não a aba aberta. Recalcular sobre o filtro fazia
    // "Catálogo Total" cair para 114 ao abrir em Comprar, e "Travas Anti-Encalhe"
    // zerar mesmo com 2.001 itens travados — o cabeçalho contradizia os chips.
    for (const item of itensComOverrides) {
      const qtdCompra = item.pedidoCustom > 0 ? item.pedidoCustom : item.sugestaoFinalCompra;
      if (qtdCompra > 0) {
        pecasTotaisSugeridas += qtdCompra;
        valorTotalSugerido += qtdCompra * item.precoCusto;
      }
      if (item.rupturaPercentual !== null) {
        rupturaMedida = true;
      }
      if (item.classificacaoRuptura === "Grave" || item.classificacaoRuptura === "Atenção") {
        totalRupturas++;
      }
      if (item.quantidadeTransferenciaSugerida > 0) {
        totalTransferencias += item.quantidadeTransferenciaSugerida;
      }
      if (item.isMarcaZumbi) {
        totalZumbis++;
      }
    }

    return {
      // Tamanho do CATÁLOGO, não do que já chegou ao navegador. Durante a carga
      // progressiva, contar o que está em memória faria esta KPI dizer 2.236
      // enquanto o chip "Todos" diz 19.118 — dois números para a mesma coisa.
      totalSkus: gradeInicial ? grade.contagens.total : itensComOverrides.length,
      pecasTotaisSugeridas,
      valorTotalSugerido,
      totalRupturas,
      rupturaMedida,
      totalTransferencias,
      totalZumbis,
    };
  }, [itensComOverrides, gradeInicial, grade.contagens.total]);

  // 8. Lista de Lojas — do cadastro do TENANT, nunca de um adapter de cliente.
  // A interface é a mesma para todo mundo; quem muda é a configuração.
  const listaLojas = useMemo(() => {
    return Object.entries(nomesFiliaisTenant).map(([id, nome]) => ({
      id: parseInt(id, 10),
      nome,
    }));
  }, [nomesFiliaisTenant]);

  const nomeLojaFoco = useMemo(() => {
    return nomesFiliaisTenant[lojaFocoId] ?? `Loja ${lojaFocoId}`;
  }, [nomesFiliaisTenant, lojaFocoId]);

  // 9. Diálogo de Similares
  const [dialogSimilaresAberto, setDialogSimilaresAberto] = useState(false);
  const [itemSimilaresSelecionado, setItemSimilaresSelecionado] = useState<LinhaCockpitCompras | null>(null);

  const handleAbrirSimilares = useCallback((linha: LinhaCockpitCompras) => {
    setItemSimilaresSelecionado(linha);
    setDialogSimilaresAberto(true);
  }, []);

  // 10. Estados da Tabela TanStack (Ordenação, Visibilidade, Fixação, Resizing, Altura)
  const [sorting, setSorting] = useState<SortingState>([]);
  const [sortValue, setSortValue] = useState<string>("custo-desc");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
    left: ["select", "codigo", "descricao"],
    right: ["pedido", "transferencia"],
  });
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  // Filtros tipados por coluna: compõem com a busca livre e os chips de status.
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowHeight, setRowHeight] = useState<"compact" | "default" | "relaxed">("default");

  const handleSortChange = useCallback((optionId: string, desc?: boolean) => {
    setSortValue(optionId);
    const colId = optionId.split("-")[0];
    setSorting([{ id: colId, desc: desc ?? true }]);
  }, []);

  // Definição das 29 Colunas da Imagem de Referência
  const colunas = useMemo(() => {
    return criarColunasCockpit({
      nomeLojaFoco,
      nomeOutrasLojas: "Rede",
      onAbrirSimilares: handleAbrirSimilares,
      onPedirCommit: (skuId, valor) => handleCommitPedido(skuId, valor, "Ajuste manual na grade"),
      onTransferirCommit: (skuId, valor) => handleCommitTransferencia(skuId, valor, "Ajuste manual na grade"),
    });
  }, [nomeLojaFoco, handleAbrirSimilares, handleCommitPedido, handleCommitTransferencia]);

  // Instância TanStack Table v8
  const table = useReactTable({
    data: itensFiltrados as LinhaCockpitCompras[],
    columns: colunas,
    state: {
      sorting,
      columnVisibility,
      columnPinning,
      columnSizing,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    filterFns: { coluna: funcaoFiltroColuna },
    defaultColumn: { filterFn: funcaoFiltroColuna },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // Valores distintos por coluna, para o filtro "é um de". Calculado sob demanda.
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getSortedRowModel: getSortedRowModel(),
  });

  // 11. Opções para QuickFilterChips
  const opcoesCurva = useMemo(() => ["A", "B", "C"], []);
  const contagensCurva = useMemo(() => {
    return new Map([
      ["A", facetas.curvas.get("A" as CurvaABC) ?? 0],
      ["B", facetas.curvas.get("B" as CurvaABC) ?? 0],
      ["C", facetas.curvas.get("C" as CurvaABC) ?? 0],
    ]);
  }, [facetas.curvas]);

  const opcoesMarcas = useMemo(() => {
    return Array.from(facetas.marcas.keys()).sort();
  }, [facetas.marcas]);

  // 12. Atalho de Teclado Global (pressionar '/' ou Ctrl+F para focar busca)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "/" || (e.ctrlKey && e.key.toLowerCase() === "f")) && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 13. Exportação configurável por cliente (layouts, formato e colunas do tenant)
  const [dialogExportacaoAberto, setDialogExportacaoAberto] = useState(false);
  // Muda a cada modelo salvo, para os botões recarregarem a lista.
  const [versaoModelos, setVersaoModelos] = useState(0);
  const contextoExportacao = useMemo<ContextoExportacao>(
    () => ({
      tenantId: tenantAtivo.id,
      nomeTenant: tenantAtivo.nome,
      filialId: lojaFocoId,
      nomeLoja: nomesFiliaisTenant[lojaFocoId] ?? `Loja ${lojaFocoId}`,
      dataReferencia: new Date(),
    }),
    [tenantAtivo, nomesFiliaisTenant, lojaFocoId]
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* 1. Menu Lateral Retrátil com Navegação e Configurações */}
      <AppSidebar usuario={usuarioSessao} />

      <DialogExportacao
        aberto={dialogExportacaoAberto}
        onFechar={() => setDialogExportacaoAberto(false)}
        itensFiltrados={itensFiltrados as LinhaCockpitMatriz[]}
        itensSelecionados={table.getSelectedRowModel().rows.map((r) => r.original as LinhaCockpitMatriz)}
        configuracao={tenantAtivo.exportacao}
        onModeloSalvo={() => setVersaoModelos((v) => v + 1)}
        contexto={contextoExportacao}
      />

      {/* 2. Conteúdo Principal Rolável */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Header Institucional Superior */}
        <header className="sticky top-0 z-30 bg-[#0F2B5C] text-white shadow-md border-b border-[#D4AF37]/30">
          <div className="max-w-[1920px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-[#D4AF37] animate-pulse" />
                {/* Identidade do TENANT. Estava fixa no código e vazava o nome
                    do cliente para a demonstração pública. */}
                <span className="text-base font-black tracking-tight text-white">
                  {tenantAtivo.nome.toUpperCase()}
                </span>
              </div>
              <span className="hidden sm:inline-block text-slate-400 text-xs">|</span>
              <span className="text-xs text-slate-300 font-medium hidden md:inline">
                Cockpit de Inteligência & Decisão de Compras
              </span>
            </div>

            {/* Seletor de Carteira RBAC e Ações */}
            <div className="flex items-center flex-wrap gap-2 text-xs">
              <div className="flex items-center bg-white/10 rounded px-2.5 py-1 border border-white/20">
                <span className="text-slate-300 mr-2 font-medium">Carteira:</span>
                <select
                  value={carteiraSelecionada}
                  onChange={(e) => setCarteiraSelecionada(e.target.value)}
                  className="bg-transparent text-white font-semibold outline-none cursor-pointer text-xs"
                >
                  {CARTEIRAS_DEMO.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Um botão por modelo: o comprador exporta o de sempre num clique. */}
              <BotoesExportacao
                itens={itensFiltrados as LinhaCockpitMatriz[]}
                contexto={contextoExportacao}
                csvPadrao={tenantAtivo.exportacao.csvPadrao}
                onAbrirConfiguracao={() => setDialogExportacaoAberto(true)}
                versao={versaoModelos}
              />

              <Link
                href="/pedidos"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded shadow flex items-center gap-1.5 transition-colors"
              >
                <PackageCheck className="h-3.5 w-3.5 text-blue-200" />
                Ver Pedidos
              </Link>

              <Link
                href="/admin/auditoria"
                className="bg-white/15 hover:bg-white/25 text-white font-semibold px-3 py-1.5 rounded border border-white/20 transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Auditoria
              </Link>
            </div>
          </div>
        </header>

        {/* Banner de Rascunho se Houver Dados Locais */}
        {draftAvailable && (
          <div className="max-w-[1920px] mx-auto px-4 pt-3 w-full">
            <BannerRascunho
              draft={draftAvailable}
              onRestaurar={handleRestaurarRascunho}
              onDescartar={handleDescartarRascunho}
            />
          </div>
        )}

        {/* 3. Painel de KPIs Rápidos */}
        <section className="max-w-[1920px] mx-auto px-4 pt-3 pb-1 w-full">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            {/* Total SKUs */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <span className="text-slate-500 font-medium uppercase text-[10px]">Catálogo Total</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black text-slate-800 dark:text-white">
                  {kpis.totalSkus.toLocaleString("pt-BR")}
                </span>
                <span className="text-[11px] text-slate-400">100% Censo</span>
              </div>
            </div>

            {/* Sugestão de Compra */}
            <div className="bg-white p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20 flex flex-col justify-between">
              <span className="text-emerald-800 font-semibold uppercase text-[10px] dark:text-emerald-300">
                Sugestão de Compra
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                  {kpis.pecasTotaisSugeridas.toLocaleString("pt-BR")} un
                </span>
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                  {kpis.valorTotalSugerido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            </div>

            {/* Rupturas no Balcão */}
            {kpis.rupturaMedida ? (
              <div className="bg-white p-3 rounded-xl border border-rose-200 bg-rose-50/40 shadow-sm flex flex-col justify-between">
                <span className="text-rose-800 font-semibold uppercase text-[10px]">
                  Rupturas Críticas
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-black text-rose-700">
                    {kpis.totalRupturas.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-[11px] font-medium text-rose-600">Saldo 0 com saída</span>
                </div>
              </div>
            ) : (
              <div
                className="bg-white p-3 rounded-xl border border-slate-200 bg-slate-50/60 shadow-sm flex flex-col justify-between"
                title="A fonte de dados deste cliente não expõe histórico de saldo diário, então dias de ruptura não são medidos. Exibir zero aqui afirmaria que nenhuma peça faltou."
              >
                <span className="text-slate-600 font-semibold uppercase text-[10px]">
                  Rupturas Críticas
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-black text-slate-400">—</span>
                  <span className="text-[11px] font-medium text-slate-500">Não medido na fonte</span>
                </div>
              </div>
            )}

            {/* Transferência Segura */}
            <div className="bg-white p-3 rounded-xl border border-indigo-200 bg-indigo-50/40 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/20 flex flex-col justify-between">
              <span className="text-indigo-800 font-semibold uppercase text-[10px] dark:text-indigo-300">
                Transferência Segura
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black text-indigo-700 dark:text-indigo-400">
                  {kpis.totalTransferencias.toLocaleString("pt-BR")} un
                </span>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">Sobra da rede</span>
              </div>
            </div>

            {/* Travas Anti-Encalhe */}
            <div className="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm dark:border-amber-900 dark:bg-amber-950/20 flex flex-col justify-between col-span-2 sm:col-span-1">
              <span className="text-amber-800 font-semibold uppercase text-[10px] dark:text-amber-300">
                Travas Anti-Encalhe
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black text-amber-700 dark:text-amber-400">
                  {kpis.totalZumbis.toLocaleString("pt-BR")}
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Sem saída 180d</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Barra de Menus e Filtros Rápidos (DataGridMenuBar & QuickFilterChips) */}
        <section className="max-w-[1920px] mx-auto px-4 py-2 w-full space-y-2">
          {/* Linha 1: Barra de Pesquisa, Seletor de Loja e Ações de Grade */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {/* Campo de Busca Rápida */}
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar por código SKU, descrição, fabricante, marca... (Pressione /)"
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-8 text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              {rawQuery && (
                <button
                  type="button"
                  onClick={() => setRawQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Seletor de Loja Foco */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Loja Foco:</span>
              <select
                value={lojaFocoId}
                onChange={(e) => setLojaFocoId(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {listaLojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome} {loja.id === 1 ? "(Matriz)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Controles da Grade: Menus de Coluna, Ordenação, Altura e Atalhos */}
            <DataGridMenuBar className="ml-auto">
              <MenuFiltrosGrade table={table} />
              <DataGridSortMenu
                value={sortValue}
                onChange={handleSortChange}
                options={OPCOES_ORDENACAO}
              />
              <DataGridRowHeightMenu
                value={rowHeight}
                onChange={setRowHeight}
              />
              <DataGridViewMenu table={table} />
              <DataGridKeyboardShortcuts />
            </DataGridMenuBar>
          </div>

          {/* Linha 2: Status Pills e Filtros Rápidos (QuickFilterChips) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: "ALL", rotulo: "Todos", count: facetas.contagensStatus.total },
                { id: "PEDIR", rotulo: "Comprar", count: facetas.contagensStatus.pedir, cor: "text-emerald-700" },
                { id: "TRANSFERIR", rotulo: "Transferir", count: facetas.contagensStatus.transferir, cor: "text-indigo-700" },
                { id: "RUPTURA", rotulo: "Ruptura", count: facetas.contagensStatus.ruptura, cor: "text-rose-700" },
                { id: "ZUMBI", rotulo: "Trava Zumbi", count: facetas.contagensStatus.zumbi, cor: "text-amber-700" },
              ].map((opcao) => {
                const ativo = statusFiltro === opcao.id;
                return (
                  <button
                    key={opcao.id}
                    type="button"
                    onClick={() => alterarStatus(opcao.id as any)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors border",
                      ativo
                        ? "bg-[#0F2B5C] text-white border-[#0F2B5C] shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    )}
                  >
                    <span>{opcao.rotulo}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                        ativo
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      )}
                    >
                      {opcao.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Filtros Rápidos por Chip (Curva ABC, Marcas) e Botão Limpar */}
            <div className="flex flex-wrap items-center gap-2">
              {gradeInicial && (
                <AvisoCatalogo
                  estado={grade.estadoCatalogo}
                  totalCatalogo={grade.contagens.total}
                  totalCarregado={itensComOverrides.length}
                  erro={grade.erro}
                  onTentarNovamente={grade.carregarCatalogo}
                />
              )}

              <QuickFilterChip
                label="Curva ABC"
                options={opcoesCurva}
                deselected={curvasDeselecionadas as any}
                counts={contagensCurva}
                onApply={(novas) => definirCurvasDeselecionadas(new Set(Array.from(novas) as CurvaABC[]))}
              />

              <QuickFilterChip
                label="Marca"
                options={opcoesMarcas}
                deselected={marcasDeselecionadas as Set<string>}
                counts={facetas.marcas}
                onApply={(novas) => definirMarcasDeselecionadas(novas)}
              />

              {(rawQuery || marcasDeselecionadas.size > 0 || curvasDeselecionadas.size > 0 || statusFiltro !== "ALL") && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline px-1 py-0.5"
                >
                  <RotateCcw className="h-3 w-3" />
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 5. Seção da Grade Operacional Fiel com TanStack Virtualizer e 29 Colunas */}
        <main className="max-w-[1920px] mx-auto px-4 pb-6 w-full flex-1 flex flex-col">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <ChipsFiltroColuna table={table} />
            <LegendaGrade className="ml-auto" />
          </div>
          <DataTableSection
            table={table}
            filteredCount={itensFiltrados.length}
            totalCount={itensComOverrides.length}
            rowHeight={rowHeight}
            className="flex-1 min-h-[500px]"
          />
        </main>
      </div>

      {/* 6. Modal de Peças Similares Intercambiáveis */}
      {dialogSimilaresAberto && itemSimilaresSelecionado && (
        <DialogSimilares
          aberto={dialogSimilaresAberto}
          onOpenChange={setDialogSimilaresAberto}
          produtoPrincipalCodigo={itemSimilaresSelecionado.codigo || itemSimilaresSelecionado.codigoSku}
          produtoPrincipalDescricao={itemSimilaresSelecionado.descricao}
          similares={itemSimilaresSelecionado.similares}
        />
      )}
    </div>
  );
}

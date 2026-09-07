"use client";

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { LinhaCockpitMatriz, ItemDeltaRascunho } from "@/tipos/cockpit";
import { useFiltrosCockpit } from "@/hooks/useFiltrosCockpit";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import { GridCockpitVirtualizado } from "./GridCockpitVirtualizado";
import { BarraFiltrosCockpit } from "./BarraFiltrosCockpit";
import { BannerRascunho } from "./BannerRascunho";
import { NOMES_FILIAIS_CARREIRO } from "@adapters/carreiro/mapeador-dax";

export interface CockpitPrincipalProps {
  itensIniciais: readonly LinhaCockpitMatriz[];
  fornecedoresPermitidosInicial?: readonly number[] | null;
  filialFocoIdInicial?: number;
}

const CARTEIRAS_DEMO = [
  { id: "GESTOR", nome: "Gestor Geral (Visão Completa da Rede)", fornecedores: null },
  { id: "COMPRADOR_SUSPENSAO", nome: "Comprador: Suspensão & Freios", fornecedores: [500, 501, 502, 503, 504] },
  { id: "COMPRADOR_MOTOR", nome: "Comprador: Motor & Injeção", fornecedores: [505, 506, 507, 508] },
  { id: "COMPRADOR_ELETRICA", nome: "Comprador: Baterias & Lubrificantes", fornecedores: [509, 510, 511, 512] },
];

export function CockpitPrincipal({
  itensIniciais,
  fornecedoresPermitidosInicial = null,
  filialFocoIdInicial = 1,
}: CockpitPrincipalProps) {
  // 1. Estado de Carteira / Comprador Selecionado
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
    salvarImediatamente,
  } = useSessionDraft({
    tenantId: "carreiro",
    userId: carteiraSelecionada,
    deltas,
  });

  // Handler para restaurar rascunho
  const handleRestaurarRascunho = useCallback(() => {
    const rascunho = restaurarRascunho();
    if (rascunho?.deltas) {
      setDeltas(rascunho.deltas);
    }
  }, [restaurarRascunho]);

  // Handler para descartar rascunho
  const handleDescartarRascunho = useCallback(() => {
    descartarRascunho();
    setDeltas({});
  }, [descartarRascunho]);

  // 4. Aplicação dos Deltas sobre a base de dados
  const itensComOverrides = useMemo(() => {
    if (Object.keys(deltas).length === 0) return itensIniciais;

    return itensIniciais.map((item) => {
      const delta = deltas[item.codigoSku] ?? deltas[String(item.produtoId)];
      if (!delta) return item;

      return {
        ...item,
        pedidoCustom: delta.quantidade,
        motivoDecisao: delta.motivoAjuste
          ? `[Ajuste Humano] ${delta.motivoAjuste}`
          : item.motivoDecisao,
      };
    });
  }, [itensIniciais, deltas]);

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
    limparFiltros,
    isPending,
  } = useFiltrosCockpit({
    itens: itensComOverrides,
    fornecedoresPermitidos: fornecedoresAtivos,
    lojaFocoIdInicial: filialFocoIdInicial,
  });

  // 6. Callback de Ajuste de Pedido pelo Comprador
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

  // 7. KPIs Consolidados do Cabeçalho
  const kpis = useMemo(() => {
    let valorTotalSugerido = 0;
    let pecasTotaisSugeridas = 0;
    let totalRupturas = 0;
    let totalTransferencias = 0;
    let totalZumbis = 0;

    for (const item of itensFiltrados) {
      const qtdCompra = item.pedidoCustom > 0 ? item.pedidoCustom : item.sugestaoFinalCompra;
      if (qtdCompra > 0) {
        pecasTotaisSugeridas += qtdCompra;
        valorTotalSugerido += qtdCompra * item.precoCusto;
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
      totalSkus: itensFiltrados.length,
      pecasTotaisSugeridas,
      valorTotalSugerido,
      totalRupturas,
      totalTransferencias,
      totalZumbis,
    };
  }, [itensFiltrados]);

  // 8. Lista de Lojas Formatada para a Barra de Filtros
  const listaLojas = useMemo(() => {
    return Object.entries(NOMES_FILIAIS_CARREIRO).map(([id, nome]) => ({
      id: parseInt(id, 10),
      nome,
    }));
  }, []);

  // 9. Exportar Pedidos para CSV
  const handleExportarCsv = useCallback(() => {
    const itensParaComprar = itensComOverrides.filter(
      (item) => (item.pedidoCustom > 0 || item.sugestaoFinalCompra > 0)
    );

    if (itensParaComprar.length === 0) {
      alert("Nenhum item com quantidade para compra neste filtro.");
      return;
    }

    const cabecalho = "SKU;Descricao;Marca;Fornecedor;QtdSugerida;QtdComprador;PrecoCusto;ValorTotal;Motivo\n";
    const linhasCsv = itensParaComprar
      .map((item) => {
        const qtd = item.pedidoCustom > 0 ? item.pedidoCustom : item.sugestaoFinalCompra;
        const total = (qtd * item.precoCusto).toFixed(2);
        return `"${item.codigoSku}";"${item.descricao}";"${item.marca}";"${item.nomeFornecedor ?? ""}";${item.sugestaoFinalCompra};${qtd};${item.precoCusto.toFixed(2)};${total};"${item.motivoDecisao}"`;
      })
      .join("\n");

    const blob = new Blob([cabecalho + linhasCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `pedido_carreiro_loja${lojaFocoId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [itensComOverrides, lojaFocoId]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-100">
      {/* 1. Header Institucional White-Label */}
      <header className="sticky top-0 z-30 bg-[#0F2B5C] text-white shadow-md border-b border-[#D4AF37]/30">
        <div className="max-w-[1920px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-[#D4AF37] animate-pulse" />
                REDE CARREIRO
              </span>
              <span className="text-xs bg-[#D4AF37] text-slate-900 font-bold px-2 py-0.5 rounded shadow-sm">
                AUTOPEÇAS
              </span>
            </div>
            <span className="hidden sm:inline-block text-slate-400 text-xs">|</span>
            <span className="text-xs text-slate-300 font-medium">
              Copiloto de Inteligência & Decisão de Compras
            </span>
          </div>

          {/* Seletor de Carteira RBAC e Ações de Cabeçalho */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-3 text-xs">
            {/* Seletor de Carteira para demonstração ao vivo de RBAC */}
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

            <button
              onClick={handleExportarCsv}
              className="bg-[#D4AF37] hover:bg-[#B89628] text-slate-950 font-bold px-3 py-1.5 rounded shadow flex items-center gap-1.5 transition-colors"
            >
              📥 Exportar CSV
            </button>

            <Link
              href="/admin/auditoria"
              className="bg-white/15 hover:bg-white/25 text-white font-semibold px-3 py-1.5 rounded border border-white/20 transition-colors flex items-center gap-1.5"
            >
              🛡️ Auditoria do Gestor
            </Link>

            <span className="text-xs text-[#D4AF37] font-semibold hidden md:inline ml-2">
              Powered by iNSIGHT D
            </span>
          </div>
        </div>
      </header>

      {/* 2. Banner de Rascunho de Sessão */}
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
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-slate-500 font-medium uppercase text-[10px]">Total SKUs no Catálogo</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-slate-800">
                {kpis.totalSkus.toLocaleString("pt-BR")}
              </span>
              <span className="text-[11px] text-slate-400">100% Censo</span>
            </div>
          </div>

          {/* Sugestão de Compras */}
          <div className="bg-white p-3 rounded-lg border border-emerald-200 bg-emerald-50/40 shadow-sm flex flex-col justify-between">
            <span className="text-emerald-800 font-semibold uppercase text-[10px]">Sugestão de Compra</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-emerald-700">
                {kpis.pecasTotaisSugeridas.toLocaleString("pt-BR")} un
              </span>
              <span className="text-[11px] font-bold text-emerald-800">
                R$ {kpis.valorTotalSugerido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Rupturas Críticas */}
          <div className="bg-white p-3 rounded-lg border border-rose-200 bg-rose-50/40 shadow-sm flex flex-col justify-between">
            <span className="text-rose-800 font-semibold uppercase text-[10px]">Rupturas no Balcão</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-rose-700">
                {kpis.totalRupturas.toLocaleString("pt-BR")}
              </span>
              <span className="text-[11px] font-medium text-rose-600">Saldo 0 com saída</span>
            </div>
          </div>

          {/* Transferências Seguras */}
          <div className="bg-white p-3 rounded-lg border border-indigo-200 bg-indigo-50/40 shadow-sm flex flex-col justify-between">
            <span className="text-indigo-800 font-semibold uppercase text-[10px]">Transferência Segura</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-indigo-700">
                {kpis.totalTransferencias.toLocaleString("pt-BR")} un
              </span>
              <span className="text-[11px] text-indigo-600 font-medium">Sobra da rede</span>
            </div>
          </div>

          {/* Trava Marca Zumbi */}
          <div className="bg-white p-3 rounded-lg border border-amber-200 bg-amber-50/40 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-amber-800 font-semibold uppercase text-[10px]">Travas Anti-Encalhe</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-amber-700">
                {kpis.totalZumbis.toLocaleString("pt-BR")}
              </span>
              <span className="text-[11px] text-amber-700 font-medium">0 vendas em 180d</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Barra de Filtros Rápidos com Feedback < 250ms */}
      <section className="max-w-[1920px] mx-auto px-4 py-2 w-full">
        <BarraFiltrosCockpit
          queryBusca={rawQuery}
          onQueryChange={setRawQuery}
          statusFiltro={statusFiltro}
          onStatusChange={alterarStatus}
          totalItens={itensComOverrides.length}
          totalFiltrados={itensFiltrados.length}
          contagensStatus={facetas.contagensStatus}
          lojas={listaLojas}
          lojaFocoId={lojaFocoId}
          onLojaFocoChange={setLojaFocoId}
          onLimparFiltros={limparFiltros}
          isPending={isPending}
        />
      </section>

      {/* 5. Grid Cockpit Virtualizado (TanStack Virtual 60fps) */}
      <main className="max-w-[1920px] mx-auto px-4 pb-4 w-full flex-1 flex flex-col">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex-1">
          <GridCockpitVirtualizado
            dados={itensFiltrados}
            onCommitPedido={handleCommitPedido}
            alturaContainer="calc(100vh - 290px)"
          />
        </div>
      </main>
    </div>
  );
}

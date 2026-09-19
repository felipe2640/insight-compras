"use client";

/**
 * Plano de Transferência Inter-Filiais — Visão Consolidada da Rede e por Destino.
 * Camada: Cockpit / Transferências (src/app/transferencias/page.tsx)
 * 100% em Português do Brasil (pt-BR).
 *
 * Exibe o panorama completo de balanceamento entre filiais:
 * 1. Matriz de Envios e Recebimentos (Origem × Destino) para toda a rede.
 * 2. Tabela consolidada de remanejamentos com filtros e tooltips de alto contraste.
 * 3. Ordem de separação detalhada por loja receptora individual.
 *
 * REGRA MANDATÓRIA INVIOLÁVEL:
 * A loja doadora só cede excedente real estritamente acima do seu estoque mínimo
 * de segurança (saldo - minStock > 0). Jamais desabastece a origem.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Loader2,
  AlertTriangle,
  PackageCheck,
  Store,
  Grid3X3,
  ListFilter,
  Search,
  CheckCircle2,
  TrendingUp,
  Boxes,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TooltipTransferencia } from "@/components/tooltips/TooltipTransferencia";
import { useNomesFiliais } from "@/lib/cockpit/contexto-tenant";
import { cn } from "@/lib/utils";

/** Tempo máximo que a tela espera a rede responder (a rota corta em 300 s). */
const LIMITE_CONSULTA_MS = 280_000;

export interface ItemTransferenciaRede {
  readonly id: string;
  readonly produtoId: number;
  readonly codigoSku: string;
  readonly descricao: string;
  readonly marca: string;
  readonly filialOrigemId: number;
  readonly filialOrigemNome: string;
  readonly filialDestinoId: number;
  readonly filialDestinoNome: string;
  readonly quantidade: number;
  readonly precoCusto: number;
  readonly valorTotal: number;
  readonly saldoOrigem: number;
  readonly estoqueMinimoOrigem: number;
  readonly sobraRealOrigem: number;
  readonly saldoOrigemApos: number;
  readonly necessidadeDestino: number;
  readonly motivo?: string;
}

type ModoVisualizacao = "matriz_rede" | "por_loja";

export default function PaginaTransferencias() {
  const nomesFiliais = useNomesFiliais();
  const LOJAS = useMemo(
    () => Object.entries(nomesFiliais).map(([id, nome]) => ({ id: Number(id), nome })),
    [nomesFiliais]
  );

  const [modo, setModo] = useState<ModoVisualizacao>("matriz_rede");
  const [destinoFoco, setDestinoFoco] = useState<number>(1);

  // Estados de dados
  const [todasTransferencias, setTodasTransferencias] = useState<ItemTransferenciaRede[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Filtros da visão consolidada
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroOrigemId, setFiltroOrigemId] = useState<number | "todas">("todas");
  const [filtroDestinoId, setFiltroDestinoId] = useState<number | "todas">("todas");

  /**
   * Carrega os dados de compras e transferências para TODAS as lojas da rede
   * em paralelo, consolidando o panorama completo de remanejamento.
   */
  const carregarDadosRede = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    try {
      const controlador = new AbortController();
      // Um pouco abaixo do maxDuration da rota (300 s), para a tela mostrar a
      // própria mensagem antes de a Vercel cortar a função.
      const limite = window.setTimeout(() => controlador.abort(), LIMITE_CONSULTA_MS);
      try {
        const resposta = await fetch("/api/transferencias", { signal: controlador.signal });
        const corpo = (await resposta.json()) as {
          dados?: ItemTransferenciaRede[];
          mensagem?: string;
        };
        if (!resposta.ok) {
          throw new Error(
            resposta.status === 401
              ? "Sessão expirada."
              : corpo.mensagem ?? `Erro ao consultar transferências (${resposta.status})`
          );
        }
        setTodasTransferencias(corpo.dados ?? []);
      } finally {
        window.clearTimeout(limite);
      }
    } catch (err) {
      setErro(
        err instanceof DOMException && err.name === "AbortError"
          ? "A consulta ao Power BI passou de 4 minutos. Tente novamente em instantes."
          : err instanceof Error
          ? err.message
          : "Sem conexão com o servidor."
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarDadosRede();
  }, [carregarDadosRede]);

  // ==========================================================================
  // CÁLCULOS DA MATRIZ DE REDE (ORIGEM × DESTINO)
  // ==========================================================================

  const matrizRede = useMemo(() => {
    // Mapa: [origemId][destinoId] -> { unidades, valor, itensCount }
    const mapa = new Map<number, Map<number, { unidades: number; valor: number; itensCount: number }>>();

    // Inicializa estrutura
    for (const o of LOJAS) {
      const destinos = new Map<number, { unidades: number; valor: number; itensCount: number }>();
      for (const d of LOJAS) {
        destinos.set(d.id, { unidades: 0, valor: 0, itensCount: 0 });
      }
      mapa.set(o.id, destinos);
    }

    // Popula com transferências reais
    for (const t of todasTransferencias) {
      const destinos = mapa.get(t.filialOrigemId);
      if (destinos) {
        const celula = destinos.get(t.filialDestinoId) ?? { unidades: 0, valor: 0, itensCount: 0 };
        celula.unidades += t.quantidade;
        celula.valor += t.valorTotal;
        celula.itensCount += 1;
        destinos.set(t.filialDestinoId, celula);
      }
    }

    // Totais por linha (enviado por cada loja)
    const totalEnviadoPorLoja = new Map<number, { unidades: number; valor: number }>();
    // Totais por coluna (recebido por cada loja)
    const totalRecebidoPorLoja = new Map<number, { unidades: number; valor: number }>();

    for (const l of LOJAS) {
      totalEnviadoPorLoja.set(l.id, { unidades: 0, valor: 0 });
      totalRecebidoPorLoja.set(l.id, { unidades: 0, valor: 0 });
    }

    for (const [origemId, destinos] of mapa.entries()) {
      for (const [destinoId, celula] of destinos.entries()) {
        const env = totalEnviadoPorLoja.get(origemId)!;
        env.unidades += celula.unidades;
        env.valor += celula.valor;

        const rec = totalRecebidoPorLoja.get(destinoId)!;
        rec.unidades += celula.unidades;
        rec.valor += celula.valor;
      }
    }

    return {
      celulas: mapa,
      totalEnviadoPorLoja,
      totalRecebidoPorLoja,
    };
  }, [todasTransferencias]);

  // KPIs Consolidados
  const kpisRede = useMemo(() => {
    let unidades = 0;
    let valor = 0;
    const doadoras = new Set<number>();
    const receptoras = new Set<number>();

    for (const t of todasTransferencias) {
      unidades += t.quantidade;
      valor += t.valorTotal;
      doadoras.add(t.filialOrigemId);
      receptoras.add(t.filialDestinoId);
    }

    return {
      totalUnidades: unidades,
      totalValor: valor,
      totalItens: todasTransferencias.length,
      qtdDoadoras: doadoras.size,
      qtdReceptoras: receptoras.size,
    };
  }, [todasTransferencias]);

  // Itens filtrados para a tabela consolidada
  const itensFiltrados = useMemo(() => {
    return todasTransferencias.filter((item) => {
      if (filtroOrigemId !== "todas" && item.filialOrigemId !== filtroOrigemId) return false;
      if (filtroDestinoId !== "todas" && item.filialDestinoId !== filtroDestinoId) return false;
      if (termoBusca.trim()) {
        const t = termoBusca.toLowerCase();
        const matchSku = item.codigoSku.toLowerCase().includes(t);
        const matchDesc = item.descricao.toLowerCase().includes(t);
        const matchMarca = item.marca.toLowerCase().includes(t);
        if (!matchSku && !matchDesc && !matchMarca) return false;
      }
      return true;
    });
  }, [todasTransferencias, filtroOrigemId, filtroDestinoId, termoBusca]);

  // Itens agrupados por origem para a visão por loja receptora focada
  const itensPorOrigemNaLojaFoco = useMemo(() => {
    const doDestino = todasTransferencias.filter((t) => t.filialDestinoId === destinoFoco);
    const grupos = new Map<
      string,
      { origemNome: string; itens: ItemTransferenciaRede[]; unidades: number; valor: number }
    >();

    for (const t of doDestino) {
      const g = grupos.get(t.filialOrigemNome) ?? {
        origemNome: t.filialOrigemNome,
        itens: [],
        unidades: 0,
        valor: 0,
      };
      g.itens.push(t);
      g.unidades += t.quantidade;
      g.valor += t.valorTotal;
      grupos.set(t.filialOrigemNome, g);
    }

    return Array.from(grupos.values()).sort((a, b) => b.unidades - a.unidades);
  }, [todasTransferencias, destinoFoco]);

  const nomeLojaFoco = LOJAS.find((l) => l.id === destinoFoco)?.nome ?? `Loja ${destinoFoco}`;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      <AppSidebar />

      <main className="flex flex-1 flex-col overflow-y-auto">
        {/* Cabeçalho da Página */}
        <header className="sticky top-0 z-30 border-b border-secundaria/30 bg-primaria px-6 py-3 text-white shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-sm font-black">
                <ArrowLeftRight className="h-4 w-4 text-secundaria" />
                Transferências Inter-Filiais &amp; Balanceamento de Rede
              </h1>
              <p className="text-xs text-white/80">
                Panorama consolidado de remanejamento seguro entre todas as lojas da rede.
              </p>
            </div>

            {/* Alternador de Modo de Visualização */}
            <div className="flex items-center rounded-lg bg-black/20 p-1 border border-white/20">
              <button
                type="button"
                onClick={() => setModo("matriz_rede")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-bold transition-colors",
                  modo === "matriz_rede"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-white/80 hover:text-white"
                )}
              >
                <Grid3X3 className="h-3.5 w-3.5" />
                Visão Consolidada da Rede
              </button>

              <button
                type="button"
                onClick={() => setModo("por_loja")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-bold transition-colors",
                  modo === "por_loja"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-white/80 hover:text-white"
                )}
              >
                <ListFilter className="h-3.5 w-3.5" />
                Ordem por Loja Receptora
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1300px] space-y-4 p-5 text-xs">
          {erro && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {erro}
            </div>
          )}

          {/* ================================================================= */}
          {/* MODO 1: VISÃO CONSOLIDADA DA REDE (MATRIZ + LISTA GERAL)          */}
          {/* ================================================================= */}
          {modo === "matriz_rede" && (
            <>
              {/* Cards de Métricas da Rede */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="font-semibold">Volume em Trânsito</span>
                    <Boxes className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
                      {carregando ? "—" : kpisRede.totalUnidades.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-xs text-slate-500">unidades</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {kpisRede.totalItens} remanejamento(s) sugerido(s)
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="font-semibold">Economia de Caixa</span>
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                      {carregando
                        ? "—"
                        : kpisRede.totalValor.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Mover estoque sem comprar de fora
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="font-semibold">Lojas Doadoras</span>
                    <ArrowUpRight className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
                      {carregando ? "—" : kpisRede.qtdDoadoras}
                    </span>
                    <span className="text-xs text-slate-500">de {LOJAS.length} lojas</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Possuem excedente acima do giro mínimo
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="font-semibold">Lojas Receptoras</span>
                    <ArrowDownLeft className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
                      {carregando ? "—" : kpisRede.qtdReceptoras}
                    </span>
                    <span className="text-xs text-slate-500">atendidas</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Necessidades sanadas por transferências
                  </p>
                </div>
              </div>

              {/* 1. Matriz Consolidada da Rede (Origem × Destino) */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-bold text-slate-900 dark:text-white">
                      Matriz de Envios e Recebimentos da Rede
                    </span>
                    <span className="text-[11px] text-slate-500">
                      (Linhas = Lojas Doadoras / Colunas = Lojas Receptoras)
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-500">
                    {carregando ? "calculando matriz..." : `${LOJAS.length} lojas mapeadas`}
                  </span>
                </div>

                {carregando ? (
                  <div className="py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                    <p className="mt-2 text-xs">Calculando balanceamento ótimo da rede...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-center">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300">
                            Origem \ Destino
                          </th>
                          {LOJAS.map((dest) => (
                            <th key={dest.id} className="px-3 py-2">
                              <span className="block font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                                {dest.nome}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">Recebe</span>
                            </th>
                          ))}
                          <th className="bg-slate-100/80 px-3 py-2 font-bold text-slate-900 dark:bg-slate-800 dark:text-white">
                            Total Enviado
                          </th>
                          <th className="bg-slate-100/80 px-3 py-2 font-bold text-slate-900 dark:bg-slate-800 dark:text-white">
                            Balanço Líquido
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {LOJAS.map((origem) => {
                          const totalEnv = matrizRede.totalEnviadoPorLoja.get(origem.id) ?? {
                            unidades: 0,
                            valor: 0,
                          };
                          const totalRec = matrizRede.totalRecebidoPorLoja.get(origem.id) ?? {
                            unidades: 0,
                            valor: 0,
                          };
                          const balancoLiquido = totalEnv.unidades - totalRec.unidades;

                          return (
                            <tr
                              key={origem.id}
                              className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                            >
                              {/* Nome da Loja Doadora */}
                              <td className="px-3 py-2 text-left font-semibold text-slate-800 dark:text-slate-200">
                                <span className="flex items-center gap-1.5">
                                  <Store className="h-3.5 w-3.5 text-slate-400" />
                                  <span className="truncate max-w-[160px]">{origem.nome}</span>
                                </span>
                              </td>

                              {/* Células cruzadas: Origem -> Destino */}
                              {LOJAS.map((destino) => {
                                const isMesmaLoja = origem.id === destino.id;
                                const celula =
                                  matrizRede.celulas.get(origem.id)?.get(destino.id) ?? {
                                    unidades: 0,
                                    valor: 0,
                                    itensCount: 0,
                                  };

                                if (isMesmaLoja) {
                                  return (
                                    <td
                                      key={destino.id}
                                      className="bg-slate-50/60 px-3 py-2 text-slate-300 dark:bg-slate-900/40 dark:text-slate-700 select-none"
                                    >
                                      —
                                    </td>
                                  );
                                }

                                if (celula.unidades === 0) {
                                  return (
                                    <td
                                      key={destino.id}
                                      className="px-3 py-2 text-slate-400 font-mono"
                                    >
                                      0
                                    </td>
                                  );
                                }

                                return (
                                  <td
                                    key={destino.id}
                                    className="px-3 py-2 font-mono font-bold"
                                    title={`${origem.nome} -> ${destino.nome}: ${celula.unidades} un em ${celula.itensCount} item(ns)`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFiltroOrigemId(origem.id);
                                        setFiltroDestinoId(destino.id);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 transition-colors"
                                    >
                                      <span>{celula.unidades} un</span>
                                    </button>
                                  </td>
                                );
                              })}

                              {/* Total Enviado pela linha */}
                              <td className="bg-slate-50/40 px-3 py-2 font-mono font-bold text-slate-900 dark:bg-slate-800/30 dark:text-white">
                                {totalEnv.unidades > 0 ? (
                                  <span className="text-indigo-600 dark:text-indigo-400">
                                    {totalEnv.unidades} un
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0</span>
                                )}
                              </td>

                              {/* Balanço Líquido */}
                              <td className="bg-slate-50/40 px-3 py-2 font-mono font-bold dark:bg-slate-800/30">
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[11px]",
                                    balancoLiquido > 0
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                      : balancoLiquido < 0
                                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                      : "text-slate-400"
                                  )}
                                >
                                  {balancoLiquido > 0 ? `+${balancoLiquido}` : balancoLiquido}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 bg-slate-50/90 font-bold dark:border-slate-700 dark:bg-slate-800/80">
                        <tr>
                          <td className="px-3 py-2 text-left text-slate-900 dark:text-white">
                            Total Recebido
                          </td>
                          {LOJAS.map((dest) => {
                            const rec = matrizRede.totalRecebidoPorLoja.get(dest.id)?.unidades ?? 0;
                            return (
                              <td key={dest.id} className="px-3 py-2 font-mono text-slate-900 dark:text-white">
                                {rec > 0 ? (
                                  <span className="text-blue-600 dark:text-blue-400">{rec} un</span>
                                ) : (
                                  <span className="text-slate-400">0</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="bg-slate-100 px-3 py-2 font-mono text-slate-950 dark:bg-slate-800 dark:text-white">
                            {kpisRede.totalUnidades} un
                          </td>
                          <td className="bg-slate-100 px-3 py-2 font-mono text-[11px] text-slate-500 dark:bg-slate-800">
                            Equilíbrio
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* 2. Tabela Detalhada de Remanejamentos da Rede com Tooltips */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                {/* Barra de Filtros da Lista */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Busca por SKU ou Descrição */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={termoBusca}
                        onChange={(e) => setTermoBusca(e.target.value)}
                        placeholder="Buscar SKU, descrição ou marca..."
                        className="rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>

                    {/* Filtro Origem */}
                    <select
                      value={filtroOrigemId}
                      onChange={(e) =>
                        setFiltroOrigemId(
                          e.target.value === "todas" ? "todas" : Number(e.target.value)
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold outline-none dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="todas">Origem: Todas as Lojas</option>
                      {LOJAS.map((l) => (
                        <option key={l.id} value={l.id}>
                          Origem: {l.nome}
                        </option>
                      ))}
                    </select>

                    {/* Filtro Destino */}
                    <select
                      value={filtroDestinoId}
                      onChange={(e) =>
                        setFiltroDestinoId(
                          e.target.value === "todas" ? "todas" : Number(e.target.value)
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold outline-none dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="todas">Destino: Todas as Lojas</option>
                      {LOJAS.map((l) => (
                        <option key={l.id} value={l.id}>
                          Destino: {l.nome}
                        </option>
                      ))}
                    </select>

                    {(filtroOrigemId !== "todas" ||
                      filtroDestinoId !== "todas" ||
                      termoBusca.trim() !== "") && (
                      <button
                        type="button"
                        onClick={() => {
                          setFiltroOrigemId("todas");
                          setFiltroDestinoId("todas");
                          setTermoBusca("");
                        }}
                        className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-500">
                    {itensFiltrados.length} item(ns) encontrado(s)
                  </span>
                </div>

                {/* Tabela de Itens */}
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2 text-left">SKU</th>
                        <th className="px-3 py-2 text-left">Descrição</th>
                        <th className="px-3 py-2 text-left">Marca</th>
                        <th className="px-3 py-2 text-left">Origem (Doadora)</th>
                        <th className="px-3 py-2 text-left">Destino (Receptora)</th>
                        <th className="px-3 py-2 text-center">Enviar</th>
                        <th className="px-3 py-2 text-right">Saldo Origem</th>
                        <th className="px-3 py-2 text-right">Sobra após</th>
                        <th className="px-3 py-2 text-right">Necessidade Destino</th>
                        <th className="px-3 py-2 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {carregando ? (
                        <tr>
                          <td colSpan={10} className="py-10 text-center text-slate-400">
                            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                          </td>
                        </tr>
                      ) : itensFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-10 text-center text-slate-400">
                            Nenhuma transferência atende aos critérios de filtro selecionados.
                          </td>
                        </tr>
                      ) : (
                        itensFiltrados.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 text-xs"
                          >
                            <td className="px-3 py-1.5 font-mono text-slate-800 dark:text-slate-200">
                              {item.codigoSku}
                            </td>
                            <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">
                              <span className="block max-w-[260px] truncate" title={item.descricao}>
                                {item.descricao}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400">
                              {item.marca}
                            </td>
                            <td className="px-3 py-1.5 font-semibold text-indigo-700 dark:text-indigo-400">
                              {item.filialOrigemNome}
                            </td>
                            <td className="px-3 py-1.5 font-semibold text-blue-700 dark:text-blue-400">
                              {item.filialDestinoNome}
                            </td>

                            {/* Quantidade a Enviar com Tooltip de Alto Contraste */}
                            <td className="px-3 py-1.5 text-center">
                              <TooltipTransferencia
                                filialOrigemNome={item.filialOrigemNome}
                                saldoOrigem={item.saldoOrigem}
                                estoqueMinimoOrigem={item.estoqueMinimoOrigem}
                                sobraRealOrigem={item.sobraRealOrigem}
                                filialDestinoNome={item.filialDestinoNome}
                                necessidadeDestino={item.necessidadeDestino}
                                quantidadeTransferirRecomendada={item.quantidade}
                                motivo={item.motivo}
                              >
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono font-bold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 cursor-help"
                                >
                                  <span>{item.quantidade} un</span>
                                  <ArrowLeftRight className="h-3 w-3 text-indigo-400" />
                                </button>
                              </TooltipTransferencia>
                            </td>

                            <td className="px-3 py-1.5 text-right font-mono text-slate-600 dark:text-slate-400">
                              {item.saldoOrigem}
                            </td>

                            <td
                              className={cn(
                                "px-3 py-1.5 text-right font-mono font-semibold",
                                item.saldoOrigemApos < item.estoqueMinimoOrigem
                                  ? "text-rose-600 font-bold"
                                  : "text-emerald-700 dark:text-emerald-400"
                              )}
                              title={`Saldo restante na origem: ${item.saldoOrigemApos} un (mínimo de segurança: ${item.estoqueMinimoOrigem} un)`}
                            >
                              {item.saldoOrigemApos}
                            </td>

                            <td className="px-3 py-1.5 text-right font-mono text-slate-600 dark:text-slate-400">
                              {item.necessidadeDestino}
                            </td>

                            <td className="px-3 py-1.5 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {item.valorTotal.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ================================================================= */}
          {/* MODO 2: ORDEM POR LOJA RECEPTORA (DETALHE POR DESTINO)           */}
          {/* ================================================================= */}
          {modo === "por_loja" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <label className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Loja que recebe (Destino):
                  </span>
                  <select
                    value={destinoFoco}
                    onChange={(e) => setDestinoFoco(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {LOJAS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <span className="text-xs text-slate-500">
                  {carregando
                    ? "carregando..."
                    : `${itensPorOrigemNaLojaFoco.length} loja(s) doadora(s) • ${itensPorOrigemNaLojaFoco
                        .reduce((s, g) => s + g.unidades, 0)
                        .toLocaleString("pt-BR")} un a receber`}
                </span>
              </div>

              {carregando ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                  <p className="mt-2 text-xs">Calculando remanejamentos para {nomeLojaFoco}...</p>
                </div>
              ) : itensPorOrigemNaLojaFoco.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  Nenhuma transferência sugerida para {nomeLojaFoco}. Toda necessidade virou compra externa
                  ou nenhuma outra filial possui excedente real acima do próprio giro mínimo.
                </div>
              ) : (
                itensPorOrigemNaLojaFoco.map((grupo) => (
                  <div
                    key={grupo.origemNome}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-indigo-50/70 px-4 py-2.5 dark:border-slate-800 dark:bg-indigo-950/40">
                      <span className="flex items-center gap-2 font-bold text-indigo-900 dark:text-indigo-200">
                        <Store className="h-4 w-4" />
                        {grupo.origemNome}
                        <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-400" />
                        <span className="text-slate-800 dark:text-slate-200">{nomeLojaFoco}</span>
                      </span>

                      <span className="flex items-center gap-4 font-mono text-indigo-950 dark:text-indigo-200">
                        <span>{grupo.itens.length} item(ns)</span>
                        <span className="font-bold">{grupo.unidades} un</span>
                        <span>
                          {grupo.valor.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </span>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          <tr>
                            <th className="px-3 py-1.5 text-left">SKU</th>
                            <th className="px-3 py-1.5 text-left">Descrição</th>
                            <th className="px-3 py-1.5 text-left">Marca</th>
                            <th className="px-3 py-1.5 text-center">Enviar</th>
                            <th className="px-3 py-1.5 text-right">Saldo Origem</th>
                            <th className="px-3 py-1.5 text-right">Sobra após</th>
                            <th className="px-3 py-1.5 text-right">Falta no Destino</th>
                            <th className="px-3 py-1.5 text-right">Valor Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {grupo.itens.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 text-xs"
                            >
                              <td className="px-3 py-1.5 font-mono text-slate-700 dark:text-slate-300">
                                {item.codigoSku}
                              </td>
                              <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">
                                <span className="block max-w-[300px] truncate" title={item.descricao}>
                                  {item.descricao}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-slate-500">{item.marca}</td>

                              <td className="px-3 py-1.5 text-center">
                                <TooltipTransferencia
                                  filialOrigemNome={item.filialOrigemNome}
                                  saldoOrigem={item.saldoOrigem}
                                  estoqueMinimoOrigem={item.estoqueMinimoOrigem}
                                  sobraRealOrigem={item.sobraRealOrigem}
                                  filialDestinoNome={item.filialDestinoNome}
                                  necessidadeDestino={item.necessidadeDestino}
                                  quantidadeTransferirRecomendada={item.quantidade}
                                  motivo={item.motivo}
                                >
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono font-bold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 cursor-help"
                                  >
                                    <span>{item.quantidade} un</span>
                                    <ArrowLeftRight className="h-3 w-3 text-indigo-400" />
                                  </button>
                                </TooltipTransferencia>
                              </td>

                              <td className="px-3 py-1.5 text-right font-mono text-slate-600 dark:text-slate-400">
                                {item.saldoOrigem}
                              </td>

                              <td
                                className={cn(
                                  "px-3 py-1.5 text-right font-mono font-semibold",
                                  item.saldoOrigemApos < item.estoqueMinimoOrigem
                                    ? "text-rose-600 font-bold"
                                    : "text-emerald-700 dark:text-emerald-400"
                                )}
                                title="Sobra da doadora após envio (mantida acima do mínimo de segurança)"
                              >
                                {item.saldoOrigemApos}
                              </td>

                              <td className="px-3 py-1.5 text-right font-mono text-slate-600 dark:text-slate-400">
                                {item.necessidadeDestino}
                              </td>

                              <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">
                                {item.valorTotal.toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Nota de Governança de Transferências */}
          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="space-y-1">
              <span className="font-bold text-slate-900 dark:text-white">
                Invariante de Proteção da Loja Doadora
              </span>
              <p className="leading-relaxed">
                Transferência inter-filiais vem estritamente antes de compra externa: mover excedente
                interno preserva caixa e estanca o encalhe. A loja doadora só cede peças se possuir
                saldo estritamente acima da sua demanda calculada (
                <code className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                  saldo - minStock &gt; 0
                </code>
                ). Sob nenhuma hipótese o remanejamento causa desabastecimento futuro na filial de origem.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

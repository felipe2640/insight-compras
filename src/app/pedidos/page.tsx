"use client";

/**
 * Histórico de pedidos — o registro do que a rede decidiu comprar.
 *
 * A fonte é a mesma que a exportação já grava: cada clique em exportar guarda
 * item a item o que o comprador decidiu, com loja, usuário, data e custo. Não
 * há lista de exemplo aqui: sem histórico gravado, a tela diz isso.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  PackageCheck,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  FileDown,
  Send,
  CheckCircle2,
  Clock,
  ArrowRight,
  Truck,
  Check,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { cn } from "@/lib/utils";
import { Pedido, ItemPedido, StatusPedido } from "@/lib/pedidos/tipos";
import { ROTULOS_STATUS, obterProximoStatus } from "@/lib/pedidos/ciclo-vida";
import { useNomesFiliais } from "@/lib/cockpit/contexto-tenant";

const dinheiro = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function badgeStatus(status: StatusPedido) {
  switch (status) {
    case "exportado":
      return {
        rotulo: "Exportado",
        cor: "bg-slate-100 text-slate-800 border-slate-300",
        icone: Clock,
      };
    case "enviado":
      return {
        rotulo: "Enviado",
        cor: "bg-amber-100 text-amber-900 border-amber-300",
        icone: Send,
      };
    case "confirmado":
      return {
        rotulo: "Confirmado",
        cor: "bg-blue-100 text-blue-900 border-blue-300",
        icone: CheckCircle2,
      };
    case "recebido":
      return {
        rotulo: "Recebido",
        cor: "bg-emerald-100 text-emerald-900 border-emerald-300",
        icone: Truck,
      };
  }
}

export default function PaginaPedidos() {
  // Nome da loja do CADASTRO do tenant. A coluna dizia "Loja 1", "Loja 2" —
  // número de filial não é como o comprador chama a loja dele.
  const nomesFiliais = useNomesFiliais();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [configurado, setConfigurado] = useState(true);
  const [dias, setDias] = useState(30);
  const [origem, setOrigem] = useState<string>("erp");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [aberto, setAberto] = useState<number | null>(null);
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [carregandoItens, setCarregandoItens] = useState(false);

  // Controle de transição de estado
  const [transitandoId, setTransitandoId] = useState<number | null>(null);
  const [observacaoTransicao, setObservacaoTransicao] = useState<Record<number, string>>({});
  const [feedbackSucesso, setFeedbackSucesso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({
        dias: String(dias),
        origem,
      });
      if (filtroStatus && filtroStatus !== "todos") {
        params.set("status", filtroStatus);
      }

      const r = await fetch(`/api/pedidos/historico?${params.toString()}`);
      const corpo = (await r.json()) as {
        configurado?: boolean;
        pedidos?: Pedido[];
        erro?: string;
      };
      if (!r.ok) {
        setErro(corpo.erro ?? "Falha ao carregar o histórico.");
        return;
      }
      setErro(null);
      setConfigurado(corpo.configurado !== false);
      setPedidos(corpo.pedidos ?? []);
    } catch {
      setErro("Sem conexão com o servidor.");
    } finally {
      setCarregando(false);
    }
  }, [dias, origem, filtroStatus]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function abrir(pedido: Pedido) {
    if (aberto === pedido.id) {
      setAberto(null);
      return;
    }
    setAberto(pedido.id);
    setItens([]);
    setCarregandoItens(true);
    try {
      const r = await fetch(`/api/pedidos/historico?pedidoId=${pedido.id}`);
      const corpo = (await r.json()) as { itens?: ItemPedido[]; pedido?: Pedido };
      setItens(corpo.itens ?? []);
      if (corpo.pedido) {
        setPedidos((prev) =>
          prev.map((item) => (item.id === corpo.pedido!.id ? corpo.pedido! : item))
        );
      }
    } catch {
      setErro("Não foi possível abrir os itens deste pedido.");
    } finally {
      setCarregandoItens(false);
    }
  }

  async function avancarStatus(pedido: Pedido, novoStatus: StatusPedido) {
    setTransitandoId(pedido.id);
    setErro(null);
    setFeedbackSucesso(null);

    const obs = observacaoTransicao[pedido.id] || undefined;

    try {
      const r = await fetch("/api/pedidos/historico", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId: pedido.id,
          novoStatus,
          observacao: obs,
        }),
      });

      const corpo = (await r.json()) as {
        sucesso?: boolean;
        pedido?: Pedido;
        erro?: string;
        mensagem?: string;
      };

      if (!r.ok || !corpo.sucesso || !corpo.pedido) {
        setErro(corpo.erro ?? "Falha ao avançar estado do pedido.");
        return;
      }

      setPedidos((prev) =>
        prev.map((item) => (item.id === corpo.pedido!.id ? corpo.pedido! : item))
      );
      setObservacaoTransicao((prev) => ({ ...prev, [pedido.id]: "" }));
      setFeedbackSucesso(
        `Pedido #${pedido.id} avançado com sucesso para '${ROTULOS_STATUS[novoStatus]}'.`
      );

      setTimeout(() => setFeedbackSucesso(null), 5000);
    } catch {
      setErro("Erro de comunicação ao atualizar o status do pedido.");
    } finally {
      setTransitandoId(null);
    }
  }

  const contagemExportados = pedidos.filter((p) => p.status === "exportado").length;
  const contagemEnviados = pedidos.filter((p) => p.status === "enviado").length;
  const contagemConfirmados = pedidos.filter((p) => p.status === "confirmado").length;
  const contagemRecebidos = pedidos.filter((p) => p.status === "recebido").length;
  const totalItens = pedidos.reduce((s, p) => s + p.totalItens, 0);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 border-b border-secundaria/30 bg-primaria px-4 py-2.5 text-white shadow-md">
          <h1 className="flex items-center gap-2 text-sm font-semibold">
            <PackageCheck className="h-4 w-4 text-secundaria" />
            Ciclo de Vida de Pedidos
          </h1>
          <p className="text-xs text-white/70">
            Rastreabilidade e avanço de estado: Exportado → Enviado → Confirmado → Recebido.
          </p>
        </header>

        <div className="mx-auto w-full max-w-[1280px] space-y-3 p-4 text-xs">
          {!configurado && (
            <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              O histórico de pedidos está temporariamente indisponível para persistência.
            </p>
          )}

          {erro && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {erro}
            </p>
          )}

          {feedbackSucesso && (
            <p
              role="status"
              className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-900 font-semibold shadow-sm"
            >
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              {feedbackSucesso}
            </p>
          )}

          {/* Cards de Resumo do Ciclo de Vida */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div
              onClick={() => setFiltroStatus(filtroStatus === "exportado" ? "todos" : "exportado")}
              className={cn(
                "cursor-pointer rounded-xl border p-3 shadow-sm transition-all",
                filtroStatus === "exportado"
                  ? "border-slate-800 bg-slate-100 ring-2 ring-slate-400"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  1. Exportados
                </span>
                <Clock className="h-4 w-4 text-slate-500" />
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">{contagemExportados}</div>
              <p className="text-[10px] text-slate-400">Aguardando envio ao fornecedor</p>
            </div>

            <div
              onClick={() => setFiltroStatus(filtroStatus === "enviado" ? "todos" : "enviado")}
              className={cn(
                "cursor-pointer rounded-xl border p-3 shadow-sm transition-all",
                filtroStatus === "enviado"
                  ? "border-amber-600 bg-amber-50 ring-2 ring-amber-400"
                  : "border-amber-200 bg-amber-50/50 hover:border-amber-300"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">
                  2. Enviados
                </span>
                <Send className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-1 text-xl font-bold text-amber-900">{contagemEnviados}</div>
              <p className="text-[10px] text-amber-700">Transmitidos ao fornecedor</p>
            </div>

            <div
              onClick={() => setFiltroStatus(filtroStatus === "confirmado" ? "todos" : "confirmado")}
              className={cn(
                "cursor-pointer rounded-xl border p-3 shadow-sm transition-all",
                filtroStatus === "confirmado"
                  ? "border-blue-600 bg-blue-50 ring-2 ring-blue-400"
                  : "border-blue-200 bg-blue-50/50 hover:border-blue-300"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wide">
                  3. Confirmados
                </span>
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-1 text-xl font-bold text-blue-900">{contagemConfirmados}</div>
              <p className="text-[10px] text-blue-700">Aguardando entrega da mercadoria</p>
            </div>

            <div
              onClick={() => setFiltroStatus(filtroStatus === "recebido" ? "todos" : "recebido")}
              className={cn(
                "cursor-pointer rounded-xl border p-3 shadow-sm transition-all",
                filtroStatus === "recebido"
                  ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-400"
                  : "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">
                  4. Recebidos
                </span>
                <Truck className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-1 text-xl font-bold text-emerald-900">{contagemRecebidos}</div>
              <p className="text-[10px] text-emerald-700">Entregues no estoque físico</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setOrigem("erp")}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold transition-all",
                  origem === "erp"
                    ? "bg-white text-blue-900 shadow-xs border border-blue-200"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Pedidos do ERP (Tempo Real)
              </button>
              <button
                type="button"
                onClick={() => setOrigem("exportacao")}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold transition-all",
                  origem === "exportacao"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-300"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Exportações Cockpit
              </button>
              <button
                type="button"
                onClick={() => setOrigem("todos")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                  origem === "todos"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-300"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Todos
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-600">Período</span>
                <select
                  value={dias}
                  onChange={(e) => setDias(Number(e.target.value))}
                  className="rounded border border-slate-300 px-2 py-1 outline-none focus:border-blue-500"
                >
                  <option value={7}>7 dias</option>
                  <option value={30}>30 dias</option>
                  <option value={90}>90 dias</option>
                  <option value={365}>1 ano</option>
                </select>
              </label>

              <label className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-600">Filtro de Estado</span>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 outline-none focus:border-blue-500"
                >
                  <option value="todos">Todos os Estados</option>
                  <option value="exportado">Apenas Exportados</option>
                  <option value="enviado">Apenas Enviados</option>
                  <option value="confirmado">Apenas Confirmados</option>
                  <option value="recebido">Apenas Recebidos</option>
                </select>
              </label>
            </div>

            <span className="text-slate-500 text-[11px]">
              {carregando
                ? "carregando..."
                : `${pedidos.length} pedido(s) listado(s) • ${totalItens.toLocaleString(
                    "pt-BR"
                  )} itens no total`}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {carregando ? (
              <p className="py-8 text-center text-slate-400">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </p>
            ) : pedidos.length === 0 ? (
              <p className="py-8 text-center text-slate-400">
                Nenhum pedido exportado no período. Exporte pelo cockpit para começar o registro.
              </p>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-8 px-2 py-2" />
                    <th className="px-3 py-2 text-left">Pedido / Quando</th>
                    <th className="px-3 py-2 text-left">Comprador</th>
                    <th className="px-3 py-2 text-left">Loja</th>
                    <th className="px-3 py-2 text-left">Modelo & Formato</th>
                    <th className="px-3 py-2 text-right">Itens</th>
                    <th className="px-3 py-2 text-center">Estado Atual</th>
                    <th className="px-3 py-2 text-right">Ação de Ciclo</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((p) => {
                    const expandido = aberto === p.id;
                    const totalValor = itens.reduce((s, i) => s + i.valorTotal, 0);
                    const proximo = obterProximoStatus(p.status);
                    const badge = badgeStatus(p.status);
                    const IconeStatus = badge.icone;
                    const estaTransitando = transitandoId === p.id;

                    return (
                      <React.Fragment key={p.id}>
                        <tr
                          className={cn(
                            "cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50",
                            expandido && "bg-slate-50/90"
                          )}
                          onClick={() => abrir(p)}
                        >
                          <td className="px-2 py-2 text-slate-400">
                            {expandido ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-800">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900">
                                {p.origem === "erp" ? `Pedido ERP #${p.numeroPedidoERP ?? p.id}` : `#${p.id}`}
                              </span>
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider",
                                  p.origem === "erp"
                                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                                    : "bg-slate-100 text-slate-600 border border-slate-200"
                                )}
                              >
                                {p.origem === "erp" ? "ERP Real" : "Exportação"}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 block">
                              {p.dataEmissao ? new Date(p.dataEmissao).toLocaleDateString("pt-BR") : new Date(p.exportadoEm).toLocaleString("pt-BR")}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {p.fornecedorNome ?? p.usuario ?? "ERP Integrado"}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {p.filialNome ?? (p.filialId ? nomesFiliais[p.filialId] ?? `Loja ${p.filialId}` : "—")}
                          </td>
                          <td className="px-3 py-2">
                            {p.origem === "erp" ? (
                              <div>
                                <span className="font-mono font-semibold text-slate-900 block">
                                  {p.valorTotal ? dinheiro(p.valorTotal) : "—"}
                                </span>
                                {p.cotacaoId ? (
                                  <span className="text-[10px] text-blue-700">
                                    Cotação #{p.cotacaoId}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <>
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                  {p.modeloId}
                                </span>
                                <span className="ml-1 text-[10px] uppercase text-slate-400">
                                  {p.formato}
                                </span>
                              </>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">
                            {p.totalItens.toLocaleString("pt-BR")}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold shadow-xs",
                                badge.cor
                              )}
                            >
                              <IconeStatus className="h-3 w-3" />
                              {badge.rotulo}
                            </span>
                          </td>
                          <td
                            className="px-3 py-2 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {proximo ? (
                              <button
                                type="button"
                                disabled={estaTransitando}
                                onClick={() => avancarStatus(p, proximo)}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white transition-all shadow-xs",
                                  proximo === "enviado" && "bg-amber-600 hover:bg-amber-700",
                                  proximo === "confirmado" && "bg-blue-600 hover:bg-blue-700",
                                  proximo === "recebido" && "bg-emerald-600 hover:bg-emerald-700",
                                  estaTransitando && "opacity-60 cursor-not-allowed"
                                )}
                                title={`Avançar para ${ROTULOS_STATUS[proximo]}`}
                              >
                                {estaTransitando ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <span>Avançar</span>
                                    <ArrowRight className="h-3 w-3" />
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Concluído
                              </span>
                            )}
                          </td>
                        </tr>

                        {expandido && (
                          <tr className="border-t border-slate-100 bg-slate-50/60">
                            <td colSpan={8} className="p-4 space-y-4">
                              {/* Stepper Visual de Ciclo de Vida */}
                              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="mb-3 flex items-center justify-between">
                                  <h3 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                                    <PackageCheck className="h-4 w-4 text-primaria" />
                                    Trilha do Ciclo de Vida — Pedido #{p.id}
                                  </h3>
                                  <span className="text-[11px] text-slate-400">
                                    Exportado em {new Date(p.exportadoEm).toLocaleString("pt-BR")}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                                  {/* Etapa 1: Exportado */}
                                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] text-white">
                                        1
                                      </span>
                                      Exportado
                                    </div>
                                    <p className="mt-1 text-[10px] text-slate-600">
                                      {new Date(p.exportadoEm).toLocaleString("pt-BR")}
                                    </p>
                                    <p className="text-[10px] text-slate-500 truncate" title={p.usuario ?? ""}>
                                      Por: {p.usuario ?? "Sistema"}
                                    </p>
                                  </div>

                                  {/* Etapa 2: Enviado */}
                                  <div
                                    className={cn(
                                      "rounded-lg border p-3 transition-colors",
                                      p.enviadoEm
                                        ? "border-amber-200 bg-amber-50/60 text-amber-950"
                                        : p.status === "exportado"
                                        ? "border-amber-300 bg-amber-50/30 text-amber-800 border-dashed"
                                        : "border-slate-200 bg-slate-50 text-slate-400"
                                    )}
                                  >
                                    <div className="flex items-center gap-1.5 font-bold">
                                      <span
                                        className={cn(
                                          "flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white",
                                          p.enviadoEm ? "bg-amber-600" : "bg-slate-300"
                                        )}
                                      >
                                        2
                                      </span>
                                      Enviado ao Fornecedor
                                    </div>
                                    {p.enviadoEm ? (
                                      <>
                                        <p className="mt-1 text-[10px] text-amber-900">
                                          {new Date(p.enviadoEm).toLocaleString("pt-BR")}
                                        </p>
                                        <p className="text-[10px] text-amber-700 truncate" title={p.enviadoPor ?? ""}>
                                          Por: {p.enviadoPor}
                                        </p>
                                      </>
                                    ) : (
                                      <p className="mt-1 text-[10px] italic text-slate-400">
                                        Pendente de envio
                                      </p>
                                    )}
                                  </div>

                                  {/* Etapa 3: Confirmado */}
                                  <div
                                    className={cn(
                                      "rounded-lg border p-3 transition-colors",
                                      p.confirmadoEm
                                        ? "border-blue-200 bg-blue-50/60 text-blue-950"
                                        : p.status === "enviado"
                                        ? "border-blue-300 bg-blue-50/30 text-blue-800 border-dashed"
                                        : "border-slate-200 bg-slate-50 text-slate-400"
                                    )}
                                  >
                                    <div className="flex items-center gap-1.5 font-bold">
                                      <span
                                        className={cn(
                                          "flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white",
                                          p.confirmadoEm ? "bg-blue-600" : "bg-slate-300"
                                        )}
                                      >
                                        3
                                      </span>
                                      Confirmado
                                    </div>
                                    {p.confirmadoEm ? (
                                      <>
                                        <p className="mt-1 text-[10px] text-blue-900">
                                          {new Date(p.confirmadoEm).toLocaleString("pt-BR")}
                                        </p>
                                        <p className="text-[10px] text-blue-700 truncate" title={p.confirmadoPor ?? ""}>
                                          Por: {p.confirmadoPor}
                                        </p>
                                      </>
                                    ) : (
                                      <p className="mt-1 text-[10px] italic text-slate-400">
                                        Aguardando confirmação
                                      </p>
                                    )}
                                  </div>

                                  {/* Etapa 4: Recebido */}
                                  <div
                                    className={cn(
                                      "rounded-lg border p-3 transition-colors",
                                      p.recebidoEm
                                        ? "border-emerald-200 bg-emerald-50/60 text-emerald-950"
                                        : p.status === "confirmado"
                                        ? "border-emerald-300 bg-emerald-50/30 text-emerald-800 border-dashed"
                                        : "border-slate-200 bg-slate-50 text-slate-400"
                                    )}
                                  >
                                    <div className="flex items-center gap-1.5 font-bold">
                                      <span
                                        className={cn(
                                          "flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white",
                                          p.recebidoEm ? "bg-emerald-600" : "bg-slate-300"
                                        )}
                                      >
                                        4
                                      </span>
                                      Recebido no Estoque
                                    </div>
                                    {p.recebidoEm ? (
                                      <>
                                        <p className="mt-1 text-[10px] text-emerald-900">
                                          {new Date(p.recebidoEm).toLocaleString("pt-BR")}
                                        </p>
                                        <p className="text-[10px] text-emerald-700 truncate" title={p.recebidoPor ?? ""}>
                                          Por: {p.recebidoPor}
                                        </p>
                                      </>
                                    ) : (
                                      <p className="mt-1 text-[10px] italic text-slate-400">
                                        Mercadoria a caminho
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Formulário de Avanço com Observação */}
                                {proximo && (
                                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                                    <span className="font-semibold text-slate-700">
                                      Avançar para {ROTULOS_STATUS[proximo]}:
                                    </span>
                                    <input
                                      type="text"
                                      placeholder="Observação / Número de NF-e / Código de rastreio (opcional)"
                                      value={observacaoTransicao[p.id] || ""}
                                      onChange={(e) =>
                                        setObservacaoTransicao({
                                          ...observacaoTransicao,
                                          [p.id]: e.target.value,
                                        })
                                      }
                                      className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500"
                                    />
                                    <button
                                      type="button"
                                      disabled={estaTransitando}
                                      onClick={() => avancarStatus(p, proximo)}
                                      className={cn(
                                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold text-white shadow-xs",
                                        proximo === "enviado" && "bg-amber-600 hover:bg-amber-700",
                                        proximo === "confirmado" && "bg-blue-600 hover:bg-blue-700",
                                        proximo === "recebido" && "bg-emerald-600 hover:bg-emerald-700",
                                        estaTransitando && "opacity-60 cursor-not-allowed"
                                      )}
                                    >
                                      {estaTransitando ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <>
                                          <span>Confirmar Transição</span>
                                          <ArrowRight className="h-3.5 w-3.5" />
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}

                                {/* Histórico de Transições */}
                                {p.historico && p.historico.length > 0 && (
                                  <div className="mt-3 border-t border-slate-100 pt-2 text-[11px]">
                                    <span className="font-semibold text-slate-600">
                                      Histórico de Transições Gravadas:
                                    </span>
                                    <ul className="mt-1 space-y-1">
                                      {p.historico.map((h, idx) => (
                                        <li
                                          key={idx}
                                          className="flex items-center gap-2 text-slate-600 bg-slate-50 px-2 py-1 rounded"
                                        >
                                          <span className="font-mono text-slate-400">
                                            {new Date(h.dataHora).toLocaleString("pt-BR")}
                                          </span>
                                          <span className="font-semibold text-slate-800">
                                            {ROTULOS_STATUS[h.de]} → {ROTULOS_STATUS[h.para]}
                                          </span>
                                          <span className="text-slate-500">
                                            ({h.responsavel})
                                          </span>
                                          {h.observacao && (
                                            <span className="italic text-slate-700">
                                              — &ldquo;{h.observacao}&rdquo;
                                            </span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>

                              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                              {carregandoItens ? (
                                <Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" />
                              ) : itens.length === 0 ? (
                                <p className="text-center text-slate-400">Sem itens neste pedido.</p>
                              ) : (
                                <>
                                  <div className="mb-1 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                                      <FileDown className="h-3.5 w-3.5" />
                                      {itens.length} item(ns)
                                    </span>
                                    <span className="font-mono font-semibold text-slate-800">
                                      {dinheiro(totalValor)}
                                    </span>
                                  </div>
                                  <div className="max-h-72 overflow-y-auto rounded border border-slate-200 bg-white">
                                    <table className="w-full">
                                      <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase text-slate-500">
                                        <tr>
                                          <th className="px-2 py-1 text-left">SKU</th>
                                          <th className="px-2 py-1 text-left">Descrição</th>
                                          <th className="px-2 py-1 text-right">Comprador</th>
                                          <th className="px-2 py-1 text-right">Modelo</th>
                                          <th className="px-2 py-1 text-right">Transf.</th>
                                          <th className="px-2 py-1 text-right">Custo</th>
                                          <th className="px-2 py-1 text-right">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {itens.map((i) => (
                                          <tr key={i.id} className="border-t border-slate-100">
                                            <td className="px-2 py-1 font-mono text-slate-700">{i.sku}</td>
                                            <td className="px-2 py-1 text-slate-600">
                                              <span className="block max-w-[320px] truncate" title={i.descricao ?? ""}>
                                                {i.descricao}
                                              </span>
                                            </td>
                                            <td className="px-2 py-1 text-right font-mono font-semibold text-slate-900">
                                              {i.qtdComprador}
                                            </td>
                                            <td
                                              className={cn(
                                                "px-2 py-1 text-right font-mono",
                                                i.qtdModelo !== null && i.qtdModelo !== i.qtdComprador
                                                  ? "text-amber-700"
                                                  : "text-slate-400"
                                              )}
                                              title="Quantidade que o modelo sugeriu"
                                            >
                                              {i.qtdModelo ?? "—"}
                                            </td>
                                            <td className="px-2 py-1 text-right font-mono text-indigo-700">
                                              {i.qtdTransferencia || "—"}
                                            </td>
                                            <td className="px-2 py-1 text-right font-mono text-slate-600">
                                              {i.custo === null ? "—" : dinheiro(i.custo)}
                                            </td>
                                            <td className="px-2 py-1 text-right font-mono text-slate-800">
                                              {dinheiro(i.valorTotal)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </>
                              )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

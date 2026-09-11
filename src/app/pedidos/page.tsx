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
} from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { cn } from "@/lib/utils";

interface PedidoExportado {
  readonly id: number;
  readonly exportadoEm: string;
  readonly usuario: string | null;
  readonly filialId: number | null;
  readonly modeloId: string;
  readonly formato: string;
  readonly totalItens: number;
}

interface ItemPedidoExportado {
  readonly id: number;
  readonly sku: string | null;
  readonly descricao: string | null;
  readonly qtdComprador: number;
  readonly qtdTransferencia: number;
  readonly qtdModelo: number | null;
  readonly custo: number | null;
  readonly valorTotal: number;
}

const dinheiro = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PaginaPedidos() {
  const [pedidos, setPedidos] = useState<PedidoExportado[]>([]);
  const [configurado, setConfigurado] = useState(true);
  const [dias, setDias] = useState(30);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [aberto, setAberto] = useState<number | null>(null);
  const [itens, setItens] = useState<ItemPedidoExportado[]>([]);
  const [carregandoItens, setCarregandoItens] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/pedidos/historico?dias=${dias}`);
      const corpo = (await r.json()) as {
        configurado?: boolean;
        pedidos?: PedidoExportado[];
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
  }, [dias]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function abrir(pedido: PedidoExportado) {
    if (aberto === pedido.id) {
      setAberto(null);
      return;
    }
    setAberto(pedido.id);
    setItens([]);
    setCarregandoItens(true);
    try {
      const r = await fetch(`/api/pedidos/historico?pedidoId=${pedido.id}`);
      const corpo = (await r.json()) as { itens?: ItemPedidoExportado[] };
      setItens(corpo.itens ?? []);
    } catch {
      setErro("Não foi possível abrir este pedido.");
    } finally {
      setCarregandoItens(false);
    }
  }

  const totalItens = pedidos.reduce((s, p) => s + p.totalItens, 0);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 border-b border-secundaria/30 bg-primaria px-4 py-2.5 text-white shadow-md">
          <h1 className="flex items-center gap-2 text-sm font-semibold">
            <PackageCheck className="h-4 w-4 text-secundaria" />
            Pedidos
          </h1>
          <p className="text-xs text-white/70">
            O que a rede decidiu comprar, gravado a cada exportação.
          </p>
        </header>

        <div className="mx-auto w-full max-w-[1200px] space-y-3 p-4 text-xs">
          {!configurado && (
            <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Histórico não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para
              que cada exportação fique registrada aqui.
            </p>
          )}

          {erro && (
            <p role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {erro}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
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
            <span className="ml-auto text-slate-500">
              {carregando
                ? "carregando..."
                : `${pedidos.length} exportação(ões) • ${totalItens.toLocaleString("pt-BR")} itens`}
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
                    <th className="w-8 px-2 py-1.5" />
                    <th className="px-3 py-1.5 text-left">Quando</th>
                    <th className="px-3 py-1.5 text-left">Quem</th>
                    <th className="px-3 py-1.5 text-left">Loja</th>
                    <th className="px-3 py-1.5 text-left">Modelo</th>
                    <th className="px-3 py-1.5 text-right">Itens</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((p) => {
                    const expandido = aberto === p.id;
                    const totalValor = itens.reduce((s, i) => s + i.valorTotal, 0);
                    return (
                      <React.Fragment key={p.id}>
                        <tr
                          className={cn(
                            "cursor-pointer border-t border-slate-100 hover:bg-slate-50",
                            expandido && "bg-slate-50"
                          )}
                          onClick={() => abrir(p)}
                        >
                          <td className="px-2 py-1.5 text-slate-400">
                            {expandido ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-slate-800">
                            {new Date(p.exportadoEm).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-3 py-1.5 text-slate-700">{p.usuario ?? "—"}</td>
                          <td className="px-3 py-1.5 text-slate-700">
                            {p.filialId ? `Loja ${p.filialId}` : "—"}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              {p.modeloId}
                            </span>
                            <span className="ml-1 text-[10px] uppercase text-slate-400">
                              {p.formato}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-800">
                            {p.totalItens.toLocaleString("pt-BR")}
                          </td>
                        </tr>

                        {expandido && (
                          <tr className="border-t border-slate-100 bg-slate-50/60">
                            <td colSpan={6} className="px-3 py-2">
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

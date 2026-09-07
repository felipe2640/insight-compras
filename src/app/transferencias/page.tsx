"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ArrowLeftRight, Download, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

interface ItemTransferencia {
  id: string;
  sku: string;
  descricao: string;
  lojaOrigem: string;
  lojaDestino: string;
  qtdSugerida: number;
  custoUnitario: number;
  diasSemVendaOrigem: number;
  motivo: string;
  status: "Sugerida" | "Aprovada" | "Emitida";
}

const TRANSFERENCIAS_INICIAIS: ItemTransferencia[] = [
  {
    id: "TRF-001",
    sku: "SKU-PNEU-17",
    descricao: "Pneu Lanvigator Aro 17 Catchfors A/T",
    lojaOrigem: "José de Freitas",
    lojaDestino: "Pedro II (Matriz)",
    qtdSugerida: 4,
    custoUnitario: 598.0,
    diasSemVendaOrigem: 180,
    motivo: "Estoque parado há 180d em JF; ruptura iminente em Pedro II",
    status: "Sugerida",
  },
  {
    id: "TRF-002",
    sku: "SKU-OLEO-5W30",
    descricao: "Óleo Lubrificante 5W30 Sintético Selènia",
    lojaOrigem: "Poranga",
    lojaDestino: "Piripiri",
    qtdSugerida: 120,
    custoUnitario: 36.8,
    diasSemVendaOrigem: 95,
    motivo: "Superávit de 453 un em Poranga; cobrindo pico de safra em Piripiri",
    status: "Sugerida",
  },
  {
    id: "TRF-003",
    sku: "SKU-BAT-MOURA-60",
    descricao: "Bateria Moura 60Ah M60GD Selada",
    lojaOrigem: "Campo Maior",
    lojaDestino: "Poranga",
    qtdSugerida: 6,
    custoUnitario: 419.4,
    diasSemVendaOrigem: 110,
    motivo: "Excesso na filial Campo Maior; abastecendo demanda de baterias em Poranga",
    status: "Aprovada",
  },
  {
    id: "TRF-004",
    sku: "SKU-AMORT-COFAP",
    descricao: "Amortecedor Dianteiro Turbogás Gol G5/G6",
    lojaOrigem: "José de Freitas",
    lojaDestino: "Piripiri",
    qtdSugerida: 8,
    custoUnitario: 185.5,
    diasSemVendaOrigem: 140,
    motivo: "Rebalanceamento de suspensão regional sem necessidade de compra externa",
    status: "Sugerida",
  },
];

export default function PaginaTransferencias() {
  const [lista, setLista] = useState<ItemTransferencia[]>(TRANSFERENCIAS_INICIAIS);

  const totalValor = lista.reduce((acc, t) => acc + t.qtdSugerida * t.custoUnitario, 0);
  const totalPecas = lista.reduce((acc, t) => acc + t.qtdSugerida, 0);

  const handleAprovar = (id: string) => {
    setLista((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "Aprovada" } : item))
    );
  };

  const handleAprovarTodas = () => {
    setLista((prev) => prev.map((item) => ({ ...item, status: "Aprovada" })));
    alert("Todas as transferências sugeridas foram aprovadas com sucesso!");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      <AppSidebar />

      <main className="flex flex-1 flex-col overflow-y-auto">
        {/* Top Header */}
        <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-indigo-600" />
                Transferências Inteligentes Inter-Lojas
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rebalanceamento de capital: transfira peças paradas entre filiais antes de comprar novo estoque do fornecedor.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAprovarTodas}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                Aprovar Todas as Sugestões
              </button>
              <button
                type="button"
                onClick={() => alert("Romaneio de transferência gerado para expedição!")}
                className="flex items-center gap-1.5 rounded-lg bg-[#0F2B5C] px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-[#0A1E40] transition-colors"
              >
                <Download className="h-4 w-4 text-[#D4AF37]" />
                Emitir Romaneio
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/20">
              <span className="text-[11px] font-bold uppercase text-indigo-700 dark:text-indigo-400">
                Transferências Sugeridas
              </span>
              <p className="mt-1 text-2xl font-black text-indigo-700 dark:text-indigo-300">
                {lista.length} rotas
              </p>
              <span className="text-[11px] text-indigo-600">Reaproveitamento de rede</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[11px] font-bold uppercase text-slate-400">Total de Peças Deslocadas</span>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                {totalPecas} un
              </p>
              <span className="text-[11px] text-slate-500">Sem gerar desembolso de caixa</span>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20">
              <span className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                Capital Preservado (Economia de Compra)
              </span>
              <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">
                {totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              <span className="text-[11px] text-emerald-600">Evitou compra externa desnecessária</span>
            </div>
          </div>

          {/* Tabela de Transferências */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40 flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">
                Rotas de Movimentação Recomendadas
              </span>
              <span className="text-xs text-slate-400 font-medium">Prioridade: Peças paradas há mais de 90 dias</span>
            </div>

            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Código</th>
                  <th className="px-4 py-2.5 font-semibold">SKU / Descrição</th>
                  <th className="px-4 py-2.5 font-semibold">Origem (Sobra)</th>
                  <th className="px-4 py-2.5 font-semibold">Destino (Falta)</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Qtd.</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Valor Total</th>
                  <th className="px-4 py-2.5 font-semibold">Motivo do Rebalanceamento</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {lista.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {item.id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-slate-900 dark:text-white block">
                        {item.sku}
                      </span>
                      <span className="text-slate-500 truncate block max-w-xs">{item.descricao}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-amber-700 dark:text-amber-400">
                      {item.lojaOrigem}
                      <span className="block text-[10px] text-slate-400 font-normal">
                        Sem venda há {item.diasSemVendaOrigem}d
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-blue-700 dark:text-blue-400">
                      {item.lojaDestino}
                    </td>
                    <td className="px-4 py-3 font-mono text-center font-bold text-slate-900 dark:text-white">
                      {item.qtdSugerida} un
                    </td>
                    <td className="px-4 py-3 font-mono text-right font-bold text-slate-900 dark:text-white">
                      {(item.qtdSugerida * item.custoUnitario).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-xs">
                      {item.motivo}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          item.status === "Aprovada"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.status === "Sugerida" ? (
                        <button
                          type="button"
                          onClick={() => handleAprovar(item.id)}
                          className="rounded bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 transition-colors"
                        >
                          Aprovar
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-600 font-medium flex items-center justify-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

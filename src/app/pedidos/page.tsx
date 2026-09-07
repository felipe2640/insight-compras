"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { PackageCheck, Download, Filter, CheckCircle2 } from "lucide-react";

const PEDIDOS_AMOSTRA = [
  { id: "PED-2026-001", fornecedor: "COFAP / MAGNETI MARELLI", itens: 42, valorTotal: 48920.5, status: "Pronto para Envio", loja: "Pedro II (Matriz)", data: "07/09/2026" },
  { id: "PED-2026-002", fornecedor: "BATERIAS MOURA S.A.", itens: 18, valorTotal: 34150.0, status: "Aguardando Aprovação", loja: "Poranga", data: "07/09/2026" },
  { id: "PED-2026-003", fornecedor: "SABÓ RETENTORES & JUNTAS", itens: 64, valorTotal: 19830.2, status: "Pronto para Envio", loja: "Piripiri", data: "07/09/2026" },
  { id: "PED-2026-004", fornecedor: "LUBRIFICANTES SELÈNIA / PETRONAS", itens: 25, valorTotal: 27400.0, status: "Aprovado", loja: "Campo Maior", data: "07/09/2026" },
  { id: "PED-2026-005", fornecedor: "MONROE AMORTECEDORES", itens: 31, valorTotal: 38200.0, status: "Aprovado", loja: "José de Freitas", data: "07/09/2026" },
];

export default function PaginaPedidos() {
  const [pedidos, setPedidos] = useState(PEDIDOS_AMOSTRA);

  const totalValor = pedidos.reduce((acc, p) => acc + p.valorTotal, 0);
  const totalItens = pedidos.reduce((acc, p) => acc + p.itens, 0);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      <AppSidebar />

      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-blue-600" />
                Sugestões & Pedidos de Compra Gerados
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Consolidação dos pedidos gerados no cockpit para integração com o ERP da Rede Carreiro.
              </p>
            </div>

            <button
              onClick={() => alert("Arquivo de pedidos exportado com sucesso!")}
              className="flex items-center gap-1.5 rounded-lg bg-[#0F2B5C] px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-[#0A1E40] transition-colors"
            >
              <Download className="h-4 w-4 text-[#D4AF37]" />
              Exportar Lote para o ERP
            </button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[11px] font-bold uppercase text-slate-400">Total de Pedidos Gerados</span>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{pedidos.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[11px] font-bold uppercase text-slate-400">Peças a Comprar</span>
              <p className="mt-1 text-2xl font-black text-blue-600 dark:text-blue-400">{totalItens.toLocaleString("pt-BR")} un</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20">
              <span className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Investimento Total Previsto</span>
              <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">
                {totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </div>

          {/* Tabela de Pedidos */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40 flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">Ordens de Compra por Fornecedor</span>
              <span className="text-xs text-slate-400 font-medium">Atualizado em tempo real</span>
            </div>

            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Nº Pedido</th>
                  <th className="px-4 py-2.5 font-semibold">Fornecedor / Indústria</th>
                  <th className="px-4 py-2.5 font-semibold">Loja Destino</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Itens (SKUs)</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Valor Total</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {pedidos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">{p.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{p.fornecedor}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.loja}</td>
                    <td className="px-4 py-3 font-mono text-center">{p.itens}</td>
                    <td className="px-4 py-3 font-mono text-right font-bold text-slate-900 dark:text-white">
                      {p.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">{p.data}</td>
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

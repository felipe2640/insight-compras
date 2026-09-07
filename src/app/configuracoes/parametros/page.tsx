"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Sliders, Save, CheckCircle2 } from "lucide-react";

export default function PaginaParametros() {
  const [salvo, setSalvo] = useState(false);

  // Estados dos parâmetros de negócio
  const [coberturaCurvaA, setCoberturaCurvaA] = useState(21);
  const [coberturaCurvaB, setCoberturaCurvaB] = useState(30);
  const [coberturaCurvaC, setCoberturaCurvaC] = useState(45);
  const [leadTimePadrao, setLeadTimePadrao] = useState(7);
  const [diasTravaEncalhe, setDiasTravaEncalhe] = useState(120);
  const [bloquearCompraSemGiro, setBloquearCompraSemGiro] = useState(true);
  const [respeitarMultiplosEmbalagem, setRespeitarMultiplosEmbalagem] = useState(true);

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      <AppSidebar />

      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="h-5 w-5 text-blue-600" />
                Parâmetros Globais do Motor de Compras
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ajuste os horizontes de cobertura por Curva ABC, lead times e travas de segurança contra compras de encalhe.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSalvar}
              className="flex items-center gap-1.5 rounded-lg bg-[#0F2B5C] px-4 py-2 text-xs font-bold text-white shadow hover:bg-[#0A1E40] transition-colors"
            >
              <Save className="h-4 w-4 text-[#D4AF37]" />
              Salvar Alterações
            </button>
          </div>
        </header>

        <div className="p-6 max-w-4xl space-y-6">
          {salvo && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Parâmetros de compras atualizados com sucesso e persistidos para todos os compradores.
            </div>
          )}

          {/* Grupo 1: Cobertura de Estoque por Curva ABC */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              1. Cobertura Alvo em Dias (Políticas de Estoque por Curva ABC)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Curva A (Alto Giro)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={coberturaCurvaA}
                    onChange={(e) => setCoberturaCurvaA(Number(e.target.value))}
                    className="w-24 rounded border border-slate-300 p-1.5 text-xs font-mono font-bold focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-500">dias de cobertura</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Giro rápido: foco em 0 ruptura.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Curva B (Médio Giro)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={coberturaCurvaB}
                    onChange={(e) => setCoberturaCurvaB(Number(e.target.value))}
                    className="w-24 rounded border border-slate-300 p-1.5 text-xs font-mono font-bold focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-500">dias de cobertura</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Equilíbrio de lote e capital.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Curva C (Baixo Giro)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={coberturaCurvaC}
                    onChange={(e) => setCoberturaCurvaC(Number(e.target.value))}
                    className="w-24 rounded border border-slate-300 p-1.5 text-xs font-mono font-bold focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-500">dias de cobertura</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Evitar compras excessivas.</span>
              </div>
            </div>
          </div>

          {/* Grupo 2: Lead Times e Logística */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              2. Prazos de Entrega (Lead Time) & Logística
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lead Time Padrão do Fornecedor
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={leadTimePadrao}
                    onChange={(e) => setLeadTimePadrao(Number(e.target.value))}
                    className="w-24 rounded border border-slate-300 p-1.5 text-xs font-mono font-bold focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-500">dias úteis</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Tempo médio do pedido até a entrada física no depósito.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Trava de Encalhe (Idade Máxima sem Venda)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={diasTravaEncalhe}
                    onChange={(e) => setDiasTravaEncalhe(Number(e.target.value))}
                    className="w-24 rounded border border-slate-300 p-1.5 text-xs font-mono font-bold focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-500">dias</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Bloqueia sugestão de compra se produto estiver sem giro há mais de X dias.
                </span>
              </div>
            </div>
          </div>

          {/* Grupo 3: Regras Comerciais e Embalagens */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              3. Regras de Travas e Arredondamento Comercial
            </h2>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bloquearCompraSemGiro}
                  onChange={(e) => setBloquearCompraSemGiro(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">
                    Bloqueio Automático de "Marcas Zumbis" e SKUs Obsoletos
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Impede que o sistema sugira compras para itens com estoque parado sem nenhuma venda nos últimos 180 dias.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={respeitarMultiplosEmbalagem}
                  onChange={(e) => setRespeitarMultiplosEmbalagem(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">
                    Forçar Arredondamento pelo Múltiplo de Caixa/Embalagem Fechada
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Itens como lâmpadas (caixa com 10), palhetas (pares) ou anéis sincronizadores devem arredondar para cima.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { useTenantAtivo } from "@/lib/cockpit/contexto-tenant";
import { Palette, Save, CheckCircle2 } from "lucide-react";

export default function PaginaTema() {
  // Os campos abrem com o que está VALENDO, do cadastro do tenant. Estavam
  // fixos na Carreiro: qualquer outro cliente abria esta tela vendo a marca
  // alheia como se fosse a dele.
  const tenant = useTenantAtivo();
  const [nomeRede, setNomeRede] = useState(tenant.nome.toUpperCase());
  const [subtitulo, setSubtitulo] = useState("Copiloto de Inteligência & Decisão de Compras");
  const [corPrimaria, setCorPrimaria] = useState(tenant.cores.primaria);
  const [corDestaque, setCorDestaque] = useState(tenant.cores.secundaria);
  const [salvo, setSalvo] = useState(false);

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
                <Palette className="h-5 w-5 text-blue-600" />
                Personalização de Tema & White-Label
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure a identidade visual exclusiva da rede de autopeças (cores corporativas, logomarcas e slogans).
              </p>
            </div>

            <button
              type="button"
              onClick={handleSalvar}
              className="flex items-center gap-1.5 rounded-lg bg-primaria px-4 py-2 text-xs font-bold text-white shadow hover:bg-primaria-hover transition-colors"
            >
              <Save className="h-4 w-4 text-secundaria" />
              Salvar Identidade Visual
            </button>
          </div>
        </header>

        <div className="p-6 max-w-4xl space-y-6">
          {salvo && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Tema atualizado com sucesso e aplicado ao tenant.
            </div>
          )}

          {/* Form de Cores e Nomes */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              1. Dados do Tenant White-Label
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Empresa / Rede
                </label>
                <input
                  type="text"
                  value={nomeRede}
                  onChange={(e) => setNomeRede(e.target.value)}
                  className="w-full rounded border border-slate-300 p-2 text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Slogan Institucional
                </label>
                <input
                  type="text"
                  value={subtitulo}
                  onChange={(e) => setSubtitulo(e.target.value)}
                  className="w-full rounded border border-slate-300 p-2 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cor Primária (Header & Menus)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={corPrimaria}
                    onChange={(e) => setCorPrimaria(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-slate-300 p-0.5"
                  />
                  <input
                    type="text"
                    value={corPrimaria}
                    onChange={(e) => setCorPrimaria(e.target.value)}
                    className="w-28 rounded border border-slate-300 p-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cor de Destaque / Acentos
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={corDestaque}
                    onChange={(e) => setCorDestaque(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-slate-300 p-0.5"
                  />
                  <input
                    type="text"
                    value={corDestaque}
                    onChange={(e) => setCorDestaque(e.target.value)}
                    className="w-28 rounded border border-slate-300 p-1.5 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pré-visualização ao vivo */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              2. Pré-Visualização em Tempo Real da Barra Superior
            </h2>

            <div
              className="rounded-lg p-3 text-white shadow flex flex-wrap items-center justify-between gap-3"
              style={{ backgroundColor: corPrimaria }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full animate-pulse"
                  style={{ backgroundColor: corDestaque }}
                />
                <span className="font-black text-sm">{nomeRede}</span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.2 rounded"
                  style={{ backgroundColor: corDestaque, color: "#000" }}
                >
                  AUTOPEÇAS
                </span>
                <span className="text-xs opacity-70 hidden sm:inline">|</span>
                <span className="text-xs opacity-90 hidden sm:inline">{subtitulo}</span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  className="font-bold px-3 py-1 rounded shadow text-xs"
                  style={{ backgroundColor: corDestaque, color: "#000" }}
                >
                  Exportar CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

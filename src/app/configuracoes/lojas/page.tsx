"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Building2, CheckCircle2, MapPin, Save } from "lucide-react";

interface Filial {
  id: number;
  nome: string;
  cidade: string;
  uf: string;
  tipo: "Matriz / Hub" | "Filial";
  ativa: boolean;
  leadTimeAbastecimentoDias: number;
  prioridadeRecepcao: number;
}

const FILIAIS_INICIAIS: Filial[] = [
  { id: 1, nome: "Pedro II", cidade: "Pedro II", uf: "PI", tipo: "Matriz / Hub", ativa: true, leadTimeAbastecimentoDias: 3, prioridadeRecepcao: 1 },
  { id: 2, nome: "Poranga", cidade: "Poranga", uf: "CE", tipo: "Filial", ativa: true, leadTimeAbastecimentoDias: 5, prioridadeRecepcao: 2 },
  { id: 3, nome: "Piripiri", cidade: "Piripiri", uf: "PI", tipo: "Filial", ativa: true, leadTimeAbastecimentoDias: 4, prioridadeRecepcao: 1 },
  { id: 4, nome: "Campo Maior", cidade: "Campo Maior", uf: "PI", tipo: "Filial", ativa: true, leadTimeAbastecimentoDias: 4, prioridadeRecepcao: 2 },
  { id: 5, nome: "José de Freitas", cidade: "José de Freitas", uf: "PI", tipo: "Filial", ativa: true, leadTimeAbastecimentoDias: 4, prioridadeRecepcao: 3 },
];

export default function PaginaLojas() {
  const [filiais, setFiliais] = useState<Filial[]>(FILIAIS_INICIAIS);
  const [salvo, setSalvo] = useState(false);

  const toggleAtiva = (id: number) => {
    setFiliais((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ativa: !f.ativa } : f))
    );
  };

  const handleSalvar = () => {
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
                <Building2 className="h-5 w-5 text-blue-600" />
                Lojas & Filiais da Rede
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gerenciamento dos pontos de venda, tempos de trânsito inter-lojas e centros de distribuição.
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

        <div className="p-6 max-w-5xl space-y-6">
          {salvo && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Configurações de lojas salvas com sucesso.
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Nome da Filial</th>
                  <th className="px-4 py-3 font-semibold">Cidade / UF</th>
                  <th className="px-4 py-3 font-semibold">Classificação</th>
                  <th className="px-4 py-3 font-semibold text-center">Lead Time de Trânsito</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                  <th className="px-4 py-3 font-semibold text-center">Ativa no Cockpit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filiais.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                      #{f.id}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-blue-600" />
                      {f.nome}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {f.cidade} - {f.uf}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 border">
                        {f.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {f.leadTimeAbastecimentoDias} dias
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          f.ativa
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {f.ativa ? "Operação Ativa" : "Pausada"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleAtiva(f.id)}
                        className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          f.ativa
                            ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {f.ativa ? "Desativar" : "Ativar"}
                      </button>
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

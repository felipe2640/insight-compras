"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Users, ShieldCheck, UserPlus, CheckCircle2 } from "lucide-react";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: "Gestor Geral" | "Comprador Especialista";
  carteira: string;
  fornecedoresAtribuidos: string[];
  ativo: boolean;
}

const USUARIOS_INICIAIS: Usuario[] = [
  {
    id: "USR-001",
    nome: "Felipe Barbosa",
    email: "felipe@redecarreiro.com.br",
    papel: "Gestor Geral",
    carteira: "Todas as Linhas (Visão Executiva)",
    fornecedoresAtribuidos: ["Acesso Global / Irrestrito"],
    ativo: true,
  },
  {
    id: "USR-002",
    nome: "Carlos Eduardo (Comprador)",
    email: "carlos.compras@redecarreiro.com.br",
    papel: "Comprador Especialista",
    carteira: "Suspensão, Freios & Direção",
    fornecedoresAtribuidos: ["Cofap", "Monroe", "Nakata", "Fras-le", "TRW"],
    ativo: true,
  },
  {
    id: "USR-003",
    nome: "Mariana Souza (Compradora)",
    email: "mariana.compras@redecarreiro.com.br",
    papel: "Comprador Especialista",
    carteira: "Motor, Câmbio & Injeção",
    fornecedoresAtribuidos: ["Mahle", "Bosch", "Magneti Marelli", "Sabó", "Metal Leve"],
    ativo: true,
  },
  {
    id: "USR-004",
    nome: "Rafael Lima (Comprador)",
    email: "rafael.compras@redecarreiro.com.br",
    papel: "Comprador Especialista",
    carteira: "Baterias, Lubrificantes & Pneus",
    fornecedoresAtribuidos: ["Baterias Moura", "Heliar", "Petronas Selènia", "Pirelli", "Lanvigator"],
    ativo: true,
  },
];

export default function PaginaUsuarios() {
  const [usuarios] = useState<Usuario[]>(USUARIOS_INICIAIS);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      <AppSidebar />

      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Usuários & Carteiras de Compras (RBAC)
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Segurança e segregação de funções: cada comprador visualiza e atua apenas sobre as marcas e fornecedores de sua carteira.
              </p>
            </div>

            <button
              type="button"
              onClick={() => alert("Modal de cadastro de novo comprador.")}
              className="flex items-center gap-1.5 rounded-lg bg-[#0F2B5C] px-4 py-2 text-xs font-bold text-white shadow hover:bg-[#0A1E40] transition-colors"
            >
              <UserPlus className="h-4 w-4 text-[#D4AF37]" />
              Novo Usuário
            </button>
          </div>
        </header>

        <div className="p-6 max-w-5xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {usuarios.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {u.id}
                      </span>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        {u.nome}
                      </h2>
                      <span className="text-xs text-slate-500">{u.email}</span>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        u.papel === "Gestor Geral"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      }`}
                    >
                      {u.papel}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Carteira Operacional:
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {u.carteira}
                    </p>
                  </div>

                  <div className="mt-3">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Fornecedores Autorizados:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {u.fornecedoresAtribuidos.map((f, i) => (
                        <span
                          key={i}
                          className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Acesso Ativo
                  </span>
                  <button
                    type="button"
                    onClick={() => alert(`Editar permissões de ${u.nome}`)}
                    className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Editar Carteira
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, Mail, Building2, Sparkles } from "lucide-react";

export default function PaginaLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("felipe@carreiro.com.br");
  const [senha, setSenha] = useState("********");
  const [perfil, setPerfil] = useState("GESTOR");
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setTimeout(() => {
      router.push("/compras");
    }, 400);
  };

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950 items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header do Tenant */}
        <div className="bg-[#0F2B5C] p-6 text-center text-white border-b border-[#D4AF37]/30">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-[#D4AF37] text-slate-950 font-black text-xl mb-2 shadow-md">
            RC
          </div>
          <h1 className="text-xl font-black tracking-tight flex items-center justify-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#D4AF37] animate-pulse" />
            REDE CARREIRO AUTOPEÇAS
          </h1>
          <p className="text-xs text-slate-300 mt-1 font-medium">
            iNSIGHT D — Copiloto de Inteligência & Decisão de Compras
          </p>
        </div>

        {/* Formulário de Login */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-200">
              Tenant / Organização
            </label>
            <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Building2 className="h-4 w-4 text-slate-400 mr-2" />
              <span className="font-semibold">carreiro.insightd.com.br</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-200">
              E-mail Corporativo
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="seu.email@empresa.com.br"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-200">
              Senha de Acesso
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-200">
              Perfil / Carteira (Demonstração RBAC)
            </label>
            <select
              value={perfil}
              onChange={(e) => setPerfil(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="GESTOR">Gestor Geral (Acesso Completo a Todas as Lojas)</option>
              <option value="COMPRADOR_SUSPENSAO">Comprador: Suspensão & Freios</option>
              <option value="COMPRADOR_MOTOR">Comprador: Motor & Injeção</option>
              <option value="COMPRADOR_ELETRICA">Comprador: Baterias & Lubrificantes</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-lg bg-[#0F2B5C] py-2.5 font-bold text-white shadow hover:bg-[#0A1E40] transition-colors flex items-center justify-center gap-2"
          >
            {carregando ? (
              <span>Autenticando...</span>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 text-[#D4AF37]" />
                <span>Entrar no Copiloto de Compras</span>
              </>
            )}
          </button>
        </form>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 dark:bg-slate-800/40 dark:border-slate-800 text-[11px] text-slate-500 text-center">
          Autenticação segura multi-tenant com auditoria SHA-256 e RBAC estrito.
        </div>
      </div>
    </div>
  );
}

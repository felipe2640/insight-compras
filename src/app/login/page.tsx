"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Lock, User, Building2 } from "lucide-react";

function FormularioLogin() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const proximo = (() => {
    const n = parametros.get("next");
    return n && n.startsWith("/") && !n.startsWith("//") ? n : "/compras";
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const r = await fetch("/api/auth/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, senha }),
      });
      const corpo = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) {
        setErro(corpo.erro ?? "Não foi possível entrar.");
        return;
      }
      router.push(proximo);
      router.refresh();
    } catch {
      setErro("Sem conexão com o servidor.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
      <div className="space-y-1">
        <label className="font-semibold text-slate-700">Organização</label>
        <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700">
          <Building2 className="h-4 w-4 text-slate-400 mr-2" />
          <span className="font-semibold">Rede Carreiro Autopeças</span>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="usuario" className="font-semibold text-slate-700">Usuário</label>
        <div className="relative">
          <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="usuario"
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="seu.usuario"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="senha" className="font-semibold text-slate-700">Senha</label>
        <div className="relative">
          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="senha"
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>
      </div>

      {erro && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={carregando}
        className="w-full rounded-lg bg-[#0F2B5C] py-2.5 font-bold text-white shadow hover:bg-[#0A1E40] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {carregando ? (
          <span>Autenticando...</span>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4 text-[#D4AF37]" />
            <span>Entrar</span>
          </>
        )}
      </button>
    </form>
  );
}

export default function PaginaLogin() {
  return (
    <div className="flex min-h-screen bg-slate-100 items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="bg-[#0F2B5C] p-6 text-center text-white border-b border-[#D4AF37]/30">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-[#D4AF37] text-slate-950 font-black text-xl mb-2 shadow-md">
            RC
          </div>
          <h1 className="text-xl font-black tracking-tight">REDE CARREIRO AUTOPEÇAS</h1>
          <p className="text-xs text-slate-300 mt-1 font-medium">iNSIGHT D — Copiloto de Inteligência & Decisão de Compras</p>
        </div>
        <Suspense fallback={<div className="p-6 text-xs text-slate-500">Carregando…</div>}>
          <FormularioLogin />
        </Suspense>
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-[11px] text-slate-500 text-center">
          Acesso por usuário e senha. O papel e a carteira vêm do cadastro, não da tela.
        </div>
      </div>
    </div>
  );
}

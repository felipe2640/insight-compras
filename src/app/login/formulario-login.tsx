"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Lock, User, Building2 } from "lucide-react";
// Identidade injetada pelo servidor (layout raiz). Sem TENANT_ATIVO
// configurado é a demonstração, e nenhum nome de rede real aparece na tela.
import { useTenantAtivo } from "@/lib/cockpit/contexto-tenant";

export function FormularioLogin() {
  const tenantNome = useTenantAtivo().nome;
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
          <span className="font-semibold">{tenantNome}</span>
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

"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, Lock, User, Building2, Loader2, CheckCircle2 } from "lucide-react";
// Identidade injetada pelo servidor (layout raiz). Sem TENANT_ATIVO
// configurado é a demonstração, e nenhum nome de rede real aparece na tela.
import { useTenantAtivo } from "@/lib/cockpit/contexto-tenant";

type EstadoLogin = "ocioso" | "autenticando" | "conectado";

export function FormularioLogin() {
  const tenantNome = useTenantAtivo().nome;
  const parametros = useSearchParams();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoLogin>("ocioso");

  const proximo = (() => {
    const n = parametros.get("next");
    return n && n.startsWith("/") && !n.startsWith("//") ? n : "/compras";
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (estado !== "ocioso") return;
    setErro(null);
    setEstado("autenticando");

    try {
      const r = await fetch("/api/auth/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, senha }),
      });
      const corpo = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) {
        setErro(corpo.erro ?? "Não foi possível entrar.");
        setEstado("ocioso");
        return;
      }

      // Feedback imediato e visualmente inequívoco: conectado com sucesso!
      setEstado("conectado");

      // Usar window.location.assign garante que o novo documento receba o cookie
      // HttpOnly de forma limpa, ativando o indicador nativo do navegador
      // e eliminando race conditions entre o router cache e os Server Components.
      window.location.assign(proximo);
    } catch {
      setErro("Sem conexão com o servidor.");
      setEstado("ocioso");
    }
  };

  const desabilitado = estado !== "ocioso";

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-xs"
    >
      <div className="space-y-1">
        <label className="font-semibold text-slate-700">Organização</label>
        <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700">
          <Building2 className="h-4 w-4 text-slate-400 mr-2" />
          <span className="font-semibold">{tenantNome}</span>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="usuario" className="font-semibold text-slate-700">
          Usuário
        </label>
        <div className="relative">
          <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="usuario"
            type="text"
            required
            disabled={desabilitado}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            placeholder="seu.usuario"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="senha" className="font-semibold text-slate-700">
          Senha
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="senha"
            type="password"
            required
            disabled={desabilitado}
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            placeholder="••••••••"
          />
        </div>
      </div>

      {erro && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
          {erro}
        </p>
      )}

      {estado === "conectado" && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-emerald-800 animate-in fade-in duration-200"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <div>
            <p className="font-semibold text-xs">Conectado com sucesso!</p>
            <p className="text-[11px] text-emerald-700">Carregando dados da plataforma...</p>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={desabilitado}
        className={`w-full rounded-lg py-2.5 font-bold text-white shadow transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed ${
          estado === "conectado"
            ? "bg-emerald-600 hover:bg-emerald-600 cursor-wait"
            : estado === "autenticando"
            ? "bg-primaria opacity-80 cursor-wait"
            : "bg-primaria hover:bg-primaria-hover cursor-pointer"
        }`}
      >
        {estado === "autenticando" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-white" />
            <span>Verificando credenciais...</span>
          </>
        ) : estado === "conectado" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-emerald-200" />
            <span>Entrando na plataforma...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4 text-secundaria" />
            <span>Entrar</span>
          </>
        )}
      </button>
    </form>
  );
}

"use client";

/**
 * Cadastro e gestão de usuários — a fonte é o provedor de autenticação, não uma lista
 * fixa no código. Só administrador entra aqui.
 *
 * A plataforma NÃO pede e-mail: a identidade é o nome de usuário. A senha
 * inicial é escolhida por quem cria e mostrada uma única vez, para ser entregue
 * à pessoa; ela não fica guardada em lugar nenhum daqui.
 *
 * Inclui:
 * - Desativação e reativação de usuários pelo administrador.
 * - Troca de senha da própria conta conectada.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Users,
  ShieldCheck,
  UserPlus,
  Loader2,
  AlertTriangle,
  Check,
  KeyRound,
  UserX,
  UserCheck,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { cn } from "@/lib/utils";

interface UsuarioCadastrado {
  readonly id: string;
  readonly usuario: string;
  readonly nome: string;
  readonly papel: "COMPRADOR" | "GESTOR" | "ADMIN";
  readonly tenantId: string;
  readonly fornecedores: readonly number[] | null;
  readonly criadoEm: string;
  readonly ativo?: boolean;
}

const ROTULO_PAPEL: Record<UsuarioCadastrado["papel"], string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor da Rede",
  COMPRADOR: "Comprador",
};

export default function PaginaUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioCadastrado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Formulário de Criação
  const [usuario, setUsuario] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<UsuarioCadastrado["papel"]>("COMPRADOR");
  const [fornecedores, setFornecedores] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [criado, setCriado] = useState<string | null>(null);

  // Ação de Desativação / Reativação
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);

  // Formulário de Troca de Senha Própria
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [sucessoSenha, setSucessoSenha] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch("/api/admin/usuarios");
      const corpo = (await r.json()) as { usuarios?: UsuarioCadastrado[]; erro?: string };
      if (!r.ok) {
        setErro(corpo.erro ?? (r.status === 403 ? "Só administrador acessa esta tela." : "Falha ao carregar."));
        setUsuarios([]);
        return;
      }
      setErro(null);
      setUsuarios(corpo.usuarios ?? []);
    } catch {
      setErro("Sem conexão com o servidor.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    setCriado(null);
    try {
      const lista = fornecedores
        .split(",")
        .map((v) => parseInt(v.trim(), 10))
        .filter((n) => Number.isInteger(n) && n > 0);

      const r = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario,
          nome,
          senha,
          papel,
          fornecedores: lista.length > 0 ? lista : null,
        }),
      });
      const corpo = (await r.json()) as { erro?: string };
      if (!r.ok) {
        setErro(corpo.erro ?? "Não foi possível criar.");
        return;
      }
      setCriado(usuario);
      setUsuario("");
      setNome("");
      setSenha("");
      setFornecedores("");
      await carregar();
    } catch {
      setErro("Sem conexão com o servidor.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarStatusUsuario(u: UsuarioCadastrado) {
    const acao = u.ativo === false ? "reativar" : "desativar";
    const confirmacao = window.confirm(
      `Deseja realmente ${acao} o acesso do usuário "${u.usuario}"?`
    );
    if (!confirmacao) return;

    setProcessandoId(u.id);
    setFeedbackStatus(null);
    try {
      const r = await fetch("/api/admin/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, acao }),
      });
      const corpo = (await r.json()) as { erro?: string; sucesso?: boolean };
      if (!r.ok) {
        setErro(corpo.erro ?? `Não foi possível ${acao} o usuário.`);
        return;
      }
      setFeedbackStatus(`Usuário ${u.usuario} foi ${acao === "desativar" ? "desativado" : "reativado"} com sucesso.`);
      await carregar();
    } catch {
      setErro("Falha de conexão com o servidor.");
    } finally {
      setProcessandoId(null);
    }
  }

  async function alterarPropriaSenha(e: React.FormEvent) {
    e.preventDefault();
    setErroSenha(null);
    setSucessoSenha(null);

    if (novaSenha !== confirmarNovaSenha) {
      setErroSenha("A confirmação da nova senha não confere.");
      return;
    }
    if (novaSenha.length < 8) {
      setErroSenha("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }

    setSalvandoSenha(true);
    try {
      const r = await fetch("/api/auth/alterar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });
      const corpo = (await r.json()) as { erro?: string; sucesso?: boolean; mensagem?: string };
      if (!r.ok) {
        setErroSenha(corpo.erro ?? "Não foi possível alterar a senha.");
        return;
      }
      setSucessoSenha(corpo.mensagem ?? "Senha alterada com sucesso.");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarNovaSenha("");
    } catch {
      setErroSenha("Erro ao comunicar com o servidor.");
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 border-b border-[#D4AF37]/30 bg-[#0F2B5C] px-4 py-2.5 text-white shadow-md">
          <h1 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-[#D4AF37]" />
            Usuários &amp; Carteiras
          </h1>
          <p className="text-xs text-white/70">
            Acesso por usuário e senha. Sem e-mail: a identidade é o nome de usuário.
          </p>
        </header>

        <div className="mx-auto w-full max-w-[1100px] space-y-4 p-4 text-xs">
          {erro && (
            <p role="alert" className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {erro}
            </p>
          )}

          {criado && (
            <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-900">
              <Check className="h-4 w-4 shrink-0" />
              Usuário <strong>{criado}</strong> criado. Entregue a senha à pessoa: ela não fica guardada aqui.
            </p>
          )}

          {feedbackStatus && (
            <p role="status" className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-blue-900">
              <Check className="h-4 w-4 shrink-0 text-blue-600" />
              {feedbackStatus}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Formulário de Novo Usuário */}
            <form
              onSubmit={criarUsuario}
              className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 lg:col-span-2"
            >
              <div className="sm:col-span-2 flex items-center gap-2 font-semibold text-slate-800 border-b border-slate-100 pb-2">
                <UserPlus className="h-4 w-4 text-blue-600" />
                Novo usuário
              </div>

              <label className="space-y-1">
                <span className="font-semibold text-slate-600">Usuário</span>
                <input
                  required
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="carlos.eduardo"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 outline-none focus:border-blue-500"
                />
                <span className="block text-[10px] text-slate-400">
                  minúsculas, números, ponto, hífen ou sublinhado
                </span>
              </label>

              <label className="space-y-1">
                <span className="font-semibold text-slate-600">Nome de exibição</span>
                <input
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Carlos Eduardo"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 outline-none focus:border-blue-500"
                />
              </label>

              <label className="space-y-1">
                <span className="font-semibold text-slate-600">Senha inicial</span>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 outline-none focus:border-blue-500"
                />
                <span className="block text-[10px] text-slate-400">mínimo 8 caracteres</span>
              </label>

              <label className="space-y-1">
                <span className="font-semibold text-slate-600">Papel</span>
                <select
                  value={papel}
                  onChange={(e) => setPapel(e.target.value as UsuarioCadastrado["papel"])}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 outline-none focus:border-blue-500"
                >
                  <option value="COMPRADOR">Comprador</option>
                  <option value="GESTOR">Gestor da Rede</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>

              <label className="space-y-1 sm:col-span-2">
                <span className="font-semibold text-slate-600">Carteira de fornecedores</span>
                <input
                  value={fornecedores}
                  onChange={(e) => setFornecedores(e.target.value)}
                  placeholder="códigos separados por vírgula (vazio = sem fornecedores)"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 outline-none focus:border-blue-500"
                />
                <span className="block text-[10px] text-slate-400">
                  Comprador sem carteira não enxerga fornecedor nenhum (falha fechada).
                </span>
              </label>

              <div className="sm:col-span-2 pt-1">
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex items-center gap-2 rounded-lg bg-[#0F2B5C] px-3 py-1.5 font-bold text-white hover:bg-[#0A1E40] disabled:opacity-60"
                >
                  {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                  Criar usuário
                </button>
              </div>
            </form>

            {/* Formulário de Troca da Própria Senha */}
            <form
              onSubmit={alterarPropriaSenha}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-semibold text-slate-800 border-b border-slate-100 pb-2">
                  <KeyRound className="h-4 w-4 text-[#D4AF37]" />
                  Minha Senha
                </div>

                {erroSenha && (
                  <p className="rounded bg-rose-50 p-2 text-[11px] text-rose-800 border border-rose-200">
                    {erroSenha}
                  </p>
                )}

                {sucessoSenha && (
                  <p className="rounded bg-emerald-50 p-2 text-[11px] text-emerald-800 border border-emerald-200">
                    {sucessoSenha}
                  </p>
                )}

                <label className="block space-y-1">
                  <span className="font-semibold text-slate-600">Senha atual</span>
                  <input
                    required
                    type="password"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    autoComplete="current-password"
                    className="w-full rounded border border-slate-300 px-2 py-1 outline-none focus:border-blue-500 text-xs"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="font-semibold text-slate-600">Nova senha</span>
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded border border-slate-300 px-2 py-1 outline-none focus:border-blue-500 text-xs"
                  />
                  <span className="block text-[10px] text-slate-400">mínimo 8 caracteres</span>
                </label>

                <label className="block space-y-1">
                  <span className="font-semibold text-slate-600">Confirmar nova senha</span>
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={confirmarNovaSenha}
                    onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded border border-slate-300 px-2 py-1 outline-none focus:border-blue-500 text-xs"
                  />
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={salvandoSenha}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 font-bold text-white hover:bg-slate-900 disabled:opacity-60"
                >
                  {salvandoSenha ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5 text-[#D4AF37]" />}
                  Alterar senha
                </button>
              </div>
            </form>
          </div>

          {/* Tabela de Usuários Cadastrados */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <span className="flex items-center gap-2 font-semibold text-slate-800">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Usuários cadastrados
              </span>
              <span className="text-[11px] text-slate-500">
                {carregando ? "carregando..." : `${usuarios.length} conta(s)`}
              </span>
            </div>

            {carregando ? (
              <p className="px-3 py-6 text-center text-slate-400">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </p>
            ) : usuarios.length === 0 ? (
              <p className="px-3 py-6 text-center text-slate-400">
                Nenhum usuário cadastrado neste tenant.
              </p>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-1.5 text-left">Usuário</th>
                    <th className="px-3 py-1.5 text-left">Nome</th>
                    <th className="px-3 py-1.5 text-left">Papel</th>
                    <th className="px-3 py-1.5 text-left">Carteira</th>
                    <th className="px-3 py-1.5 text-left">Status</th>
                    <th className="px-3 py-1.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => {
                    const ativo = u.ativo !== false;
                    const emProcesso = processandoId === u.id;
                    return (
                      <tr key={u.id} className={cn("border-t border-slate-100", !ativo && "bg-slate-50/60 opacity-70")}>
                        <td className="px-3 py-1.5 font-mono text-slate-800 font-semibold">{u.usuario}</td>
                        <td className="px-3 py-1.5 text-slate-700">{u.nome}</td>
                        <td className="px-3 py-1.5">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                              u.papel === "ADMIN"
                                ? "bg-rose-100 text-rose-800"
                                : u.papel === "GESTOR"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-100 text-slate-700"
                            )}
                          >
                            {ROTULO_PAPEL[u.papel]}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-slate-600">
                          {u.fornecedores === null
                            ? "irrestrita"
                            : u.fornecedores.length === 0
                              ? "nenhum (bloqueada)"
                              : `${u.fornecedores.length} fornecedor(es)`}
                        </td>
                        <td className="px-3 py-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                              ativo
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-700"
                            )}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full", ativo ? "bg-emerald-500" : "bg-slate-400")} />
                            {ativo ? "Ativo" : "Desativado"}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            type="button"
                            disabled={emProcesso}
                            onClick={() => alternarStatusUsuario(u)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
                              ativo
                                ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                            )}
                          >
                            {emProcesso ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : ativo ? (
                              <>
                                <UserX className="h-3 w-3" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3 w-3" />
                                Reativar
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

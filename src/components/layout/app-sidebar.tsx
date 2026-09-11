"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShoppingCart,
  PackageCheck,
  ArrowLeftRight,
  ShieldCheck,
  Sliders,
  Building2,
  Users,
  Palette,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { obterTenantAtivo } from "@/lib/cockpit/opcoes-tenant";

/** Nome do cliente ativo; em demonstração, o nome genérico do mostruário. */
const NOME_TENANT = obterTenantAtivo().nome.toUpperCase();

interface ItemNavegacao {
  titulo: string;
  href: string;
  icone: React.ComponentType<{ className?: string }>;
  badge?: string;
  somenteAdmin?: boolean;
}

const GRUPO_OPERACAO: ItemNavegacao[] = [
  {
    titulo: "Cockpit de Compras",
    href: "/compras",
    icone: ShoppingCart,
  },
  {
    titulo: "Sugestões & Pedidos",
    href: "/pedidos",
    icone: PackageCheck,
  },
  {
    titulo: "Transferências",
    href: "/transferencias",
    icone: ArrowLeftRight,
  },
  {
    titulo: "Auditoria do Gestor",
    href: "/admin/auditoria",
    icone: ShieldCheck,
    badge: "Compliance",
    somenteAdmin: true,
  },
  {
    titulo: "Modelo × Comprador",
    href: "/aprendizado",
    icone: ShieldCheck,
  },
];

const GRUPO_CONFIGURACOES: ItemNavegacao[] = [
  {
    titulo: "Parâmetros de Compra",
    href: "/configuracoes/parametros",
    icone: Sliders,
    somenteAdmin: true,
  },
  {
    titulo: "Lojas & Filiais",
    href: "/configuracoes/lojas",
    icone: Building2,
    somenteAdmin: true,
  },
  {
    titulo: "Usuários & Carteiras",
    href: "/configuracoes/usuarios",
    icone: Users,
    somenteAdmin: true,
  },
  {
    titulo: "Tema & White-Label",
    href: "/configuracoes/tema",
    icone: Palette,
    somenteAdmin: true,
  },
];

export interface UsuarioSidebar {
  readonly nome: string;
  readonly papelRotulo: string;
}

export function AppSidebar({ className, usuario }: { className?: string; usuario?: UsuarioSidebar | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessao, setSessao] = useState<UsuarioSidebar | null>(usuario ?? null);

  useEffect(() => {
    if (usuario) return; // veio do servidor: sem ida ao /api/auth/sessao
    let ativo = true;
    fetch("/api/auth/sessao")
      .then((r) => (r.ok ? r.json() : null))
      .then((corpo: { usuario?: { nome: string; papelRotulo: string } } | null) => {
        if (ativo && corpo?.usuario) setSessao({ nome: corpo.usuario.nome, papelRotulo: corpo.usuario.papelRotulo });
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [usuario]);

  const sair = async () => {
    try {
      await fetch("/api/auth/sair", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };
  const [colapsado, setColapsado] = useState(false);

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 select-none z-30",
        colapsado ? "w-16" : "w-64",
        className
      )}
    >
      {/* 1. Header com Marca do Tenant */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-3 bg-[#0F2B5C] text-white dark:border-slate-800">
        {!colapsado ? (
          <div className="flex items-center gap-2 truncate">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#D4AF37] animate-pulse" />
            <div className="flex flex-col truncate">
              <span className="text-xs font-black tracking-tight leading-none text-white">
                {NOME_TENANT}
              </span>
              <span className="text-[10px] text-slate-300 font-medium tracking-wide">
                iNSIGHT D Compras
              </span>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded bg-[#D4AF37] text-slate-950 font-black text-xs">
            RC
          </div>
        )}

        <button
          type="button"
          onClick={() => setColapsado(!colapsado)}
          className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          title={colapsado ? "Expandir menu" : "Recolher menu"}
          aria-label={colapsado ? "Expandir menu lateral" : "Recolher menu lateral"}
        >
          {colapsado ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* 2. Conteúdo e Grupos de Navegação */}
      <div className="flex-1 overflow-y-auto py-3 space-y-5 px-2">
        {/* Grupo Operação */}
        <div>
          {!colapsado && (
            <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Operação de Compras
            </p>
          )}
          <nav className="space-y-1">
            {GRUPO_OPERACAO.map((item) => {
              const ativo = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icone = item.icone;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                    ativo
                      ? "bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/60 dark:text-blue-300"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
                    colapsado && "justify-center px-2"
                  )}
                  title={colapsado ? item.titulo : undefined}
                >
                  <Icone className={cn("h-4 w-4 shrink-0", ativo ? "text-blue-600 dark:text-blue-400" : "text-slate-400")} />
                  {!colapsado && (
                    <div className="flex flex-1 items-center justify-between truncate">
                      <span className="truncate">{item.titulo}</span>
                      {item.badge && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Grupo Configurações */}
        <div>
          {!colapsado && (
            <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Configurações & Parâmetros
            </p>
          )}
          <nav className="space-y-1">
            {GRUPO_CONFIGURACOES.map((item) => {
              const ativo = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icone = item.icone;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                    ativo
                      ? "bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/60 dark:text-blue-300"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
                    colapsado && "justify-center px-2"
                  )}
                  title={colapsado ? item.titulo : undefined}
                >
                  <Icone className={cn("h-4 w-4 shrink-0", ativo ? "text-blue-600 dark:text-blue-400" : "text-slate-400")} />
                  {!colapsado && <span className="truncate">{item.titulo}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* 3. Rodapé do Menu com Perfil do Usuário e Logout */}
      <div className="border-t border-slate-200 p-2.5 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
        {!colapsado ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col truncate">
              <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                {sessao?.nome ?? "—"}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {sessao?.papelRotulo ?? "sessão não carregada"}
              </span>
            </div>
            <button
              type="button"
              onClick={sair}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 transition-colors"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={sair}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

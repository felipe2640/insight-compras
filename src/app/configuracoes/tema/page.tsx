/**
 * Personalização visual da instalação.
 * Camada: Interface / Configurações (src/app/configuracoes/tema/page.tsx)
 * 100% em Português do Brasil (pt-BR).
 *
 * Esta tela apresenta a identidade visual vigente para o cliente atual.
 */

import React from "react";
import {
  Palette,
  Eye,
  Globe,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { resolverTenantConfigurado } from "@config/tenants";
import { obterUsuarioAtual, rotuloPapel } from "@/lib/autenticacao/servidor";

export const dynamic = "force-dynamic";

export default async function PaginaTema() {
  const usuario = await obterUsuarioAtual();
  const tenant = resolverTenantConfigurado();

  // Lista organizada de cores institucionais com metadados explicativos
  const itensCores = [
    {
      chave: "primaria",
      rotulo: "Cor Primária",
      descricao: "Cabeçalhos, barra superior, menus e identidade principal",
      valor: tenant.cores.primaria,
    },
    {
      chave: "secundaria",
      rotulo: "Cor Secundária (Destaque)",
      descricao: "Acentos, botões de ação de compra e detalhes nobres",
      valor: tenant.cores.secundaria,
    },
    {
      chave: "acento",
      rotulo: "Cor de Acento",
      descricao: "Pontos focais, indicadores de status e seletores ativos",
      valor: tenant.cores.acento,
    },
    {
      chave: "primariaHover",
      rotulo: "Primária Hover",
      descricao: "Variação de foco e repouso da cor primária",
      valor: tenant.cores.primariaHover,
    },
    {
      chave: "secundariaHover",
      rotulo: "Secundária Hover",
      descricao: "Variação de foco e clique da cor secundária",
      valor: tenant.cores.secundariaHover,
    },
    {
      chave: "fundo",
      rotulo: "Cor de Fundo",
      descricao: "Fundo estrutural da aplicação",
      valor: tenant.cores.fundo,
    },
    {
      chave: "card",
      rotulo: "Fundo de Cartões / Painéis",
      descricao: "Superfícies de modais, tabelas e contêineres",
      valor: tenant.cores.card,
    },
    {
      chave: "borda",
      rotulo: "Bordas Estruturais",
      descricao: "Linhas divisórias e contornos de componentes",
      valor: tenant.cores.borda,
    },
    {
      chave: "texto",
      rotulo: "Texto Principal",
      descricao: "Tipografia de alto contraste para leitura de dados",
      valor: tenant.cores.texto,
    },
    {
      chave: "textoSecundario",
      rotulo: "Texto Secundário",
      descricao: "Legendas, metadados e cabeçalhos de tabela",
      valor: tenant.cores.textoSecundario,
    },
    {
      chave: "fundoDestaqueMultiplo",
      rotulo: "Destaque Múltiplos",
      descricao: "Fundo de alerta visual para itens com lote de fábrica",
      valor: tenant.cores.fundoDestaqueMultiplo,
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      <AppSidebar
        usuario={usuario ? { nome: usuario.nome, papelRotulo: rotuloPapel(usuario.role) } : null}
      />

      <main className="flex flex-1 flex-col overflow-y-auto">
        {/* Cabeçalho da Página */}
        <header
          className="sticky top-0 z-30 border-b px-6 py-4 shadow-sm"
          style={{
            backgroundColor: "var(--cor-primaria)",
            borderColor: "var(--cor-secundaria)",
            color: "#FFFFFF",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-base font-black">
                <Palette className="h-5 w-5" style={{ color: "var(--cor-secundaria)" }} />
                Identidade visual
              </h1>
              <p className="text-xs text-white/80">
                Cliente: <strong>{tenant.nome}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-white/80">Visualização da configuração atual</span>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1100px] space-y-5 p-6 text-xs">
          {/* 1. Dados cadastrais e domínios */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-600" />
                1. Informações da organização
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Nome Institucional
                </span>
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                  {tenant.nome}
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Razão Social
                </span>
                <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {tenant.razaoSocial}
                </p>
              </div>

            </div>
          </section>

          {/* 2. Paleta de cores */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Palette className="h-4 w-4 text-amber-500" />
                  2. Paleta corporativa
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Cores usadas nos cabeçalhos, menus, botões e indicadores.
                </p>
              </div>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {itensCores.length} cores configuradas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {itensCores.map((item) => (
                <div
                  key={item.chave}
                  className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white p-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-950/40"
                >
                  {/* Amostra visual da cor */}
                  <div
                    className="h-10 w-10 shrink-0 rounded-lg border border-slate-300/80 shadow-inner flex items-center justify-center dark:border-slate-700"
                    style={{ backgroundColor: item.valor }}
                    title={`${item.rotulo}: ${item.valor}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {item.rotulo}
                      </span>
                      <span className="font-mono font-bold text-[11px] text-slate-900 dark:text-white">
                        {item.valor}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      {item.descricao}
                    </p>
                  </div>
                </div>
              ))}
            </div>

          </section>

          {/* 3. Identidade Visual e Ativos Gráficos */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              3. Identidade Visual e Assinatura da Plataforma
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Logo Claro
                </span>
                <p className="mt-1 text-xs text-slate-800 dark:text-slate-200">
                  {tenant.identidadeVisual.logoClaro ? "Configurado" : "Não configurado"}
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Logo Escuro
                </span>
                <p className="mt-1 text-xs text-slate-800 dark:text-slate-200">
                  {tenant.identidadeVisual.logoEscuro ? "Configurado" : "Não configurado"}
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Favicon
                </span>
                <p className="mt-1 text-xs text-slate-800 dark:text-slate-200">
                  {tenant.identidadeVisual.favicon ? "Configurado" : "Não configurado"}
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Assinatura da plataforma
                </span>
                <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {tenant.assinatura.texto}
                </p>
              </div>
            </div>
          </section>

          {/* 4. Pré-visualização ao vivo da Barra Superior */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Eye className="h-4 w-4 text-indigo-600" />
                4. Pré-visualização da barra superior
              </h2>
            </div>

            <div
              className="rounded-xl p-3.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-white transition-all"
              style={{
                backgroundColor: "var(--cor-primaria)",
                borderColor: "var(--cor-secundaria)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-block h-3 w-3 rounded-full animate-pulse shadow-sm"
                  style={{ backgroundColor: "var(--cor-secundaria)" }}
                />
                <span className="font-black text-sm tracking-tight">{tenant.nome}</span>
                <span className="text-xs opacity-60 hidden sm:inline">|</span>
                <span className="text-xs opacity-90 hidden sm:inline">
                  Copiloto de Inteligência &amp; Decisão de Compras
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span
                  className="rounded px-2 py-0.5 text-[10px] font-semibold text-white/90"
                  style={{ backgroundColor: "rgba(255, 255, 255, 0.15)" }}
                >
                  {tenant.filiais.length} lojas conectadas
                </span>
                <button
                  type="button"
                  className="font-bold px-3 py-1 rounded shadow text-xs transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: "var(--cor-secundaria)",
                    color: "#000000",
                  }}
                >
                  Exportar CSV
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/**
 * Personalização de Tema & White-Label — leitura transparente da configuração do tenant.
 * Camada: Interface / Configurações (src/app/configuracoes/tema/page.tsx)
 * 100% em Português do Brasil (pt-BR).
 *
 * O arquivo do tenant (`config/tenants/*.ts`) é a FONTE DA VERDADE da identidade
 * visual, compilado em tempo de build/deploy. Como o sistema de arquivos na Vercel
 * e em produção é estritamente somente-leitura, esta tela declara com total
 * honestidade os valores ativos e as variáveis CSS injetadas no root da aplicação,
 * sem formulários que simulam salvar na memória do navegador.
 */

import React from "react";
import {
  Palette,
  FileCode2,
  ShieldCheck,
  Eye,
  Layers,
  Globe,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { resolverTenantConfigurado } from "@config/tenants";
import { obterUsuarioAtual, rotuloPapel } from "@/lib/autenticacao/servidor";
import { gerarVariaveisCssTenant, gerarStringCssVarsInline } from "@config/tenants/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaTema() {
  const usuario = await obterUsuarioAtual();
  const tenant = resolverTenantConfigurado();
  const varsCss = gerarVariaveisCssTenant(tenant);
  const stringCssInline = gerarStringCssVarsInline(tenant);

  // Lista organizada de cores institucionais com metadados explicativos
  const itensCores = [
    {
      chave: "primaria",
      rotulo: "Cor Primária",
      descricao: "Cabeçalhos, barra superior, menus e identidade principal",
      valor: tenant.cores.primaria,
      varCss: "--cor-primaria",
    },
    {
      chave: "secundaria",
      rotulo: "Cor Secundária (Destaque)",
      descricao: "Acentos, botões de ação de compra e detalhes nobres",
      valor: tenant.cores.secundaria,
      varCss: "--cor-secundaria",
    },
    {
      chave: "acento",
      rotulo: "Cor de Acento",
      descricao: "Pontos focais, indicadores de status e seletores ativos",
      valor: tenant.cores.acento,
      varCss: "--cor-acento",
    },
    {
      chave: "primariaHover",
      rotulo: "Primária Hover",
      descricao: "Variação de foco e repouso da cor primária",
      valor: tenant.cores.primariaHover,
      varCss: "--cor-primaria-hover",
    },
    {
      chave: "secundariaHover",
      rotulo: "Secundária Hover",
      descricao: "Variação de foco e clique da cor secundária",
      valor: tenant.cores.secundariaHover,
      varCss: "--cor-secundaria-hover",
    },
    {
      chave: "fundo",
      rotulo: "Cor de Fundo",
      descricao: "Fundo estrutural da aplicação",
      valor: tenant.cores.fundo,
      varCss: "--cor-fundo",
    },
    {
      chave: "card",
      rotulo: "Fundo de Cartões / Painéis",
      descricao: "Superfícies de modais, tabelas e contêineres",
      valor: tenant.cores.card,
      varCss: "--cor-card",
    },
    {
      chave: "borda",
      rotulo: "Bordas Estruturais",
      descricao: "Linhas divisórias e contornos de componentes",
      valor: tenant.cores.borda,
      varCss: "--cor-borda",
    },
    {
      chave: "texto",
      rotulo: "Texto Principal",
      descricao: "Tipografia de alto contraste para leitura de dados",
      valor: tenant.cores.texto,
      varCss: "--cor-texto",
    },
    {
      chave: "textoSecundario",
      rotulo: "Texto Secundário",
      descricao: "Legendas, metadados e cabeçalhos de tabela",
      valor: tenant.cores.textoSecundario,
      varCss: "--cor-texto-secundario",
    },
    {
      chave: "fundoDestaqueMultiplo",
      rotulo: "Destaque Múltiplos",
      descricao: "Fundo de alerta visual para itens com lote de fábrica",
      valor: tenant.cores.fundoDestaqueMultiplo,
      varCss: "--cor-destaque-multiplo",
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
                Identidade Visual &amp; White-Label
              </h1>
              <p className="text-xs text-white/80">
                Tenant ativo: <strong>{tenant.nome}</strong> (ID: <code className="font-mono">{tenant.id}</code>)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Configuração de Deploy (Somente Leitura)
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1100px] space-y-5 p-6 text-xs">
          {/* Nota de transparência sobre arquitetura white-label */}
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <FileCode2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="space-y-1">
              <p className="font-bold text-slate-900 dark:text-white">
                Declaração Honesta de Configuração do Tenant
              </p>
              <p className="leading-relaxed">
                Esta identidade visual deriva diretamente do arquivo de configuração do tenant (
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                  config/tenants/{tenant.id}.ts
                </code>
                ), definido em tempo de build e deploy. Como a infraestrutura em produção (Vercel)
                possui sistema de arquivos estritamente somente-leitura, alterações visuais são
                versionadas no código-fonte e propagadas deterministicamente por variáveis CSS
                injetadas no root do HTML. Esta tela é informativa e reflete com exatidão o estado
                vigente no servidor.
              </p>
            </div>
          </div>

          {/* 1. Dados Cadastrais e Domínios do Tenant */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-600" />
                1. Informações do Tenant e Roteamento White-Label
              </h2>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                slug: {tenant.id}
              </span>
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

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Subdomínio Canônico
                </span>
                <p className="mt-1 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {tenant.subdominioPrincipal}
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Domínio Customizado
                </span>
                <p className="mt-1 font-mono text-xs text-slate-700 dark:text-slate-300">
                  {tenant.customDomain ?? "—"}
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40 sm:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Aliases e Subdomínios Válidos
                </span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {tenant.subdominiosValidos.map((alias) => (
                    <span
                      key={alias}
                      className="rounded bg-slate-200/80 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                    >
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 2. Paleta de Cores e Mapeamento de Variáveis CSS */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Palette className="h-4 w-4 text-amber-500" />
                  2. Paleta Corporativa e Variáveis CSS Ativas
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Valores ativos no DOM via injeção central no cabeçalho do layout da aplicação.
                </p>
              </div>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {itensCores.length} variáveis ativas
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
                    <code className="block mt-0.5 font-mono text-[10px] text-blue-600 dark:text-blue-400">
                      {item.varCss}
                    </code>
                  </div>
                </div>
              ))}
            </div>

            {/* Bloco de Código com CSS Variables Inline */}
            <div className="mt-4 rounded-lg bg-slate-900 p-3 text-slate-200">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-blue-400" />
                  CSS Variables Injetadas no Root HTML
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  gerarStringCssVarsInline(tenant)
                </span>
              </div>
              <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-emerald-400">
                {Object.entries(varsCss)
                  .map(([chave, valor]) => `${chave}: ${valor};`)
                  .join("\n")}
              </pre>
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
                <p className="mt-1 font-mono text-xs text-slate-800 dark:text-slate-200 truncate" title={tenant.identidadeVisual.logoClaro}>
                  {tenant.identidadeVisual.logoClaro}
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Logo Escuro
                </span>
                <p className="mt-1 font-mono text-xs text-slate-800 dark:text-slate-200 truncate" title={tenant.identidadeVisual.logoEscuro}>
                  {tenant.identidadeVisual.logoEscuro}
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Favicon
                </span>
                <p className="mt-1 font-mono text-xs text-slate-800 dark:text-slate-200 truncate" title={tenant.identidadeVisual.favicon}>
                  {tenant.identidadeVisual.favicon}
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Assinatura White-Label
                </span>
                <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {tenant.assinatura.texto} (v{tenant.assinatura.versaoPlataforma})
                </p>
              </div>
            </div>
          </section>

          {/* 4. Pré-visualização ao vivo da Barra Superior */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Eye className="h-4 w-4 text-indigo-600" />
                4. Pré-Visualização em Tempo Real da Barra Superior com CSS Variables
              </h2>
              <span className="text-[10px] font-mono text-slate-400">
                renderização nativa por CSS Vars
              </span>
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
                <span
                  className="text-[10px] font-black px-1.5 py-0.5 rounded shadow-xs"
                  style={{
                    backgroundColor: "var(--cor-secundaria)",
                    color: "#000000",
                  }}
                >
                  WHITE-LABEL
                </span>
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

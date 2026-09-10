/**
 * Lojas & Filiais — leitura do arquivo do tenant, que é a fonte da verdade.
 *
 * Antes esta tela tinha uma lista fixa no código, editável na memória do
 * navegador: mexer aqui não mudava nada e ainda dava a impressão de que mudava.
 * Enquanto a edição não for gravada de verdade, mostrar o que está valendo e
 * dizer onde se altera é mais útil do que um formulário que finge.
 */

import React from "react";
import { Building2, MapPin, FileCode2 } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { obterTenantAtivo } from "@/lib/cockpit/opcoes-tenant";
import { obterUsuarioAtual, rotuloPapel } from "@/lib/autenticacao/servidor";

export const dynamic = "force-dynamic";

export default async function PaginaLojas() {
  const usuario = await obterUsuarioAtual();
  const tenant = obterTenantAtivo();
  const filiais = tenant.filiais;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <AppSidebar
        usuario={usuario ? { nome: usuario.nome, papelRotulo: rotuloPapel(usuario.role) } : null}
      />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 border-b border-[#D4AF37]/30 bg-[#0F2B5C] px-4 py-2.5 text-white shadow-md">
          <h1 className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-[#D4AF37]" />
            Lojas &amp; Filiais
          </h1>
          <p className="text-xs text-white/70">
            {tenant.nome} — {filiais.length} loja(s) na rede.
          </p>
        </header>

        <div className="mx-auto w-full max-w-[1000px] space-y-3 p-4 text-xs">
          <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600 shadow-sm">
            <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              Estas lojas vêm do arquivo de configuração do cliente
              (<code className="rounded bg-slate-100 px-1">config/tenants/{tenant.id}.ts</code>),
              que é o que o motor de compra e o balanceamento de transferência realmente usam.
              Abrir uma loja nova é uma mudança de configuração, não de tela.
            </span>
          </p>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-1.5 text-left">Cód.</th>
                  <th className="px-3 py-1.5 text-left">Loja</th>
                  <th className="px-3 py-1.5 text-left">Tipo</th>
                  <th className="px-3 py-1.5 text-left">Praça</th>
                  <th className="px-3 py-1.5 text-left">Situação</th>
                </tr>
              </thead>
              <tbody>
                {filiais.map((f) => (
                  <tr key={f.filialId} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-mono text-slate-700">{f.filialId}</td>
                    <td className="px-3 py-1.5 font-semibold text-slate-800">{f.nome}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={
                          f.tipo === "matriz"
                            ? "rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800"
                            : "rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                        }
                      >
                        {f.tipo === "matriz" ? "Matriz" : "Filial"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {f.cidade ? `${f.cidade}${f.uf ? `/${f.uf}` : ""}` : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={
                          f.ativa
                            ? "text-emerald-700 font-semibold"
                            : "text-slate-400"
                        }
                      >
                        {f.ativa ? "Ativa" : "Inativa"}
                      </span>
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

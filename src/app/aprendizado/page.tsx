import React from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ComparativoAprendizado } from "@/components/aprendizado/ComparativoAprendizado";
import { obterTenantAtivo, montarNomesFiliais } from "@/lib/cockpit/opcoes-tenant";
import { obterUsuarioAtual, rotuloPapel } from "@/lib/autenticacao/servidor";

export const dynamic = "force-dynamic";

export default async function PaginaAprendizado() {
  const usuario = await obterUsuarioAtual();
  const tenant = obterTenantAtivo();
  const nomesFiliais = montarNomesFiliais(tenant);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 border-b border-[#D4AF37]/30 bg-[#0F2B5C] px-4 py-2.5 text-white shadow-md">
          <h1 className="text-sm font-semibold">Modelo × Comprador</h1>
          <p className="text-xs text-white/70">O que o modelo sugeriu, o que o comprador decidiu, o que de fato entrou — e por quê divergiu.</p>
        </header>
        <div className="mx-auto w-full max-w-[1600px] p-4">
          <ComparativoAprendizado nomesFiliais={nomesFiliais} />
        </div>
      </main>
    </div>
  );
}

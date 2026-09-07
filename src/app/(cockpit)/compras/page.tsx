import React, { Suspense } from "react";
import { obterAdaptadorInventario } from "@adapters/index";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { montarOpcoesMatriz } from "@/lib/cockpit/opcoes-tenant";
import { CockpitPrincipal } from "@/components/cockpit/CockpitPrincipal";

export const revalidate = 60; // Cache de 1 minuto com revalidação estrita

async function CarregarDadosCockpit() {
  const adaptador = obterAdaptadorInventario();
  const carga = await adaptador.carregarInventarioCompleto({
    fornecedoresPermitidos: null,
    filialId: 1,
  });
  // Parâmetros calibrados do tenant (Carreiro: fator 0,90 do backtest).
  const linhas = converterParaLinhasCockpit(carga, montarOpcoesMatriz(1));

  return <CockpitPrincipal itensIniciais={linhas} filialFocoIdInicial={1} />;
}

function EsqueletoCarregamento() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-100 p-4 animate-pulse">
      <div className="h-14 bg-[#0F2B5C] rounded-lg mb-4" />
      <div className="grid grid-cols-5 gap-3 mb-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-white rounded-lg border border-slate-200" />
        ))}
      </div>
      <div className="h-12 bg-white rounded-lg border border-slate-200 mb-4" />
      <div className="flex-1 min-h-[500px] bg-white rounded-lg border border-slate-200" />
    </div>
  );
}

export default function PaginaCockpitCompras() {
  return (
    <Suspense fallback={<EsqueletoCarregamento />}>
      <CarregarDadosCockpit />
    </Suspense>
  );
}

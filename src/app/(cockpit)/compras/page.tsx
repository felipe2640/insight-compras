import React, { Suspense } from "react";
import { obterAdaptadorInventario } from "@adapters/index";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { montarOpcoesMatrizComPublicados } from "@/lib/aprendizado/parametros-motor";
import { CockpitPrincipal } from "@/components/cockpit/CockpitPrincipal";
import { obterUsuarioAtual, rotuloPapel } from "@/lib/autenticacao/servidor";

// A página lê a sessão (cookies), portanto é dinâmica por requisição; o cache de dados fica no adapter.
export const dynamic = "force-dynamic";

async function CarregarDadosCockpit() {
  const usuario = await obterUsuarioAtual();
  const adaptador = obterAdaptadorInventario();
  const carga = await adaptador.carregarInventarioCompleto({
    fornecedoresPermitidos: null,
    filialId: 1,
    // O comprador decide sobre o que tem saldo ou saiu recentemente. Trazer o
    // catálogo inteiro enche a grade de item morto e atrasa a carga.
    apenasComEstoqueOuVenda: true,
  });
  // Parâmetros calibrados do tenant (Carreiro: fator 0,90 do backtest).
  const linhas = converterParaLinhasCockpit(carga, await montarOpcoesMatrizComPublicados(1));

  return (
    <CockpitPrincipal
      itensIniciais={linhas}
      filialFocoIdInicial={1}
      usuarioSessao={usuario ? { nome: usuario.nome, papelRotulo: rotuloPapel(usuario.role) } : null}
    />
  );
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

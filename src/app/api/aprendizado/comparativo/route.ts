/**
 * GET /api/aprendizado/comparativo?dias=30&filialId=1
 * Modelo × comprador nos últimos N dias, com feedback e confirmação.
 */

import { NextRequest, NextResponse } from "next/server";
import { classificarDivergencia } from "@core/aprendizado";
import { obterUsuarioDaRequisicao, respostaNaoAutenticado } from "@/lib/autenticacao/servidor";
import { listarComparativo } from "@/lib/aprendizado/repositorio";
import { aprendizadoConfigurado } from "@/lib/aprendizado/repositorio";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioDaRequisicao(request);
  if (!usuario) return respostaNaoAutenticado();
  const { searchParams } = new URL(request.url);
  const dias = Math.min(365, Math.max(1, parseInt(searchParams.get("dias") ?? "30", 10) || 30));
  const filialParam = searchParams.get("filialId");
  const filialId = filialParam ? parseInt(filialParam, 10) || undefined : undefined;

  if (!aprendizadoConfigurado()) {
    return NextResponse.json({ configurado: false, itens: [], resumo: null });
  }

  const itens = await listarComparativo({ tenantId: usuario.tenantId, dias, filialId });
  const comDivergencia = itens.map((i) => ({
    ...i,
    divergencia: classificarDivergencia(i.qtdComprador, i.qtdModelo),
  }));

  const resumo = {
    total: comDivergencia.length,
    igual: comDivergencia.filter((i) => i.divergencia === "igual").length,
    compradorMaior: comDivergencia.filter((i) => i.divergencia === "comprador_maior").length,
    compradorMenor: comDivergencia.filter((i) => i.divergencia === "comprador_menor").length,
    soModelo: comDivergencia.filter((i) => i.divergencia === "so_modelo").length,
    semSugestao: comDivergencia.filter((i) => i.divergencia === "sem_sugestao").length,
    comMotivo: comDivergencia.filter((i) => i.feedback).length,
    confirmados: comDivergencia.filter((i) => i.confirmacao && i.confirmacao.status !== "aguardando").length,
  };

  return NextResponse.json({ configurado: true, dias, itens: comDivergencia, resumo });
}

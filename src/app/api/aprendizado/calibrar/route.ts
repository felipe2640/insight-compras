/**
 * GET  /api/aprendizado/calibrar?dias=60  -> SIMULA a proposta (não grava)
 * POST /api/aprendizado/calibrar?dias=60  -> PUBLICA em parametros_modelo
 *
 * A publicação é um passo separado de propósito: muda o quanto o sistema manda
 * comprar, então é decisão de gente, não efeito colateral de um GET.
 */

import { NextRequest, NextResponse } from "next/server";
import { calcularPropostaCalibracao, aplicarProposta } from "@core/aprendizado";
import { obterUsuarioDaRequisicao, podeGerirAprendizado } from "@/lib/seguranca/usuario-requisicao";
import { obterTenantAtivo } from "@/lib/cockpit/opcoes-tenant";
import {
  listarLinhasCalibracao,
  publicarParametros,
  carregarParametrosPublicados,
} from "@/lib/aprendizado/repositorio";
import { supabaseConfigurado } from "@/lib/aprendizado/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function montarProposta(request: NextRequest) {
  const usuario = obterUsuarioDaRequisicao(request);
  const tenant = obterTenantAtivo();
  const { searchParams } = new URL(request.url);
  const dias = Math.min(365, Math.max(7, parseInt(searchParams.get("dias") ?? "60", 10) || 60));

  const publicados = await carregarParametrosPublicados(usuario.tenantId);
  const margensVigentes = publicados?.margens ?? tenant.parametrosMotor.motor.margens;
  const fatorVigente = publicados?.fatorCalibracao ?? tenant.parametrosMotor.motor.fatorCalibracao;

  const linhas = await listarLinhasCalibracao({ tenantId: usuario.tenantId, dias });
  const proposta = calcularPropostaCalibracao(linhas);
  const margensPropostas = aplicarProposta(margensVigentes, proposta);

  return { usuario, dias, linhas: linhas.length, margensVigentes, fatorVigente, proposta, margensPropostas, publicados };
}

export async function GET(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ configurado: false });
  }
  const r = await montarProposta(request);
  return NextResponse.json({
    configurado: true,
    simulacao: true,
    publicado: false,
    dias: r.dias,
    linhasAprendizado: r.linhas,
    vigente: { margens: r.margensVigentes, fatorCalibracao: r.fatorVigente, versao: r.publicados?.versao ?? "arquivo do tenant" },
    proposta: r.proposta,
    margensPropostas: r.margensPropostas,
  });
}

export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "supabase_nao_configurado" }, { status: 503 });
  }
  const r = await montarProposta(request);
  if (!podeGerirAprendizado(r.usuario)) {
    return NextResponse.json({ erro: "sem permissão" }, { status: 403 });
  }
  const aplicaveis = r.proposta.filter((p) => p.aplicavel);
  if (aplicaveis.length === 0) {
    return NextResponse.json(
      { publicado: false, motivo: "nenhum perfil com amostra suficiente para publicar", proposta: r.proposta },
      { status: 409 }
    );
  }
  const publicado = await publicarParametros({
    tenantId: r.usuario.tenantId,
    margens: r.margensPropostas,
    fatorCalibracao: r.fatorVigente,
    proposta: r.proposta,
    usuario: r.usuario.email,
  });
  return NextResponse.json({ publicado: true, versao: publicado.versao, margens: publicado.margens, perfisAlterados: aplicaveis.map((p) => p.perfil) });
}

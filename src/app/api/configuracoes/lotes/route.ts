import { NextRequest, NextResponse } from "next/server";
import {
  obterUsuarioDaRequisicao,
  podeGerirAprendizado,
  respostaNaoAutenticado,
  respostaSemPermissao,
} from "@/lib/autenticacao/servidor";
import { obterTenantAtivo } from "@/lib/cockpit/opcoes-tenant";
import {
  carregarConfiguracaoLotes,
  salvarConfiguracaoLotes,
  validarConfiguracaoLotes,
} from "@/lib/configuracao/lotes-repositorio";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioDaRequisicao(request);
  if (!usuario) return respostaNaoAutenticado();
  const tenant = obterTenantAtivo(usuario.tenantId);
  const configuracao = await carregarConfiguracaoLotes(usuario.tenantId, tenant.parametrosMotor.lotes);
  return NextResponse.json({ configuracao, podeEditar: podeGerirAprendizado(usuario) });
}

export async function PUT(request: NextRequest) {
  const usuario = await obterUsuarioDaRequisicao(request);
  if (!usuario) return respostaNaoAutenticado();
  if (!podeGerirAprendizado(usuario)) return respostaSemPermissao();
  try {
    const configuracao = validarConfiguracaoLotes(await request.json());
    await salvarConfiguracaoLotes(usuario.tenantId, configuracao, usuario.nome);
    return NextResponse.json({ configuracao });
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." },
      { status: 400 }
    );
  }
}

/**
 * POST /api/auth/entrar  { email, senha }
 * Autentica no provedor configurado e grava o cookie httpOnly de sessão.
 * O tenant vem do middleware (x-tenant-id): o usuário precisa pertencer a ele.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ErroSegurancaBase } from "@/lib/rbac/tipos";
import { obterProvedorAutenticacao, opcoesCookieSessao, ErroProvedorIndisponivel } from "@/lib/autenticacao";
import { obterTenantAtivo } from "@/lib/cockpit/opcoes-tenant";
import { rotuloPapel } from "@/lib/autenticacao/servidor";

export const dynamic = "force-dynamic";

const esquema = z.object({
  email: z.string().trim().email().max(200),
  senha: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  let corpo: z.infer<typeof esquema>;
  try {
    corpo = esquema.parse(await request.json());
  } catch {
    return NextResponse.json({ erro: "informe e-mail e senha válidos" }, { status: 400 });
  }

  const tenantId = request.headers.get("x-tenant-id") ?? obterTenantAtivo().id;
  const provedor = obterProvedorAutenticacao();

  try {
    const sessao = await provedor.entrar({ email: corpo.email, senha: corpo.senha, tenantId });
    const resposta = NextResponse.json({
      usuario: {
        id: sessao.usuario.id,
        nome: sessao.usuario.nome,
        email: sessao.usuario.email,
        papel: sessao.usuario.role,
        papelRotulo: rotuloPapel(sessao.usuario.role),
        tenantId: sessao.usuario.tenantId,
      },
      provedor: provedor.id,
      expiraEm: sessao.expiraEm,
    });
    resposta.cookies.set(
      opcoesCookieSessao(
        { provedor: sessao.provedor, token: sessao.token, tokenRenovacao: sessao.tokenRenovacao, expiraEm: sessao.expiraEm },
        process.env.NODE_ENV === "production"
      )
    );
    return resposta;
  } catch (erro) {
    if (erro instanceof ErroSegurancaBase) {
      return NextResponse.json({ erro: erro.message }, { status: erro.statusCode });
    }
    if (erro instanceof ErroProvedorIndisponivel) {
      console.error("[autenticacao]", erro.message);
      return NextResponse.json({ erro: "serviço de autenticação indisponível" }, { status: 503 });
    }
    console.error("[autenticacao] erro inesperado no login:", erro);
    return NextResponse.json({ erro: "falha ao autenticar" }, { status: 500 });
  }
}

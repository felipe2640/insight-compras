/** POST /api/auth/sair — revoga no provedor (melhor esforço) e apaga o cookie. */

import { NextRequest, NextResponse } from "next/server";
import { NOME_COOKIE_SESSAO, decodificarCookieSessao, obterProvedorAutenticacao, opcoesCookieLimpar } from "@/lib/autenticacao";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const sessao = decodificarCookieSessao(request.cookies.get(NOME_COOKIE_SESSAO)?.value);
  if (sessao) {
    try {
      await obterProvedorAutenticacao(sessao.provedor).sair(sessao.token);
    } catch {
      // cookie some de qualquer forma
    }
  }
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set(opcoesCookieLimpar(process.env.NODE_ENV === "production"));
  return resposta;
}

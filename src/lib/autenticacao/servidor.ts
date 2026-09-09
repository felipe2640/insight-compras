/**
 * Sessão do lado servidor (rotas e Server Components).
 * Camada: Aplicação (src/lib/autenticacao) — server-only (importa next/headers).
 *
 * As rotas NUNCA leem cabeçalhos x-user-*: identidade vem só do cookie de sessão
 * validado pelo provedor. Sem sessão -> 401.
 */

import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { UsuarioAutenticado } from "@/lib/rbac/tipos";
import { obterTenantAtivo } from "@/lib/cockpit/opcoes-tenant";
import { obterProvedorAutenticacao } from "./fabrica";
import { NOME_COOKIE_SESSAO, decodificarCookieSessao, sessaoExpirada } from "./sessao";

async function resolverUsuario(valorCookie: string | undefined, tenantId: string): Promise<UsuarioAutenticado | null> {
  const sessao = decodificarCookieSessao(valorCookie);
  if (!sessao || sessaoExpirada(sessao, Date.now(), 0)) return null;
  try {
    return await obterProvedorAutenticacao(sessao.provedor).validar(sessao.token, tenantId);
  } catch (erro) {
    console.warn("[autenticacao] falha ao validar sessão:", erro);
    return null;
  }
}

/** Rotas de API: usuário da requisição ou null. */
export async function obterUsuarioDaRequisicao(request: NextRequest): Promise<UsuarioAutenticado | null> {
  const tenantId = request.headers.get("x-tenant-id") ?? obterTenantAtivo().id;
  return resolverUsuario(request.cookies.get(NOME_COOKIE_SESSAO)?.value, tenantId);
}

/** Server Components: usuário atual ou null. */
export async function obterUsuarioAtual(): Promise<UsuarioAutenticado | null> {
  const tenantId = headers().get("x-tenant-id") ?? obterTenantAtivo().id;
  return resolverUsuario(cookies().get(NOME_COOKIE_SESSAO)?.value, tenantId);
}

export function respostaNaoAutenticado(): NextResponse {
  return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
}

export function respostaSemPermissao(): NextResponse {
  return NextResponse.json({ erro: "sem permissão" }, { status: 403 });
}

/** Só gestor/admin publica calibração e registra motivo de divergência. */
export function podeGerirAprendizado(usuario: UsuarioAutenticado): boolean {
  return usuario.role === "GESTOR" || usuario.role === "ADMIN";
}

export function rotuloPapel(papel: UsuarioAutenticado["role"]): string {
  return papel === "ADMIN" ? "Administrador" : papel === "GESTOR" ? "Gestor da Rede" : "Comprador";
}

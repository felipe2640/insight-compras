/**
 * Identidade do usuário a partir da requisição.
 * Camada: Aplicação (src/lib/seguranca)
 *
 * Hoje a plataforma resolve o usuário por cabeçalhos (x-user-*), como a rota de
 * compras já faz. Quando o login real entrar, é AQUI que a sessão passa a ser
 * lida — as rotas não mudam.
 */

import { NextRequest } from "next/server";
import { UsuarioAutenticado, PapelUsuario } from "@/lib/rbac/tipos";
import { obterTenantAtivo } from "@/lib/cockpit/opcoes-tenant";

export function obterUsuarioDaRequisicao(request: NextRequest): UsuarioAutenticado {
  const tenant = obterTenantAtivo();
  const roleHeader = (request.headers.get("x-user-role") ?? "GESTOR").toUpperCase();
  const role: PapelUsuario =
    roleHeader === "ADMIN" ? "ADMIN" : roleHeader === "COMPRADOR" ? "COMPRADOR" : "GESTOR";

  const fornecedoresHeader = request.headers.get("x-allowed-suppliers");
  const allowedSupplierIds = fornecedoresHeader
    ? new Set(
        fornecedoresHeader
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !Number.isNaN(n))
      )
    : null;

  const id = request.headers.get("x-user-id") ?? "usuario-demo";
  return {
    id,
    nome: request.headers.get("x-user-nome") ?? "Usuário Demonstração",
    email: `${id}@${tenant.id}.local`,
    role,
    allowedSupplierIds,
    tenantId: tenant.id,
  };
}

/** Só gestor/admin publica calibração e registra motivo de divergência. */
export function podeGerirAprendizado(usuario: UsuarioAutenticado): boolean {
  return usuario.role === "GESTOR" || usuario.role === "ADMIN";
}

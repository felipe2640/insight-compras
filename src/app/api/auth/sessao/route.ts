/** GET /api/auth/sessao — quem está logado (para a interface), ou 401. */

import { NextRequest, NextResponse } from "next/server";
import { obterUsuarioDaRequisicao, respostaNaoAutenticado, rotuloPapel } from "@/lib/autenticacao/servidor";
import { idProvedorConfigurado } from "@/lib/autenticacao";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioDaRequisicao(request);
  if (!usuario) return respostaNaoAutenticado();
  return NextResponse.json({
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      usuario: usuario.email,
      papel: usuario.role,
      papelRotulo: rotuloPapel(usuario.role),
      tenantId: usuario.tenantId,
      carteiraRestrita: usuario.allowedSupplierIds !== null,
    },
    provedor: idProvedorConfigurado(),
  });
}

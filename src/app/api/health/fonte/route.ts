import { NextRequest, NextResponse } from "next/server";
import { ErroContexto, contextoDaRequisicao } from "@/lib/contexto/contexto-requisicao";
import { respostaErroContexto } from "@/lib/contexto/resposta-erro";
import { resumirCapacidades } from "@adapters/capacidades";
import { obterAdaptadorInventario, capacidadesEfetivas } from "@adapters/index";
import { resolverTenantConfigurado } from "@config/tenants";

export const dynamic = "force-dynamic";

/**
 * Health da FONTE do cliente: conectividade e capacidades.
 *
 * Exige gestor/admin da própria rede, ou o token de monitoramento
 * (`HEALTH_TOKEN`) para ferramentas externas. Comprador não precisa disso, e
 * anônimo não pode fazer a plataforma consultar a fonte de ninguém.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const tokenMonitoramento = process.env.HEALTH_TOKEN?.trim();
  const tokenRecebido = request.headers.get("x-health-token")?.trim();

  if (tokenMonitoramento && tokenRecebido === tokenMonitoramento) {
    // Monitoramento externo: o cliente é o da INSTALAÇÃO, nunca o do cabeçalho.
    const tenant = resolverTenantConfigurado();
    const fonte = capacidadesEfetivas(obterAdaptadorInventario({ tenant }), tenant);
    const conectado = await fonte.verificarSaudeConexao();
    return NextResponse.json({
      tenant: tenant.id,
      conectado,
      capacidades: resumirCapacidades(fonte),
      timestamp: new Date().toISOString(),
    });
  }

  let contexto;
  try {
    contexto = await contextoDaRequisicao(request);
  } catch (erro) {
    if (erro instanceof ErroContexto) return respostaErroContexto(erro);
    throw erro;
  }

  const { usuario, tenant, fonte } = contexto;
  if (usuario.role !== "GESTOR" && usuario.role !== "ADMIN") {
    return NextResponse.json({ erro: "sem permissão" }, { status: 403 });
  }

  const conectado = await fonte.verificarSaudeConexao();
  return NextResponse.json({
    tenant: tenant.id,
    conectado,
    capacidades: resumirCapacidades(fonte),
    timestamp: new Date().toISOString(),
  });
}

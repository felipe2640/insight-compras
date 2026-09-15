import { NextRequest, NextResponse } from "next/server";
import { obterAdaptadorInventario } from "@adapters/index";
import { resolverTenantConfigurado, obterConfiguracaoTenant } from "@config/tenants";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse>;
export async function GET(): Promise<NextResponse>;
export async function GET(request?: NextRequest): Promise<NextResponse> {
  const tenantIdHeader = request?.headers?.get ? request.headers.get("x-tenant-id") : null;
  const tenant = tenantIdHeader ? obterConfiguracaoTenant(tenantIdHeader) : resolverTenantConfigurado();
  const adaptador = obterAdaptadorInventario({ tenant });
  const saudeConexao = await adaptador.verificarSaudeConexao();

  return NextResponse.json({
    status: "ok",
    versao: "1.0.0",
    plataforma: "iNSIGHT D - Copiloto de Inteligência de Compras",
    tenant: tenant.id,
    conexaoDados: saudeConexao ? "conectado" : "offline_mock",
    timestamp: new Date().toISOString(),
  });
}

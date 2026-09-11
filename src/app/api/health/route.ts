import { NextResponse } from "next/server";
import { obterAdaptadorInventario } from "@adapters/index";
import { resolverTenantConfigurado } from "@config/tenants";

export const dynamic = "force-dynamic";

export async function GET() {
  const adaptador = obterAdaptadorInventario();
  const saudeConexao = await adaptador.verificarSaudeConexao();
  const tenant = resolverTenantConfigurado();

  return NextResponse.json({
    status: "ok",
    versao: "1.0.0",
    plataforma: "iNSIGHT D - Copiloto de Inteligência de Compras",
    tenant: tenant.id,
    conexaoDados: saudeConexao ? "conectado" : "offline_mock",
    timestamp: new Date().toISOString(),
  });
}

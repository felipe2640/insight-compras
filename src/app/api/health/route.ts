import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Health PÚBLICO: responde se a aplicação está no ar. Nada além disso.
 *
 * Esta rota é pública e fora do middleware, e aceitava `x-tenant-id` do
 * cliente para então DISPARAR uma consulta à fonte daquele tenant. Qualquer
 * pessoa na internet podia fazer a plataforma consultar o Power BI de um
 * cliente, sem sessão. A checagem da fonte foi para /api/health/fonte.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    versao: "1.0.0",
    plataforma: "iNSIGHT D - Copiloto de Inteligência de Compras",
    timestamp: new Date().toISOString(),
  });
}

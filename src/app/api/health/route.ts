import { NextResponse } from "next/server";
import { obterAdaptadorInventario } from "@adapters/index";

export const dynamic = "force-dynamic";

export async function GET() {
  const adaptador = obterAdaptadorInventario();
  const saudeConexao = await adaptador.verificarSaudeConexao();

  return NextResponse.json({
    status: "ok",
    versao: "1.0.0",
    plataforma: "iNSIGHT D - Copiloto de Inteligência de Compras",
    tenant: "carreiro",
    conexaoDados: saudeConexao ? "conectado" : "offline_mock",
    timestamp: new Date().toISOString(),
  });
}

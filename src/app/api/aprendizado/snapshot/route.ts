/**
 * POST /api/aprendizado/snapshot
 * Captura, no clique de Exportar, a decisão do comprador × a sugestão do modelo.
 * Fire-and-forget do lado do cliente: NUNCA pode impedir o download.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { obterUsuarioDaRequisicao } from "@/lib/seguranca/usuario-requisicao";
import { gravarSnapshot } from "@/lib/aprendizado/repositorio";
import { supabaseConfigurado } from "@/lib/aprendizado/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PERFIS = ["ALTO_GIRO", "MEDIO_GIRO", "BAIXO_GIRO_INTERMITENTE", "SEM_HISTORICO_SUFICIENTE"] as const;

const esquemaItem = z.object({
  produtoId: z.number().int().positive(),
  sku: z.string().max(60),
  descricao: z.string().max(200),
  filialId: z.number().int().positive(),
  custo: z.number().nonnegative(),
  qtdComprador: z.number().nonnegative(),
  qtdTransferenciaComprador: z.number().nonnegative().default(0),
  qtdModelo: z.number().nonnegative().nullable(),
  qtdTransferenciaModelo: z.number().nonnegative().default(0),
  perfil: z.enum(PERFIS),
  consumoDiario: z.number().nonnegative(),
  horizonteDias: z.number().int().nonnegative(),
  margemAplicada: z.number(),
  fatorCalibracao: z.number().positive(),
  previsaoBruta: z.number().nonnegative(),
  elegivel: z.boolean(),
  motivoInelegibilidade: z.string().max(300).nullable(),
  sinalGovernanca: z.enum(["MANTER", "REDUZIR", "PAUSAR"]).nullable(),
});

const esquemaCorpo = z.object({
  filialId: z.number().int().positive(),
  layoutId: z.string().max(60),
  formato: z.enum(["csv", "xlsx", "pdf"]),
  itens: z.array(esquemaItem).min(1).max(2000),
});

export async function POST(request: NextRequest) {
  const usuario = obterUsuarioDaRequisicao(request);

  let corpo: z.infer<typeof esquemaCorpo>;
  try {
    corpo = esquemaCorpo.parse(await request.json());
  } catch (e) {
    return NextResponse.json(
      { gravado: false, erro: e instanceof z.ZodError ? "payload inválido" : "json inválido" },
      { status: 400 }
    );
  }

  if (!supabaseConfigurado()) {
    // Não configurado: não falhar a exportação — só sinalizar.
    return NextResponse.json({ gravado: false, motivo: "supabase_nao_configurado" });
  }

  try {
    const resultado = await gravarSnapshot({
      tenantId: usuario.tenantId,
      filialId: corpo.filialId,
      usuario: usuario.email,
      layoutId: corpo.layoutId,
      formato: corpo.formato,
      itens: corpo.itens,
    });
    return NextResponse.json(resultado);
  } catch (erro) {
    console.error("[aprendizado] snapshot não gravado:", erro);
    return NextResponse.json({ gravado: false, motivo: "erro_gravacao" }, { status: 502 });
  }
}

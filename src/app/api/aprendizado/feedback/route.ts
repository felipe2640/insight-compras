/**
 * POST /api/aprendizado/feedback
 * Registra o motivo da divergência (human-in-the-loop). Um por item — upsert.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { motivoValido } from "@core/aprendizado";
import { obterUsuarioDaRequisicao, podeGerirAprendizado, respostaNaoAutenticado } from "@/lib/autenticacao/servidor";
import { gravarFeedback } from "@/lib/aprendizado/repositorio";
import { aprendizadoConfigurado } from "@/lib/aprendizado/repositorio";

export const dynamic = "force-dynamic";

const esquema = z.object({
  itemId: z.number().int().positive(),
  motivo: z.string().refine(motivoValido, "motivo fora da taxonomia"),
  comentario: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const usuario = await obterUsuarioDaRequisicao(request);
  if (!usuario) return respostaNaoAutenticado();
  if (!podeGerirAprendizado(usuario)) {
    return NextResponse.json({ erro: "sem permissão" }, { status: 403 });
  }
  if (!aprendizadoConfigurado()) {
    return NextResponse.json({ erro: "supabase_nao_configurado" }, { status: 503 });
  }

  let corpo: z.infer<typeof esquema>;
  try {
    corpo = esquema.parse(await request.json());
  } catch {
    return NextResponse.json({ erro: "payload inválido" }, { status: 400 });
  }

  await gravarFeedback({
    tenantId: usuario.tenantId,
    itemId: corpo.itemId,
    motivo: corpo.motivo as Parameters<typeof gravarFeedback>[0]["motivo"],
    comentario: corpo.comentario?.trim() || null,
    usuario: usuario.email,
  });
  return NextResponse.json({ ok: true });
}

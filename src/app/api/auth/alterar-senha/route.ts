/**
 * POST /api/auth/alterar-senha — Altera a senha da própria conta autenticada.
 * Camada: Aplicação / Rotas de API (src/app/api/auth/alterar-senha/route.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  obterUsuarioDaRequisicao,
  respostaNaoAutenticado,
} from "@/lib/autenticacao/servidor";
import {
  obterProvedorAutenticacao,
  ErroCredenciaisInvalidas,
  ErroProvedorIndisponivel,
} from "@/lib/autenticacao";

export const dynamic = "force-dynamic";

const esquema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual."),
  novaSenha: z.string().min(8, "A nova senha deve ter no mínimo 8 caracteres."),
});

export async function POST(request: NextRequest) {
  const usuario = await obterUsuarioDaRequisicao(request);
  if (!usuario) return respostaNaoAutenticado();

  let corpo: z.infer<typeof esquema>;
  try {
    corpo = esquema.parse(await request.json());
  } catch (erro) {
    if (erro instanceof z.ZodError) {
      return NextResponse.json(
        { erro: erro.errors[0]?.message ?? "Dados inválidos para troca de senha." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { erro: "Dados inválidos para troca de senha." },
      { status: 400 }
    );
  }

  try {
    const provedor = obterProvedorAutenticacao();
    await provedor.alterarSenha(usuario.id, corpo.senhaAtual, corpo.novaSenha);
    return NextResponse.json({
      sucesso: true,
      mensagem: "Senha alterada com sucesso.",
    });
  } catch (erro) {
    if (erro instanceof ErroCredenciaisInvalidas) {
      return NextResponse.json({ erro: erro.message }, { status: 400 });
    }
    if (erro instanceof ErroProvedorIndisponivel) {
      return NextResponse.json({ erro: erro.message }, { status: 503 });
    }
    const msg = erro instanceof Error ? erro.message : "Falha ao alterar senha.";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

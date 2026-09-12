/**
 * GET  /api/admin/usuarios  -> lista os usuários do tenant
 * POST /api/admin/usuarios  -> cria um usuário
 *
 * Só administrador. A senha inicial é definida por quem cria e devolvida UMA
 * vez na resposta, para ser entregue à pessoa; não fica guardada em lugar
 * nenhum da plataforma.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ehAdministrador,
  obterUsuarioDaRequisicao,
  respostaNaoAutenticado,
  respostaSemPermissao,
} from "@/lib/autenticacao/servidor";
import {
  obterAdministradorUsuarios,
  ErroProvedorIndisponivel,
  normalizarNomeUsuario,
  REGEX_NOME_USUARIO,
} from "@/lib/autenticacao";

export const dynamic = "force-dynamic";

const esquema = z.object({
  usuario: z.string().trim().min(3).max(30),
  nome: z.string().trim().min(2).max(120),
  senha: z.string().min(8).max(200),
  papel: z.enum(["COMPRADOR", "GESTOR", "ADMIN"]),
  /** null = carteira irrestrita. Comprador sem carteira não enxerga fornecedor nenhum. */
  fornecedores: z.array(z.number().int().positive()).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioDaRequisicao(request);
  if (!usuario) return respostaNaoAutenticado();
  if (!ehAdministrador(usuario)) return respostaSemPermissao();

  try {
    const lista = await obterAdministradorUsuarios().listarUsuarios(usuario.tenantId);
    return NextResponse.json({ usuarios: lista });
  } catch (erro) {
    if (erro instanceof ErroProvedorIndisponivel) {
      return NextResponse.json({ erro: erro.message, usuarios: [] }, { status: 503 });
    }
    console.error("[admin/usuarios] falha ao listar:", erro);
    return NextResponse.json({ erro: "falha ao listar usuários" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const solicitante = await obterUsuarioDaRequisicao(request);
  if (!solicitante) return respostaNaoAutenticado();
  if (!ehAdministrador(solicitante)) return respostaSemPermissao();

  let corpo: z.infer<typeof esquema>;
  try {
    corpo = esquema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { erro: "confira os campos: usuário, nome, senha de 8 caracteres e papel" },
      { status: 400 }
    );
  }

  const nomeUsuario = normalizarNomeUsuario(corpo.usuario);
  if (!nomeUsuario) {
    return NextResponse.json(
      {
        erro: `usuário inválido. Use de 3 a 30 caracteres: minúsculas, números, ponto, hífen ou sublinhado (${REGEX_NOME_USUARIO.source}).`,
      },
      { status: 400 }
    );
  }

  try {
    const criado = await obterAdministradorUsuarios().criarUsuario({
      usuario: nomeUsuario,
      senha: corpo.senha,
      nome: corpo.nome,
      papel: corpo.papel,
      tenantId: solicitante.tenantId,
      fornecedores: corpo.fornecedores ?? null,
    });
    return NextResponse.json({ criado }, { status: 201 });
  } catch (erro) {
    if (erro instanceof ErroProvedorIndisponivel) {
      return NextResponse.json({ erro: erro.message }, { status: 503 });
    }
    console.error("[admin/usuarios] falha ao criar:", erro);
    return NextResponse.json({ erro: "falha ao criar usuário" }, { status: 500 });
  }
}

const esquemaStatus = z.object({
  id: z.string().min(1),
  acao: z.enum(["desativar", "reativar"]),
});

export async function PATCH(request: NextRequest) {
  const solicitante = await obterUsuarioDaRequisicao(request);
  if (!solicitante) return respostaNaoAutenticado();
  if (!ehAdministrador(solicitante)) return respostaSemPermissao();

  let corpo: z.infer<typeof esquemaStatus>;
  try {
    corpo = esquemaStatus.parse(await request.json());
  } catch {
    return NextResponse.json(
      { erro: "Parâmetros inválidos. Informe o id do usuário e a ação ('desativar' ou 'reativar')." },
      { status: 400 }
    );
  }

  if (corpo.id === solicitante.id && corpo.acao === "desativar") {
    return NextResponse.json(
      { erro: "Você não pode desativar a sua própria conta de administrador." },
      { status: 400 }
    );
  }

  try {
    const admin = obterAdministradorUsuarios();
    if (corpo.acao === "desativar") {
      await admin.desativarUsuario(corpo.id);
    } else {
      await admin.reativarUsuario(corpo.id);
    }
    return NextResponse.json({ sucesso: true, acao: corpo.acao });
  } catch (erro) {
    if (erro instanceof ErroProvedorIndisponivel) {
      return NextResponse.json({ erro: erro.message }, { status: 503 });
    }
    console.error(`[admin/usuarios] falha ao ${corpo.acao}:`, erro);
    return NextResponse.json({ erro: `falha ao ${corpo.acao} usuário` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const solicitante = await obterUsuarioDaRequisicao(request);
  if (!solicitante) return respostaNaoAutenticado();
  if (!ehAdministrador(solicitante)) return respostaSemPermissao();

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ erro: "Parâmetro 'id' do usuário é obrigatório." }, { status: 400 });
  }

  if (id === solicitante.id) {
    return NextResponse.json(
      { erro: "Você não pode desativar a sua própria conta de administrador." },
      { status: 400 }
    );
  }

  try {
    await obterAdministradorUsuarios().desativarUsuario(id);
    return NextResponse.json({ sucesso: true, desativado: id });
  } catch (erro) {
    if (erro instanceof ErroProvedorIndisponivel) {
      return NextResponse.json({ erro: erro.message }, { status: 503 });
    }
    console.error("[admin/usuarios] falha ao desativar:", erro);
    return NextResponse.json({ erro: "falha ao desativar usuário" }, { status: 500 });
  }
}


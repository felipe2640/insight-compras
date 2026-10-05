/**
 * GET    /api/exportacao/modelos       -> modelos de fábrica + salvos
 * POST   /api/exportacao/modelos       -> salva um modelo
 * DELETE /api/exportacao/modelos?id=x  -> apaga um salvo
 *
 * Modelo de fábrica não é apagável: ele vem do arquivo do tenant e é o padrão
 * que o cliente recebe no primeiro dia.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  obterUsuarioDaRequisicao,
  podeGerirAprendizado,
  respostaNaoAutenticado,
  respostaSemPermissao,
} from "@/lib/autenticacao/servidor";
import { obterTenantAtivo } from "@/lib/cockpit/opcoes-tenant";
import { IDS_COLUNAS_EXPORTACAO } from "@/lib/exportacao/catalogo-colunas";
import {
  ModeloExportacao,
  idDoModelo,
  mesclarModelos,
  modelosDeFabrica,
  validarModelo,
} from "@/lib/exportacao/modelos";
import {
  excluirModelo,
  listarModelosSalvos,
  modelosPersistidos,
  salvarModelo,
} from "@/lib/exportacao/modelos-repositorio";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioDaRequisicao(request);
  if (!usuario) return respostaNaoAutenticado();

  const tenant = obterTenantAtivo(usuario.tenantId);
  const fabrica = modelosDeFabrica(tenant.exportacao);
  const salvos = await listarModelosSalvos(usuario.tenantId);

  return NextResponse.json({
    modelos: mesclarModelos(fabrica, salvos),
    podeSalvar: modelosPersistidos() && podeGerirAprendizado(usuario),
    persistencia: modelosPersistidos(),
  });
}

export async function POST(request: NextRequest) {
  const usuario = await obterUsuarioDaRequisicao(request);
  if (!usuario) return respostaNaoAutenticado();
  // Modelo é configuração do cliente, não preferência pessoal: quem salva é
  // quem responde pela operação.
  if (!podeGerirAprendizado(usuario)) return respostaSemPermissao();

  if (!modelosPersistidos()) {
    return NextResponse.json(
      { erro: "Não é possível salvar modelos no momento. Tente novamente mais tarde." },
      { status: 503 }
    );
  }

  let corpo: Partial<ModeloExportacao>;
  try {
    corpo = (await request.json()) as Partial<ModeloExportacao>;
  } catch {
    return NextResponse.json({ erro: "json inválido" }, { status: 400 });
  }

  const erros = validarModelo(corpo, IDS_COLUNAS_EXPORTACAO);
  if (erros.length > 0) {
    return NextResponse.json({ erro: erros[0].mensagem, erros }, { status: 400 });
  }

  const modelo: ModeloExportacao = {
    id: corpo.id?.trim() || idDoModelo(corpo.nome ?? ""),
    nome: (corpo.nome ?? "").trim(),
    escopo: corpo.escopo!,
    formato: corpo.formato!,
    colunas: corpo.colunas!,
    rotulosPersonalizados: corpo.rotulosPersonalizados,
    csv: corpo.csv,
    nomeArquivo: corpo.nomeArquivo?.trim() || "{tenant} {loja} {data} {layout}",
    tituloPdf: corpo.tituloPdf,
    deFabrica: false,
  };

  try {
    await salvarModelo(usuario.tenantId, modelo, usuario.nome);
    return NextResponse.json({ modelo }, { status: 201 });
  } catch (erro) {
    console.error("[exportacao] falha ao salvar modelo:", erro);
    return NextResponse.json({ erro: "falha ao salvar o modelo" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const usuario = await obterUsuarioDaRequisicao(request);
  if (!usuario) return respostaNaoAutenticado();
  if (!podeGerirAprendizado(usuario)) return respostaSemPermissao();

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ erro: "informe o id do modelo" }, { status: 400 });

  const tenant = obterTenantAtivo(usuario.tenantId);
  if (modelosDeFabrica(tenant.exportacao).some((m) => m.id === id)) {
    return NextResponse.json(
      { erro: "Modelo de fábrica não pode ser apagado. Ajuste-o salvando por cima." },
      { status: 409 }
    );
  }

  try {
    await excluirModelo(usuario.tenantId, id);
    return NextResponse.json({ excluido: id });
  } catch (erro) {
    console.error("[exportacao] falha ao excluir modelo:", erro);
    return NextResponse.json({ erro: "falha ao excluir o modelo" }, { status: 500 });
  }
}

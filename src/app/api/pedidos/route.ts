import { NextRequest, NextResponse } from "next/server";
import { servicoAuditoriaPadrao } from "@/lib/auditoria";
import { UsuarioAutenticado } from "@/lib/rbac/tipos";
import { CABECALHOS_SEGURANCA_HTTP } from "@/lib/seguranca/headers";

export const dynamic = "force-dynamic";

/**
 * Endpoint de Registro e Consulta da Trilha Imutável de Auditoria de Pedidos
 * Rota: /api/pedidos (POST: registrar ação/pedido, GET: consultar trilha e KPIs)
 * 100% em Português do Brasil (pt-BR).
 */
export async function POST(request: NextRequest) {
  try {
    const corpo = await request.json();

    const roleHeader = (request.headers.get("x-user-role") ?? "COMPRADOR").toUpperCase();
    const userId = request.headers.get("x-user-id") ?? "comprador-01";
    const userNome = request.headers.get("x-user-nome") ?? "Comprador Responsável";

    const usuario: UsuarioAutenticado = {
      id: userId,
      nome: userNome,
      email: `${userId}@carreiro.com.br`,
      role: roleHeader === "GESTOR" ? "GESTOR" : "COMPRADOR",
      allowedSupplierIds: null,
      tenantId: "carreiro",
    };

    const registro = await servicoAuditoriaPadrao.registrarDecisao({
      usuario,
      filialId: corpo.filialId ?? 1,
      filialNome: corpo.filialNome ?? "Carreiro Pedro II",
      produtoId: corpo.produtoId,
      codigoSku: corpo.codigoSku,
      descricaoProduto: corpo.descricaoProduto,
      fornecedorId: corpo.fornecedorId,
      nomeFornecedor: corpo.nomeFornecedor,
      quantidadeSugerida: corpo.quantidadeSugerida ?? 0,
      quantidadeDigitada: corpo.quantidadeDigitada,
      precoCusto: corpo.precoCusto ?? 0,
      justificativaOverride: corpo.justificativaOverride,
    });

    const resposta = NextResponse.json({
      sucesso: true,
      mensagem: "Pedido registrado na trilha imutável com sucesso",
      registro,
    });

    for (const [chave, valor] of Object.entries(CABECALHOS_SEGURANCA_HTTP)) {
      resposta.headers.set(chave, valor);
    }

    return resposta;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Erro ao processar pedido";
    return NextResponse.json(
      { sucesso: false, erro: "Falha no Registro de Pedido", mensagem },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenantId") ?? "carreiro";
    const filialId = searchParams.get("filialId");
    const compradorId = searchParams.get("compradorId");

    const [trilha, kpis] = await Promise.all([
      servicoAuditoriaPadrao.consultarTrilha({
        tenantId,
        filialId: filialId ? parseInt(filialId, 10) : undefined,
        compradorId: compradorId ?? undefined,
      }),
      servicoAuditoriaPadrao.calcularKpisGerenciais(tenantId),
    ]);

    const resposta = NextResponse.json({
      sucesso: true,
      totalRegistros: trilha.length,
      kpis,
      trilha,
    });

    for (const [chave, valor] of Object.entries(CABECALHOS_SEGURANCA_HTTP)) {
      resposta.headers.set(chave, valor);
    }

    return resposta;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Erro ao consultar trilha";
    return NextResponse.json(
      { sucesso: false, erro: "Falha na Consulta de Auditoria", mensagem },
      { status: 500 }
    );
  }
}

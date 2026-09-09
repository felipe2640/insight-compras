import { NextRequest, NextResponse } from "next/server";
import { obterAdaptadorInventario } from "@adapters/index";
import { aplicarGuardrailInventarioServerSide } from "@/lib/rbac/validador-carteira";
import { ErroAcessoNegado } from "@/lib/rbac/tipos";
import { obterUsuarioDaRequisicao, respostaNaoAutenticado } from "@/lib/autenticacao/servidor";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { montarOpcoesMatrizComPublicados } from "@/lib/aprendizado/parametros-motor";
import { CABECALHOS_SEGURANCA_HTTP } from "@/lib/seguranca/headers";

export const dynamic = "force-dynamic";

/**
 * Endpoint da Matriz de Decisão do Cockpit de Compras
 * Rota: GET /api/compras
 * 100% em Português do Brasil (pt-BR).
 */
export async function GET(request: NextRequest) {
  const inicio = Date.now();
  const searchParams = request.nextUrl.searchParams;

  try {
    // 1. Identidade: sessão validada pelo provedor (nunca cabeçalhos x-user-*)
    const usuario = await obterUsuarioDaRequisicao(request);
    if (!usuario) return respostaNaoAutenticado();

    // 2. Parâmetros de Filtro Solicitados
    const fornecedorQuery = searchParams.get("fornecedorId");
    const secaoQuery = searchParams.get("secaoId");
    const filialQuery = searchParams.get("filialId");

    const fornecedoresSolicitados = fornecedorQuery
      ? [parseInt(fornecedorQuery, 10)]
      : null;

    const secaoId = secaoQuery ? parseInt(secaoQuery, 10) : undefined;
    const filialId = filialQuery ? parseInt(filialQuery, 10) : 1;

    // 3. Aplicação do Guardrail Server-Side (RBAC) - Lança 403 se violar carteira
    const filtroValidado = aplicarGuardrailInventarioServerSide(usuario, {
      fornecedoresPermitidos: fornecedoresSolicitados,
      secaoId,
      filialId,
    });

    const provedorQuery = searchParams.get("provedor")?.toUpperCase();
    const tipoProvedor =
      provedorQuery === "CARREIRO" || provedorQuery === "MOCK"
        ? provedorQuery
        : undefined;

    // 4. Carregamento Resiliente via Adaptador de Inventário
    const adaptador = obterAdaptadorInventario({ tipo: tipoProvedor });
    const carga = await adaptador.carregarInventarioCompleto(filtroValidado);

    // 5. Transformação Canônica em Linhas da Matriz de Decisão
    const linhas = converterParaLinhasCockpit(carga, await montarOpcoesMatrizComPublicados(filialId));

    const tempoExecucaoMs = Date.now() - inicio;

    const resposta = NextResponse.json({
      sucesso: true,
      total: linhas.length,
      filialFocoId: filialId,
      tempoExecucaoMs,
      provedorDados: carga.metadados.provedor,
      dados: linhas,
    });

    // Injeta cabeçalhos de segurança HTTP
    for (const [chave, valor] of Object.entries(CABECALHOS_SEGURANCA_HTTP)) {
      resposta.headers.set(chave, valor);
    }

    return resposta;
  } catch (erro) {
    if (erro instanceof ErroAcessoNegado) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "Acesso Negado à Carteira Solicitada",
          mensagem: erro.message,
        },
        { status: 403 }
      );
    }

    const mensagem = erro instanceof Error ? erro.message : "Erro interno do servidor";
    return NextResponse.json(
      {
        sucesso: false,
        erro: "Falha ao Carregar Matriz de Compras",
        mensagem,
      },
      { status: 500 }
    );
  }
}

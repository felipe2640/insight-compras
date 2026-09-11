import { NextRequest, NextResponse } from "next/server";
import { obterAdaptadorInventario } from "@adapters/index";
import { aplicarGuardrailInventarioServerSide } from "@/lib/rbac/validador-carteira";
import { ErroAcessoNegado } from "@/lib/rbac/tipos";
import { obterUsuarioDaRequisicao, respostaNaoAutenticado } from "@/lib/autenticacao/servidor";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { montarOpcoesMatrizComPublicados } from "@/lib/aprendizado/parametros-motor";
import { CABECALHOS_SEGURANCA_HTTP } from "@/lib/seguranca/headers";
import { codificarGradeTabular } from "@/lib/cockpit/codificacao-tabular";
import { contarStatusGrade, separarAcionaveis } from "@/lib/cockpit/escopo-grade";

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

    // 2.1 Falha fechada no servidor para comprador sem carteira homologada (recebe lista vazia)
    const qtdFornecedoresCarteira = !usuario.allowedSupplierIds
      ? 0
      : Array.isArray(usuario.allowedSupplierIds)
      ? usuario.allowedSupplierIds.length
      : (usuario.allowedSupplierIds as ReadonlySet<number>).size;
    if (usuario.role === "COMPRADOR" && (!usuario.allowedSupplierIds || qtdFornecedoresCarteira === 0)) {
      if (fornecedoresSolicitados && fornecedoresSolicitados.length > 0) {
        return NextResponse.json(
          {
            sucesso: false,
            erro: "Acesso Negado à Carteira Solicitada",
            mensagem: "Comprador sem nenhum fornecedor associado à sua carteira.",
          },
          { status: 403 }
        );
      }
      const escopo = searchParams.get("escopo") === "acionaveis" ? "acionaveis" : "todos";
      const tabular = searchParams.get("formato") === "tabular";
      const tempoExecucaoMs = Date.now() - inicio;
      const respostaVazia = NextResponse.json({
        sucesso: true,
        total: 0,
        escopo,
        contagens: { acionaveis: 0, monitorar: 0, saudavel: 0, excesso: 0, zerado: 0 },
        filialFocoId: filialId,
        tempoExecucaoMs,
        provedorDados: "VAZIO",
        ...(tabular
          ? { grade: codificarGradeTabular([]) }
          : { dados: [] }),
      });
      for (const [chave, valor] of Object.entries(CABECALHOS_SEGURANCA_HTTP)) {
        respostaVazia.headers.set(chave, valor);
      }
      return respostaVazia;
    }

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

    // Escopo: a grade abre com o que pede decisão e completa o catálogo depois.
    // As contagens saem SEMPRE do conjunto completo — os chips não podem mentir
    // enquanto o restante ainda está a caminho.
    const escopo = searchParams.get("escopo") === "acionaveis" ? "acionaveis" : "todos";
    const contagens = contarStatusGrade(linhas);
    const linhasDoEscopo = escopo === "acionaveis" ? separarAcionaveis(linhas).acionaveis : linhas;

    const tempoExecucaoMs = Date.now() - inicio;

    // Formato tabular: mesmo conteúdo, sem repetir o nome dos 94 campos em cada
    // uma das ~19 mil linhas (medido: 48,4 MB -> 15,1 MB).
    const tabular = searchParams.get("formato") === "tabular";
    const resposta = NextResponse.json({
      sucesso: true,
      total: linhasDoEscopo.length,
      escopo,
      contagens,
      filialFocoId: filialId,
      tempoExecucaoMs,
      provedorDados: carga.metadados.provedor,
      ...(tabular
        ? { grade: codificarGradeTabular(linhasDoEscopo) }
        : { dados: linhasDoEscopo }),
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

import { NextRequest, NextResponse } from "next/server";
import { aplicarGuardrailInventarioServerSide } from "@/lib/rbac/validador-carteira";
import { ErroAcessoNegado, ErroViolacaoTenant } from "@/lib/rbac/tipos";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { montarOpcoesMatrizComPublicados } from "@/lib/aprendizado/parametros-motor";
import { CABECALHOS_SEGURANCA_HTTP } from "@/lib/seguranca/headers";
import { codificarGradeTabular } from "@/lib/cockpit/codificacao-tabular";
import { contarStatusGrade, separarAcionaveis } from "@/lib/cockpit/escopo-grade";
import { ErroContexto, contextoDaRequisicao } from "@/lib/contexto/contexto-requisicao";
import { respostaErroContexto } from "@/lib/contexto/resposta-erro";
import {
  listarIdsProdutosEmPedidosAtivos,
  removerProdutosEmPedidosAtivos,
} from "@/lib/pedidos/produtos-pendentes";

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
    // 1. Identidade, cliente e fonte: um lugar só, que nega quando divergem.
    const contexto = await contextoDaRequisicao(request);
    const { usuario, tenant } = contexto;

    // 2. Parâmetros de Filtro Solicitados
    const fornecedorQuery = searchParams.get("fornecedorId");
    const secaoQuery = searchParams.get("secaoId");
    const filialQuery = searchParams.get("filialId");

    const fornecedoresSolicitados = fornecedorQuery
      ? [parseInt(fornecedorQuery, 10)]
      : null;

    const secaoId = secaoQuery ? parseInt(secaoQuery, 10) : undefined;
    // Loja em foco: a pedida, ou a do CADASTRO do cliente. Nunca a filial 1
    // por convenção — um cliente cujas lojas começam em outro número via a
    // grade de uma loja que não existe.
    const filialId = filialQuery ? parseInt(filialQuery, 10) : contexto.filialFocoId;

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
        provedorDados: contexto.fonte.natureza === "sintetica" ? "MOCK_SINTETICO" : "POWERBI_FABRIC_DAX",
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

    /**
     * A fonte vem do CONTEXTO, não da URL.
     *
     * Havia um `?provedor=MOCK` que trocava o estoque real pelo gerador
     * sintético para qualquer usuário autenticado, sem nada na tela avisar.
     * Quem precisa de dado sintético usa o tenant de demonstração.
     */
    const carga = await contexto.carregarInventario(filtroValidado);

    // 5. Transformação Canônica em Linhas da Matriz de Decisão
    const linhasCalculadas = converterParaLinhasCockpit(
      carga,
      await montarOpcoesMatrizComPublicados(filialId, tenant)
    );
    const linhas = removerProdutosEmPedidosAtivos(
      linhasCalculadas,
      await listarIdsProdutosEmPedidosAtivos(tenant.id, filialId),
    );

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
    if (erro instanceof ErroContexto) {
      return respostaErroContexto(erro);
    }

    if (erro instanceof ErroViolacaoTenant) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "Violação de Isolamento de Tenant",
          mensagem: erro.message,
        },
        { status: 403 }
      );
    }

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

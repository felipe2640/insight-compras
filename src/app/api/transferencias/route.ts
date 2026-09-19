import { NextRequest, NextResponse } from "next/server";
import { ErroContexto, contextoDaRequisicao } from "@/lib/contexto/contexto-requisicao";
import { respostaErroContexto } from "@/lib/contexto/resposta-erro";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { montarOpcoesMatrizComPublicados } from "@/lib/aprendizado/parametros-motor";
import { aplicarGuardrailInventarioServerSide } from "@/lib/rbac/validador-carteira";
import { ErroAcessoNegado } from "@/lib/rbac/tipos";
import { CABECALHOS_SEGURANCA_HTTP } from "@/lib/seguranca/headers";

export const dynamic = "force-dynamic";
/**
 * Mesmo teto da API do cockpit (padrão da Vercel com Fluid Compute).
 *
 * Estava em 60 s, e a carga da rede passa disso: medido ao vivo em 19/09/2026,
 * as 5 consultas de posição de estoque (uma por loja, em paralelo) levam de
 * 57 a 78 s cada contra o Power BI da Carreiro. O cockpit não declarava limite
 * e funcionava; esta rota cortava em 60 s e a tela mostrava "a consulta demorou
 * mais de 60 segundos" — na produção também, não só no preview.
 *
 * O navegador usa um limite pouco menor que este (ver src/app/transferencias).
 */
export const maxDuration = 300;

/**
 * Retorna somente os remanejamentos da rede.
 *
 * A carga do Power BI já contém todas as filiais. Portanto ela deve acontecer
 * uma única vez: carregar uma grade completa por loja multiplicava por cinco
 * as consultas, a CPU e respostas de ~15 MB e fazia a tela expirar em produção.
 */
export async function GET(request: NextRequest) {
  try {
    const contexto = await contextoDaRequisicao(request);
    const { usuario, tenant } = contexto;
    /**
     * Só itens com estoque ou venda. Item sem saldo e sem venda não tem o que
     * transferir nem para quem — e sem este recorte a carga trazia o catálogo
     * inteiro da rede. Medido ao vivo: 130,8 s sem recorte contra 64,1 s com
     * ele, e as MESMAS 1.302 transferências nos dois casos.
     */
    const filtro = aplicarGuardrailInventarioServerSide(usuario, {
      apenasComEstoqueOuVenda: true,
    });
    const carga = await contexto.carregarInventario(filtro);

    const resultados = await Promise.all(
      tenant.filiais.map(async (filial) => {
        const linhas = converterParaLinhasCockpit(
          carga,
          await montarOpcoesMatrizComPublicados(filial.filialId, tenant)
        );

        return linhas.flatMap((linha) => {
          const quantidade = linha.quantidadeTransferenciaSugerida ?? 0;
          const filialOrigemNome = linha.filialOrigemTransferenciaNome;
          const filialOrigemId = linha.filialOrigemTransferenciaId ?? 0;
          if (quantidade <= 0 || !filialOrigemNome) return [];

          const saldoOrigem = linha.saldoOrigemTransferencia ?? 0;
          const sobraRealOrigem = linha.sobraRealOrigemTransferencia ?? 0;
          const estoqueMinimoOrigem =
            linha.estoqueMinimoOrigemTransferencia ??
            Math.max(0, saldoOrigem - sobraRealOrigem);
          const precoCusto = linha.precoCusto ?? 0;

          return [{
            id: `${linha.produtoId}:${filialOrigemId}:${filial.filialId}`,
            produtoId: linha.produtoId,
            codigoSku: linha.codigoSku,
            descricao: linha.descricao,
            marca: linha.marca || "—",
            filialOrigemId,
            filialOrigemNome,
            filialDestinoId: filial.filialId,
            filialDestinoNome: filial.nome,
            quantidade,
            precoCusto,
            valorTotal: quantidade * precoCusto,
            saldoOrigem,
            estoqueMinimoOrigem,
            sobraRealOrigem,
            saldoOrigemApos: saldoOrigem - quantidade,
            necessidadeDestino: linha.necessidadeDestinoTransferencia ?? quantidade,
            motivo: linha.motivoDecisao ?? undefined,
          }];
        });
      })
    );

    const resposta = NextResponse.json({
      sucesso: true,
      dados: resultados.flat(),
      provedorDados: carga.metadados.provedor,
    });
    for (const [chave, valor] of Object.entries(CABECALHOS_SEGURANCA_HTTP)) {
      resposta.headers.set(chave, valor);
    }
    return resposta;
  } catch (erro) {
    if (erro instanceof ErroContexto) {
      return respostaErroContexto(erro);
    }

    const status = erro instanceof ErroAcessoNegado ? 403 : 500;
    return NextResponse.json(
      {
        sucesso: false,
        erro: "Falha ao carregar transferências",
        mensagem: erro instanceof Error ? erro.message : "Erro interno do servidor",
      },
      { status }
    );
  }
}

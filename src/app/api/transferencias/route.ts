import { NextRequest, NextResponse } from "next/server";
import { obterAdaptadorInventario } from "@adapters/index";
import { obterUsuarioDaRequisicao, respostaNaoAutenticado } from "@/lib/autenticacao/servidor";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { montarOpcoesMatrizComPublicados } from "@/lib/aprendizado/parametros-motor";
import { aplicarGuardrailInventarioServerSide } from "@/lib/rbac/validador-carteira";
import { ErroAcessoNegado } from "@/lib/rbac/tipos";
import { CABECALHOS_SEGURANCA_HTTP } from "@/lib/seguranca/headers";
import { obterConfiguracaoTenant } from "@config/tenants";
import { carregarConfiguracaoLotes } from "@/lib/configuracao/lotes-repositorio";

export const dynamic = "force-dynamic";
// Compatível com o teto do plano Hobby mesmo quando Fluid Compute está desativado.
// O navegador usa o mesmo limite e nunca fica preso em carregamento indefinido.
export const maxDuration = 60;

/**
 * Retorna somente os remanejamentos da rede.
 *
 * A carga do Power BI já contém todas as filiais. Portanto ela deve acontecer
 * uma única vez: carregar uma grade completa por loja multiplicava por cinco
 * as consultas, a CPU e respostas de ~15 MB e fazia a tela expirar em produção.
 */
export async function GET(request: NextRequest) {
  try {
    const usuario = await obterUsuarioDaRequisicao(request);
    if (!usuario) return respostaNaoAutenticado();

    const tenantBase = obterConfiguracaoTenant(usuario.tenantId);
    const lotes = await carregarConfiguracaoLotes(usuario.tenantId, tenantBase.parametrosMotor.lotes);
    const tenant = { ...tenantBase, parametrosMotor: { ...tenantBase.parametrosMotor, lotes } };
    const filtro = aplicarGuardrailInventarioServerSide(usuario, {});
    const adaptador = obterAdaptadorInventario({ tenant });
    const carga = await adaptador.carregarInventarioCompleto(filtro);

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

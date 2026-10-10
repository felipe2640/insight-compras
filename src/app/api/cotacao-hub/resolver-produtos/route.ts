import { NextRequest } from "next/server";
import { z } from "zod";
import { contextoDaRequisicao, ErroContexto } from "@/lib/contexto/contexto-requisicao";
import { respostaErroContexto } from "@/lib/contexto/resposta-erro";
import { exigirOrigemMesma } from "@/lib/cotacao-hub/server-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  /** Códigos base dos itens (SKU ou produtoId com pad de 6). Máx. 300. */
  codigos: z.array(z.string().trim().min(1).max(40)).min(1).max(300),
}).strict();

/**
 * POST /api/cotacao-hub/resolver-produtos
 *
 * Resolve marca, referência, descrição e MARCAS SIMILARES CADASTRADAS de um
 * recorte de itens, usando a capacidade tipada `catalogoCotacao` da FONTE.
 *
 * Por que esta rota existe: a lista de catálogo vinha embutida no
 * GET /api/cotacao-hub, que pagava a carga COMPLETA de inventário
 * (159 mil produtos + 174 mil similares no Fabric) e devolvia um JSON
 * gigantesco — o modal da cotação compilada travava nisso e, quando a
 * resposta estourava, chegava sem catálogo e todos os itens perdiam a
 * marca. Aqui a fonte resolve APENAS os itens pedidos (duas consultas
 * leves, ~1 s no total, validadas ao vivo).
 *
 * Deliberadamente INDEPENDENTE da conexão com o Hub: marca/referência vêm
 * do catálogo da fonte (Power BI), não do Cotação Hub — a falta de
 * INSIGHT_HUB_CONFIG_JSON não pode deixar o comprador sem marca na prévia.
 * O envio ao Hub continua exigindo a conexão completa (fail-closed).
 *
 * Visibilidade: mesmo membro autenticado do tenant que vê o histórico de
 * pedidos da rede (rede-wide por decisão da rota irmã); a resposta carrega
 * atributos de cadastro (marca/ref), sem preços — estritamente menos que a
 * grade do cockpit já mostra.
 */
export async function POST(request: NextRequest) {
  try {
    exigirOrigemMesma(request);
  } catch {
    return Response.json({ erro: "Origem da requisição não autorizada." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const context = await contextoDaRequisicao(request);
    if (Number(request.headers.get("content-length") ?? 0) > 64_000) return new Response(null, { status: 413 });
    const corpo = corpoSchema.parse(await request.json());

    const codigos = [...new Set(corpo.codigos)].filter((codigo) => /^[A-Za-z0-9-|]{1,40}$/.test(codigo)).slice(0, 300);
    if (codigos.length === 0) {
      return Response.json({ produtos: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const capacidade = context.fonte.catalogoCotacao;
    if (!capacidade) {
      return Response.json(
        { erro: "A fonte desta instalação não resolve recorte de catálogo; a prévia segue com os dados do pedido." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const produtos = await capacidade.resolverProdutos(codigos);
    return Response.json(
      { produtos: produtos.map((p) => ({ codigo: p.codigo, descricao: p.descricao, marca: p.marca, referencia: p.referencia, marcasSimilares: p.marcasSimilares })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (erro) {
    if (erro instanceof ErroContexto) return respostaErroContexto(erro);
    console.error("[cotacao-hub] Erro no resolver-produtos:", erro);
    return Response.json(
      { erro: "Não foi possível resolver os itens no catálogo da fonte." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

/**
 * POST /api/aprendizado/confirmar?janela=10&dias=45
 * Fecha o ciclo: para cada item exportado, confronta o que entrou de fato na
 * loja dentro da janela. Idempotente — reprocessa só o que ainda está aguardando.
 */

import { NextRequest, NextResponse } from "next/server";
import { confirmarEntrada, janelaFechou, JANELA_CONFIRMACAO } from "@core/aprendizado";
import { podeGerirAprendizado } from "@/lib/autenticacao/servidor";
import { listarItensParaConfirmar, gravarConfirmacoes } from "@/lib/aprendizado/repositorio";
import { aprendizadoConfigurado } from "@/lib/aprendizado/repositorio";
import { ErroContexto, contextoDaRequisicao } from "@/lib/contexto/contexto-requisicao";
import { respostaErroContexto } from "@/lib/contexto/resposta-erro";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let contexto;
  try {
    contexto = await contextoDaRequisicao(request);
  } catch (erro) {
    if (erro instanceof ErroContexto) return respostaErroContexto(erro);
    throw erro;
  }
  const { usuario, fonte } = contexto;
  if (!podeGerirAprendizado(usuario)) {
    return NextResponse.json({ erro: "sem permissão" }, { status: 403 });
  }
  if (!aprendizadoConfigurado()) {
    return NextResponse.json({ erro: "supabase_nao_configurado" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const janela = Math.min(
    JANELA_CONFIRMACAO.MAX_DIAS,
    Math.max(JANELA_CONFIRMACAO.MIN_DIAS, parseInt(searchParams.get("janela") ?? "", 10) || JANELA_CONFIRMACAO.PADRAO_DIAS)
  );
  const dias = Math.min(180, Math.max(janela, parseInt(searchParams.get("dias") ?? "45", 10) || 45));

  /**
   * Sem a capacidade de conferir entradas na fonte, o ciclo fecha em modo
   * SIMULADO. A rota importava o cliente do Power BI direto e perguntava "é a
   * Carreiro?"; agora quem responde é a capacidade da fonte, então um cliente
   * novo com outro ERP entra sem tocar neste arquivo.
   */
  if (!fonte.entradasConfirmadas) {
    const pendentes = await listarItensParaConfirmar({ tenantId: usuario.tenantId, dias });
    const confirmacoes = pendentes.map((item) => ({
      itemId: item.id,
      janelaDias: janela,
      qtdEntrada: item.qtdPedida,
      qtdTransferida: 0,
      status: "confirmado" as const,
    }));
    if (confirmacoes.length > 0) {
      await gravarConfirmacoes(usuario.tenantId, confirmacoes);
    }
    return NextResponse.json({
      processados: confirmacoes.length,
      consultasPowerBI: 0,
      janelaDias: janela,
      diasAnalisados: dias,
      origem: "simulada",
    });
  }

  const pendentes = await listarItensParaConfirmar({ tenantId: usuario.tenantId, dias });
  const agora = new Date();

  // Agrupa por (snapshot, loja): uma consulta de entradas por grupo.
  const grupos = new Map<string, typeof pendentes>();
  for (const item of pendentes) {
    const chave = `${item.snapshotId}:${item.filialId}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  }

  const confirmacoes: Parameters<typeof gravarConfirmacoes>[1][number][] = [];
  let consultas = 0;

  for (const itens of grupos.values()) {
    const exportadoEm = new Date(itens[0].exportadoEm);
    const fim = new Date(Math.min(agora.getTime(), exportadoEm.getTime() + janela * 86_400_000));
    const fechada = janelaFechou(exportadoEm, agora, janela);
    const diasJanela = Math.max(
      1,
      Math.ceil((fim.getTime() - exportadoEm.getTime()) / 86_400_000)
    );

    const entradas = await fonte.entradasConfirmadas.listarEntradas(
      itens.map((i) => i.produtoId),
      diasJanela
    );
    consultas += 1;

    const porProduto = new Map<number, number>();
    for (const entrada of entradas) {
      if (entrada.filialId !== null && entrada.filialId !== itens[0].filialId) continue;
      porProduto.set(
        entrada.produtoId,
        (porProduto.get(entrada.produtoId) ?? 0) + entrada.quantidadeEntrada
      );
    }

    for (const item of itens) {
      const r = confirmarEntrada(
        item.qtdPedida,
        { qtdEntrada: porProduto.get(item.produtoId) ?? 0, qtdTransferida: 0 },
        fechada
      );
      confirmacoes.push({
        itemId: item.id,
        janelaDias: janela,
        qtdEntrada: r.qtdEntrada,
        qtdTransferida: r.qtdTransferida,
        status: r.status,
      });
    }
  }

  await gravarConfirmacoes(usuario.tenantId, confirmacoes);

  const porStatus: Record<string, number> = {};
  for (const c of confirmacoes) porStatus[c.status] = (porStatus[c.status] ?? 0) + 1;

  return NextResponse.json({ ok: true, janelaDias: janela, itens: confirmacoes.length, consultas, porStatus });
}

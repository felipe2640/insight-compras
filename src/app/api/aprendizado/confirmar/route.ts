/**
 * POST /api/aprendizado/confirmar?janela=10&dias=45
 * Fecha o ciclo: para cada item exportado, confronta o que entrou de fato na
 * loja dentro da janela. Idempotente — reprocessa só o que ainda está aguardando.
 */

import { NextRequest, NextResponse } from "next/server";
import { confirmarEntrada, janelaFechou, JANELA_CONFIRMACAO } from "@core/aprendizado";
import { obterUsuarioDaRequisicao, podeGerirAprendizado } from "@/lib/seguranca/usuario-requisicao";
import { listarItensParaConfirmar, gravarConfirmacoes } from "@/lib/aprendizado/repositorio";
import { supabaseConfigurado } from "@/lib/aprendizado/supabase";
import { ClienteDaxPowerBI } from "@adapters/carreiro/cliente-dax";
import { buscarEntradasCarreiro } from "@adapters/carreiro/entradas-confirmacao";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const usuario = obterUsuarioDaRequisicao(request);
  if (!podeGerirAprendizado(usuario)) {
    return NextResponse.json({ erro: "sem permissão" }, { status: 403 });
  }
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "supabase_nao_configurado" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const janela = Math.min(
    JANELA_CONFIRMACAO.MAX_DIAS,
    Math.max(JANELA_CONFIRMACAO.MIN_DIAS, parseInt(searchParams.get("janela") ?? "", 10) || JANELA_CONFIRMACAO.PADRAO_DIAS)
  );
  const dias = Math.min(180, Math.max(janela, parseInt(searchParams.get("dias") ?? "45", 10) || 45));

  const cliente = new ClienteDaxPowerBI();
  if (!cliente.possuiConfiguracaoAtiva()) {
    return NextResponse.json({ erro: "fonte de entradas indisponível (Power BI sem credenciais)" }, { status: 503 });
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

    const entradas = await buscarEntradasCarreiro(cliente, {
      filialId: itens[0].filialId,
      inicio: exportadoEm,
      fim,
      produtoIds: new Set(itens.map((i) => i.produtoId)),
    });
    consultas += 1;

    for (const item of itens) {
      const e = entradas.get(item.produtoId);
      const r = confirmarEntrada(
        item.qtdPedida,
        { qtdEntrada: e?.qtdEntrada ?? 0, qtdTransferida: e?.qtdTransferida ?? 0 },
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

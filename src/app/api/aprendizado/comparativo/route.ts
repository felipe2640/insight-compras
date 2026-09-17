/**
 * GET /api/aprendizado/comparativo?dias=30&filialId=1
 * Modelo × comprador nos últimos N dias, com feedback e confirmação.
 */

import { NextRequest, NextResponse } from "next/server";
import { classificarDivergencia, StatusConfirmacao } from "@core/aprendizado";
import { listarComparativo, ItemComparativo } from "@/lib/aprendizado/repositorio";
import { aprendizadoConfigurado } from "@/lib/aprendizado/repositorio";
import { ErroContexto, contextoDaRequisicao } from "@/lib/contexto/contexto-requisicao";
import { respostaErroContexto } from "@/lib/contexto/resposta-erro";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let contexto;
  try {
    contexto = await contextoDaRequisicao(request);
  } catch (erro) {
    if (erro instanceof ErroContexto) return respostaErroContexto(erro);
    throw erro;
  }
  const { usuario, tenant, fonte: fonteDados } = contexto;
  const { searchParams } = new URL(request.url);
  const dias = Math.min(365, Math.max(1, parseInt(searchParams.get("dias") ?? "30", 10) || 30));
  const filialParam = searchParams.get("filialId");
  const filialId = filialParam ? parseInt(filialParam, 10) || undefined : undefined;
  const fonteParam = searchParams.get("fonte")?.toLowerCase();

  const temProcessoERP = Boolean(fonteDados.pedidosERP);
  const fonte = fonteParam ?? (temProcessoERP ? "erp" : "snapshot");

  let itens: ItemComparativo[] = [];

  // 1. Carrega Compras Reais emitidas no ERP se fonte for "erp" ou "todos"
  if (fonte === "erp" || fonte === "todos") {
    if (fonteDados.pedidosERP) {
      const comprasErp = await fonteDados.pedidosERP.listarComprasNaJanela(dias, filialId);
      const rotuloUsuario = tenant.fonte.nomeERP
        ? `ERP ${tenant.fonte.nomeERP} (compra real)`
        : "ERP integrado (compra real)";

      const itensErp: ItemComparativo[] = comprasErp.map((c) => {
        /**
         * A quantidade do MODELO não é medida aqui.
         *
         * Havia um `produtoId % 5` inventando o número do modelo e um perfil de
         * giro a partir do mesmo resto: para um cliente real, a tela mostrava
         * divergência fabricada como se fosse medição. Sem o dado, é "não
         * medido" (null), que a grade exibe como "—". A comparação de verdade
         * vem do snapshot de exportação, onde a sugestão do modelo foi gravada.
         */
        const qtdModelo = null;

        return {
          id: c.id,
          snapshotId: c.pedidoId,
          exportadoEm: c.dataEmissao,
          usuario: rotuloUsuario,
          produtoId: c.produtoId,
          sku: c.sku ?? (c.produtoId ? String(c.produtoId).padStart(6, "0") : `PROD-${c.produtoId}`),
          descricao: c.descricao || "Item de Compra ERP",
          filialId: c.filialId ?? 0,
          custo: c.valorUnitario,
          qtdComprador: c.quantidade,
          qtdModelo,
          qtdTransferenciaComprador: 0,
          qtdTransferenciaModelo: 0,
          perfil: null,
          elegivel: true,
          motivoInelegibilidade: null,
          sinalGovernanca: "COMPRA_ERP",
          feedback: null,
          /**
           * Compra emitida no ERP não é entrada CONFERIDA: o que foi pedido
           * não é o que chegou. Fica "aguardando" até a confirmação real.
           */
          confirmacao: {
            status: "aguardando" as StatusConfirmacao,
            qtdEntrada: 0,
            qtdTransferida: 0,
          },
        };
      });

      itens = itensErp;
    }
  }

  // 2. Carrega Snapshots de Exportações se fonte for "snapshot" ou "todos"
  if (fonte === "snapshot" || (fonte === "todos" && aprendizadoConfigurado())) {
    if (aprendizadoConfigurado()) {
      const itensSnapshot = await listarComparativo({ tenantId: usuario.tenantId, dias, filialId });
      itens = fonte === "todos" ? [...itens, ...itensSnapshot] : itensSnapshot;
    }
  }

  if (itens.length === 0 && !aprendizadoConfigurado() && fonte === "snapshot") {
    return NextResponse.json({ configurado: false, itens: [], resumo: null });
  }

  const comDivergencia = itens.map((i) => ({
    ...i,
    divergencia: classificarDivergencia(i.qtdComprador, i.qtdModelo),
  }));

  const resumo = {
    total: comDivergencia.length,
    igual: comDivergencia.filter((i) => i.divergencia === "igual").length,
    compradorMaior: comDivergencia.filter((i) => i.divergencia === "comprador_maior").length,
    compradorMenor: comDivergencia.filter((i) => i.divergencia === "comprador_menor").length,
    soModelo: comDivergencia.filter((i) => i.divergencia === "so_modelo").length,
    semSugestao: comDivergencia.filter((i) => i.divergencia === "sem_sugestao").length,
    comMotivo: comDivergencia.filter((i) => i.feedback).length,
    confirmados: comDivergencia.filter((i) => i.confirmacao && i.confirmacao.status !== "aguardando").length,
  };

  return NextResponse.json({
    configurado: true,
    dias,
    fonte,
    temProcessoERP,
    itens: comDivergencia,
    resumo,
  });
}


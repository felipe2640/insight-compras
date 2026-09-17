/**
 * GET /api/aprendizado/comparativo?dias=30&filialId=1
 * Modelo × comprador nos últimos N dias, com feedback e confirmação.
 */

import { NextRequest, NextResponse } from "next/server";
import { classificarDivergencia, StatusConfirmacao } from "@core/aprendizado";
import { obterUsuarioDaRequisicao, respostaNaoAutenticado } from "@/lib/autenticacao/servidor";
import { listarComparativo, ItemComparativo } from "@/lib/aprendizado/repositorio";
import { aprendizadoConfigurado } from "@/lib/aprendizado/repositorio";
import { obterAdaptadorInventario } from "@adapters/index";
import { obterConfiguracaoTenant } from "@config/tenants";
import {
  indexarSugestoesRegistradas,
  sugestaoQueAntecedeuACompra,
} from "@/lib/aprendizado/cruzamento-compras-erp";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioDaRequisicao(request);
  if (!usuario) return respostaNaoAutenticado();
  const { searchParams } = new URL(request.url);
  const dias = Math.min(365, Math.max(1, parseInt(searchParams.get("dias") ?? "30", 10) || 30));
  const filialParam = searchParams.get("filialId");
  const filialId = filialParam ? parseInt(filialParam, 10) || undefined : undefined;
  const fonteParam = searchParams.get("fonte")?.toLowerCase();

  const tenant = obterConfiguracaoTenant(usuario.tenantId);
  const temProcessoERP = Boolean(tenant.processoCompra?.habilitado);
  const fonte = fonteParam ?? (temProcessoERP ? "erp" : "snapshot");

  let itens: ItemComparativo[] = [];

  // 1. Carrega Compras Reais emitidas no ERP se fonte for "erp" ou "todos"
  if (fonte === "erp" || fonte === "todos") {
    const adaptador = obterAdaptadorInventario({ tenant: usuario.tenantId });
    if (adaptador.listarTodasComprasERPNaJanela) {
      const comprasErp = await adaptador.listarTodasComprasERPNaJanela(dias, filialId);
      const ehConnectsoft = tenant.processoCompra?.tipoERP === "connectsoft-shopcash";
      const rotuloUsuario = ehConnectsoft ? "ERP Connectsoft (Compra Real)" : "ERP Integrado (Compra Real)";

      // O lado do modelo vem do que o motor EFETIVAMENTE sugeriu, registrado na
      // exportação que antecedeu a compra — nunca de um fator fabricado. Sem
      // sugestão registrada, qtdModelo fica null e a classificação diz
      // "sem_sugestao". Ver src/lib/aprendizado/cruzamento-compras-erp.ts.
      const sugestoesRegistradas = aprendizadoConfigurado()
        ? await listarComparativo({ tenantId: usuario.tenantId, dias, filialId })
        : [];
      const indiceSugestoes = indexarSugestoesRegistradas(sugestoesRegistradas);

      const itensErp: ItemComparativo[] = comprasErp.map((c) => {
        const sugestao = sugestaoQueAntecedeuACompra(
          indiceSugestoes,
          c.produtoId,
          c.filialId,
          c.dataEmissao
        );

        return {
          id: c.id,
          snapshotId: c.pedidoId,
          exportadoEm: c.dataEmissao,
          usuario: rotuloUsuario,
          produtoId: c.produtoId,
          sku: c.sku ?? (c.produtoId ? String(c.produtoId).padStart(6, "0") : `PROD-${c.produtoId}`),
          descricao: c.descricao || "Item de Compra ERP",
          filialId: c.filialId,
          custo: c.valorUnitario,
          qtdComprador: c.quantidade,
          qtdModelo: sugestao?.qtdModelo ?? null,
          qtdTransferenciaComprador: 0,
          qtdTransferenciaModelo: sugestao?.qtdTransferenciaModelo ?? 0,
          perfil: sugestao?.perfil ?? null,
          elegivel: sugestao?.elegivel ?? true,
          motivoInelegibilidade: sugestao?.motivoInelegibilidade ?? null,
          sinalGovernanca: "COMPRA_ERP",
          feedback: sugestao?.feedback ?? null,
          // Pedido emitido não é mercadoria recebida: só há confirmação quando a
          // exportação correspondente foi confirmada. Antes vinha "confirmado"
          // fixo, com entrada igual à quantidade pedida.
          confirmacao: sugestao?.confirmacao ?? null,
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


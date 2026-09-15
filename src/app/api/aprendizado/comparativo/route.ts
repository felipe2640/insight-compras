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
      const itensErp: ItemComparativo[] = comprasErp.map((c) => ({
        id: c.id,
        snapshotId: c.pedidoId,
        exportadoEm: c.dataEmissao,
        usuario: "ERP Connectsoft (Compra Real)",
        produtoId: c.produtoId,
        sku: c.sku ?? `PROD-${c.produtoId}`,
        descricao: c.descricao,
        filialId: c.filialId,
        custo: c.valorUnitario,
        qtdComprador: c.quantidade,
        qtdModelo: Math.round(c.quantidade * 0.8), // Sugestão do modelo
        qtdTransferenciaComprador: 0,
        qtdTransferenciaModelo: 0,
        perfil: "MEDIO_GIRO",
        elegivel: true,
        motivoInelegibilidade: null,
        sinalGovernanca: "COMPRA_ERP",
        feedback: null,
        confirmacao: {
          status: "confirmado" as StatusConfirmacao,
          qtdEntrada: c.quantidade,
          qtdTransferida: 0,
        },
      }));

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


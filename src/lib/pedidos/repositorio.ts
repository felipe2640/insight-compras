/**
 * Histórico de pedidos exportados.
 * Camada: Aplicação (src/lib/pedidos) — server-only.
 *
 * POR QUE LÊ DAS TABELAS DO APRENDIZADO
 * Toda exportação já grava o que o comprador decidiu, item a item, com loja,
 * usuário, data e custo — é exatamente o registro de um pedido. Criar uma
 * segunda tabela para a mesma coisa daria dois números para a mesma pergunta e
 * a garantia de que um dia eles discordariam.
 *
 * Sem Supabase configurado devolve vazio, e a tela diz que o histórico não está
 * ligado, em vez de mostrar exemplo inventado.
 */

import { sbSelecionar, supabaseConfigurado } from "@/lib/aprendizado/supabase";

export interface PedidoExportado {
  readonly id: number;
  readonly exportadoEm: string;
  readonly usuario: string | null;
  readonly filialId: number | null;
  readonly modeloId: string;
  readonly formato: string;
  readonly totalItens: number;
}

export interface ItemPedidoExportado {
  readonly id: number;
  readonly sku: string | null;
  readonly descricao: string | null;
  readonly qtdComprador: number;
  readonly qtdTransferencia: number;
  readonly qtdModelo: number | null;
  readonly custo: number | null;
  readonly valorTotal: number;
}

export function historicoDisponivel(): boolean {
  return supabaseConfigurado();
}

export async function listarPedidosExportados(parametros: {
  tenantId: string;
  dias: number;
  filialId?: number;
  limite?: number;
}): Promise<PedidoExportado[]> {
  if (!supabaseConfigurado()) return [];
  const desde = new Date(Date.now() - parametros.dias * 86_400_000).toISOString();
  const filtroFilial = parametros.filialId ? `&filial_id=eq.${parametros.filialId}` : "";
  const limite = Math.min(200, Math.max(1, parametros.limite ?? 60));

  try {
    const linhas = await sbSelecionar<{
      id: number;
      exportado_em: string;
      usuario: string | null;
      filial_id: number | null;
      layout_id: string;
      formato: string;
      n_itens: number;
    }>(
      "aprendizado_snapshot",
      `select=id,exportado_em,usuario,filial_id,layout_id,formato,n_itens` +
        `&tenant_id=eq.${encodeURIComponent(parametros.tenantId)}` +
        `&exportado_em=gte.${desde}${filtroFilial}` +
        `&order=exportado_em.desc&limit=${limite}`
    );

    return linhas.map((l) => ({
      id: l.id,
      exportadoEm: l.exportado_em,
      usuario: l.usuario,
      filialId: l.filial_id,
      modeloId: l.layout_id,
      formato: l.formato,
      totalItens: Number(l.n_itens) || 0,
    }));
  } catch (erro) {
    console.warn("[pedidos] falha ao listar histórico:", erro);
    return [];
  }
}

/** Itens de UM pedido. Só é buscado quando a pessoa abre a linha. */
export async function listarItensDoPedido(
  tenantId: string,
  pedidoId: number
): Promise<ItemPedidoExportado[]> {
  if (!supabaseConfigurado()) return [];

  const linhas = await sbSelecionar<{
    id: number;
    sku: string | null;
    descricao: string | null;
    qtd_comprador: number;
    qtd_transferencia_comprador: number | null;
    qtd_modelo: number | null;
    custo: number | null;
  }>(
    "aprendizado_item",
    `select=id,sku,descricao,qtd_comprador,qtd_transferencia_comprador,qtd_modelo,custo` +
      `&tenant_id=eq.${encodeURIComponent(tenantId)}&snapshot_id=eq.${pedidoId}` +
      `&order=sku.asc&limit=5000`
  );

  return linhas.map((l) => {
    const qtd = Number(l.qtd_comprador) || 0;
    const custo = l.custo === null ? null : Number(l.custo);
    return {
      id: l.id,
      sku: l.sku,
      descricao: l.descricao,
      qtdComprador: qtd,
      qtdTransferencia: Number(l.qtd_transferencia_comprador) || 0,
      qtdModelo: l.qtd_modelo === null ? null : Number(l.qtd_modelo),
      custo,
      valorTotal: custo === null ? 0 : +(qtd * custo).toFixed(2),
    };
  });
}

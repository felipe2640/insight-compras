/**
 * Provedor Supabase (PostgREST) do Ciclo de Vida de Pedidos
 * Camada: Aplicação / Pedidos / Provedores (src/lib/pedidos/provedores/supabase.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { sbSelecionar } from "@/lib/aprendizado/supabase";
import {
  FiltrosListagemPedidos,
  ParametrosTransicaoPedido,
  RepositorioPedidos,
} from "../porta-repositorio";
import { ItemPedido, Pedido, StatusPedido, TransicaoPedido } from "../tipos";
import { criarRegistroTransicao, validarTransicaoStatus } from "../ciclo-vida";

interface LinhaSnapshotDb {
  id: number;
  tenant_id?: string;
  exportado_em: string;
  usuario: string | null;
  filial_id: number | null;
  layout_id: string;
  formato: string;
  n_itens: number;
  status?: string | null;
  enviado_em?: string | null;
  enviado_por?: string | null;
  confirmado_em?: string | null;
  confirmado_por?: string | null;
  recebido_em?: string | null;
  recebido_por?: string | null;
  historico_estados?: TransicaoPedido[] | null;
}

interface LinhaItemDb {
  id: number;
  sku: string | null;
  descricao: string | null;
  qtd_comprador: number;
  qtd_transferencia_comprador: number | null;
  qtd_modelo: number | null;
  custo: number | null;
}

function converterLinhaParaPedido(linha: LinhaSnapshotDb, tenantId: string): Pedido {
  const statusRaw = (linha.status ?? "exportado").toLowerCase();
  const status: StatusPedido =
    statusRaw === "enviado" || statusRaw === "confirmado" || statusRaw === "recebido"
      ? statusRaw
      : "exportado";

  return {
    id: Number(linha.id),
    tenantId: linha.tenant_id ?? tenantId,
    exportadoEm: linha.exportado_em,
    usuario: linha.usuario,
    filialId: linha.filial_id === null ? null : Number(linha.filial_id),
    modeloId: linha.layout_id,
    formato: linha.formato,
    totalItens: Number(linha.n_itens) || 0,
    status,
    enviadoEm: linha.enviado_em ?? null,
    enviadoPor: linha.enviado_por ?? null,
    confirmadoEm: linha.confirmado_em ?? null,
    confirmadoPor: linha.confirmado_por ?? null,
    recebidoEm: linha.recebido_em ?? null,
    recebidoPor: linha.recebido_por ?? null,
    historico: Array.isArray(linha.historico_estados) ? linha.historico_estados : [],
  };
}

async function patchPostgrest(tabela: string, filtro: string, dados: Record<string, unknown>): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error("Supabase não configurado.");
  }

  const res = await fetch(`${url}/rest/v1/${tabela}?${filtro}`, {
    method: "PATCH",
    headers: {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(dados),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Falha ao atualizar ${tabela}: ${res.status} ${await res.text()}`);
  }
}

export class RepositorioPedidosSupabase implements RepositorioPedidos {
  public readonly id = "supabase" as const;

  public async listarPedidos(filtros: FiltrosListagemPedidos): Promise<readonly Pedido[]> {
    const desde = new Date(Date.now() - filtros.dias * 86_400_000).toISOString();
    const filtroFilial = filtros.filialId ? `&filial_id=eq.${filtros.filialId}` : "";
    const filtroStatus = filtros.status ? `&status=eq.${encodeURIComponent(filtros.status)}` : "";
    const limite = Math.min(200, Math.max(1, filtros.limite ?? 60));

    const consulta =
      `select=id,tenant_id,exportado_em,usuario,filial_id,layout_id,formato,n_itens,` +
      `status,enviado_em,enviado_por,confirmado_em,confirmado_por,recebido_em,recebido_por,historico_estados` +
      `&tenant_id=eq.${encodeURIComponent(filtros.tenantId)}` +
      `&exportado_em=gte.${desde}${filtroFilial}${filtroStatus}` +
      `&order=exportado_em.desc&limit=${limite}`;

    try {
      const linhas = await sbSelecionar<LinhaSnapshotDb>("aprendizado_snapshot", consulta);
      return linhas.map((l) => converterLinhaParaPedido(l, filtros.tenantId));
    } catch (erro) {
      console.warn("[pedidos/supabase] Falha ao listar pedidos com status estendido:", erro);
      // Fallback gracioso para tabela antes da migração de colunas
      const linhasBasicas = await sbSelecionar<LinhaSnapshotDb>(
        "aprendizado_snapshot",
        `select=id,exportado_em,usuario,filial_id,layout_id,formato,n_itens` +
          `&tenant_id=eq.${encodeURIComponent(filtros.tenantId)}` +
          `&exportado_em=gte.${desde}${filtroFilial}&order=exportado_em.desc&limit=${limite}`
      );
      return linhasBasicas.map((l) => converterLinhaParaPedido(l, filtros.tenantId));
    }
  }

  public async obterPedidoPorId(tenantId: string, pedidoId: number): Promise<Pedido | null> {
    const consulta =
      `select=id,tenant_id,exportado_em,usuario,filial_id,layout_id,formato,n_itens,` +
      `status,enviado_em,enviado_por,confirmado_em,confirmado_por,recebido_em,recebido_por,historico_estados` +
      `&tenant_id=eq.${encodeURIComponent(tenantId)}&id=eq.${pedidoId}&limit=1`;

    try {
      const linhas = await sbSelecionar<LinhaSnapshotDb>("aprendizado_snapshot", consulta);
      if (!linhas || linhas.length === 0) return null;
      return converterLinhaParaPedido(linhas[0], tenantId);
    } catch (erro) {
      console.warn(`[pedidos/supabase] Falha ao obter pedido #${pedidoId}:`, erro);
      return null;
    }
  }

  public async listarItensDoPedido(tenantId: string, pedidoId: number): Promise<readonly ItemPedido[]> {
    const linhas = await sbSelecionar<LinhaItemDb>(
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

  public async atualizarStatusPedido(params: ParametrosTransicaoPedido): Promise<Pedido> {
    const pedidoAtual = await this.obterPedidoPorId(params.tenantId, params.pedidoId);
    if (!pedidoAtual) {
      throw new Error(`Pedido #${params.pedidoId} não encontrado.`);
    }

    const validacao = validarTransicaoStatus(pedidoAtual.status, params.novoStatus);
    if (!validacao.valido) {
      throw new Error(validacao.motivo);
    }

    const dataHora = params.dataHora ?? new Date().toISOString();
    const transicao = criarRegistroTransicao({
      de: pedidoAtual.status,
      para: params.novoStatus,
      responsavel: params.responsavel,
      observacao: params.observacao,
      dataHora,
    });

    const dadosUpdate: Record<string, unknown> = {
      status: params.novoStatus,
      historico_estados: [...pedidoAtual.historico, transicao],
    };

    if (params.novoStatus === "enviado") {
      dadosUpdate.enviado_em = dataHora;
      dadosUpdate.enviado_por = params.responsavel;
    } else if (params.novoStatus === "confirmado") {
      dadosUpdate.confirmado_em = dataHora;
      dadosUpdate.confirmado_por = params.responsavel;
    } else if (params.novoStatus === "recebido") {
      dadosUpdate.recebido_em = dataHora;
      dadosUpdate.recebido_por = params.responsavel;
    }

    await patchPostgrest(
      "aprendizado_snapshot",
      `id=eq.${params.pedidoId}&tenant_id=eq.${encodeURIComponent(params.tenantId)}`,
      dadosUpdate
    );

    const atualizado = await this.obterPedidoPorId(params.tenantId, params.pedidoId);
    if (!atualizado) {
      throw new Error(`Falha ao reler pedido #${params.pedidoId} após atualização.`);
    }
    return atualizado;
  }
}

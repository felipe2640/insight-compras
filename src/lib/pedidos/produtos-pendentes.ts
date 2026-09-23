import { supabaseConfigurado, sbSelecionar } from "@/lib/aprendizado/supabase";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";

interface LinhaProdutoPendenteDb {
  readonly produto_id: number;
}

/**
 * Produtos que já viraram pedido no cockpit e ainda não foram recebidos.
 *
 * O ERP da Carreiro não expõe pedidos em aberto com integridade suficiente;
 * por isso o cockpit precisa considerar também o seu próprio ciclo de vida.
 */
export async function listarIdsProdutosEmPedidosAtivos(
  tenantId: string,
  filialId: number,
): Promise<ReadonlySet<number>> {
  if (!supabaseConfigurado()) return new Set();

  try {
    const linhas = await sbSelecionar<LinhaProdutoPendenteDb>(
      "aprendizado_item",
      `select=produto_id,aprendizado_snapshot!inner(status,filial_id,layout_id)` +
        `&tenant_id=eq.${encodeURIComponent(tenantId)}` +
        `&filial_id=eq.${filialId}` +
        `&aprendizado_snapshot.status=in.(exportado,enviado,confirmado)` +
        `&aprendizado_snapshot.layout_id=neq.analise` +
        `&limit=10000`,
    );
    return new Set(
      linhas
        .map((linha) => Number(linha.produto_id))
        .filter((id) => Number.isInteger(id) && id > 0),
    );
  } catch (erro) {
    // Uma falha no histórico não pode derrubar a grade. Ela fica visível para
    // observabilidade e o cockpit preserva os dados vindos do ERP.
    console.warn("[pedidos] não foi possível carregar produtos pendentes:", erro);
    return new Set();
  }
}

export function removerProdutosEmPedidosAtivos(
  linhas: readonly LinhaCockpitMatriz[],
  produtosPendentes: ReadonlySet<number>,
): LinhaCockpitMatriz[] {
  if (produtosPendentes.size === 0) return [...linhas];
  return linhas.filter((linha) => !produtosPendentes.has(linha.produtoId));
}

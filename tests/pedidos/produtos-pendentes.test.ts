import { describe, expect, it } from "vitest";
import { removerProdutosEmPedidosAtivos } from "@/lib/pedidos/produtos-pendentes";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";

describe("produtos em pedidos ativos", () => {
  it("remove da sugestão os produtos que já viraram pedido", () => {
    const linhas = [
      { produtoId: 639, codigoSku: "000639" },
      { produtoId: 700, codigoSku: "000700" },
    ] as LinhaCockpitMatriz[];

    expect(removerProdutosEmPedidosAtivos(linhas, new Set([639]))).toEqual([
      linhas[1],
    ]);
  });

  it("não altera a lista quando não há pedidos ativos", () => {
    const linhas = [{ produtoId: 639 }] as LinhaCockpitMatriz[];
    expect(removerProdutosEmPedidosAtivos(linhas, new Set())).toEqual(linhas);
  });
});

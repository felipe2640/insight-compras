import { describe, it, expect } from "vitest";
import {
  gerarConsultaDaxSimilares,
  TAMANHO_PAGINA_SIMILARES,
} from "@adapters/carreiro/consultas-homologadas";
import { mapearSimilaresDax } from "@adapters/carreiro/mapeador-dax";
import type { Produto } from "@core/dominio";

const produto = (id: number, sku: string, marca: string): Produto =>
  ({
    id,
    codigoSku: sku,
    descricao: `PEÇA ${sku}`,
    marca,
    fabricante: marca,
    referenciaFabricante: null,
    aplicacaoVeicular: null,
    familiaId: null,
    secaoId: null,
    nomeSecao: null,
    fornecedorId: 1,
    nomeFornecedor: "F",
    precoCusto: 10,
    precoVenda: 20,
    loteMultiplo: 1,
  }) as Produto;

describe("consulta de intercambiáveis", () => {
  it("lê a tabela do modelo do cliente, não a temporária de auditoria", () => {
    const dax = gerarConsultaDaxSimilares();
    expect(dax).toContain("PRODUTOS_SEMELHANTES");
    expect(dax).not.toContain("TMP_AUDIT");
  });

  it("pagina por ID: são 135.334 pares contra um teto de 100.000 na resposta", () => {
    expect(gerarConsultaDaxSimilares()).not.toContain("[ID] >");
    expect(gerarConsultaDaxSimilares(40000)).toContain("'PRODUTOS_SEMELHANTES'[ID] > 40000");
    expect(TAMANHO_PAGINA_SIMILARES).toBeLessThan(100000);
  });

  it("o cursor só aceita número — nada de texto entrando no DAX", () => {
    const dax = gerarConsultaDaxSimilares("7; DEFINE" as unknown as number);
    expect(dax).not.toContain("DEFINE");
    expect(dax).not.toContain("[ID] >");
  });

  it("ignora pares sem código dos dois lados", () => {
    const dax = gerarConsultaDaxSimilares();
    expect(dax).toContain("NOT ISBLANK('PRODUTOS_SEMELHANTES'[ACODPRODUTO])");
    expect(dax).toContain("NOT ISBLANK('PRODUTOS_SEMELHANTES'[ACODPRODUTO_SEMELHANTE])");
  });
});

describe("mapeamento de intercambiáveis", () => {
  const produtos = new Map<number, Produto>([
    [876, produto(876, "000876", "GENERICA")],
    [18099, produto(18099, "018099", "CAUPLAS")],
    [18100, produto(18100, "018100", "VIQUA")],
  ]);

  it("não repete o mesmo similar — o par vem uma vez por empresa na origem", () => {
    const linhas = Array.from({ length: 5 }, () => ({
      ProdutoOrigem: "000876",
      ProdutoSimilar: "018099",
      TipoSimilaridade: "B",
    }));
    const mapa = mapearSimilaresDax(linhas, produtos, new Map([[18099, 2]]));
    expect(mapa.get(876)).toHaveLength(1);
    expect(mapa.get(876)?.[0].codigoSkuSimilar).toBe("018099");
    expect(mapa.get(876)?.[0].saldoFisicoDisponivelRede).toBe(2);
  });

  it("mantém similares distintos", () => {
    const mapa = mapearSimilaresDax(
      [
        { ProdutoOrigem: "000876", ProdutoSimilar: "018099", TipoSimilaridade: "B" },
        { ProdutoOrigem: "000876", ProdutoSimilar: "018100", TipoSimilaridade: "B" },
      ],
      produtos,
      new Map([[18099, 2], [18100, 0]])
    );
    expect(mapa.get(876)?.map((s) => s.codigoSkuSimilar)).toEqual(["018099", "018100"]);
  });

  it("forma um grupo bidirecional e transitivo para todos os SKUs equivalentes", () => {
    const mapa = mapearSimilaresDax(
      [
        { ProdutoOrigem: "000876", ProdutoSimilar: "018099" },
        { ProdutoOrigem: "000876", ProdutoSimilar: "018100" },
      ],
      produtos,
      new Map([[876, 1], [18099, 2], [18100, 3]])
    );

    expect(mapa.get(876)?.map((s) => s.codigoSkuSimilar)).toEqual(["018099", "018100"]);
    expect(mapa.get(18099)?.map((s) => s.codigoSkuSimilar)).toEqual(["000876", "018100"]);
    expect(mapa.get(18100)?.map((s) => s.codigoSkuSimilar)).toEqual(["000876", "018099"]);
    expect(mapa.get(18099)?.map((s) => s.saldoFisicoDisponivelRede)).toEqual([1, 3]);
  });

  it("aceita código com e sem sufixo de empresa", () => {
    const mapa = mapearSimilaresDax(
      [{ ProdutoOrigem: "000876|guid-a", ProdutoSimilar: "018099", TipoSimilaridade: "B" }],
      produtos,
      new Map()
    );
    expect(mapa.get(876)).toHaveLength(1);
  });

  it("descarta autorreferência e similar fora do catálogo", () => {
    const mapa = mapearSimilaresDax(
      [
        { ProdutoOrigem: "000876", ProdutoSimilar: "000876", TipoSimilaridade: "B" },
        { ProdutoOrigem: "000876", ProdutoSimilar: "999999", TipoSimilaridade: "B" },
      ],
      produtos,
      new Map()
    );
    expect(mapa.get(876) ?? []).toHaveLength(0);
  });
});

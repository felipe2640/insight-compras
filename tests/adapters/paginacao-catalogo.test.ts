import { describe, it, expect } from "vitest";
import {
  gerarConsultaDaxProdutosEstoque,
  TAMANHO_PAGINA_PRODUTOS,
} from "@adapters/carreiro/consultas-homologadas";

/**
 * O executeQueries corta a resposta por TAMANHO e não avisa. Medido ao vivo em
 * 09/09/2026 sobre as 126.280 linhas de PRODUTOS: 2 colunas devolveram 100.000
 * linhas, 5 colunas devolveram 59.473 e o conjunto real de atributos, 26.362.
 * Sem paginar, o catálogo chegava com um terço a menos — e sempre os mesmos
 * itens, porque a ordenação faz a perda cair na cauda dos códigos.
 */
describe("paginação do catálogo de produtos", () => {
  it("a primeira página não filtra por cursor", () => {
    const dax = gerarConsultaDaxProdutosEstoque();
    expect(dax).not.toContain("[ACODPRODUTO] >");
    expect(dax).toContain(`TOPN(\n  ${TAMANHO_PAGINA_PRODUTOS}`);
  });

  it("as páginas seguintes começam depois do último código", () => {
    const dax = gerarConsultaDaxProdutosEstoque(undefined, "031576|abc-123");
    expect(dax).toContain(`'PRODUTOS'[ACODPRODUTO] > "031576|abc-123"`);
  });

  it("ordena por código: sem ordem total o cursor pularia ou repetiria linhas", () => {
    const dax = gerarConsultaDaxProdutosEstoque();
    expect(dax).toContain("[Produto], ASC");
    expect(dax).toContain("ORDER BY [Produto]");
  });

  it("o cursor é escapado — código com aspas não injeta DAX", () => {
    const dax = gerarConsultaDaxProdutosEstoque(undefined, 'abc" || 1=1 //');
    expect(dax).toContain('"abc"" || 1=1 //"');
    expect(dax).not.toContain('> "abc" ||');
  });

  it("a página é pequena o bastante para caber na resposta da API", () => {
    // 26.362 foi o teto observado com o conjunto real de colunas; a página tem
    // que ficar com folga abaixo disso.
    expect(TAMANHO_PAGINA_PRODUTOS).toBeLessThan(20000);
    expect(TAMANHO_PAGINA_PRODUTOS).toBeGreaterThan(1000);
  });

  it("o filtro do chamador continua valendo junto com o cursor", () => {
    const dax = gerarConsultaDaxProdutosEstoque(
      { fornecedoresPermitidos: [7, 9], apenasComEstoqueOuVenda: true },
      "000100|x"
    );
    expect(dax).toContain("'PRODUTOS'[ICODFORN] IN { 7, 9 }");
    expect(dax).toContain("NESTOQATUAL");
    expect(dax).toContain(`'PRODUTOS'[ACODPRODUTO] > "000100|x"`);
  });

  it("traz o sub-grupo com o nome legível, não o código", () => {
    const dax = gerarConsultaDaxProdutosEstoque();
    expect(dax).toContain("SUBCLASSES[ADESCRICAO]");
    expect(dax).toContain("CLASSES[ADESCRICAO]");
  });
});

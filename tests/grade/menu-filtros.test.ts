import { describe, it, expect } from "vitest";
import {
  adicionarFiltro,
  atualizarFiltro,
  colunasDisponiveis,
  conectivoDaLinha,
  contarFiltrosAplicaveis,
  filtroInicialDaColuna,
  primeiraColunaLivre,
  removerFiltro,
  trocarColunaDoFiltro,
  type ColunaFiltravel,
  type FiltroAtivo,
} from "@/lib/cockpit/menu-filtros";

const COLUNAS: ColunaFiltravel[] = [
  { id: "marca", rotulo: "Marca", variante: "texto" },
  { id: "descricao", rotulo: "Descrição", variante: "texto" },
  { id: "custo", rotulo: "Custo", variante: "numero" },
  { id: "curvaAbcSistema", rotulo: "Curva ABC", variante: "selecao" },
];

describe("construtor central de filtros", () => {
  it("uma coluna por linha: as já usadas somem da lista", () => {
    const ativos: FiltroAtivo[] = [{ id: "marca", value: { operador: "contem", valor: "x" } }];
    expect(colunasDisponiveis(COLUNAS, ativos).map((c) => c.id)).toEqual([
      "descricao",
      "custo",
      "curvaAbcSistema",
    ]);
  });

  it("a coluna da própria linha continua na lista dela", () => {
    const ativos: FiltroAtivo[] = [{ id: "marca", value: { operador: "contem" } }];
    expect(colunasDisponiveis(COLUNAS, ativos, "marca").map((c) => c.id)).toContain("marca");
  });

  it("adicionar pega a primeira coluna livre, com o operador padrão do tipo", () => {
    let ativos = adicionarFiltro([], COLUNAS);
    expect(ativos).toEqual([{ id: "marca", value: { operador: "contem" } }]);

    ativos = adicionarFiltro(ativos, COLUNAS);
    expect(ativos[1]).toEqual({ id: "descricao", value: { operador: "contem" } });

    ativos = adicionarFiltro(ativos, COLUNAS);
    expect(ativos[2]).toEqual({ id: "custo", value: { operador: "igual" } });

    ativos = adicionarFiltro(ativos, COLUNAS);
    expect(ativos[3]).toEqual({ id: "curvaAbcSistema", value: { operador: "eUmDe" } });
  });

  it("sem coluna livre, adicionar não faz nada", () => {
    const cheio = COLUNAS.reduce<FiltroAtivo[]>((acc) => adicionarFiltro(acc, COLUNAS), []);
    expect(cheio).toHaveLength(4);
    expect(adicionarFiltro(cheio, COLUNAS)).toHaveLength(4);
    expect(primeiraColunaLivre(COLUNAS, cheio)).toBeNull();
  });

  it("remove e atualiza sem mexer nas outras linhas", () => {
    const ativos: FiltroAtivo[] = [
      { id: "marca", value: { operador: "contem", valor: "bosch" } },
      { id: "custo", value: { operador: "maior", valor: 10 } },
    ];
    expect(removerFiltro(ativos, "marca")).toEqual([ativos[1]]);
    const atualizado = atualizarFiltro(ativos, "custo", { valor: 99 });
    expect(atualizado[1].value).toEqual({ operador: "maior", valor: 99 });
    expect(atualizado[0]).toBe(ativos[0]);
  });

  it("trocar para coluna do MESMO tipo preserva operador e valor", () => {
    const ativos: FiltroAtivo[] = [{ id: "marca", value: { operador: "comecaCom", valor: "mo" } }];
    const depois = trocarColunaDoFiltro(ativos, "marca", COLUNAS[1]);
    expect(depois).toEqual([{ id: "descricao", value: { operador: "comecaCom", valor: "mo" } }]);
  });

  it("trocar para coluna de OUTRO tipo zera o filtro — 'Custo contém' não existe", () => {
    const ativos: FiltroAtivo[] = [{ id: "marca", value: { operador: "contem", valor: "bosch" } }];
    const depois = trocarColunaDoFiltro(ativos, "marca", COLUNAS[2]);
    expect(depois).toEqual([{ id: "custo", value: { operador: "igual" } }]);
  });

  it("operador que existe nos dois tipos sobrevive à troca", () => {
    // "está vazio" vale para texto e para número
    const ativos: FiltroAtivo[] = [{ id: "marca", value: { operador: "vazio" } }];
    expect(trocarColunaDoFiltro(ativos, "marca", COLUNAS[2])).toEqual([
      { id: "custo", value: { operador: "vazio" } },
    ]);
  });

  it("o crachá conta só o que de fato filtra", () => {
    const ativos: FiltroAtivo[] = [
      { id: "marca", value: { operador: "contem", valor: "bosch" } },
      { id: "custo", value: { operador: "entre", valor: 10 } }, // pela metade
      { id: "descricao", value: { operador: "vazio" } },
    ];
    expect(ativos).toHaveLength(3);
    expect(contarFiltrosAplicaveis(ativos)).toBe(2);
  });

  it("a primeira linha diz 'Onde', as seguintes dizem 'E'", () => {
    expect(conectivoDaLinha(0)).toBe("Onde");
    expect(conectivoDaLinha(1)).toBe("E");
    expect(conectivoDaLinha(7)).toBe("E");
  });

  it("filtro inicial de cada tipo nasce com o operador certo", () => {
    expect(filtroInicialDaColuna(COLUNAS[0]).value.operador).toBe("contem");
    expect(filtroInicialDaColuna(COLUNAS[2]).value.operador).toBe("igual");
    expect(filtroInicialDaColuna(COLUNAS[3]).value.operador).toBe("eUmDe");
  });
});

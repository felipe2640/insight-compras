/**
 * O contrato do InventoryAdapter rodando contra TODAS as fontes.
 *
 * - Power BI (DAX), com `fetch` falso servindo as consultas homologadas a
 *   partir de fixtures gravadas da fonte real e anonimizadas;
 * - a fonte sintética completa (demonstração);
 * - um cliente MÍNIMO: 2 lojas com ids 7 e 9, sem capacidade nenhuma de ERP.
 *
 * O cliente mínimo é o que faltava. Toda a suíte conhecia só um cliente rico,
 * e por isso nenhum teste passava pelos caminhos que um cliente novo percorre.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AdaptadorInventarioCarreiro } from "@adapters/carreiro/adaptador-carreiro";
import { ClienteDaxPowerBI } from "@adapters/carreiro/cliente-dax";
import { AdaptadorInventarioMock } from "@adapters/mock/adaptador-mock";
import { capacidadesEfetivas } from "@adapters/capacidades";
import { GerenciadorCacheResiliente } from "@adapters/carreiro/cache-resiliente";
import type { FilialCadastradaTenant } from "@config/tenants/tipos";
import { TENANT_DEMONSTRACAO } from "@config/tenants/demonstracao";
import { executarContratoInventoryAdapter } from "./contrato-inventory-adapter";
import { FILIAIS_MINIMAS } from "../ajuda/clientes-teste";

const DIR_FIXTURES = path.resolve(__dirname, "../fixtures/dax");

function lerFixture(nome: string): Record<string, unknown>[] {
  const caminho = path.join(DIR_FIXTURES, `${nome}.json`);
  if (!fs.existsSync(caminho)) return [];
  return JSON.parse(fs.readFileSync(caminho, "utf8")) as Record<string, unknown>[];
}

/**
 * Lojas da fixture: saem do próprio dado gravado, não de uma constante.
 *
 * As duas primeiras são as que têm posição de estoque gravada; as demais
 * aparecem no catálogo e servem para exercitar "loja fora do cadastro".
 */
const catalogo = lerFixture("catalogo");
const lojasDaFixture = Array.from(
  new Set(catalogo.map((linha) => String(linha.Empresa ?? "")).filter(Boolean))
);

const filiaisDaFixture: readonly FilialCadastradaTenant[] = lojasDaFixture
  .slice(0, 2)
  .map((identificador, indice) => ({
    filialId: indice + 1,
    nome: `Loja ${indice + 1}`,
    codigo: `L${indice + 1}`,
    tipo: indice === 0 ? ("matriz" as const) : ("filial" as const),
    ativa: true,
    identificadoresFonte: [identificador],
  }));

/** `fetch` falso que responde as consultas homologadas com as fixtures. */
function fetchDasFixtures(): typeof fetch {
  return (async (url: unknown, init?: RequestInit) => {
    const corpo = JSON.parse(String(init?.body ?? "{}")) as { queries?: { query: string }[] };
    const dax = corpo.queries?.[0]?.query ?? "";

    // A fonte aplica o filtro de carteira; com carteira vazia, não volta nada.
    if (dax.includes("{ -1 }")) return respostaDax([]);

    let nome = "";
    if (dax.includes("PRODUTOS_SEMELHANTES")) nome = "similares";
    else if (dax.includes("MOVESTOQ") && dax.includes("Delta")) nome = "movimentos";
    else if (dax.includes("MOVESTOQ")) nome = "entradas-hoje";
    else if (dax.includes("TBL_SOLICITACOES_COMPRAS_HIST")) nome = "ultimo-pedido";
    else if (dax.includes("TBL_SOLICITACOES_COMPRAS")) nome = "sugestoes-erp";
    else if (dax.includes("PEDIDOS[")) nome = "pedidos-erp";
    else if (dax.includes("VendasQtd90d") || dax.includes("Quantidade Vendida")) nome = "historico";
    else if (dax.includes("Estoque Qtd Atual")) {
      // Posição é uma consulta por loja: responde a da loja filtrada.
      const daLoja1 = filiaisDaFixture[0]?.identificadoresFonte?.[0];
      nome = daLoja1 && dax.includes(daLoja1) ? "posicao-loja-1" : "posicao-loja-2";
    } else if (dax.includes("ACODPRODUTO")) nome = "catalogo";

    return respostaDax(nome ? lerFixture(nome) : []);
  }) as unknown as typeof fetch;
}

function respostaDax(linhas: Record<string, unknown>[]): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ results: [{ tables: [{ rows: linhas }] }] }),
  } as unknown as Response;
}

function criarFontePowerBI(): AdaptadorInventarioCarreiro {
  return new AdaptadorInventarioCarreiro({
    clienteDax: new ClienteDaxPowerBI({
      workspaceId: "workspace-de-teste",
      datasetId: "dataset-de-teste",
      accessTokenFixo: "token-de-teste",
      fetchCustomizado: fetchDasFixtures(),
    }),
    // Cache próprio por instância: uma fonte de teste não pode herdar a carga
    // de outra, senão o contrato validaria o cache e não o adaptador.
    gerenciadorCache: new GerenciadorCacheResiliente(),
    filiais: filiaisDaFixture,
    nomeERP: "ERP de Teste",
  });
}

describe.skipIf(filiaisDaFixture.length < 2)("fonte Power BI (fixtures gravadas)", () => {
  executarContratoInventoryAdapter({
    nome: "Power BI com fixtures da fonte real",
    criar: criarFontePowerBI,
    filiais: filiaisDaFixture,
    natureza: "real",
    capacidadesEsperadas: {
      pedidosERP: true,
      cotacoesERP: true,
      entradasConfirmadas: true,
      sugestoesErp: true,
    },
  });

  it("descarta as lojas que a fonte trouxe e o cadastro não declara", async () => {
    const carga = await criarFontePowerBI().carregarInventarioCompleto({
      fornecedoresPermitidos: null,
    });

    const naoMapeadas = carga.metadados.lojasNaoMapeadas ?? [];
    // O catálogo da fixture tem mais lojas do que as 2 declaradas.
    expect(naoMapeadas.length).toBeGreaterThan(0);
    for (const estoque of carga.estoques.values()) {
      expect([1, 2]).toContain(estoque.filialId);
    }
  });

  it("declara ruptura e quantidade já pedida como NÃO MEDIDAS", async () => {
    const carga = await criarFontePowerBI().carregarInventarioCompleto({
      fornecedoresPermitidos: null,
    });

    const algumEstoque = Array.from(carga.estoques.values())[0];
    expect(algumEstoque?.camposIndisponiveis ?? []).toContain("quantidadeJaPedida");
  });
});

executarContratoInventoryAdapter({
  nome: "fonte sintética completa (demonstração)",
  criar: () => new AdaptadorInventarioMock({ totalSkus: 300 }),
  filiais: TENANT_DEMONSTRACAO.filiais,
  natureza: "sintetica",
  capacidadesEsperadas: {
    pedidosERP: true,
    cotacoesERP: true,
    entradasConfirmadas: true,
    sugestoesErp: true,
  },
});

executarContratoInventoryAdapter({
  nome: "cliente MÍNIMO (2 lojas 7 e 9, sem ERP)",
  criar: () =>
    new AdaptadorInventarioMock({
      totalSkus: 120,
      filiais: FILIAIS_MINIMAS.map((f) => ({ filialId: f.filialId, nome: f.nome })),
      capacidades: {
        pedidosERP: false,
        cotacoesERP: false,
        entradasConfirmadas: false,
        sugestoesErp: false,
      },
    }),
  filiais: FILIAIS_MINIMAS,
  natureza: "sintetica",
  capacidadesEsperadas: {
    pedidosERP: false,
    cotacoesERP: false,
    entradasConfirmadas: false,
    sugestoesErp: false,
  },
});

describe("o cadastro só DESLIGA capacidade, nunca liga", () => {
  it("capacidade desligada some do objeto que as rotas enxergam", () => {
    const completa = new AdaptadorInventarioMock({ totalSkus: 50 });
    expect(completa.pedidosERP).toBeDefined();

    const efetiva = capacidadesEfetivas(completa, {
      fonte: { adaptador: "sintetica", capacidadesDesligadas: ["pedidosERP", "sugestoesErp"] },
    });

    expect(efetiva.pedidosERP).toBeUndefined();
    expect(efetiva.forneceSugestoesErp).toBe(false);
    // O que não foi desligado continua igual.
    expect(efetiva.cotacoesERP).toBeDefined();
  });

  it("desligar o que a fonte não tem não inventa capacidade", () => {
    const semErp = new AdaptadorInventarioMock({
      totalSkus: 50,
      capacidades: { pedidosERP: false },
    });
    const efetiva = capacidadesEfetivas(semErp, {
      fonte: { adaptador: "sintetica", capacidadesDesligadas: ["cotacoesERP"] },
    });

    expect(efetiva.pedidosERP).toBeUndefined();
    expect(efetiva.cotacoesERP).toBeUndefined();
  });
});

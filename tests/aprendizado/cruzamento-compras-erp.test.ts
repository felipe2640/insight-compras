import { describe, it, expect } from "vitest";
import {
  indexarSugestoesRegistradas,
  sugestaoQueAntecedeuACompra,
} from "@/lib/aprendizado/cruzamento-compras-erp";
import type { ItemComparativo } from "@/lib/aprendizado/porta-repositorio";

function sugestao(parciais: Partial<ItemComparativo>): ItemComparativo {
  return {
    id: 1,
    snapshotId: 1,
    exportadoEm: "2026-09-10T12:00:00.000Z",
    usuario: "comprador",
    produtoId: 101,
    sku: "SKU-101",
    descricao: null,
    filialId: 1,
    custo: 10,
    qtdComprador: 5,
    qtdModelo: 8,
    qtdTransferenciaComprador: 0,
    qtdTransferenciaModelo: 0,
    perfil: "ALTO_GIRO",
    elegivel: true,
    motivoInelegibilidade: null,
    sinalGovernanca: null,
    feedback: null,
    confirmacao: null,
    ...parciais,
  };
}

describe("Cruzamento compra real do ERP × sugestão registrada do modelo", () => {
  it("usa a sugestão que ANTECEDEU a compra, não a mais recente de todas", () => {
    const indice = indexarSugestoesRegistradas([
      sugestao({ id: 1, exportadoEm: "2026-09-01T10:00:00Z", qtdModelo: 4 }),
      sugestao({ id: 2, exportadoEm: "2026-09-10T10:00:00Z", qtdModelo: 8 }),
      // Posterior à compra: não explica a decisão do comprador.
      sugestao({ id: 3, exportadoEm: "2026-09-20T10:00:00Z", qtdModelo: 99 }),
    ]);

    const r = sugestaoQueAntecedeuACompra(indice, 101, 1, "2026-09-15T08:00:00Z");

    expect(r?.id).toBe(2);
    expect(r?.qtdModelo).toBe(8);
  });

  it("devolve null quando toda sugestão é posterior à compra", () => {
    const indice = indexarSugestoesRegistradas([
      sugestao({ exportadoEm: "2026-09-20T10:00:00Z", qtdModelo: 99 }),
    ]);
    expect(sugestaoQueAntecedeuACompra(indice, 101, 1, "2026-09-15T08:00:00Z")).toBeNull();
  });

  it("não casa item de outra loja", () => {
    const indice = indexarSugestoesRegistradas([sugestao({ filialId: 3, qtdModelo: 8 })]);
    expect(sugestaoQueAntecedeuACompra(indice, 101, 1, "2026-09-15T08:00:00Z")).toBeNull();
  });

  it("não casa outro produto", () => {
    const indice = indexarSugestoesRegistradas([sugestao({ produtoId: 202 })]);
    expect(sugestaoQueAntecedeuACompra(indice, 101, 1, "2026-09-15T08:00:00Z")).toBeNull();
  });

  it("ignora sugestão sem loja em vez de atribuí-la a alguma", () => {
    const indice = indexarSugestoesRegistradas([sugestao({ filialId: null, qtdModelo: 8 })]);
    expect(sugestaoQueAntecedeuACompra(indice, 101, 1, "2026-09-15T08:00:00Z")).toBeNull();
  });

  it("data de compra ilegível não casa com nada", () => {
    // Sem a data não há como saber qual sugestão estava na tela; escolher a
    // mais recente poderia pegar uma posterior à compra.
    const indice = indexarSugestoesRegistradas([sugestao({ qtdModelo: 8 })]);
    expect(sugestaoQueAntecedeuACompra(indice, 101, 1, "")).toBeNull();
    expect(sugestaoQueAntecedeuACompra(indice, 101, 1, "data-invalida")).toBeNull();
  });

  it("sem nenhuma sugestão registrada, devolve null (e não um número inventado)", () => {
    const indice = indexarSugestoesRegistradas([]);
    expect(sugestaoQueAntecedeuACompra(indice, 101, 1, "2026-09-15T08:00:00Z")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import {
  idDoModelo,
  layoutDoModelo,
  mesclarModelos,
  modelosDeFabrica,
  validarModelo,
  type ModeloExportacao,
} from "@/lib/exportacao/modelos";
import { TENANT_CARREIRO } from "@config/tenants/carreiro";
import { IDS_COLUNAS_EXPORTACAO } from "@/lib/exportacao/catalogo-colunas";

const IDS_CATALOGO = IDS_COLUNAS_EXPORTACAO;

const modelo = (p: Partial<ModeloExportacao>): ModeloExportacao => ({
  id: "m",
  nome: "Modelo",
  escopo: "compra",
  colunas: ["sku"],
  formato: "csv",
  nomeArquivo: "{tenant} {data}",
  deFabrica: false,
  ...p,
});

describe("identificador do modelo", () => {
  it("vira slug estável a partir do nome digitado", () => {
    expect(idDoModelo("Pedido Fornecedor")).toBe("pedido_fornecedor");
    expect(idDoModelo("  Análise Completa!  ")).toBe("analise_completa");
    expect(idDoModelo("###")).toBe("modelo");
  });
});

describe("modelos de fábrica", () => {
  it("cada layout do tenant vira um botão", () => {
    const fabrica = modelosDeFabrica(TENANT_CARREIRO.exportacao);
    expect(fabrica.length).toBe(TENANT_CARREIRO.exportacao.layouts.length);
    expect(fabrica.every((m) => m.deFabrica)).toBe(true);
  });

  it("o formato do botão respeita o que o layout permite", () => {
    for (const m of modelosDeFabrica(TENANT_CARREIRO.exportacao)) {
      const layout = TENANT_CARREIRO.exportacao.layouts.find((l) => l.id === m.id)!;
      expect(layout.formatosPermitidos).toContain(m.formato);
    }
  });
});

describe("modelo vira layout para o gerador", () => {
  it("só permite o formato que o modelo escolheu", () => {
    const l = layoutDoModelo(modelo({ formato: "xlsx" }));
    expect(l.formatosPermitidos).toEqual(["xlsx"]);
    expect(l.colunas).toEqual(["sku"]);
  });
});

describe("mesclagem", () => {
  it("salvo com id novo entra ao lado do de fábrica", () => {
    const fabrica = [modelo({ id: "a", deFabrica: true })];
    const juntos = mesclarModelos(fabrica, [modelo({ id: "b" })]);
    expect(juntos.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("salvo com id de fábrica sobrescreve, mas continua não apagável", () => {
    const fabrica = [modelo({ id: "a", nome: "Original", deFabrica: true })];
    const juntos = mesclarModelos(fabrica, [modelo({ id: "a", nome: "Ajustado" })]);
    expect(juntos).toHaveLength(1);
    expect(juntos[0].nome).toBe("Ajustado");
    expect(juntos[0].deFabrica).toBe(true);
  });
});

describe("validação", () => {
  it("aceita um modelo bem formado", () => {
    expect(validarModelo(modelo({ nome: "Pedido semanal" }), IDS_CATALOGO)).toEqual([]);
  });

  it("recusa nome curto, escopo e formato desconhecidos", () => {
    const erros = validarModelo(
      { nome: "ab", escopo: "inventado" as never, formato: "doc" as never, colunas: ["sku"] },
      IDS_CATALOGO
    );
    expect(erros.map((e) => e.campo).sort()).toEqual(["escopo", "formato", "nome"]);
  });

  it("recusa modelo sem coluna — geraria arquivo vazio", () => {
    const erros = validarModelo(modelo({ colunas: [] }), IDS_CATALOGO);
    expect(erros[0].campo).toBe("colunas");
  });

  it("recusa coluna que não existe no catálogo", () => {
    const erros = validarModelo(modelo({ colunas: ["sku", "coluna_fantasma"] }), IDS_CATALOGO);
    expect(erros).toHaveLength(1);
    expect(erros[0].mensagem).toContain("coluna_fantasma");
  });
});

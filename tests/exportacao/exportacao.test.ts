import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import {
  CATALOGO_COLUNAS_EXPORTACAO,
  IDS_COLUNAS_EXPORTACAO,
  montarTabelaExportacao,
  filtrarPorEscopo,
  gerarCsv,
  gerarXlsx,
  gerarPdf,
  gerarArquivoExportacao,
  montarNomeArquivo,
  validarConfiguracaoExportacao,
  layoutPadraoDoTenant,
  LayoutExportacao,
  ContextoExportacao,
} from "@/lib/exportacao";
import { TENANT_CARREIRO } from "@config/tenants/carreiro";

function criarLinha(sobrescritas: Partial<LinhaCockpitMatriz> = {}): LinhaCockpitMatriz {
  return {
    produtoId: 1,
    codigoSku: "000363",
    descricao: 'BIELETA ESTAB "DT" POLO; GOL',
    marca: "PERFECT",
    fabricante: "PERFECT",
    referenciaFabricante: "KBT4067",
    aplicacaoVeicular: "POLO/GOL",
    secaoNome: "Suspensão",
    fornecedorId: 12,
    nomeFornecedor: "Distribuidora X",
    precoCusto: 18.9,
    precoVenda: 39,
    curvaAbc: "A",
    perfilGiro: "ALTO_GIRO",
    rupturaDiasAnalisados: null,
    rupturaDiasZerados: null,
    rupturaPercentual: null,
    classificacaoRuptura: "Sem histórico",
    dataUltimoZeramento: null,
    vendaPerdidaEstimadaReais: 0,
    notasVenda90d: 12,
    notasDevolucao90d: 0,
    notasLiquidas90d: 12,
    frequenciaPercentual90d: 13.3,
    classificacaoFrequencia: "Baixa",
    totalPecasVendidas90d: 40,
    extratoFrequencia90d: [],
    vendasLiquidas30d: 15,
    consumoMedioDiario30d: 0.5,
    diasCobertura30d: 0,
    vendasLiquidas90d: 40,
    consumoMedioDiario90d: 0.44,
    diasCobertura90d: 0,
    vendasLiquidas180d: 90,
    consumoMedioDiario180d: 0.5,
    diasCobertura180d: 0,
    tendenciaCobertura: "ESTAVEL",
    isMarcaZumbi: false,
    filialFocoId: 1,
    filialFocoNome: "Carreiro Pedro II (Matriz)",
    estoqueLojaFoco: 0,
    estoqueMinimoLojaFoco: 4,
    quantidadeJaPedidaFoco: null,
    estoqueOutrasLojasRede: 9,
    sugestaoFinalCompra: 1,
    previsaoBrutaModelo: 2,
    horizonteDiasAplicado: 20,
    margemSegurancaAplicada: 0.25,
    fatorCalibracaoAplicado: 0.9,
    motivoInelegibilidade: null,
    statusSugestao: "APROVADO_COMPRA",
    motivoDecisao: "Transferir 1 un de Poranga e comprar 1 un (múltiplo 1)",
    loteMultiplo: 1,
    pedidoCustom: 0,
    transferenciaCustom: 0,
    filialOrigemTransferenciaId: 3,
    filialOrigemTransferenciaNome: "Carreiro Poranga",
    saldoOrigemTransferencia: 6,
    estoqueMinimoOrigemTransferencia: 5,
    sobraRealOrigemTransferencia: 1,
    necessidadeDestinoTransferencia: 2,
    quantidadeTransferenciaSugerida: 1,
    similares: [],
    entradasHoje: [],
    consumoDiario: 0.5,
    consumoMensal: 15,
    diasSemVenda: 3,
    dtUltVenda: "2026-09-05T10:00:00",
    dtUltimaCompra: null,
    ...sobrescritas,
  };
}

const CONTEXTO: ContextoExportacao = {
  tenantId: "carreiro",
  nomeTenant: "Rede Carreiro Autopeças",
  filialId: 1,
  nomeLoja: "Carreiro Pedro II (Matriz)",
  dataReferencia: new Date(2026, 8, 9, 14, 30),
};

const LAYOUT_TESTE: LayoutExportacao = {
  id: "teste",
  nome: "Layout de teste",
  escopo: "compra_ou_transferencia",
  colunas: ["sku", "descricao", "qtd_pedido", "qtd_transferir", "preco_custo", "valor_total_pedido", "ultima_venda"],
  formatosPermitidos: ["csv", "xlsx", "pdf"],
  nomeArquivo: "arquivo_{tenant}_{loja}_{data}_{layout}",
};

describe("Exportação configurável por cliente", () => {
  describe("escopo de linhas", () => {
    const itens = [
      criarLinha({ codigoSku: "A", sugestaoFinalCompra: 2, quantidadeTransferenciaSugerida: 0 }),
      criarLinha({ codigoSku: "B", sugestaoFinalCompra: 0, quantidadeTransferenciaSugerida: 3 }),
      criarLinha({ codigoSku: "C", sugestaoFinalCompra: 0, quantidadeTransferenciaSugerida: 0 }),
      // ajuste humano vale mais que a sugestão do motor
      criarLinha({ codigoSku: "D", sugestaoFinalCompra: 0, pedidoCustom: 5, quantidadeTransferenciaSugerida: 0 }),
    ];
    it("compra: só quem tem quantidade de pedido (motor ou comprador)", () => {
      expect(filtrarPorEscopo(itens, "compra").map((i) => i.codigoSku)).toEqual(["A", "D"]);
    });
    it("transferencia: só quem tem transferência", () => {
      expect(filtrarPorEscopo(itens, "transferencia").map((i) => i.codigoSku)).toEqual(["B"]);
    });
    it("compra_ou_transferencia: qualquer ação", () => {
      expect(filtrarPorEscopo(itens, "compra_ou_transferencia").map((i) => i.codigoSku)).toEqual(["A", "B", "D"]);
    });
    it("todos: tudo", () => {
      expect(filtrarPorEscopo(itens, "todos")).toHaveLength(4);
    });
  });

  describe("montagem da tabela", () => {
    it("respeita a ORDEM das colunas do layout e ignora IDs desconhecidos", () => {
      const layout: LayoutExportacao = { ...LAYOUT_TESTE, colunas: ["qtd_pedido", "coluna_inexistente", "sku"] };
      const t = montarTabelaExportacao([criarLinha()], layout);
      expect(t.cabecalhos).toEqual(["Qtd. pedido", "SKU"]);
      expect(t.linhas[0]).toEqual([1, "000363"]);
    });

    it("aplica rótulos personalizados do cliente (ex.: nome de campo do ERP)", () => {
      const layout: LayoutExportacao = {
        ...LAYOUT_TESTE,
        colunas: ["sku", "qtd_pedido"],
        rotulosPersonalizados: { sku: "COD_PROD", qtd_pedido: "QTDE" },
      };
      expect(montarTabelaExportacao([criarLinha()], layout).cabecalhos).toEqual(["COD_PROD", "QTDE"]);
    });

    it("a seleção do usuário restringe, mas não reordena, o layout", () => {
      const t = montarTabelaExportacao([criarLinha()], LAYOUT_TESTE, new Set(["preco_custo", "sku"]));
      expect(t.cabecalhos).toEqual(["SKU", "Preço custo"]);
    });

    it("valor não medido sai como vazio, não como zero", () => {
      const layout: LayoutExportacao = { ...LAYOUT_TESTE, colunas: ["pedido_em_aberto", "ultima_compra"] };
      const t = montarTabelaExportacao([criarLinha()], layout);
      expect(t.linhas[0]).toEqual([null, null]);
      expect(gerarCsv(t, { incluirBom: false })).toBe('"Pedido em aberto";"Última compra"\r\n;\r\n');
    });

    it("valor total do pedido usa a quantidade EFETIVA (ajuste do comprador)", () => {
      const layout: LayoutExportacao = { ...LAYOUT_TESTE, colunas: ["qtd_pedido", "valor_total_pedido"] };
      const t = montarTabelaExportacao([criarLinha({ pedidoCustom: 4, precoCusto: 10 })], layout);
      expect(t.linhas[0]).toEqual([4, 40]);
    });
  });

  describe("CSV", () => {
    it("usa ; e vírgula decimal por padrão, com BOM, texto entre aspas e data pt-BR", () => {
      const csv = gerarCsv(montarTabelaExportacao([criarLinha()], LAYOUT_TESTE));
      expect(csv.charCodeAt(0)).toBe(0xfeff);
      const linhas = csv.slice(1).split("\r\n");
      expect(linhas[0]).toBe('"SKU";"Descrição";"Qtd. pedido";"Qtd. transferir";"Preço custo";"Valor total pedido";"Última venda"');
      // aspas internas dobradas; ponto-e-vírgula dentro do texto preservado
      expect(linhas[1]).toBe('"000363";"BIELETA ESTAB ""DT"" POLO; GOL";1;1;18,90;18,90;05/09/2026');
    });

    it("aceita separador , e ponto decimal quando o cliente exigir", () => {
      const csv = gerarCsv(montarTabelaExportacao([criarLinha()], LAYOUT_TESTE), {
        separador: ",",
        separadorDecimal: ".",
        incluirBom: false,
        quebraLinha: "\n",
      });
      expect(csv.split("\n")[1]).toBe('"000363","BIELETA ESTAB ""DT"" POLO; GOL",1,1,18.90,18.90,05/09/2026');
    });
  });

  describe("XLSX", () => {
    it("gera planilha legível com números como número e texto como texto", () => {
      const bytes = gerarXlsx(montarTabelaExportacao([criarLinha()], LAYOUT_TESTE), { nomePlanilha: "Pedido" });
      // cellNF: o SheetJS só preserva o formato numérico na leitura se pedido.
      const pasta = XLSX.read(bytes, { type: "array", cellNF: true });
      expect(pasta.SheetNames).toEqual(["Pedido"]);
      const planilha = pasta.Sheets["Pedido"];
      const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(planilha);
      expect(linhas).toHaveLength(1);
      expect(linhas[0]["SKU"]).toBe("000363"); // zeros à esquerda preservados
      expect(linhas[0]["Preço custo"]).toBe(18.9); // número, não "18,90"
      expect(linhas[0]["Qtd. pedido"]).toBe(1);
      expect(planilha["E2"].z).toBe('"R$" #,##0.00');
    });

    it("corta o nome da planilha em 31 caracteres e remove caracteres proibidos", () => {
      const bytes = gerarXlsx(montarTabelaExportacao([], LAYOUT_TESTE), {
        nomePlanilha: "Análise completa (compra + transferência) / lojas: [todas]?",
      });
      const nome = XLSX.read(bytes, { type: "array" }).SheetNames[0];
      expect(nome.length).toBeLessThanOrEqual(31);
      expect(nome).not.toMatch(/[:\\/?*[\]]/);
    });
  });

  describe("PDF", () => {
    it("gera um PDF válido", async () => {
      const bytes = await gerarPdf(montarTabelaExportacao([criarLinha()], LAYOUT_TESTE), {
        titulo: "Pedido de Compra",
        contexto: CONTEXTO,
      });
      expect(bytes.length).toBeGreaterThan(500);
      expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    });
  });

  describe("orquestrador", () => {
    it("monta o nome do arquivo pelo padrão do tenant, sem acento nem espaço", () => {
      expect(montarNomeArquivo(LAYOUT_TESTE, "xlsx", CONTEXTO)).toBe(
        "arquivo_carreiro_carreiro_pedro_ii_matriz_2026-09-09_teste.xlsx"
      );
    });

    it("recusa formato que o layout não permite", async () => {
      const layout: LayoutExportacao = { ...LAYOUT_TESTE, formatosPermitidos: ["csv"] };
      await expect(
        gerarArquivoExportacao({ itens: [criarLinha()], layout, formato: "pdf", contexto: CONTEXTO })
      ).rejects.toThrow(/não permite o formato PDF/);
    });

    it("entrega CSV com o MIME e o nome corretos", async () => {
      const arq = await gerarArquivoExportacao({ itens: [criarLinha()], layout: LAYOUT_TESTE, formato: "csv", contexto: CONTEXTO });
      expect(arq.nomeArquivo.endsWith(".csv")).toBe(true);
      expect(arq.mime).toContain("text/csv");
      expect(typeof arq.conteudo).toBe("string");
    });
  });

  describe("configuração da Carreiro", () => {
    const ids = new Set(IDS_COLUNAS_EXPORTACAO);

    it("é válida: todo layout usa só colunas do catálogo", () => {
      expect(validarConfiguracaoExportacao(TENANT_CARREIRO.exportacao, ids)).toEqual([]);
    });

    it("tem layouts separados de pedido e transferência, e o padrão é o pedido", () => {
      const cfg = TENANT_CARREIRO.exportacao;
      expect(cfg.layouts.map((l) => l.id)).toContain("pedido_fornecedor");
      expect(cfg.layouts.map((l) => l.id)).toContain("transferencias_lojas");
      expect(layoutPadraoDoTenant(cfg).id).toBe("pedido_fornecedor");
      expect(cfg.csvPadrao.separador).toBe(";");
      expect(cfg.csvPadrao.separadorDecimal).toBe(",");
    });

    it("o validador acusa coluna desconhecida e rótulo órfão", () => {
      const problemas = validarConfiguracaoExportacao(
        {
          ...TENANT_CARREIRO.exportacao,
          layouts: [{ ...LAYOUT_TESTE, colunas: ["sku", "nao_existe"], rotulosPersonalizados: { marca: "X" } }],
          layoutPadraoId: "teste",
        },
        ids
      );
      expect(problemas.some((p) => p.includes("nao_existe"))).toBe(true);
      expect(problemas.some((p) => p.includes('"marca"'))).toBe(true);
    });

    it("todo item do catálogo tem rótulo e grupo", () => {
      for (const c of CATALOGO_COLUNAS_EXPORTACAO.values()) {
        expect(c.rotulo.length).toBeGreaterThan(0);
        expect(c.grupo.length).toBeGreaterThan(0);
      }
    });
  });
});

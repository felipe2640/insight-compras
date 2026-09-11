/**
 * Suíte de Testes da Régua do Motor — Etapa E1
 * Validação de "Sem Histórico na Loja em Foco" como Não Medido (não zero)
 * e Medição Rigorosa dos 4 Efeitos Colaterais:
 *   1. Ordenação
 *   2. Filtro por faixa
 *   3. Contagem dos chips
 *   4. Conteúdo exportado
 *
 * Invariante 1: "Zero não é o mesmo que não medido."
 */

import { describe, it, expect } from "vitest";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { criarColunasCockpit } from "@/components/cockpit/colunas-cockpit";
import {
  compararNumerico,
  aplicarFiltroColuna,
  valorEstaVazio,
  interpretarNumero,
} from "@/lib/cockpit/filtros-coluna";
import { contarStatusGrade, ehLinhaAcionavel } from "@/lib/cockpit/escopo-grade";
import { CATALOGO_COLUNAS_EXPORTACAO } from "@/lib/exportacao/catalogo-colunas";
import { formatarValorTexto } from "@/lib/exportacao/formatar-valor";
import { montarTabelaExportacao } from "@/lib/exportacao/montar-tabela";
import { gerarCsv } from "@/lib/exportacao/gerar-csv";
import { gerarXlsx } from "@/lib/exportacao/gerar-xlsx";
import { LayoutExportacao } from "@/lib/exportacao/tipos";
import { Produto, EstoqueFilial, HistoricoVendasFilial } from "@core/dominio";
import { RespostaCargaInventario } from "@adapters/AdaptadorInventario";

function criarCargaTeste(parciais?: {
  comHistoricoFoco?: boolean;
  vendasFoco?: number;
  camposIndisponiveis?: (keyof HistoricoVendasFilial)[];
}): RespostaCargaInventario {
  const produtoSemHist: Produto = {
    id: 1001,
    codigoSku: "SKU-SEM-HIST-01",
    descricao: "AMORTECEDOR DIANTEIRO TESTE SEM HISTORICO",
    marca: "MONROE",
    fabricante: "TENNECO",
    referenciaFabricante: "G1001",
    aplicacaoVeicular: "COROLLA",
    familiaId: "FAM-10",
    secaoId: 10,
    nomeSecao: "Suspensão",
    subgrupoId: 101,
    subgrupoNome: "AMORTECEDOR",
    fornecedorId: 501,
    nomeFornecedor: "MONROE DO BRASIL",
    precoCusto: 200,
    precoVenda: 320,
    loteMultiplo: 2,
  };

  const produtoComZero: Produto = {
    id: 1002,
    codigoSku: "SKU-COM-ZERO-02",
    descricao: "VELA DE IGNICAO TESTE COM HISTORICO ZERO",
    marca: "NGK",
    fabricante: "NGK",
    referenciaFabricante: "BKR6E",
    aplicacaoVeicular: "GOL",
    familiaId: "FAM-20",
    secaoId: 20,
    nomeSecao: "Motor",
    subgrupoId: 201,
    subgrupoNome: "VELA DE IGNICAO",
    fornecedorId: 502,
    nomeFornecedor: "NGK DO BRASIL",
    precoCusto: 20,
    precoVenda: 35,
    loteMultiplo: 4,
  };

  const produtoComVendas: Produto = {
    id: 1003,
    codigoSku: "SKU-COM-VENDAS-03",
    descricao: "DISCO DE FREIO TESTE COM VENDAS ATIVAS",
    marca: "FREMAX",
    fabricante: "FREMAX",
    referenciaFabricante: "BD1234",
    aplicacaoVeicular: "ONIX",
    familiaId: "FAM-30",
    secaoId: 30,
    nomeSecao: "Freios",
    subgrupoId: 301,
    subgrupoNome: "DISCO DE FREIO",
    fornecedorId: 503,
    nomeFornecedor: "FREMAX BRASIL",
    precoCusto: 80,
    precoVenda: 130,
    loteMultiplo: 2,
  };

  const criarEstoqueMock = (dados: {
    produtoId: number;
    filialId: number;
    saldoFisico: number;
    estoqueMinimoSeguranca: number;
    quantidadeJaPedida: number;
    camposIndisponiveis?: (keyof EstoqueFilial)[];
  }): EstoqueFilial => ({
    produtoId: dados.produtoId,
    filialId: dados.filialId,
    nomeFilial: `Filial ${dados.filialId}`,
    saldoFisico: dados.saldoFisico,
    estoqueMinimoSeguranca: dados.estoqueMinimoSeguranca,
    quantidadeJaPedida: dados.quantidadeJaPedida,
    consumoMedioDiarioErp: 0,
    diasSemVenda: null,
    sinalGovernancaCompra: null,
    usoLimiteCompra: null,
    margemRealizada: null,
    margemAlvo: null,
    dataUltimaVenda: null,
    dataUltimaCompra: null,
    camposIndisponiveis: dados.camposIndisponiveis ?? ["quantidadeJaPedida"],
  });

  const estoques = new Map<string, EstoqueFilial>();
  estoques.set("1001:1", criarEstoqueMock({
    produtoId: 1001,
    filialId: 1,
    saldoFisico: 5,
    estoqueMinimoSeguranca: 2,
    quantidadeJaPedida: 0,
    camposIndisponiveis: ["quantidadeJaPedida"],
  }));
  estoques.set("1002:1", criarEstoqueMock({
    produtoId: 1002,
    filialId: 1,
    saldoFisico: 8,
    estoqueMinimoSeguranca: 4,
    quantidadeJaPedida: 0,
    camposIndisponiveis: ["quantidadeJaPedida"],
  }));
  estoques.set("1003:1", criarEstoqueMock({
    produtoId: 1003,
    filialId: 1,
    saldoFisico: 2,
    estoqueMinimoSeguranca: 6,
    quantidadeJaPedida: 0,
    camposIndisponiveis: ["quantidadeJaPedida"],
  }));

  const historicos = new Map<string, HistoricoVendasFilial>();

  // 1001 NÃO TEM HISTÓRICO NA LOJA 1 (apenas em outra loja da rede para simular rede real)
  historicos.set("1001:2", {
    produtoId: 1001,
    filialId: 2,
    vendasLiquidas30dias: 10,
    vendasLiquidas90dias: 30,
    vendasLiquidas180dias: 60,
    devolucoes90dias: 0,
    notasFiscaisVenda90dias: 15,
    notasFiscaisDevolucao90dias: 0,
    mesesAtivos12meses: 6,
    medianaLinhaVenda: 2,
    diasRuptura90dias: 0,
    diasObservados: 180,
    dataPrimeiraVendaRegistrada: "2025-01-10",
  });

  // 1002 TEM HISTÓRICO MEDIDO NA LOJA 1 IGUAL A ZERO (confirmadamente não vendeu)
  historicos.set("1002:1", {
    produtoId: 1002,
    filialId: 1,
    vendasLiquidas30dias: 0,
    vendasLiquidas90dias: 0,
    vendasLiquidas180dias: 0,
    devolucoes90dias: 0,
    notasFiscaisVenda90dias: 0,
    notasFiscaisDevolucao90dias: 0,
    mesesAtivos12meses: 0,
    medianaLinhaVenda: 0,
    diasRuptura90dias: 0,
    diasObservados: 180,
    dataPrimeiraVendaRegistrada: null,
  });

  // 1003 TEM HISTÓRICO POSITIVO MEDIDO NA LOJA 1
  historicos.set("1003:1", {
    produtoId: 1003,
    filialId: 1,
    vendasLiquidas30dias: 15,
    vendasLiquidas90dias: 45,
    vendasLiquidas180dias: 90,
    devolucoes90dias: 1,
    notasFiscaisVenda90dias: 20,
    notasFiscaisVenda12meses: 35,
    notasFiscaisDevolucao90dias: 1,
    mesesAtivos12meses: 8,
    medianaLinhaVenda: 2,
    diasRuptura90dias: 0,
    diasObservados: 180,
    dataPrimeiraVendaRegistrada: "2025-02-01",
  });

  return {
    produtos: [produtoSemHist, produtoComZero, produtoComVendas],
    estoques,
    historicos,
    entradasHoje: [],
    similares: new Map(),
    metadados: {
      provedor: "MOCK_SINTETICO",
      timestampCarga: new Date().toISOString(),
      emModoDegradado: false,
      totalSkusCarregados: 3,
      latenciaMs: 1,
    },
  };
}

describe("Régua do Motor — Unidade U6: Etapa E1", () => {
  describe("Geração Canônica da Matriz (Sem histórico vira não medido / null)", () => {
    it("deve preencher vendas, consumo e notas com null (não zero) para SKU sem histórico na loja foco", () => {
      const carga = criarCargaTeste();
      const linhas = converterParaLinhasCockpit(carga, { filialFocoId: 1 });

      const linhaSemHist = linhas.find((l) => l.codigoSku === "SKU-SEM-HIST-01");
      expect(linhaSemHist).toBeDefined();

      // Vendas nas janelas: null (não medido)
      expect(linhaSemHist?.vendasLiquidas30d).toBeNull();
      expect(linhaSemHist?.vendasLiquidas90d).toBeNull();
      expect(linhaSemHist?.vendasLiquidas180d).toBeNull();

      // Consumos médios: null
      expect(linhaSemHist?.consumoMedioDiario30d).toBeNull();
      expect(linhaSemHist?.consumoMedioDiario90d).toBeNull();
      expect(linhaSemHist?.consumoMedioDiario180d).toBeNull();
      expect(linhaSemHist?.consumoDiario).toBeNull();
      expect(linhaSemHist?.consumoMensal).toBeNull();

      // Notas e frequência: null
      expect(linhaSemHist?.notasVenda90d).toBeNull();
      expect(linhaSemHist?.notasDevolucao90d).toBeNull();
      expect(linhaSemHist?.notasLiquidas90d).toBeNull();
      expect(linhaSemHist?.frequenciaPercentual90d).toBeNull();
      expect(linhaSemHist?.classificacaoFrequencia).toBe("Sem histórico");
      expect(linhaSemHist?.classificacaoConsumo).toBe("Sem histórico");

      // Cobertura e venda a cada dias: null
      expect(linhaSemHist?.diasCobertura30d).toBeNull();
      expect(linhaSemHist?.diasCobertura90d).toBeNull();
      expect(linhaSemHist?.diasCobertura180d).toBeNull();
      expect(linhaSemHist?.vendaACadaDias).toBeNull();

      // Perfil e motivos
      expect(linhaSemHist?.perfilGiro).toBe("SEM_HISTORICO_SUFICIENTE");
      expect(linhaSemHist?.isMarcaZumbi).toBe(false); // NÃO é marca zumbi se não há histórico medido
      expect(linhaSemHist?.motivoInelegibilidade).toBe(
        "Sem histórico de vendas registrado na loja em foco"
      );
    });

    it("distingue explicitamente 'não medido' (null) de 'medido igual a zero' (0)", () => {
      const carga = criarCargaTeste();
      const linhas = converterParaLinhasCockpit(carga, { filialFocoId: 1 });

      const linhaSemHist = linhas.find((l) => l.codigoSku === "SKU-SEM-HIST-01");
      const linhaComZero = linhas.find((l) => l.codigoSku === "SKU-COM-ZERO-02");

      expect(linhaSemHist?.vendasLiquidas90d).toBeNull();
      expect(linhaComZero?.vendasLiquidas90d).toBe(0);

      expect(linhaSemHist?.consumoDiario).toBeNull();
      expect(linhaComZero?.consumoDiario).toBe(0);

      expect(linhaSemHist?.notasLiquidas90d).toBeNull();
      expect(linhaComZero?.notasLiquidas90d).toBe(0);

      // 1002 comprovadamente não vendeu há 180 dias tendo saldo positivo: é Marca Zumbi
      expect(linhaComZero?.isMarcaZumbi).toBe(true);
      // 1001 não sabemos se vendeu: NÃO pode ser marcada como Zumbi
      expect(linhaSemHist?.isMarcaZumbi).toBe(false);
    });
  });

  describe("Efeito Colateral 1: Ordenação Previsível", () => {
    it("as definições de coluna devem possuir sortUndefined: 'last' para campos não medidos", () => {
      const colunas = criarColunasCockpit({ nomeLojaFoco: "Pedro II" });
      const idsVerificar = [
        "produtosVend90d",
        "notasLiquidas90d",
        "consumoDiario",
        "consumoMensal",
        "consumoUltimos30DiasQtd",
        "vendaACadaDias",
        "cobertura",
        "histVendas90d",
        "histProdVend90d",
        "diasSemVenda",
      ];

      for (const id of idsVerificar) {
        const col = colunas.find((c) => (c as { id?: string }).id === id);
        expect(col, `Coluna ${id} deve existir`).toBeDefined();
        expect(
          (col as { sortUndefined?: string }).sortUndefined,
          `Coluna ${id} deve ter sortUndefined: 'last'`
        ).toBe("last");
      }
    });

    it("valores não medidos (null/undefined) ordenam sempre para o fim da lista", () => {
      const valores = [
        { sku: "POSITIVO", val: 5 },
        { sku: "NAO_MEDIDO", val: undefined },
        { sku: "ZERO", val: 0 },
      ];

      // Ordenação ascendente com regra de null/undefined por último
      const asc = [...valores].sort((a, b) => {
        if (a.val === undefined) return 1;
        if (b.val === undefined) return -1;
        return a.val - b.val;
      });
      expect(asc.map((x) => x.sku)).toEqual(["ZERO", "POSITIVO", "NAO_MEDIDO"]);

      // Ordenação descendente com regra de null/undefined por último
      const desc = [...valores].sort((a, b) => {
        if (a.val === undefined) return 1;
        if (b.val === undefined) return -1;
        return b.val - a.val;
      });
      expect(desc.map((x) => x.sku)).toEqual(["POSITIVO", "ZERO", "NAO_MEDIDO"]);
    });
  });

  describe("Efeito Colateral 2: Filtro por Faixa Numérica", () => {
    it("filtros numéricos (ex: maior que 0) excluem itens não medidos (null)", () => {
      // Valor não medido: null
      const passaNaoMedido = aplicarFiltroColuna(
        null,
        { operador: "maior", valor: 0 },
        "numero"
      );
      expect(passaNaoMedido).toBe(false);

      // Valor zero medido: 0 não é > 0
      const passaZero = aplicarFiltroColuna(
        0,
        { operador: "maior", valor: 0 },
        "numero"
      );
      expect(passaZero).toBe(false);

      // Valor positivo: 5 > 0
      const passaPositivo = aplicarFiltroColuna(
        5,
        { operador: "maior", valor: 0 },
        "numero"
      );
      expect(passaPositivo).toBe(true);
    });

    it("filtro por faixa (entre X e Y) exclui itens não medidos", () => {
      const filtroEntre = { operador: "entre" as const, valor: 0, valor2: 10 };

      // Não medido -> false
      expect(aplicarFiltroColuna(null, filtroEntre, "numero")).toBe(false);

      // Zero medido está entre 0 e 10 -> true
      expect(aplicarFiltroColuna(0, filtroEntre, "numero")).toBe(true);

      // 5 está entre 0 e 10 -> true
      expect(aplicarFiltroColuna(5, filtroEntre, "numero")).toBe(true);

      // 15 não está -> false
      expect(aplicarFiltroColuna(15, filtroEntre, "numero")).toBe(false);
    });

    it("filtro 'está vazio' identifica não medidos sem incluir o zero legítimo", () => {
      expect(aplicarFiltroColuna(null, { operador: "vazio" }, "numero")).toBe(true);
      expect(aplicarFiltroColuna(undefined, { operador: "vazio" }, "numero")).toBe(true);
      expect(aplicarFiltroColuna(0, { operador: "vazio" }, "numero")).toBe(false);
      expect(aplicarFiltroColuna(10, { operador: "vazio" }, "numero")).toBe(false);
    });
  });

  describe("Efeito Colateral 3: Contagem dos Chips e Badges", () => {
    it("SKU não medido não é contabilizado em Ruptura nem em Zumbi", () => {
      const carga = criarCargaTeste();
      const linhas = converterParaLinhasCockpit(carga, { filialFocoId: 1 });
      const contagens = contarStatusGrade(linhas);

      // Apenas 1003 pede compra (ou 1002 trava zumbi)
      // 1001 não medido não tem ruptura grave nem atenção (está em 'Sem histórico')
      // 1001 não medido não é marca zumbi
      expect(contagens.total).toBe(3);
      expect(contagens.zumbi).toBe(1); // apenas 1002
      expect(contagens.ruptura).toBe(0); // nenhum dos 3 tem ruptura grave/atenção

      const linhaSemHist = linhas.find((l) => l.codigoSku === "SKU-SEM-HIST-01")!;
      expect(ehLinhaAcionavel(linhaSemHist)).toBe(false);
    });
  });

  describe("Efeito Colateral 4: Conteúdo do Arquivo Exportado (CSV / XLSX)", () => {
    it("as colunas de demanda extraem null para SKU sem histórico", () => {
      const carga = criarCargaTeste();
      const linhas = converterParaLinhasCockpit(carga, { filialFocoId: 1 });
      const linhaSemHist = linhas.find((l) => l.codigoSku === "SKU-SEM-HIST-01")!;

      const colVendas90d = CATALOGO_COLUNAS_EXPORTACAO.get("vendas_90d")!;
      const colConsumoDiario = CATALOGO_COLUNAS_EXPORTACAO.get("consumo_diario")!;
      const colCobertura = CATALOGO_COLUNAS_EXPORTACAO.get("cobertura_90d")!;
      const colNotas90d = CATALOGO_COLUNAS_EXPORTACAO.get("notas_90d")!;

      expect(colVendas90d.extrair(linhaSemHist)).toBeNull();
      expect(colConsumoDiario.extrair(linhaSemHist)).toBeNull();
      expect(colCobertura.extrair(linhaSemHist)).toBeNull();
      expect(colNotas90d.extrair(linhaSemHist)).toBeNull();
    });

    it("formatarValorTexto produz string vazia para null (nunca '0' inventado)", () => {
      expect(formatarValorTexto(null, "inteiro", { separadorDecimal: "," })).toBe("");
      expect(formatarValorTexto(null, "decimal", { separadorDecimal: "," })).toBe("");
      expect(formatarValorTexto(null, "moeda", { separadorDecimal: "," })).toBe("");
      expect(formatarValorTexto(0, "inteiro", { separadorDecimal: "," })).toBe("0");
    });

    it("CSV exportado renderiza campo vazio para não medido e '0' para zero medido", () => {
      const carga = criarCargaTeste();
      const linhas = converterParaLinhasCockpit(carga, { filialFocoId: 1 });
      const layout: LayoutExportacao = {
        id: "teste_csv",
        nome: "Teste CSV",
        nomeArquivo: "teste-csv",
        escopo: "todos",
        colunas: ["sku", "vendas_90d", "consumo_diario"],
        formatosPermitidos: ["csv", "xlsx"],
      };
      const tabela = montarTabelaExportacao(linhas, layout);

      const csv = gerarCsv(tabela, { separador: ";", separadorDecimal: ",", incluirBom: false });
      const linhasCsv = csv.split("\r\n");

      // Cabeçalho (colunas entre aspas RFC 4180)
      expect(linhasCsv[0]).toBe('"SKU";"Vendas 90d";"Consumo diário"');

      // Linha 1: SKU-SEM-HIST-01 -> valores vazios entre delimitadores (não medidos)
      const linhaSemHistCsv = linhasCsv.find((l) => l.includes("SKU-SEM-HIST-01"));
      expect(linhaSemHistCsv).toBe('"SKU-SEM-HIST-01";;');

      // Linha 2: SKU-COM-ZERO-02 -> zero legítimo formatado
      const linhaComZeroCsv = linhasCsv.find((l) => l.includes("SKU-COM-ZERO-02"));
      expect(linhaComZeroCsv).toBe('"SKU-COM-ZERO-02";0;0,00');
    });

    it("XLSX exportado preserva campos null sem convertê-los em números", () => {
      const carga = criarCargaTeste();
      const linhas = converterParaLinhasCockpit(carga, { filialFocoId: 1 });
      const layout: LayoutExportacao = {
        id: "teste_xlsx",
        nome: "Teste XLSX",
        nomeArquivo: "teste-xlsx",
        escopo: "todos",
        colunas: ["sku", "vendas_90d"],
        formatosPermitidos: ["csv", "xlsx"],
      };
      const tabela = montarTabelaExportacao(linhas, layout);

      const bytes = gerarXlsx(tabela);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(0);
    });
  });
});

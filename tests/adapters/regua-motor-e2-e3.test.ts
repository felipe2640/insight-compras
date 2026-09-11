/**
 * Suíte de Testes da Régua do Motor — Etapas E2 e E3
 *
 * E2: Precedência de Lote: ERP > Histograma > Vocabulário
 * E3: Elegibilidade avaliada em 12 meses (Notas12m) e salvaguarda contra truncamento DAX
 */

import { describe, it, expect } from "vitest";
import { detectarLotePorHistograma } from "@core/travas/lote-multiplo";
import { resolverLoteAutopecas } from "@adapters/comum/lote-autopecas";
import {
  mapearProdutosDax,
  mapearHistoricoVendasDax,
} from "@adapters/carreiro/mapeador-dax";
import {
  gerarConsultaDaxHistoricoVendas,
  gerarConsultaDaxContagemHistoricoVendas,
} from "@adapters/carreiro/consultas-homologadas";
import {
  classificarPerfilGiro,
  verificarElegibilidadeHistorico,
} from "@core/calculo/demanda-diaria";

describe("Régua do Motor — Unidade U6: Etapa E2 (Lote por Histograma e Precedência)", () => {
  describe("Precedência Estrita: ERP > Histograma > Vocabulário", () => {
    it("ERP prevalece sobre Histograma e Vocabulário", () => {
      // Descrição de amortecedor (vocabulário = 2)
      // Histograma com dominância de 4
      // ERP com lote cadastrado = 6
      const resultado = resolverLoteAutopecas({
        loteCadastradoErp: 6,
        loteDetectadoHistograma: 4,
        descricao: "AMORTECEDOR DIANTEIRO COFAP",
      });

      expect(resultado.origem).toBe("ERP");
      expect(resultado.lote).toBe(6);
    });

    it("Histograma prevalece sobre Vocabulário quando ERP não possui cadastro", () => {
      // Descrição de amortecedor (vocabulário = 2)
      // ERP ausente (0)
      // Histograma com dominância de 4
      const resultado = resolverLoteAutopecas({
        loteCadastradoErp: 0,
        loteDetectadoHistograma: 4,
        descricao: "AMORTECEDOR DIANTEIRO NAKATA",
      });

      expect(resultado.origem).toBe("HISTOGRAMA");
      expect(resultado.lote).toBe(4);
    });

    it("Vocabulário atua como fallback quando não há ERP nem Histograma dominante", () => {
      // Descrição de vela de ignição (vocabulário = 4)
      // ERP ausente (0)
      // Histograma insuficiente ou sem dominância (1)
      const resultado = resolverLoteAutopecas({
        loteCadastradoErp: 0,
        loteDetectadoHistograma: 1,
        descricao: "VELA DE IGNICAO NGK GREEN",
      });

      expect(resultado.origem).toBe("VOCABULARIO");
      expect(resultado.lote).toBe(4);
    });

    it("Devolve 1 como avulso quando nenhum critério é aplicável", () => {
      const resultado = resolverLoteAutopecas({
        loteCadastradoErp: 0,
        loteDetectadoHistograma: 1,
        descricao: "FILTRO DE OLEO COMUM",
      });

      expect(resultado.origem).toBe("VOCABULARIO");
      expect(resultado.lote).toBe(1);
    });
  });

  describe("Detecção Estatística por Histograma a partir de NOTAS_ITEMS[NQTDE]", () => {
    it("detecta lote 4 a partir de distribuição de quantidades de compras", () => {
      // 8 linhas onde todas são múltiplas de 4
      const quantidadesLinhas = [4, 4, 8, 4, 12, 4, 4, 4];
      const lote = detectarLotePorHistograma(quantidadesLinhas);
      expect(lote).toBe(4);
    });

    it("detecta lote 12 preferencialmente se houver dominância no maior múltiplo", () => {
      const quantidadesLinhas = [12, 24, 12, 12, 36, 12, 12, 12];
      const lote = detectarLotePorHistograma(quantidadesLinhas);
      expect(lote).toBe(12);
    });

    it("retorna 1 quando as quantidades não formam múltiplos consistentes", () => {
      const quantidadesLinhas = [1, 3, 5, 7, 9, 11, 13, 17];
      const lote = detectarLotePorHistograma(quantidadesLinhas);
      expect(lote).toBe(1);
    });
  });

  describe("Integração do Mapeador DAX com Lote por Histograma", () => {
    it("mapearProdutosDax resolve lote via mapa lotesPorProdutoId (Histograma)", () => {
      const linhasProdutos = [
        {
          "PRODUTOS[ACODPRODUTO]": 301,
          "PRODUTOS[ADESCRICAO]": "AMORTECEDOR DIANT GOL", // vocabulário = 2
          "PRODUTOS[NPRECOCOMPRA]": 150,
        },
      ];

      // Histograma comprovou lote 4 nas vendas
      const lotesPorProdutoId = new Map<number, number>([[301, 4]]);

      const produtos = mapearProdutosDax(linhasProdutos, { lotesPorProdutoId });
      expect(produtos).toHaveLength(1);
      expect(produtos[0].loteMultiplo).toBe(4); // Histograma venceu vocabulário!
    });

    it("mapearProdutosDax respeita ERP mesmo com histograma presente", () => {
      const linhasProdutos = [
        {
          "PRODUTOS[ACODPRODUTO]": 302,
          "PRODUTOS[ADESCRICAO]": "AMORTECEDOR TRAS PALIO", // vocabulário = 2
          "PRODUTOS[LoteMultiplo]": 6, // ERP cadastrado = 6
          "PRODUTOS[NPRECOCOMPRA]": 140,
        },
      ];

      const lotesPorProdutoId = new Map<number, number>([[302, 4]]);

      const produtos = mapearProdutosDax(linhasProdutos, { lotesPorProdutoId });
      expect(produtos).toHaveLength(1);
      expect(produtos[0].loteMultiplo).toBe(6); // ERP venceu histograma!
    });

    it("mapearHistoricoVendasDax extrai LoteDetectado do DAX", () => {
      const linhasHistorico = [
        {
          "PRODUTOS[ACODPRODUTO]": 303,
          "CADEMP[ACODEMP]": 1,
          LoteDetectado: 4,
          NotasVenda90d: 10,
          Notas12m: 25,
        },
      ];

      const mapaHist = mapearHistoricoVendasDax(linhasHistorico);
      const hist = mapaHist.get("303:1");
      expect(hist).toBeDefined();
      expect(hist?.loteDetectadoHistograma).toBe(4);
      expect(hist?.notasFiscaisVenda12meses).toBe(25);
    });
  });
});

describe("Régua do Motor — Unidade U6: Etapa E3 (Elegibilidade em 12 Meses & DAX)", () => {
  describe("Critério Homologado: 3 Notas Distintas em 12m + 2 Meses Ativos", () => {
    it("torna elegível produto com poucas notas em 90d mas suficiente em 12m", () => {
      // Cenário: produto com apenas 1 nota nos últimos 90 dias (inelegível se usasse 90d),
      // mas com 4 notas nos últimos 12 meses e 3 meses ativos.
      const notas90d = 1;
      const notas12m = 4;
      const mesesAtivos = 3;
      const consumoDiario = 0.2; // 6 un/mês

      // Se usasse 90d:
      const elegivel90d = verificarElegibilidadeHistorico(notas90d, mesesAtivos);
      expect(elegivel90d).toBe(false);

      // Usando critério homologado de 12 meses:
      const elegivel12m = verificarElegibilidadeHistorico(notas12m, mesesAtivos);
      expect(elegivel12m).toBe(true);

      const perfil = classificarPerfilGiro(consumoDiario, notas12m, mesesAtivos);
      expect(perfil).toBe("ALTO_GIRO");
    });

    it("bloqueia compras de itens com notas concentradas em um único mês (sem recorrência)", () => {
      const notas12m = 8;
      const mesesAtivos = 1; // apenas 1 mês ativo
      const elegivel = verificarElegibilidadeHistorico(notas12m, mesesAtivos);
      expect(elegivel).toBe(false);

      const perfil = classificarPerfilGiro(0.3, notas12m, mesesAtivos);
      expect(perfil).toBe("SEM_HISTORICO_SUFICIENTE");
    });
  });

  describe("Validação da Consulta DAX Homologada e Salvaguarda contra Truncamento", () => {
    it("gerarConsultaDaxHistoricoVendas inclui Notas12m e LoteDetectado", () => {
      const dax = gerarConsultaDaxHistoricoVendas();

      // Confere que Notas12m está presente e usa Periodo365d
      expect(dax).toContain('"Notas12m"');
      expect(dax).toContain("Periodo365d");

      // Confere que LoteDetectado está presente e avalia múltiplos
      expect(dax).toContain('"LoteDetectado"');
      expect(dax).toContain("NOTAS_ITEMS");
      expect(dax).toContain("MOD('NOTAS_ITEMS'[NQTDE], 12)");
      expect(dax).toContain("MOD('NOTAS_ITEMS'[NQTDE], 2)");
    });

    it("gerarConsultaDaxContagemHistoricoVendas gera query COUNTROWS para auditoria de integridade", () => {
      const daxContagem = gerarConsultaDaxContagemHistoricoVendas();

      expect(daxContagem).toContain("COUNTROWS");
      expect(daxContagem).toContain("SUMMARIZECOLUMNS");
      expect(daxContagem).toContain("'CADEMP'[ACODEMP]");
      expect(daxContagem).toContain("'PRODUTOS'[ACODPRODUTO]");
    });
  });
});

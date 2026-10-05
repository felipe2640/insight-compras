/**
 * CONTRATO do InventoryAdapter.
 *
 * Um conjunto único de asserções, rodado contra TODA fonte. Antes cada
 * adaptador tinha a sua suíte e nenhum teste passava pelos dois pela mesma
 * interface — então o mock podia prometer o que a fonte real não entrega, e
 * entregava: implementava todos os métodos opcionais, nunca declarava campo
 * ausente e sempre devolvia 5 lojas começando em 1.
 *
 * Passar aqui é o que significa "esta fonte pode atender um cliente".
 */

import { describe, expect, it } from "vitest";
import type { FilialCadastradaTenant } from "@config/tenants/tipos";
import type { InventoryAdapter, StatusNormalizadoERP } from "@adapters/AdaptadorInventario";

const STATUS_VALIDOS: readonly StatusNormalizadoERP[] = [
  "aberto",
  "concluido",
  "cancelado",
  "desconhecido",
];

export interface CenarioContrato {
  /** Nome do cenário, como aparece na saída do teste. */
  readonly nome: string;
  /** Cria uma fonte nova (o estado não pode vazar entre asserções). */
  readonly criar: () => InventoryAdapter;
  /** Filiais declaradas no cadastro deste cliente. */
  readonly filiais: readonly FilialCadastradaTenant[];
  readonly natureza: "real" | "sintetica";
  /** Capacidades esperadas; ausente = não exigida nem proibida. */
  readonly capacidadesEsperadas?: {
    readonly pedidosERP?: boolean;
    readonly cotacoesERP?: boolean;
    readonly entradasConfirmadas?: boolean;
    readonly sugestoesErp?: boolean;
  };
}

export function executarContratoInventoryAdapter(cenario: CenarioContrato): void {
  const idsDeclarados = new Set(cenario.filiais.filter((f) => f.ativa).map((f) => f.filialId));

  describe(`contrato do InventoryAdapter — ${cenario.nome}`, () => {
    it("declara quem é: descrição da fonte e natureza", () => {
      const fonte = cenario.criar();
      expect(fonte.descricaoFonte.trim().length).toBeGreaterThan(0);
      expect(fonte.natureza).toBe(cenario.natureza);
      expect(typeof fonte.forneceSugestoesErp).toBe("boolean");
    });

    it("responde sobre a própria saúde sem lançar", async () => {
      const fonte = cenario.criar();
      expect(typeof (await fonte.verificarSaudeConexao())).toBe("boolean");
    });

    it("entrega uma carga coerente com o CADASTRO de lojas do cliente", async () => {
      const fonte = cenario.criar();
      const carga = await fonte.carregarInventarioCompleto({ fornecedoresPermitidos: null });

      expect(Array.isArray(carga.produtos)).toBe(true);
      expect(carga.metadados.totalSkusCarregados).toBe(carga.produtos.length);

      for (const produto of carga.produtos) {
        expect(produto.id).toBeGreaterThan(0);
        expect(produto.loteMultiplo).toBeGreaterThanOrEqual(1);
      }

      // Nenhuma loja fora do cadastro. Este é o ponto: uma loja desconhecida
      // virava a filial 1 e somava estoque de lojas diferentes.
      for (const [chave, estoque] of carga.estoques) {
        expect(chave).toBe(`${estoque.produtoId}:${estoque.filialId}`);
        expect(idsDeclarados.has(estoque.filialId)).toBe(true);
      }
      for (const [chave, historico] of carga.historicos) {
        expect(chave).toBe(`${historico.produtoId}:${historico.filialId}`);
        expect(idsDeclarados.has(historico.filialId)).toBe(true);
      }
      for (const entrada of carga.entradasHoje) {
        expect(idsDeclarados.has(entrada.filialId)).toBe(true);
      }
      for (const [chave, sugestao] of carga.sugestoesErp ?? new Map()) {
        expect(chave).toBe(`${sugestao.produtoId}:${sugestao.filialId}`);
        expect(idsDeclarados.has(sugestao.filialId)).toBe(true);
      }
    });

    it("o que a fonte não mediu sai declarado, não como zero", async () => {
      const fonte = cenario.criar();
      const carga = await fonte.carregarInventarioCompleto({ fornecedoresPermitidos: null });

      /**
       * Campo declarado ausente não pode trazer número FABRICADO. Hoje alguns
       * chegam como 0 porque o tipo do core ainda é `number`; quem impede o
       * motor de ler esse 0 como medição é a declaração em
       * `camposIndisponiveis`, respeitada na geração da grade.
       *
       * Transformar esses campos numa medida que sabe dizer "não medido"
       * dentro do próprio core é o passo seguinte (ponto 5 da revisão).
       */
      const declarado = (alvo: Record<string, unknown>, campo: string) => {
        const valor = alvo[campo] ?? null;
        expect(valor === null || valor === 0).toBe(true);
      };

      for (const estoque of carga.estoques.values()) {
        for (const campo of estoque.camposIndisponiveis ?? []) {
          declarado(estoque as unknown as Record<string, unknown>, campo);
        }
      }
      for (const historico of carga.historicos.values()) {
        for (const campo of historico.camposIndisponiveis ?? []) {
          declarado(historico as unknown as Record<string, unknown>, campo);
        }
      }
    });

    it("informa as lojas que a fonte trouxe e o cadastro não reconhece", async () => {
      const fonte = cenario.criar();
      const carga = await fonte.carregarInventarioCompleto({ fornecedoresPermitidos: null });
      const naoMapeadas = carga.metadados.lojasNaoMapeadas ?? [];

      for (const loja of naoMapeadas) {
        expect(loja.identificador.length).toBeGreaterThan(0);
        expect(loja.linhasDescartadas).toBeGreaterThan(0);
      }
    });

    if (cenario.capacidadesEsperadas) {
      it("tem exatamente as capacidades que este cliente espera", () => {
        const fonte = cenario.criar();
        const esperado = cenario.capacidadesEsperadas!;

        if (esperado.pedidosERP !== undefined) {
          expect(Boolean(fonte.pedidosERP)).toBe(esperado.pedidosERP);
        }
        if (esperado.cotacoesERP !== undefined) {
          expect(Boolean(fonte.cotacoesERP)).toBe(esperado.cotacoesERP);
        }
        if (esperado.entradasConfirmadas !== undefined) {
          expect(Boolean(fonte.entradasConfirmadas)).toBe(esperado.entradasConfirmadas);
        }
        if (esperado.sugestoesErp !== undefined) {
          expect(fonte.forneceSugestoesErp).toBe(esperado.sugestoesErp);
        }
      });
    }

    it("pedidos do ERP, quando existem, vêm com status traduzido e loja conhecida", async () => {
      const fonte = cenario.criar();
      if (!fonte.pedidosERP) return; // capacidade ausente é resposta válida

      expect(["loja", "rede"]).toContain(fonte.pedidosERP.granularidade);

      const pedidos = await fonte.pedidosERP.listarPedidos({ dias: 30 });
      for (const pedido of pedidos) {
        expect(STATUS_VALIDOS).toContain(pedido.status);
        expect(typeof pedido.statusOriginal).toBe("string");
        if (pedido.filialId !== null) {
          expect(idsDeclarados.has(pedido.filialId)).toBe(true);
        } else {
          // Sem granularidade por loja, a tela mostra "Rede" — nunca a matriz.
          expect(fonte.pedidosERP.granularidade).toBe("rede");
        }
      }

      const itens = await fonte.pedidosERP.listarComprasNaJanela(30);
      for (const item of itens) {
        if (item.filialId !== null) {
          expect(idsDeclarados.has(item.filialId)).toBe(true);
        }
      }
    });

    it("cotações do ERP, quando existem, seguem a mesma regra", async () => {
      const fonte = cenario.criar();
      if (!fonte.cotacoesERP) return;

      const cotacoes = await fonte.cotacoesERP.listarCotacoes({ dias: 30 });
      for (const cotacao of cotacoes) {
        expect(STATUS_VALIDOS).toContain(cotacao.status);
        if (cotacao.filialId !== null) {
          expect(idsDeclarados.has(cotacao.filialId)).toBe(true);
        }
      }
    });

    it("entradas confirmadas, quando existem, respondem a uma janela", async () => {
      const fonte = cenario.criar();
      if (!fonte.entradasConfirmadas) return;

      const carga = await fonte.carregarInventarioCompleto({ fornecedoresPermitidos: null });
      const ids = carga.produtos.slice(0, 3).map((p) => p.id);
      const entradas = await fonte.entradasConfirmadas.listarEntradas(ids, 10);

      for (const entrada of entradas) {
        expect(entrada.quantidadeEntrada).toBeGreaterThanOrEqual(0);
        if (entrada.filialId !== null) {
          expect(idsDeclarados.has(entrada.filialId)).toBe(true);
        }
      }
    });

    it("carteira vazia não devolve produto de fornecedor nenhum", async () => {
      const fonte = cenario.criar();
      const carga = await fonte.carregarInventarioCompleto({ fornecedoresPermitidos: [] });
      expect(carga.produtos).toHaveLength(0);
    });
  });
}

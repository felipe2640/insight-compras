// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  TooltipRuptura,
  TooltipFrequencia,
  TooltipCobertura,
  TooltipTransferencia,
  TooltipNfeDoDia,
  DialogSimilares,
} from "@/components/tooltips";
import { ItemSimilarIntercambiavel, EntradaNFeDoDia } from "@/tipos/cockpit";

describe("Cockpit — 5 Tooltips Analíticos Ricos & DialogSimilares", () => {
  // --------------------------------------------------------------------------
  // 1. Tooltip de Ruptura
  // --------------------------------------------------------------------------
  describe("TooltipRuptura", () => {
    it("deve calcular percentual de ruptura e exibir classificação Boa (<= 5%)", () => {
      render(
        <TooltipRuptura
          diasAnalisados={90}
          diasZerados={3}
          percentualRuptura={3.33}
          classificacao="Boa"
          dataUltimoZeramento="01/08/2026"
          vendaPerdidaEstimadaReais={150.0}
        >
          <button>Gatilho Ruptura</button>
        </TooltipRuptura>
      );

      const gatilho = screen.getByText("Gatilho Ruptura");
      fireEvent.focus(gatilho);

      expect(screen.getByRole("tooltip")).toBeTruthy();
      expect(screen.getByText("Diagnóstico de Ruptura")).toBeTruthy();
      expect(screen.getByText("3 de 90 dias")).toBeTruthy();
      expect(screen.getByText("3,3%")).toBeTruthy();
      expect(screen.getByText("Boa")).toBeTruthy();
      expect(screen.getByText(/R\$\s*150,00/)).toBeTruthy();
    });

    it("deve exibir classificação Grave (> 10%) e fechar com Escape", () => {
      render(
        <TooltipRuptura
          diasAnalisados={90}
          diasZerados={15}
          percentualRuptura={16.67}
          classificacao="Grave"
          dataUltimoZeramento="04/09/2026"
          vendaPerdidaEstimadaReais={1250.0}
        >
          <button>Gatilho Grave</button>
        </TooltipRuptura>
      );

      const gatilho = screen.getByText("Gatilho Grave");
      fireEvent.focus(gatilho);
      expect(screen.getByRole("tooltip")).toBeTruthy();
      expect(screen.getByText("Grave")).toBeTruthy();

      // Pressiona Escape para fechar
      fireEvent.keyDown(gatilho, { key: "Escape" });
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("deve tratar diasAnalisados = 0 como 'Sem histórico' sem lançar erro", () => {
      render(
        <TooltipRuptura
          diasAnalisados={0}
          diasZerados={0}
          percentualRuptura={null}
          classificacao="Sem histórico"
          dataUltimoZeramento={null}
          vendaPerdidaEstimadaReais={0}
        >
          <button>Gatilho Sem Hist</button>
        </TooltipRuptura>
      );

      const gatilho = screen.getByText("Gatilho Sem Hist");
      fireEvent.focus(gatilho);
      expect(screen.getByRole("tooltip")).toBeTruthy();
      expect(screen.getAllByText("Sem histórico").length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Tooltip de Frequência em 90 dias
  // --------------------------------------------------------------------------
  describe("TooltipFrequencia", () => {
    it("deve calcular notas líquidas (vendas - devoluções) e exibir extrato com cores", () => {
      render(
        <TooltipFrequencia
          notasVenda={22}
          notasDevolucao={2}
          notasLiquidas={20}
          frequenciaPercentual={22.2}
          classificacao="Média"
          totalPecasVendidas={58}
          extratoMovimentacoes={[
            {
              dataVenda: "05/09/2026",
              nomeCliente: "AUTO MECANICA DOIS IRMAOS",
              tipo: "venda",
              quantidade: 4,
              numeroNota: "109283",
            },
            {
              dataVenda: "02/09/2026",
              nomeCliente: "CENTRO AUTOMOTIVO SILVA",
              tipo: "devolucao",
              quantidade: 1,
              numeroNota: "108912",
            },
          ]}
        >
          <button>Gatilho Freq</button>
        </TooltipFrequencia>
      );

      const gatilho = screen.getByText("Gatilho Freq");
      fireEvent.focus(gatilho);

      expect(screen.getByRole("tooltip")).toBeTruthy();
      expect(screen.getByText("Frequência em 90 Dias")).toBeTruthy();
      expect(screen.getByText("22")).toBeTruthy(); // Vendas
      expect(screen.getByText("2")).toBeTruthy(); // Devoluções
      expect(screen.getByText("20")).toBeTruthy(); // Líquidas
      expect(screen.getByText("22,2%")).toBeTruthy();
      expect(screen.getByText("58 peças")).toBeTruthy();
      expect(screen.getByText("AUTO MECANICA DOIS IRMAOS")).toBeTruthy();
      expect(screen.getByText("+4 un (NF #109283)")).toBeTruthy();
      expect(screen.getByText("-1 un (NF #108912)")).toBeTruthy();
    });

    it("deve exibir mensagem amigável quando o extrato de notas for vazio", () => {
      render(
        <TooltipFrequencia
          notasVenda={0}
          notasDevolucao={0}
          notasLiquidas={0}
          frequenciaPercentual={0}
          classificacao="Baixa"
          totalPecasVendidas={0}
          extratoMovimentacoes={[]}
        >
          <button>Gatilho Freq Vazio</button>
        </TooltipFrequencia>
      );

      const gatilho = screen.getByText("Gatilho Freq Vazio");
      fireEvent.focus(gatilho);
      expect(screen.getByText("Sem movimentação de notas nos últimos 90 dias")).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // 3. Tooltip de Coberturas Comparativas (30d / 90d / 180d)
  // --------------------------------------------------------------------------
  describe("TooltipCobertura", () => {
    it("deve decompor as 3 janelas e emitir diagnóstico de aceleração", () => {
      render(
        <TooltipCobertura
          saldoEstoqueAtual={12}
          vendas30d={12}
          cmd30d={0.4}
          cobertura30dDias={30}
          vendas90d={18}
          cmd90d={0.2}
          cobertura90dDias={60}
          vendas180d={36}
          cmd180d={0.2}
          cobertura180dDias={60}
          tendencia="ALTA"
          isMarcaZumbi={false}
        >
          <button>Gatilho Cobertura</button>
        </TooltipCobertura>
      );

      const gatilho = screen.getByText("Gatilho Cobertura");
      fireEvent.focus(gatilho);

      expect(screen.getByRole("tooltip")).toBeTruthy();
      expect(screen.getByText("Coberturas Comparativas")).toBeTruthy();
      expect(screen.getByText("30d (Aceleração)")).toBeTruthy();
      expect(screen.getByText("90d (Giro Médio)")).toBeTruthy();
      expect(screen.getByText("180d (Defesa)")).toBeTruthy();
      expect(screen.getByText("30 dias")).toBeTruthy();
      expect(screen.getByText(/Tendência de ALTA \/ ACELERAÇÃO/)).toBeTruthy();
    });

    it("deve disparar trava crítica de Marca Zumbi quando saldo > 0 e vendas180d = 0", () => {
      render(
        <TooltipCobertura
          saldoEstoqueAtual={25}
          vendas30d={0}
          cmd30d={0}
          cobertura30dDias={0}
          vendas90d={0}
          cmd90d={0}
          cobertura90dDias={0}
          vendas180d={0}
          cmd180d={0}
          cobertura180dDias={0}
          tendencia="ZUMBI"
          isMarcaZumbi={true}
        >
          <button>Gatilho Zumbi</button>
        </TooltipCobertura>
      );

      const gatilho = screen.getByText("Gatilho Zumbi");
      fireEvent.focus(gatilho);

      expect(screen.getByText(/⚠ MARCA ZUMBI/)).toBeTruthy();
      expect(screen.getByText(/TRAVA MARCA ZUMBI \/ ENCALHE/)).toBeTruthy();
      expect(screen.getByText(/Compra bloqueada estritamente em zero/)).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Tooltip de Transferência Inteligente
  // --------------------------------------------------------------------------
  describe("TooltipTransferencia", () => {
    it("deve calcular sobra real da doadora e respeitar limite de estoque mínimo", () => {
      render(
        <TooltipTransferencia
          filialOrigemNome="Loja 02 - Paraipaba"
          saldoOrigem={15}
          estoqueMinimoOrigem={5}
          sobraRealOrigem={10}
          filialDestinoNome="Loja 01 - Trairi"
          necessidadeDestino={6}
          quantidadeTransferirRecomendada={6}
          motivo="Excedente real identificado na filial doadora"
        >
          <button>?</button>
        </TooltipTransferencia>
      );

      const gatilho = screen.getByText("?");
      fireEvent.focus(gatilho);

      expect(screen.getByRole("tooltip")).toBeTruthy();
      expect(screen.getByText("Transferência entre Lojas")).toBeTruthy();
      expect(screen.getByText("Loja 02 - Paraipaba")).toBeTruthy();
      expect(screen.getByText("10 un")).toBeTruthy(); // Sobra real (15 - 5)
      expect(screen.getAllByText("6 un").length).toBeGreaterThanOrEqual(1); // Transferência recomendada
      expect(screen.getByText(/Regra de Proteção da Origem/)).toBeTruthy();
      expect(screen.getByText(/Jamais desabastece a origem/)).toBeTruthy();
    });

    it("deve limitar a transferência à sobra real quando a necessidade for maior", () => {
      render(
        <TooltipTransferencia
          filialOrigemNome="Loja 03 - Itapipoca"
          saldoOrigem={8}
          estoqueMinimoOrigem={6}
          sobraRealOrigem={2}
          filialDestinoNome="Loja 01 - Trairi"
          necessidadeDestino={10}
          quantidadeTransferirRecomendada={2} // Limitado a 2 un
        >
          <button>? Limite</button>
        </TooltipTransferencia>
      );

      const gatilho = screen.getByText("? Limite");
      fireEvent.focus(gatilho);
      const elementos2un = screen.getAllByText("2 un");
      expect(elementos2un.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Saldo Atual:/)).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Tooltip de NF-e do Dia
  // --------------------------------------------------------------------------
  describe("TooltipNfeDoDia", () => {
    it("deve exibir alerta crítico contra compra duplicada e somatório de peças", () => {
      const entradas: EntradaNFeDoDia[] = [
        {
          numeroNotaFiscal: "049281",
          produtoId: 101,
          filialId: 1,
          fornecedorNome: "MONROE BRASIL AUTOPECAS LTDA",
          quantidadeEntrada: 10,
          valorEntrada: 2450.0,
          dataHoraChegada: "06/09/2026 09:30",
        },
        {
          numeroNotaFiscal: "049302",
          produtoId: 101,
          filialId: 2,
          fornecedorNome: "DISTRIBUIDORA PEÇAS DO NORDESTE",
          quantidadeEntrada: 6,
          valorEntrada: 1470.0,
          dataHoraChegada: "06/09/2026 11:15",
        },
      ];

      render(
        <TooltipNfeDoDia entradas={entradas}>
          <button>⚠ Alerta</button>
        </TooltipNfeDoDia>
      );

      const gatilho = screen.getByText("⚠ Alerta");
      fireEvent.focus(gatilho);

      expect(screen.getByRole("tooltip")).toBeTruthy();
      expect(screen.getByText("Entrada de NF-e no Dia")).toBeTruthy();
      expect(screen.getByText("+16 un")).toBeTruthy(); // 10 + 6
      expect(screen.getByText("NF #049281")).toBeTruthy();
      expect(screen.getByText("NF #049302")).toBeTruthy();
      expect(screen.getByText(/Verifique o recebimento antes de emitir nova compra externa/)).toBeTruthy();
    });

    it("não deve renderizar gatilho de tooltip quando não houver entradas hoje", () => {
      render(
        <TooltipNfeDoDia entradas={[]}>
          <span>Item Normal</span>
        </TooltipNfeDoDia>
      );

      expect(screen.getByText("Item Normal")).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // 6. Diálogo de Peças Similares Intercambiáveis
  // --------------------------------------------------------------------------
  describe("DialogSimilares", () => {
    it("deve renderizar modal de peças similares com estoque total da rede e fechar com botão", () => {
      const onOpenChange = vi.fn();
      const similares: ItemSimilarIntercambiavel[] = [
        {
          produtoIdOrigem: 1001,
          produtoIdSimilar: 2002,
          codigoSkuSimilar: "AM-COF-001",
          descricaoSimilar: "AMORTECEDOR DIANTEIRO COROLLA COFAP TURBOGAS",
          marcaSimilar: "COFAP",
          saldoFisicoDisponivelRede: 8,
          saldoFisicoLojaAvaliacao: 3,
          vendasLojaAvaliacao30dias: 5,
          vendasLojaAvaliacao60dias: 9,
          vendasLojaAvaliacao90dias: 14,
        },
        {
          produtoIdOrigem: 1001,
          produtoIdSimilar: 3003,
          codigoSkuSimilar: "AM-NAK-001",
          descricaoSimilar: "AMORTECEDOR DIANTEIRO COROLLA NAKATA HG",
          marcaSimilar: "NAKATA",
          saldoFisicoDisponivelRede: 4,
        },
      ];

      render(
        <DialogSimilares
          aberto={true}
          onOpenChange={onOpenChange}
          produtoPrincipalCodigo="AM-MON-001"
          produtoPrincipalDescricao="AMORTECEDOR DIANTEIRO COROLLA MONROE"
          similares={similares}
        />
      );

      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(screen.getByText("Peças Similares Intercambiáveis")).toBeTruthy();
      expect(screen.getByText("AM-COF-001")).toBeTruthy();
      expect(screen.getByText("AM-NAK-001")).toBeTruthy();
      expect(screen.getByText("12 un")).toBeTruthy(); // 8 + 4
      expect(screen.getByText("Estoque na loja")).toBeTruthy();
      expect(screen.getByText("Vendidos (30d)")).toBeTruthy();
      expect(screen.getByText("3 un")).toBeTruthy();
      expect(screen.getByText("5 un")).toBeTruthy();

      fireEvent.change(screen.getByLabelText("Período de vendas na loja de avaliação"), {
        target: { value: "60" },
      });
      expect(screen.getByText("Vendidos (60d)")).toBeTruthy();
      expect(screen.getByText("9 un")).toBeTruthy();

      const botaoFechar = screen.getByText("Fechar");
      fireEvent.click(botaoFechar);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("não deve renderizar nada quando aberto for false", () => {
      render(
        <DialogSimilares
          aberto={false}
          onOpenChange={vi.fn()}
          produtoPrincipalCodigo="AM-MON-001"
          produtoPrincipalDescricao="AMORTECEDOR"
          similares={[]}
        />
      );

      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});

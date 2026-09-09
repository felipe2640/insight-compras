// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GridCockpitVirtualizado } from "@/components/cockpit";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 600 });
});

function gerarLinhasTeste(quantidade: number): LinhaCockpitMatriz[] {
  const resultado: LinhaCockpitMatriz[] = [];
  for (let i = 1; i <= quantidade; i++) {
    resultado.push({
      produtoId: i,
      codigoSku: `SKU-${String(i).padStart(4, "0")}`,
      descricao: `AMORTECEDOR TESTE NÚMERO ${i}`,
      marca: i % 2 === 0 ? "MONROE" : "COFAP",
      fabricante: "FABRICANTE PADRAO",
      referenciaFabricante: `REF-${i}`,
      aplicacaoVeicular: "APLICACAO VEICULAR COMPLETA",
      secaoId: 1,
      secaoNome: "Suspensão",
      precoCusto: 100.0,
      precoVenda: 160.0,
      curvaAbc: i <= 5 ? "A" : i <= 15 ? "B" : "C",
      perfilGiro: "MEDIO_GIRO",
      rupturaDiasAnalisados: 90,
      rupturaDiasZerados: 0,
      rupturaPercentual: 0,
      classificacaoRuptura: "Boa",
      dataUltimoZeramento: null,
      vendaPerdidaEstimadaReais: 0,
      notasVenda90d: 20,
      notasDevolucao90d: 0,
      notasLiquidas90d: 20,
      frequenciaPercentual90d: 22.2,
      classificacaoFrequencia: "Média",
      totalPecasVendidas90d: 40,
      extratoFrequencia90d: [],
      vendasLiquidas30d: 14,
      consumoMedioDiario30d: 0.46,
      diasCobertura30d: 21.7,
      vendasLiquidas90d: 40,
      consumoMedioDiario90d: 0.44,
      diasCobertura90d: 22.5,
      vendasLiquidas180d: 80,
      consumoMedioDiario180d: 0.44,
      diasCobertura180d: 22.5,
      tendenciaCobertura: "ESTAVEL",
      isMarcaZumbi: false,
      filialFocoId: 1,
      filialFocoNome: "Loja 01 - Trairi",
      estoqueLojaFoco: 10,
      estoqueMinimoLojaFoco: 5,
      quantidadeJaPedidaFoco: 0,
      estoqueOutrasLojasRede: 12,
      sugestaoFinalCompra: 4,
      previsaoBrutaModelo: 0,
      horizonteDiasAplicado: 0,
      margemSegurancaAplicada: 0,
      fatorCalibracaoAplicado: 1,
      motivoInelegibilidade: null,
      statusSugestao: "APROVADO_COMPRA",
      motivoDecisao: "Giro ativo com necessidade calculada",
      loteMultiplo: 2,
      embalagemMinima: 2,
      pedidoCustom: 4,
      transferenciaCustom: 0,
      filialOrigemTransferenciaId: null,
      filialOrigemTransferenciaNome: null,
      saldoOrigemTransferencia: 0,
      estoqueMinimoOrigemTransferencia: 0,
      sobraRealOrigemTransferencia: 0,
      necessidadeDestinoTransferencia: 0,
      quantidadeTransferenciaSugerida: 0,
      similares: i === 1 ? [
        {
          produtoIdOrigem: 1,
          produtoIdSimilar: 999,
          codigoSkuSimilar: "SIM-001",
          descricaoSimilar: "AMORTECEDOR SIMILAR NAKATA",
          marcaSimilar: "NAKATA",
          saldoFisicoDisponivelRede: 6,
        },
      ] : [],
      entradasHoje: i === 1 ? [
        {
          numeroNotaFiscal: "049100",
          produtoId: 1,
          filialId: 1,
          fornecedorNome: "MONROE BRASIL",
          quantidadeEntrada: 10,
          valorEntrada: 1000.0,
          dataHoraChegada: "06/09/2026 10:00",
        },
      ] : [],
    });
  }
  return resultado;
}

describe("Cockpit — GridCockpitVirtualizado (TanStack Table v8 + TanStack Virtual)", () => {
  it("deve renderizar cabeçalhos da tabela com colunas baseColumns", () => {
    const dados = gerarLinhasTeste(5);

    render(
      <GridCockpitVirtualizado
        dados={dados}
        alturaContainer={500}
      />
    );

    expect(screen.getByText("Código SKU")).toBeTruthy();
    expect(screen.getByText("Descrição do Item")).toBeTruthy();
    expect(screen.getByText("Marca / Curva")).toBeTruthy();
    expect(screen.getByText("Giro Diário (CMD)")).toBeTruthy();
    expect(screen.getByText("Ruptura")).toBeTruthy();
    expect(screen.getByText("Freq. 90d (Notas)")).toBeTruthy();
    expect(screen.getByText("Cobertura (dias)")).toBeTruthy();
    expect(screen.getByText("Estoque Foco / Rede")).toBeTruthy();
    expect(screen.getByText("Sugestão Motor")).toBeTruthy();
    expect(screen.getByText("Pedido Compra")).toBeTruthy();
    expect(screen.getByText("Transferir")).toBeTruthy();
  });

  it("deve abrir diálogo de similares ao clicar no badge Sparkles", () => {
    const dados = gerarLinhasTeste(3);

    render(
      <GridCockpitVirtualizado
        dados={dados}
        alturaContainer={500}
      />
    );

    // O primeiro item tem similares configurados
    const botaoSimilares = screen.getByLabelText("Abrir diálogo de similares para SKU SKU-0001");
    fireEvent.click(botaoSimilares);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Peças Similares Intercambiáveis")).toBeTruthy();
    expect(screen.getByText("SIM-001")).toBeTruthy();
    expect(screen.getByText("AMORTECEDOR SIMILAR NAKATA")).toBeTruthy();
  });

  it("deve disparar callbacks onCommitPedido e onCommitTransferencia ao editar células", () => {
    const onCommitPedido = vi.fn();
    const onCommitTransferencia = vi.fn();
    const dados = gerarLinhasTeste(2);

    render(
      <GridCockpitVirtualizado
        dados={dados}
        onCommitPedido={onCommitPedido}
        onCommitTransferencia={onCommitTransferencia}
        alturaContainer={500}
      />
    );

    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    // Altera o primeiro input (pedido de compra)
    fireEvent.change(inputs[0], { target: { value: "8" } });
    fireEvent.blur(inputs[0]);

    expect(onCommitPedido).toHaveBeenCalledWith(1, 8, null);
  });

  it("deve exibir mensagem de estado vazio quando a lista de dados for vazia", () => {
    render(
      <GridCockpitVirtualizado
        dados={[]}
        alturaContainer={500}
      />
    );

    expect(
      screen.getByText("Nenhum produto encontrado para os filtros selecionados.")
    ).toBeTruthy();
  });
});

// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CockpitPrincipal, criarColunasCockpit } from "@/components/cockpit";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import { ProvedorTenant } from "@/lib/cockpit/contexto-tenant";
import { resolverTenantConfigurado } from "@config/tenants";

const tenantConfigurado = resolverTenantConfigurado();
const { parametrosMotor: _pm, ...tenantClienteTeste } = tenantConfigurado;

function renderComTenant(ui: React.ReactElement) {
  return render(
    <ProvedorTenant tenant={tenantClienteTeste}>
      {ui}
    </ProvedorTenant>
  );
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 600 });
});

function gerarLinhasTeste(quantidade: number): LinhaCockpitMatriz[] {
  const resultado: LinhaCockpitMatriz[] = [];
  for (let i = 1; i <= quantidade; i++) {
    const sku = `SKU-${String(i).padStart(4, "0")}`;
    resultado.push({
      produtoId: i,
      codigo: sku,
      codigoSku: sku,
      descricao: `AMORTECEDOR TESTE NÚMERO ${i}`,
      marca: i % 2 === 0 ? "MONROE" : "COFAP",
      fabricante: "FABRICANTE PADRAO",
      referenciaFabricante: `REF-${i}`,
      aplicacao: "APLICACAO VEICULAR COMPLETA",
      aplicacaoVeicular: "APLICACAO VEICULAR COMPLETA",
      secaoId: 1,
      secaoNome: "Suspensão",
      subgrupo: "Amortecedores",
      precoCusto: 100.0,
      custo: 100.0,
      precoVenda: 160.0,
      curvaAbc: i <= 5 ? "A" : i <= 15 ? "B" : "C",
      curvaAbcSistema: i <= 5 ? "A" : i <= 15 ? "B" : "C",
      perfilGiro: "MEDIO_GIRO",
      consumoDiario: 0.44,
      consumoMedioDiario90d: 0.44,
      consumoMensal: 13.2,
      vendaACadaDias: 2.3,
      consumoUltimos30DiasQtd: 14,
      produtosVend90d: 40,
      notasLiquidas90d: 20,
      giroUltimaVenda: "Alta",
      frequencia: "Média",
      classificacaoConsumo: "Média",
      ruptura: "Boa",
      periodoIdeal: "15 dias",
      histVendas90d: 38,
      histProdVend90d: 19,
      diasSemVenda: 2,
      statusMovimentacao: "Comprar",
      sugestaoCompra: 4,
      sugestaoTransferencia: 0,
      temSimilarComEstoque: i === 1,
      exigeMultiploEmbalagem: false,
      rupturaDiasAnalisados: 90,
      rupturaDiasZerados: 0,
      rupturaPercentual: 0,
      classificacaoRuptura: "Boa",
      dataUltimoZeramento: null,
      vendaPerdidaEstimadaReais: 0,
      notasVenda90d: 20,
      notasDevolucao90d: 0,
      frequenciaPercentual90d: 22.2,
      classificacaoFrequencia: "Média",
      totalPecasVendidas90d: 40,
      extratoFrequencia90d: [],
      vendasLiquidas30d: 14,
      consumoMedioDiario30d: 0.46,
      diasCobertura30d: 21.7,
      vendasLiquidas90d: 40,
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
      estoqueRede: 12,
      sugestaoFinalCompra: 4,
      previsaoBrutaModelo: 4,
      horizonteDiasAplicado: 30,
      margemSegurancaAplicada: 1.2,
      fatorCalibracaoAplicado: 1,
      motivoInelegibilidade: null,
      statusSugestao: "APROVADO_COMPRA",
      motivoDecisao: "Giro ativo com necessidade calculada",
      loteMultiplo: 1,
      embalagemMinima: 1,
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

describe("Cockpit — Virtualização da Grade Viva (CockpitPrincipal & colunas-cockpit)", () => {
  it("deve exportar e configurar corretamente as colunas da árvore viva", () => {
    const colunas = criarColunasCockpit({
      nomeLojaFoco: "Trairi",
      nomeOutrasLojas: "Rede",
    });

    const ids = colunas.map((c) => c.id);
    expect(ids).toContain("select");
    expect(ids).toContain("codigo");
    expect(ids).toContain("descricao");
    expect(ids).toContain("marca");
    expect(ids).toContain("subgrupo");
    expect(ids).toContain("curvaAbcSistema");
    expect(ids).toContain("consumoDiario");
    expect(ids).toContain("ruptura");
    expect(ids).toContain("frequencia");
    expect(ids).toContain("cobertura");
    expect(ids).toContain("estoqueLojaFoco");
    expect(ids).toContain("estoqueRede");
    expect(ids).toContain("pedido");
    expect(ids).toContain("transferencia");
  });

  it("deve renderizar cabeçalhos e dados na grade viva CockpitPrincipal", () => {
    const dados = gerarLinhasTeste(5);

    renderComTenant(
      <CockpitPrincipal
        itensIniciais={dados}
      />
    );

    expect(screen.getAllByText("Código").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Descrição").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Marca").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sub-grupo").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Curva ABC").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Consumo Diário").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ruptura").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Frequência").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Cobertura (dias)").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pedido").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Transferência").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("SKU-0001")).toBeTruthy();
    expect(screen.getByText("AMORTECEDOR TESTE NÚMERO 1")).toBeTruthy();
    expect(screen.getByText("Sugestão ERP")).toBeTruthy();
  });

  it("deve abrir diálogo de similares ao clicar no badge Sparkles no CockpitPrincipal", () => {
    const dados = gerarLinhasTeste(3);

    renderComTenant(
      <CockpitPrincipal
        itensIniciais={dados}
      />
    );

    // O primeiro item tem similares configurados
    const botaoSimilares = screen.getByRole("button", { name: /similares com estoque/i });
    fireEvent.click(botaoSimilares);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Peças Similares Intercambiáveis")).toBeTruthy();
    expect(screen.getByText("SIM-001")).toBeTruthy();
    expect(screen.getByText("AMORTECEDOR SIMILAR NAKATA")).toBeTruthy();
  });

  it("deve exibir alerta de NF-e do Dia com TooltipNfeDoDia e abrir tooltip ao focar", () => {
    const dados = gerarLinhasTeste(2);

    renderComTenant(
      <CockpitPrincipal
        itensIniciais={dados}
      />
    );

    const alertaNfe = screen.getByLabelText("Chegou hoje no estoque");
    expect(alertaNfe).toBeTruthy();

    fireEvent.focus(alertaNfe);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    expect(screen.getByText("Entrada de NF-e no Dia")).toBeTruthy();
    expect(screen.getByText("NF #049100")).toBeTruthy();
    expect(screen.getAllByText("+10 un").length).toBeGreaterThanOrEqual(1);
  });

  it("deve exibir mensagem de estado vazio quando a lista de dados for vazia", () => {
    renderComTenant(
      <CockpitPrincipal
        itensIniciais={[]}
      />
    );

    expect(
      screen.getByText("Nenhum produto corresponde aos filtros selecionados.")
    ).toBeTruthy();
  });

  it("deve restaurar a última ordem de colunas salva para o usuário", async () => {
    const ordemPersonalizada = [
      "select", "codigo", "codigoAgrupador", "descricao", "marca", "aplicacao",
      "subgrupo", "refFabricante", "curvaAbcSistema", "estoqueLojaFoco", "estoqueRede",
      "produtosVend90d", "consumoUltimos30DiasQtd", "consumoDiario", "consumoMensal",
      "vendaACadaDias", "notasLiquidas90d", "frequencia", "classificacaoConsumo",
      "giroUltimaVenda", "dtUltVenda", "diasSemVenda", "ruptura", "cobertura",
      "periodoIdeal", "histVendas90d", "histProdVend90d", "custo", "dtUltimaCompra",
      "dtUltimoPedido", "statusMovimentacao", "pedido", "transferencia",
    ];
    localStorage.setItem(
      `insight-compras-grade-${tenantClienteTeste.id}-usuario-grade`,
      JSON.stringify({ versao: 1, ordem: ordemPersonalizada, visibilidade: { codigoAgrupador: false } })
    );

    renderComTenant(
      <CockpitPrincipal
        itensIniciais={gerarLinhasTeste(3)}
        usuarioSessao={{ id: "usuario-grade", papel: "GESTOR", allowedSupplierIds: null }}
      />
    );

    await waitFor(() => {
      const cabecalhos = screen.getAllByRole("columnheader").map((item) => item.textContent ?? "");
      expect(cabecalhos.findIndex((texto) => texto.includes("Marca")))
        .toBeLessThan(cabecalhos.findIndex((texto) => texto.includes("Aplicação")));
    });
  });
});

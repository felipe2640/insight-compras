// @vitest-environment jsdom
/**
 * Testes Automatizados de Interface do Diálogo de Exportação e CRUD de Modelos
 * Camada: Testes / Exportação (tests/exportacao/dialog-exportacao-ui.test.tsx)
 * 100% em Português do Brasil (pt-BR).
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DialogExportacao } from "@/components/cockpit/DialogExportacao";
import { BotoesExportacao } from "@/components/cockpit/BotoesExportacao";
import { TENANT_DEMONSTRACAO } from "@config/tenants/demonstracao";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import { ContextoExportacao } from "@/lib/exportacao";

const CONTEXTO: ContextoExportacao = {
  tenantId: "demonstracao",
  nomeTenant: "Loja Modelo",
  filialId: 1,
  nomeLoja: "Loja Matriz",
  dataReferencia: new Date(2026, 8, 11),
};

const ITENS_MOCK: LinhaCockpitMatriz[] = [
  {
    produtoId: 1,
    codigoSku: "SKU-001",
    descricao: "Peça Teste 1",
    marca: "Marca A",
    fabricante: "Fab A",
    referenciaFabricante: "REF-1",
    aplicacaoVeicular: "GOL",
    secaoNome: "Motor",
    subgrupo: null,
    fornecedorId: 10,
    nomeFornecedor: "Fornecedor X",
    precoCusto: 50,
    precoVenda: 100,
    curvaAbc: "A",
    perfilGiro: "ALTO_GIRO",
    rupturaDiasAnalisados: 90,
    rupturaDiasZerados: 0,
    rupturaPercentual: 0,
    classificacaoRuptura: "Boa",
    dataUltimoZeramento: null,
    vendaPerdidaEstimadaReais: 0,
    notasVenda90d: 10,
    notasDevolucao90d: 0,
    notasLiquidas90d: 10,
    frequenciaPercentual90d: 11.1,
    classificacaoFrequencia: "Alta",
    totalPecasVendidas90d: 25,
    extratoFrequencia90d: [],
    vendasLiquidas30d: 10,
    consumoMedioDiario30d: 0.33,
    diasCobertura30d: 30,
    vendasLiquidas90d: 25,
    consumoMedioDiario90d: 0.28,
    diasCobertura90d: 35,
    vendasLiquidas180d: 50,
    consumoMedioDiario180d: 0.28,
    diasCobertura180d: 35,
    tendenciaCobertura: "ESTAVEL",
    isMarcaZumbi: false,
    filialFocoId: 1,
    filialFocoNome: "Loja Matriz",
    estoqueLojaFoco: 10,
    estoqueMinimoLojaFoco: 5,
    quantidadeJaPedidaFoco: null,
    estoqueOutrasLojasRede: 0,
    sugestaoFinalCompra: 5,
    previsaoBrutaModelo: 5,
    horizonteDiasAplicado: 30,
    margemSegurancaAplicada: 0.2,
    fatorCalibracaoAplicado: 1.0,
    motivoInelegibilidade: null,
    statusSugestao: "APROVADO_COMPRA",
    motivoDecisao: "Comprar 5",
    loteMultiplo: 1,
    pedidoCustom: 0,
    transferenciaCustom: 0,
    filialOrigemTransferenciaId: null,
    filialOrigemTransferenciaNome: null,
    saldoOrigemTransferencia: 0,
    estoqueMinimoOrigemTransferencia: 0,
    sobraRealOrigemTransferencia: 0,
    necessidadeDestinoTransferencia: 0,
    quantidadeTransferenciaSugerida: 0,
    similares: [],
    entradasHoje: [],
    consumoDiario: 0.33,
    consumoMensal: 10,
    diasSemVenda: 2,
    dtUltVenda: "2026-09-09T10:00:00",
    dtUltimaCompra: null,
  },
];

describe("Interface de Exportação e CRUD de Modelos (DialogExportacao e BotoesExportacao)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("deve renderizar o diálogo e permitir alternar entre abas Exportar e Modelos", async () => {
    const modelosMock = [
      {
        id: "pedido_fornecedor",
        nome: "Pedido Fornecedor",
        escopo: "compra",
        formato: "csv",
        colunas: ["sku", "descricao", "qtd_pedido"],
        nomeArquivo: "arquivo",
        deFabrica: true,
      },
      {
        id: "modelo_personalizado_bosch",
        nome: "Pedido Bosch Semanal",
        escopo: "compra",
        formato: "xlsx",
        colunas: ["sku", "descricao", "marca", "qtd_pedido"],
        nomeArquivo: "arquivo",
        deFabrica: false,
      },
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/exportacao/modelos")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ modelos: modelosMock, podeSalvar: true }),
        });
      }
      return Promise.reject(new Error("URL não mockada"));
    });

    render(
      <DialogExportacao
        aberto={true}
        onFechar={vi.fn()}
        itensFiltrados={ITENS_MOCK}
        itensSelecionados={[]}
        configuracao={TENANT_DEMONSTRACAO.exportacao}
        contexto={CONTEXTO}
      />
    );

    // Verifica aba inicial de exportação
    expect(screen.getByText("Exportação & Modelos de Dados")).toBeTruthy();
    expect(screen.getByText("Exportar Arquivo")).toBeTruthy();
    expect(screen.getByText(/Gerenciar Modelos/i)).toBeTruthy();

    // Alterna para aba Gerenciar Modelos
    const btnAbaModelos = screen.getByText(/Gerenciar Modelos/i);
    fireEvent.click(btnAbaModelos);

    await waitFor(() => {
      expect(screen.getByText("Pedido Fornecedor")).toBeTruthy();
      expect(screen.getByText("Pedido Bosch Semanal")).toBeTruthy();
      expect(screen.getByText("Padrão de Fábrica")).toBeTruthy();
      expect(screen.getByText("Personalizado")).toBeTruthy();
    });
  });

  it("deve acionar criação de novo modelo via interface", async () => {
    let chamadaPost: unknown = null;

    global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes("/api/exportacao/modelos")) {
        if (opts?.method === "POST") {
          chamadaPost = JSON.parse(opts.body as string);
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ modelo: { id: "novo_modelo", ...(chamadaPost as object) } }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ modelos: [], podeSalvar: true }),
        });
      }
      return Promise.reject(new Error("URL não mockada"));
    });

    const onModeloSalvoMock = vi.fn();

    render(
      <DialogExportacao
        aberto={true}
        onFechar={vi.fn()}
        itensFiltrados={ITENS_MOCK}
        itensSelecionados={[]}
        configuracao={TENANT_DEMONSTRACAO.exportacao}
        contexto={CONTEXTO}
        onModeloSalvo={onModeloSalvoMock}
      />
    );

    // Preenche input de novo modelo
    const inputNome = screen.getByPlaceholderText(/Pedido Semanal Bosch/i);
    fireEvent.change(inputNome, { target: { value: "Meu Modelo Personalizado" } });

    // Clica em Salvar Modelo
    const btnSalvar = screen.getByText("Salvar Modelo");
    fireEvent.click(btnSalvar);

    await waitFor(() => {
      expect(chamadaPost).toBeTruthy();
      expect((chamadaPost as { nome: string }).nome).toBe("Meu Modelo Personalizado");
      expect(onModeloSalvoMock).toHaveBeenCalled();
    });
  });

  it("deve acionar renomeação de modelo customizado na aba Gerenciar Modelos", async () => {
    const modelosMock = [
      {
        id: "modelo_renomear",
        nome: "Nome Original",
        escopo: "compra",
        formato: "csv",
        colunas: ["sku", "qtd_pedido"],
        nomeArquivo: "arquivo",
        deFabrica: false,
      },
    ];

    let postBody: unknown = null;

    global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes("/api/exportacao/modelos")) {
        if (opts?.method === "POST") {
          postBody = JSON.parse(opts.body as string);
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ modelo: { id: "modelo_renomear", ...(postBody as object) } }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ modelos: modelosMock, podeSalvar: true }),
        });
      }
      return Promise.reject(new Error("URL não mockada"));
    });

    render(
      <DialogExportacao
        aberto={true}
        onFechar={vi.fn()}
        itensFiltrados={ITENS_MOCK}
        itensSelecionados={[]}
        configuracao={TENANT_DEMONSTRACAO.exportacao}
        contexto={CONTEXTO}
      />
    );

    // Vai para aba Modelos
    fireEvent.click(screen.getByText(/Gerenciar Modelos/i));

    await waitFor(() => {
      expect(screen.getByText("Nome Original")).toBeTruthy();
    });

    // Clica em Renomear
    const btnRenomear = screen.getByText("Renomear");
    fireEvent.click(btnRenomear);

    // Encontra input com o valor atual
    const inputRenomear = screen.getByDisplayValue("Nome Original");
    fireEvent.change(inputRenomear, { target: { value: "Nome Atualizado" } });

    // Clica em Salvar
    const btnSalvar = screen.getByText("Salvar");
    fireEvent.click(btnSalvar);

    await waitFor(() => {
      expect(postBody).toBeTruthy();
      expect((postBody as { id: string; nome: string }).id).toBe("modelo_renomear");
      expect((postBody as { id: string; nome: string }).nome).toBe("Nome Atualizado");
    });
  });

  it("deve acionar exclusão de modelo customizado com confirmação", async () => {
    const modelosMock = [
      {
        id: "modelo_excluir",
        nome: "Para Deletar",
        escopo: "compra",
        formato: "csv",
        colunas: ["sku"],
        nomeArquivo: "arquivo",
        deFabrica: false,
      },
    ];

    let deleteUrl: string | null = null;

    global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes("/api/exportacao/modelos")) {
        if (opts?.method === "DELETE") {
          deleteUrl = url;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ excluido: "modelo_excluir" }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ modelos: modelosMock, podeSalvar: true }),
        });
      }
      return Promise.reject(new Error("URL não mockada"));
    });

    render(
      <DialogExportacao
        aberto={true}
        onFechar={vi.fn()}
        itensFiltrados={ITENS_MOCK}
        itensSelecionados={[]}
        configuracao={TENANT_DEMONSTRACAO.exportacao}
        contexto={CONTEXTO}
      />
    );

    // Vai para aba Modelos
    fireEvent.click(screen.getByText(/Gerenciar Modelos/i));

    await waitFor(() => {
      expect(screen.getByText("Para Deletar")).toBeTruthy();
    });

    // Clica no ícone de lixeira
    const btnLixeira = screen.getByTitle("Excluir modelo customizado");
    fireEvent.click(btnLixeira);

    // Verifica prompt de confirmação "Excluir? Sim / Não"
    expect(screen.getByText("Excluir?")).toBeTruthy();
    const btnSim = screen.getByText("Sim");
    fireEvent.click(btnSim);

    await waitFor(() => {
      expect(deleteUrl).toContain("id=modelo_excluir");
    });
  });

  it("BotoesExportacao deve carregar modelos e permitir acionar configuração", async () => {
    const modelosMock = [
      {
        id: "modelo_rapido",
        nome: "Rápido",
        escopo: "compra",
        formato: "csv",
        colunas: ["sku", "qtd_pedido"],
        nomeArquivo: "arquivo",
        deFabrica: true,
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ modelos: modelosMock }),
    });

    const onAbrirConfigMock = vi.fn();

    render(
      <BotoesExportacao
        itens={ITENS_MOCK}
        contexto={CONTEXTO}
        onAbrirConfiguracao={onAbrirConfigMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Rápido")).toBeTruthy();
      expect(screen.getByText("1")).toBeTruthy(); // 1 item no escopo de compra
    });

    // Botão Modelos deve acionar abertura
    const btnModelos = screen.getByText("Modelos");
    fireEvent.click(btnModelos);
    expect(onAbrirConfigMock).toHaveBeenCalled();
  });
});

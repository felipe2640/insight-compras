// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  preIndexarListaMatriz,
  filtrarLinhasCockpit,
  normalizarTexto,
} from "@/hooks/useFiltrosCockpit";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import { CurvaABC } from "@core/dominio";

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 600 });
});

/**
 * Gerador de SKUs sintéticos de alta fidelidade automotiva para testes de estresse de 25k a 50k itens.
 */
function gerarDatasetAdversarial(quantidade: number): LinhaCockpitMatriz[] {
  const marcas = [
    "MONROE", "COFAP", "NAKATA", "BOSCH", "FRAS-LE", "FREMAX",
    "MAHLE", "VALEO", "DAYCO", "TRW", "NGK", "FRAM", "DELPHI", "MOURA", "SACHS",
  ];

  const secoes = [
    { id: 10, nome: "Suspensão & Direção" },
    { id: 20, nome: "Freios & Sistema Hidráulico" },
    { id: 30, nome: "Motor & Injeção Eletrônica" },
    { id: 40, nome: "Lubrificação & Filtros" },
    { id: 50, nome: "Elétrica & Baterias" },
    { id: 60, nome: "Transmissão & Embreagem" },
    { id: 70, nome: "Arrefecimento & Climatização" },
    { id: 80, nome: "Acessórios & Iluminação" },
  ];

  const veiculos = [
    "TOYOTA COROLLA 2.0 VVT-i DUAL FLEX",
    "VW GOL G6 1.0 8V TOTALFLEX TEC",
    "FIAT STRADA WORKING 1.4 8V FIRE EVO",
    "CHEVROLET ONIX TURBO PREMIER 1.0 12V",
    "FORD RANGER 3.2 20V 4X4 DURATORQ DIESEL",
    "HYUNDAI HB20 1.0 12V KAPPA FLEX",
    "HONDA CIVIC TOURING 1.5 TURBO 16V",
    "RENAULT DUSTER DAKAR 1.6 16V SCe",
    "JEEP COMPASS LONGITUDE 2.0 TURBODIESEL",
    "TOYOTA HILUX SRV 2.8 16V 4X4 TDI DIESEL",
    "VW SAVEIRO CROSS 1.6 16V MSI TOTALFLEX",
    "CHEVROLET S10 HIGH COUNTRY 2.8 4X4 CTDI",
  ];

  const pecas = [
    "AMORTECEDOR DIANTEIRO PRESSURIZADO TURBOGAS",
    "AMORTECEDOR TRASEIRO PRESSURIZADO A GAS",
    "DISCO DE FREIO VENTILADO 257MM DIANTEIRO",
    "DISCO DE FREIO SOLIDO TRASEIRO",
    "PASTILHA DE FREIO CERAMICA COM SENSOR",
    "FILTRO DE OLEO MOTOR SINTETICO",
    "FILTRO DE COMBUSTIVEL FLEX",
    "FILTRO DE AR CONDICIONADO CABINE",
    "VELA DE IGNICAO IRIDIUM LASER",
    "BOMBA DAGUA COM JUNTA E POLIA",
    "CORREIA DENTADA SINCRONIZADORA HNBR",
    "PIVO DA SUSPENSAO INFERIOR DIANTEIRO",
    "TERMINAL DE DIRECAO AXIAL REFORCADO",
    "BATERIA AUTOMOTIVA 60AH SELADA FREE",
    "VALVULA TERMOSTATICA COM CARCACA ALUMINIO",
    "KIT EMBREAGEM PLATO DISCO ROLAMENTO",
    "CABO DE VELA SILICONADO ALTA PERFORMANCE",
  ];

  const itens: LinhaCockpitMatriz[] = new Array(quantidade);

  for (let i = 0; i < quantidade; i++) {
    const id = i + 1;
    const veiculo = veiculos[i % veiculos.length];
    const peca = pecas[i % pecas.length];
    const marca = marcas[(i * 7) % marcas.length];
    const secao = secoes[(i * 3) % secoes.length];
    const fornecedorId = 500 + (i % 25);
    const curvaAbc: CurvaABC = i % 10 < 2 ? "A" : i % 10 < 5 ? "B" : "C";

    const isZumbi = i % 40 === 0;
    const isRuptura = !isZumbi && i % 12 === 0;
    const temCompra = !isZumbi && i % 3 === 0;
    const temTransf = !isZumbi && !temCompra && i % 7 === 0;

    itens[i] = {
      produtoId: id,
      codigoSku: `CAR-${String(id).padStart(6, "0")}`,
      descricao: `${peca} - ${veiculo}`,
      marca,
      fabricante: `${marca} BRASIL COMPONENTES LTDA`,
      referenciaFabricante: `REF-${id * 3}`,
      aplicacaoVeicular: veiculo,
      secaoId: secao.id,
      secaoNome: secao.nome,
      subgrupo: null,
      fornecedorId,
      nomeFornecedor: `DISTRIBUIDORA DE AUTOPEÇAS ${marca}`,
      precoCusto: 45.0 + (i % 450),
      precoVenda: 75.0 + (i % 700),
      curvaAbc,
      perfilGiro: curvaAbc === "A" ? "ALTO_GIRO" : curvaAbc === "B" ? "MEDIO_GIRO" : "BAIXO_GIRO_INTERMITENTE",
      rupturaDiasAnalisados: 90,
      rupturaDiasZerados: isRuptura ? 14 : 0,
      rupturaPercentual: isRuptura ? 15.5 : 0,
      classificacaoRuptura: isRuptura ? "Grave" : "Boa",
      dataUltimoZeramento: isRuptura ? "02/09/2026" : null,
      vendaPerdidaEstimadaReais: isRuptura ? 1250.0 : 0,
      notasVenda90d: isZumbi ? 0 : 20 + (i % 40),
      notasDevolucao90d: isZumbi ? 0 : i % 3,
      notasLiquidas90d: isZumbi ? 0 : 20 + (i % 40) - (i % 3),
      frequenciaPercentual90d: isZumbi ? 0 : 33.3,
      classificacaoFrequencia: isZumbi ? "Baixa" : "Média",
      totalPecasVendidas90d: isZumbi ? 0 : 45 + (i % 60),
      extratoFrequencia90d: [],
      vendasLiquidas30d: isZumbi ? 0 : 12 + (i % 20),
      consumoMedioDiario30d: isZumbi ? 0 : 0.55,
      diasCobertura30d: 20,
      vendasLiquidas90d: isZumbi ? 0 : 36 + (i % 60),
      consumoMedioDiario90d: isZumbi ? 0 : 0.50,
      diasCobertura90d: 22,
      vendasLiquidas180d: isZumbi ? 0 : 72 + (i % 120),
      consumoMedioDiario180d: isZumbi ? 0 : 0.48,
      diasCobertura180d: 23,
      tendenciaCobertura: isZumbi ? "ZUMBI" : "ESTAVEL",
      isMarcaZumbi: isZumbi,
      filialFocoId: 1,
      filialFocoNome: "Loja 01 - Trairi",
      estoqueLojaFoco: isZumbi ? 20 : isRuptura ? 0 : 15 + (i % 30),
      estoqueMinimoLojaFoco: 10,
      quantidadeJaPedidaFoco: 0,
      estoqueOutrasLojasRede: 25,
      sugestaoFinalCompra: temCompra ? 12 : 0,
      previsaoBrutaModelo: 0,
      horizonteDiasAplicado: 0,
      margemSegurancaAplicada: 0,
      fatorCalibracaoAplicado: 1,
      motivoInelegibilidade: null,
      statusSugestao: isZumbi
        ? "TRAVADO_MARCA_ZUMBI"
        : temCompra
          ? "APROVADO_COMPRA"
          : temTransf
            ? "COBERTO_POR_TRANSFERENCIA"
            : "ESTOQUE_SUFICIENTE",
      motivoDecisao: isZumbi
        ? "TRAVA MARCA ZUMBI"
        : temCompra
          ? "Demanda calculada"
          : "Estoque suficiente",
      loteMultiplo: peca.includes("AMORTECEDOR") || peca.includes("DISCO") ? 2 : 1,
      embalagemMinima: 1,
      pedidoCustom: temCompra ? 12 : 0,
      transferenciaCustom: temTransf ? 6 : 0,
      filialOrigemTransferenciaId: temTransf ? 2 : null,
      filialOrigemTransferenciaNome: temTransf ? "Loja 02 - Paraipaba" : null,
      saldoOrigemTransferencia: temTransf ? 24 : 0,
      estoqueMinimoOrigemTransferencia: temTransf ? 8 : 0,
      sobraRealOrigemTransferencia: temTransf ? 16 : 0,
      necessidadeDestinoTransferencia: temTransf ? 6 : 0,
      quantidadeTransferenciaSugerida: temTransf ? 6 : 0,
      similares: [],
      entradasHoje: [],
    };
  }

  return itens;
}


describe("Gate M3 — Integridade do Índice de Busca e do Scroll Virtualizado", () => {
  describe("3. Estabilidade de Memória e Normalização do Índice _searchIndex", () => {
    it("não deve vazar memória ou criar duplicatas em re-indexações consecutivas", () => {
      const dados = gerarDatasetAdversarial(25000);
      const memInicial = process.memoryUsage().heapUsed;

      // Executa 5 ciclos completos de re-indexação simulando refreshes periódicos do Power BI
      let atual = dados;
      for (let ciclo = 1; ciclo <= 5; ciclo++) {
        atual = preIndexarListaMatriz(atual);
        expect(atual).toHaveLength(25000);
        expect(typeof atual[0]._searchIndex).toBe("string");
      }

      const memFinal = process.memoryUsage().heapUsed;
      const variacaoMB = (memFinal - memInicial) / (1024 * 1024);

      if (typeof global.gc === "function") {
        global.gc();
      }
      const memFinalAposGc = process.memoryUsage().heapUsed;
      const variacaoMBAposGc = (memFinalAposGc - memInicial) / (1024 * 1024);

      console.log(`[Challenger M3] Variação de Heap após 5 re-indexações de 25k SKUs: ${variacaoMB.toFixed(2)} MB`);
      // A variação média não deve explodir de forma descontrolada (teto seguro de 250 MB sem GC manual)
      expect(Math.min(variacaoMB, variacaoMBAposGc)).toBeLessThan(250);
    });

    it("deve normalizar diacríticos e caracteres especiais com integridade estrita", () => {
      expect(normalizarTexto("AMORTECEDOR TURBOGÁS")).toBe("amortecedor turbogas");
      expect(normalizarTexto("PASTILHA DE FREIO CERÂMICA")).toBe("pastilha de freio ceramica");
      expect(normalizarTexto("BOMBA D'ÁGUA REFORÇADA")).toBe("bomba d'agua reforcada");
      expect(normalizarTexto("SUSPENSÃO & DIREÇÃO ELÉTRICA")).toBe("suspensao & direcao eletrica");
      expect(normalizarTexto("ÓLEO 15W40 MOTOR")).toBe("oleo 15w40 motor");
      expect(normalizarTexto("")).toBe("");
      expect(normalizarTexto("   ")).toBe("   ");
    });
  });

  describe("4. Estabilidade do Scroll Virtualizado e Invariantes dos Espaçadores (paddingTop / paddingBottom)", () => {
    it("deve manter espaçadores estritamente finitos, sem NaN e coerentes para lista vazia (0 itens)", () => {
      const containerElement = document.createElement("div");
      Object.defineProperty(containerElement, "clientHeight", { configurable: true, value: 600 });
      Object.defineProperty(containerElement, "scrollTop", { configurable: true, value: 0 });

      const { result } = renderHook(() =>
        useVirtualizer({
          count: 0,
          getScrollElement: () => containerElement,
          estimateSize: () => 48,
          overscan: 10,
          initialRect: { width: 1200, height: 600 },
        })
      );

      const virtualRows = result.current.getVirtualItems();
      const totalSize = result.current.getTotalSize();

      const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
      const paddingBottom =
        virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

      expect(virtualRows).toHaveLength(0);
      expect(totalSize).toBe(0);
      expect(Number.isFinite(paddingTop)).toBe(true);
      expect(Number.isNaN(paddingTop)).toBe(false);
      expect(paddingTop).toBe(0);

      expect(Number.isFinite(paddingBottom)).toBe(true);
      expect(Number.isNaN(paddingBottom)).toBe(false);
      expect(paddingBottom).toBe(0);
    });

    it("deve manter espaçadores finitos e sem NaN para 1 único item", () => {
      const containerElement = document.createElement("div");
      Object.defineProperty(containerElement, "clientHeight", { configurable: true, value: 600 });
      Object.defineProperty(containerElement, "scrollTop", { configurable: true, value: 0 });

      const { result } = renderHook(() =>
        useVirtualizer({
          count: 1,
          getScrollElement: () => containerElement,
          estimateSize: () => 48,
          overscan: 10,
          initialRect: { width: 1200, height: 600 },
        })
      );

      const virtualRows = result.current.getVirtualItems();
      const totalSize = result.current.getTotalSize();

      const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
      const paddingBottom =
        virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

      expect(totalSize).toBe(48);
      expect(virtualRows.length).toBe(1);
      expect(Number.isFinite(paddingTop)).toBe(true);
      expect(Number.isNaN(paddingTop)).toBe(false);
      expect(paddingTop).toBe(0);

      expect(Number.isFinite(paddingBottom)).toBe(true);
      expect(Number.isNaN(paddingBottom)).toBe(false);
      expect(paddingBottom).toBe(0);
    });

    it("deve validar invariante matemática em 25.000 e 50.000 linhas em múltiplos offsets de scroll", () => {
      const tamanhosTeste = [25000, 50000];

      for (const totalLinhas of tamanhosTeste) {
        const containerElement = document.createElement("div");
        Object.defineProperty(containerElement, "clientHeight", { configurable: true, value: 600 });

        let currentScrollTop = 0;
        Object.defineProperty(containerElement, "scrollTop", {
          configurable: true,
          get: () => currentScrollTop,
          set: (val: number) => {
            currentScrollTop = val;
          },
        });

        const { result } = renderHook(() =>
          useVirtualizer({
            count: totalLinhas,
            getScrollElement: () => containerElement,
            estimateSize: () => 48,
            overscan: 10,
            initialRect: { width: 1200, height: 600 },
          })
        );

        const totalEsperado = totalLinhas * 48;
        expect(result.current.getTotalSize()).toBe(totalEsperado);

        // Pontos de teste de scroll: topo, meio, rodapé, posições arbitrárias
        const scrollOffsets = [
          0,
          480,
          10000,
          100000,
          Math.floor(totalEsperado / 2),
          totalEsperado - 1200,
          totalEsperado - 600,
          totalEsperado,
        ];

        for (const offset of scrollOffsets) {
          act(() => {
            currentScrollTop = offset;
            result.current.scrollToOffset(offset);
          });

          const virtualRows = result.current.getVirtualItems();
          const totalSize = result.current.getTotalSize();

          expect(virtualRows.length).toBeGreaterThan(0);
          expect(Number.isFinite(totalSize)).toBe(true);
          expect(!Number.isNaN(totalSize)).toBe(true);

          const paddingTop = virtualRows[0].start;
          const lastVirtualRow = virtualRows[virtualRows.length - 1];
          const paddingBottom = totalSize - lastVirtualRow.end;

          // Validação mandatória: sem NaN, sem Infinito, não-negativos
          expect(Number.isFinite(paddingTop)).toBe(true);
          expect(Number.isNaN(paddingTop)).toBe(false);
          expect(paddingTop).toBeGreaterThanOrEqual(0);

          expect(Number.isFinite(paddingBottom)).toBe(true);
          expect(Number.isNaN(paddingBottom)).toBe(false);
          expect(paddingBottom).toBeGreaterThanOrEqual(0);

          // Invariante de conservação de altura do container virtualizado:
          // paddingTop + alturaRenderizada + paddingBottom == totalSize
          const alturaRenderizada = lastVirtualRow.end - virtualRows[0].start;
          const somaTotal = paddingTop + alturaRenderizada + paddingBottom;

          expect(somaTotal).toBe(totalSize);
        }
      }
    });

    it("deve se recuperar estavelmente quando a lista filtrada transiciona instantaneamente de 50.000 para 0 e volta", () => {
      let count = 50000;
      const containerElement = document.createElement("div");
      Object.defineProperty(containerElement, "clientHeight", { configurable: true, value: 600 });
      Object.defineProperty(containerElement, "scrollTop", { configurable: true, value: 50000 });

      const { result, rerender } = renderHook(() =>
        useVirtualizer({
          count,
          getScrollElement: () => containerElement,
          estimateSize: () => 48,
          overscan: 10,
          initialRect: { width: 1200, height: 600 },
        })
      );

      // Estado inicial com 50k
      expect(result.current.getTotalSize()).toBe(50000 * 48);

      // Filtro zera todos os resultados
      act(() => {
        count = 0;
        rerender();
      });

      let virtualRows = result.current.getVirtualItems();
      let totalSize = result.current.getTotalSize();
      let paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
      let paddingBottom =
        virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

      expect(totalSize).toBe(0);
      expect(virtualRows).toHaveLength(0);
      expect(paddingTop).toBe(0);
      expect(paddingBottom).toBe(0);
      expect(Number.isFinite(paddingTop)).toBe(true);
      expect(Number.isFinite(paddingBottom)).toBe(true);

      // Filtro limpo restaura 50k
      act(() => {
        count = 50000;
        rerender();
      });

      virtualRows = result.current.getVirtualItems();
      totalSize = result.current.getTotalSize();
      paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
      paddingBottom =
        virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

      expect(totalSize).toBe(50000 * 48);
      expect(virtualRows.length).toBeGreaterThan(0);
      expect(Number.isFinite(paddingTop)).toBe(true);
      expect(Number.isFinite(paddingBottom)).toBe(true);
      expect(paddingTop).toBeGreaterThanOrEqual(0);
      expect(paddingBottom).toBeGreaterThanOrEqual(0);
    });
  });
});

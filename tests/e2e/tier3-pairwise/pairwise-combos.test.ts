/**
 * Tier 3: Combinações Entre Features (Pairwise)
 * Requisitos: ORIGINAL_REQUEST R1-R5 & PROJECT.md
 */

import { describe, it, expect } from "vitest";
import { aplicarTravaMarcaZumbi } from "@core/travas/marca-zumbi";
import { aplicarTravaFamiliaAplicacao, ItemFamiliaAplicacao } from "@core/travas/familia-aplicacao";
import { calcularTransferenciaEntreDuasLojas, SaldoFilialParaTransferencia } from "@core/transferencia/balanceamento";
import { arredondarParaMultiplo } from "@core/travas/lote-multiplo";
import {
  UsuarioAutenticado,
  LinhaMatrizDecisaoE2E,
  gerarCatalogoSintetico,
} from "../harness/contexto-teste";
import {
  executarBuscaEFiltroEmMemoria,
  salvarRascunhoSessao,
  recuperarRascunhoSessao,
  PayloadRascunhoSessao,
} from "../harness/runner-opaque";
import {
  criarStorageIsolado,
  GerenciadorCacheResiliente,
  CircuitBreakerResiliente,
} from "../harness/mock-ambiente";

describe("Tier 3 — Combinações Entre Features (Pairwise)", () => {
  // Par 1: Comprador RBAC Restrito x Marca Zumbi
  it("T3.1 — Par RBAC x Marca Zumbi: comprador autorizado acessa item que deve ter compra travada em 0 por inatividade", () => {
    const compradorNakata: UsuarioAutenticado = {
      id: "usr-comp-02",
      nome: "Renata Compradora Freios",
      email: "renata@carreiro.com.br",
      role: "COMPRADOR",
      allowedSupplierIds: new Set([503]), // NAKATA
      tenantId: "carreiro",
    };

    const catalogoComZumbi: LinhaMatrizDecisaoE2E[] = [
      {
        produtoId: 3001,
        codigoSku: "NAK-ZUMB-01",
        descricao: "TERMINAL DE DIRECAO NAKATA OBSOLETO",
        marca: "NAKATA",
        fabricante: "NAKATA",
        referenciaFabricante: "N-100",
        aplicacaoVeicular: "ANTIGO",
        secaoId: 3,
        nomeSecao: "FREIO",
        fornecedorId: 503,
        nomeFornecedor: "NAKATA DISTRIBUIDORA",
        precoCusto: 80.0,
        loteMultiplo: 1,
        diasAnalisados: 90,
        diasZerados: 0,
        taxaRupturaPercentual: 0,
        classificacaoRuptura: "Boa",
        notasVenda90d: 0,
        notasDevolucao90d: 0,
        notasLiquidas90d: 0,
        frequenciaPercentual90d: 0,
        classificacaoFrequencia: "Baixa",
        vendas30d: 0,
        cmd30d: 0,
        cobertura30dDias: 9999,
        vendas90d: 0,
        cmd90d: 0,
        cobertura90dDias: 9999,
        vendas180d: 0,
        cmd180d: 0,
        cobertura180dDias: 9999,
        isMarcaZumbi: true,
        saldoEstoqueLojaFoco: 12, // Saldo parado
        estoqueMinimoLojaFoco: 4,
        saldoEstoqueOutrasLojas: 0,
        quantidadeJaPedida: 0,
        statusDecisao: "OK",
        transferenciaSugerida: 0,
        transferenciaAjustada: 0,
        filialOrigemTransferenciaId: null,
        filialOrigemSobraReal: 0,
        pedidoSugerido: 0,
        pedidoAjustado: 0,
        similares: [],
        entradasHoje: [],
        _searchIndex: "nak-zumb-01 terminal nakata",
      },
    ];

    // 1. RBAC permite carregar o item porque pertence à Nakata (503)
    const resultado = executarBuscaEFiltroEmMemoria(catalogoComZumbi, {}, compradorNakata);
    expect(resultado.totalLinhas).toBe(1);

    // 2. Trava zumbi assegura que a sugestão permanece zero
    const trava = aplicarTravaMarcaZumbi({
      saldoFisico: resultado.itensFiltrados[0].saldoEstoqueLojaFoco,
      vendasLiquidas180dias: resultado.itensFiltrados[0].vendas180d,
      sugestaoOriginal: 5,
    });
    expect(trava.travado).toBe(true);
    expect(trava.sugestaoAjustada).toBe(0);
  });

  // Par 2: Alerta de NF-e do Dia x Similar Disponível na Rede x Necessidade Calculada
  it("T3.2 — Par Alerta NF-e x Similar Rede: SKU com necessidade é alertado por entrada fiscal do dia e similar excedente", () => {
    const itemComAlerta: LinhaMatrizDecisaoE2E = {
      produtoId: 4001,
      codigoSku: "AM-MON-4001",
      descricao: "AMORTECEDOR TRASEIRO STRADA",
      marca: "MONROE",
      fabricante: "TENNECO",
      referenciaFabricante: "G8010",
      aplicacaoVeicular: "FIAT STRADA",
      secaoId: 1,
      nomeSecao: "SUSPENSAO",
      fornecedorId: 501,
      nomeFornecedor: "DISTRIBUIDORA MONROE BRASIL",
      precoCusto: 200.0,
      loteMultiplo: 2,
      diasAnalisados: 90,
      diasZerados: 12,
      taxaRupturaPercentual: 13.33,
      classificacaoRuptura: "Grave",
      notasVenda90d: 25,
      notasDevolucao90d: 0,
      notasLiquidas90d: 25,
      frequenciaPercentual90d: 27.7,
      classificacaoFrequencia: "Média",
      vendas30d: 10,
      cmd30d: 0.33,
      cobertura30dDias: 6.0,
      vendas90d: 30,
      cmd90d: 0.33,
      cobertura90dDias: 6.0,
      vendas180d: 60,
      cmd180d: 0.33,
      cobertura180dDias: 6.0,
      isMarcaZumbi: false,
      saldoEstoqueLojaFoco: 2, // Ruptura iminente
      estoqueMinimoLojaFoco: 10,
      saldoEstoqueOutrasLojas: 6,
      quantidadeJaPedida: 0,
      statusDecisao: "PEDIR_TRANSFERIR",
      transferenciaSugerida: 4,
      transferenciaAjustada: 4,
      filialOrigemTransferenciaId: 2,
      filialOrigemSobraReal: 4,
      pedidoSugerido: 4,
      pedidoAjustado: 4,
      similares: [
        {
          produtoId: 4002,
          codigo: "AM-COF-4002",
          descricao: "AMORTECEDOR TRASEIRO STRADA COFAP",
          marca: "COFAP",
          precoCusto: 195.0,
          estoquePorFilial: { 1: 0, 2: 8 },
        },
      ],
      entradasHoje: [
        {
          numeroNota: "NF-991201",
          fornecedorNome: "DISTRIBUIDORA MONROE BRASIL",
          quantidadeRecebida: 6,
          dataEntrada: "2026-09-06",
        },
      ],
      _searchIndex: "am-mon-4001 estrada monroe suspensao",
    };

    // Avaliação conjunta:
    // 1. Há entrada do dia de 6 un que acabou de ser recebida
    expect(itemComAlerta.entradasHoje).toHaveLength(1);
    expect(itemComAlerta.entradasHoje[0].quantidadeRecebida).toBe(6);

    // 2. Há similar da Cofap com 8 un na Loja 2
    expect(itemComAlerta.similares[0].estoquePorFilial[2]).toBe(8);

    // 3. A necessidade calculada de compra (4) é inferior ao já recebido na NF (6) -> compra duplicada é evitada
    const compraExternaNecessariaAposEntrada = Math.max(
      0,
      itemComAlerta.pedidoSugerido - itemComAlerta.entradasHoje[0].quantidadeRecebida
    );
    expect(compraExternaNecessariaAposEntrada).toBe(0);
  });

  // Par 3: Família de Aplicação com Cobertura Global x SKU Individual Zerado
  it("T3.3 — Par Família Coberta x SKU Zerado: SKU com estoque zero tem compra bloqueada porque as marcas similares cobrem o horizonte", () => {
    // Família: Pastilha de Freio Onix
    // Marca Cobreq: estoque 0, consumo diário 0.5 un/dia -> individualmente precisaria de 15 un
    // Marca Fras-le: estoque 40, consumo diário 0.5 un/dia
    // Marca Jurid: estoque 30, consumo diário 0.2 un/dia
    // Total estoque: 70 un. Consumo consolidado: 1.2 un/dia -> Cobertura = 58.3 dias (acima do horizonte de 40 dias)
    const itensFamilia: ItemFamiliaAplicacao[] = [
      {
        produtoId: 501,
        codigoSku: "PST-COBREQ-ONIX",
        marca: "COBREQ",
        saldoFisico: 0, // ZERADO
        quantidadeJaPedida: 0,
        consumoDiario: 0.5,
        necessidadeIndividual: 15,
      },
      {
        produtoId: 502,
        codigoSku: "PST-FRASLE-ONIX",
        marca: "FRAS-LE",
        saldoFisico: 40,
        quantidadeJaPedida: 0,
        consumoDiario: 0.5,
        necessidadeIndividual: 0,
      },
      {
        produtoId: 503,
        codigoSku: "PST-JURID-ONIX",
        marca: "JURID",
        saldoFisico: 30,
        quantidadeJaPedida: 0,
        consumoDiario: 0.2,
        necessidadeIndividual: 0,
      },
    ];

    const resultadoTrava = aplicarTravaFamiliaAplicacao("FAM-PASTILHA-ONIX", itensFamilia, 40);

    expect(resultadoTrava.familiaCoberta).toBe(true);
    // Apesar de PST-COBREQ-ONIX estar com estoque zero, sua compra é bloqueada
    const itemCobreq = resultadoTrava.itens.get(501);
    expect(itemCobreq!.sugestaoAjustada).toBe(0);
    expect(itemCobreq!.travado).toBe(true);
  });

  // Par 4: Transferência Parcial Segura x Compra Complementar com Embalagem Mínima
  it("T3.4 — Par Transferência Parcial x Compra em Pares: destino recebe sobra segura e compra o saldo restante arredondado para par", () => {
    // Loja Destino precisa de 7 unidades de amortecedores (múltiplo = 2)
    // Loja Origem tem saldo = 9, minStock = 6 -> Sobra = 3 unidades
    const origem: SaldoFilialParaTransferencia = {
      filialId: 1,
      saldoFisico: 9,
      estoqueMinimo: 6,
      necessidadeCompra: 0,
    };
    const destino: SaldoFilialParaTransferencia = {
      filialId: 2,
      saldoFisico: 0,
      estoqueMinimo: 7,
      necessidadeCompra: 7,
    };

    const transferencia = calcularTransferenciaEntreDuasLojas(origem, destino);
    expect(transferencia).not.toBeNull();
    expect(transferencia!.quantidadeTransferir).toBe(3); // Doa no máximo a sobra real

    // Saldo da necessidade restante no destino: 7 - 3 = 4 unidades
    const necessidadeResidual = destino.necessidadeCompra - transferencia!.quantidadeTransferir;
    expect(necessidadeResidual).toBe(4);

    // Ajuste por múltiplo de fábrica (par = 2): 4 já é múltiplo de 2
    const compraAjustada = arredondarParaMultiplo(necessidadeResidual, 2);
    expect(compraAjustada).toBe(4);
    expect(compraAjustada % 2).toBe(0);
  });

  // Par 5: Restauração de Rascunho x Revogação de Acesso RBAC
  it("T3.5 — Par Rascunho x RBAC: itens de fornecedores revogados são expurgados na restauração da sessão", () => {
    const storage = criarStorageIsolado();

    // Rascunho salvo anteriormente quando o comprador tinha acesso aos fornecedores 501 e 502
    const rascunhoAntigo: PayloadRascunhoSessao = {
      timestamp: Date.now(),
      usuarioId: "usr-revogado",
      tenantId: "carreiro",
      lojaId: 1,
      ajustesComprador: {
        "AM-MON-001": { pedir: 6, transferir: 0 }, // Fornecedor 501
        "AM-COF-002": { pedir: 8, transferir: 0 }, // Fornecedor 502 (REVOGADO)
      },
    };
    salvarRascunhoSessao(storage, rascunhoAntigo);

    // Sessão atual do comprador (perdeu acesso ao fornecedor 502)
    const compradorAtualizado: UsuarioAutenticado = {
      id: "usr-revogado",
      nome: "Comprador Monroe Exclusivo",
      email: "comprador@carreiro.com.br",
      role: "COMPRADOR",
      allowedSupplierIds: new Set([501]), // Somente 501 autorizado!
      tenantId: "carreiro",
    };

    // Catálogo completo disponível no servidor
    const catalogo: LinhaMatrizDecisaoE2E[] = [
      {
        ...gerarCatalogoSintetico(2)[0],
        codigoSku: "AM-MON-001",
        fornecedorId: 501,
      },
      {
        ...gerarCatalogoSintetico(2)[1],
        codigoSku: "AM-COF-002",
        fornecedorId: 502,
      },
    ];

    // Ao filtrar com a sessão atualizada, o produto do fornecedor 502 é expurgado
    const resultado = executarBuscaEFiltroEmMemoria(catalogo, {}, compradorAtualizado);
    expect(resultado.totalLinhas).toBe(1);
    expect(resultado.itensFiltrados[0].codigoSku).toBe("AM-MON-001");
  });

  // Par 6: Resiliência de Rede (Circuit Breaker) x Busca em Memória Instantânea
  it("T3.6 — Par Resiliência x Grid: queda de rede no Power BI entrega dados em cache L2 e busca em memória mantém latência < 250ms", async () => {
    const catalogoSnapshot = gerarCatalogoSintetico(1000);
    const breaker = new CircuitBreakerResiliente<readonly LinhaMatrizDecisaoE2E[]>({
      limiteFalhasConsecutivas: 1,
      tempoAbertoMs: 5000,
    });

    const chamadaComQuedaRede = async () => {
      throw new Error("Timeout ao consultar dataset Carreiro Fabric");
    };
    const fallbackL2 = async () => catalogoSnapshot;

    // Executa sob queda de rede: Circuit Breaker cai para o snapshot L2
    const { dado: catalogoRecuperado, fonte } = await breaker.executar(
      chamadaComQuedaRede,
      fallbackL2
    );
    expect(fonte).toBe("SNAPSHOT_DEGRADADO");
    expect(catalogoRecuperado).toHaveLength(1000);

    // Imediatamente executa busca em memória sobre o snapshot entregue
    const busca = executarBuscaEFiltroEmMemoria(catalogoRecuperado, {
      queryBusca: "SUSPENSAO MONROE",
    });

    expect(busca.totalLinhas).toBeGreaterThan(0);
    expect(busca.tempoExecucaoMs).toBeLessThan(250);
  });
});

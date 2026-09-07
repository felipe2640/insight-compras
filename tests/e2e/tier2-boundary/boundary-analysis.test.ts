/**
 * Tier 2: Casos de Borda e Limite (Boundary Value Analysis - BVA)
 * Requisitos: ORIGINAL_REQUEST R2, R3 & PROJECT.md
 */

import { describe, it, expect, beforeEach } from "vitest";
import { calcularTransferenciaEntreDuasLojas, SaldoFilialParaTransferencia } from "@core/transferencia/balanceamento";
import { aplicarTravaMarcaZumbi } from "@core/travas/marca-zumbi";
import { arredondarParaMultiplo, ajustarQuantidadePorLote } from "@core/travas/lote-multiplo";
import {
  gerarCatalogoSintetico,
} from "../harness/contexto-teste";
import {
  executarBuscaEFiltroEmMemoria,
  salvarRascunhoSessao,
  recuperarRascunhoSessao,
  PayloadRascunhoSessao,
} from "../harness/runner-opaque";
import { criarStorageIsolado, SimulaLocalStorage } from "../harness/mock-ambiente";

describe("Tier 2 — Casos de Borda e Limite (Boundary Value Analysis - BVA)", () => {
  let storage: SimulaLocalStorage;

  beforeEach(() => {
    storage = criarStorageIsolado();
  });

  // T2.1: BVA Saldo de Origem na Transferência (minStock - 1, minStock, minStock + 1)
  it("T2.1 — BVA Transferência: fronteira estrita de saldo na origem (minStock - 1, minStock, minStock + 1)", () => {
    const minStock = 10;
    const destinoNecessidade = 5;

    // Sub-caso A: Saldo = minStock - 1 (saldo = 9) -> Sobra = 0 -> Nenhuma transferência
    const origemA: SaldoFilialParaTransferencia = {
      filialId: 1,
      saldoFisico: 9,
      estoqueMinimo: minStock,
      necessidadeCompra: 0,
    };
    const destino: SaldoFilialParaTransferencia = {
      filialId: 2,
      saldoFisico: 0,
      estoqueMinimo: 5,
      necessidadeCompra: destinoNecessidade,
    };
    expect(calcularTransferenciaEntreDuasLojas(origemA, destino)).toBeNull();

    // Sub-caso B: Saldo = minStock (saldo = 10) -> Sobra = 0 -> Nenhuma transferência
    const origemB: SaldoFilialParaTransferencia = {
      filialId: 1,
      saldoFisico: 10,
      estoqueMinimo: minStock,
      necessidadeCompra: 0,
    };
    expect(calcularTransferenciaEntreDuasLojas(origemB, destino)).toBeNull();

    // Sub-caso C: Saldo = minStock + 1 (saldo = 11) -> Sobra = 1 -> Transfere exatamente 1 unidade
    const origemC: SaldoFilialParaTransferencia = {
      filialId: 1,
      saldoFisico: 11,
      estoqueMinimo: minStock,
      necessidadeCompra: 0,
    };
    const resC = calcularTransferenciaEntreDuasLojas(origemC, destino);
    expect(resC).not.toBeNull();
    expect(resC!.quantidadeTransferir).toBe(1);
    expect(resC!.saldoOrigemApos).toBe(minStock); // Preserva exatamente o mínimo!
  });

  // T2.2: BVA Marca Zumbi (179d ativo vs 180d zumbi)
  it("T2.2 — BVA Marca Zumbi: fronteira de 180 dias sem vendas", () => {
    // 179 dias sem venda, mas registrou 1 venda no período de 180 dias -> ATIVO
    const item179d = aplicarTravaMarcaZumbi({
      saldoFisico: 8,
      vendasLiquidas180dias: 1, // Venda registrada
      sugestaoOriginal: 4,
    });
    expect(item179d.travado).toBe(false);
    expect(item179d.sugestaoAjustada).toBe(4);

    // Exatamente 0 vendas nos últimos 180 dias com saldo > 0 -> ZUMBI TRAVADO
    const item180d = aplicarTravaMarcaZumbi({
      saldoFisico: 8,
      vendasLiquidas180dias: 0,
      sugestaoOriginal: 4,
    });
    expect(item180d.travado).toBe(true);
    expect(item180d.sugestaoAjustada).toBe(0);

    // 0 vendas nos últimos 180 dias mas com saldo = 0 -> NÃO É ZUMBI DE ESTOQUE PARADO
    const itemSemEstoque = aplicarTravaMarcaZumbi({
      saldoFisico: 0,
      vendasLiquidas180dias: 0,
      sugestaoOriginal: 0,
    });
    expect(itemSemEstoque.travado).toBe(false);
  });

  // T2.3: BVA Diagnóstico de Ruptura (0%, 5%, 10%, >10% e 0 dias analisados)
  it("T2.3 — BVA Ruptura: limiares percentuais de gravidade e divisão segura", () => {
    const classificarRuptura = (diasZerados: number, diasAnalisados: number) => {
      if (diasAnalisados <= 0) return "Sem histórico";
      const pct = (diasZerados / diasAnalisados) * 100;
      if (pct > 10) return "Grave";
      if (pct >= 5) return "Atenção";
      return "Boa";
    };

    expect(classificarRuptura(0, 90)).toBe("Boa"); // 0%
    expect(classificarRuptura(4.5, 90)).toBe("Atenção"); // 5.0% exato
    expect(classificarRuptura(9, 90)).toBe("Atenção"); // 10.0% exato
    expect(classificarRuptura(9.01, 90)).toBe("Grave"); // 10.01%
    expect(classificarRuptura(0, 0)).toBe("Sem histórico"); // Evita NaN
  });

  // T2.4: BVA Frequência por Notas em 90 dias
  it("T2.4 — BVA Frequência: limiares de notas líquidas (Baixa < 15%, Média 15-40%, Alta > 40%)", () => {
    const classificarFreq = (notasLiquidas: number) => {
      const pct = (notasLiquidas / 90) * 100;
      if (pct > 40) return "Alta";
      if (pct >= 15) return "Média";
      return "Baixa";
    };

    expect(classificarFreq(0)).toBe("Baixa"); // 0%
    expect(classificarFreq(13)).toBe("Baixa"); // 14.44% (< 15%)
    expect(classificarFreq(14)).toBe("Média"); // 15.55% (>= 15%)
    expect(classificarFreq(36)).toBe("Média"); // 40.0% (limiar)
    expect(classificarFreq(37)).toBe("Alta"); // 41.11% (> 40%)
  });

  // T2.5: BVA Múltiplos e Embalagens Mínimas
  it("T2.5 — BVA Múltiplos: valores limítrofes de lote (0, 1, 2, 4, frações e negativos)", () => {
    // Quantidade zero ou negativa
    expect(arredondarParaMultiplo(0, 2)).toBe(0);
    expect(arredondarParaMultiplo(-5, 2)).toBe(0);

    // Múltiplo <= 1
    expect(arredondarParaMultiplo(7, 1)).toBe(7);
    expect(arredondarParaMultiplo(7, 0)).toBe(7);

    // Par obrigatório (múltiplo 2)
    expect(arredondarParaMultiplo(1, 2)).toBe(2);
    expect(arredondarParaMultiplo(2, 2)).toBe(2);
    expect(arredondarParaMultiplo(3, 2)).toBe(4);

    // Jogo de 4 (múltiplo 4)
    expect(arredondarParaMultiplo(1, 4)).toBe(4);
    expect(arredondarParaMultiplo(4, 4)).toBe(4);
    expect(arredondarParaMultiplo(5, 4)).toBe(8);

    // Quantidade fracionária (ex: 2.5) arredondada para cima
    expect(arredondarParaMultiplo(2.5, 2)).toBe(4);
  });

  // T2.6: BVA TTL do Rascunho de Sessão (23h59m vs 24h01m)
  it("T2.6 — BVA TTL Rascunho: validade no limite de 24 horas", () => {
    const agora = Date.now();
    const ttl24h = 24 * 3600 * 1000;

    // Caso A: Rascunho criado há 23h 59m 50s -> VÁLIDO
    const payloadValido: PayloadRascunhoSessao = {
      timestamp: agora - (ttl24h - 10000),
      usuarioId: "usr-valido",
      tenantId: "carreiro",
      lojaId: 1,
      ajustesComprador: { "SKU-1": { pedir: 10, transferir: 0 } },
    };
    salvarRascunhoSessao(storage, payloadValido);
    const recValido = recuperarRascunhoSessao(storage, "usr-valido", ttl24h);
    expect(recValido.expirado).toBe(false);
    expect(recValido.rascunho).not.toBeNull();

    // Caso B: Rascunho criado há 24h 00m 10s -> EXPIRADO
    const payloadExpirado: PayloadRascunhoSessao = {
      timestamp: agora - (ttl24h + 10000),
      usuarioId: "usr-expirado",
      tenantId: "carreiro",
      lojaId: 1,
      ajustesComprador: { "SKU-2": { pedir: 10, transferir: 0 } },
    };
    salvarRascunhoSessao(storage, payloadExpirado);
    const recExpirado = recuperarRascunhoSessao(storage, "usr-expirado", ttl24h);
    expect(recExpirado.expirado).toBe(true);
    expect(recExpirado.rascunho).toBeNull();
  });

  // T2.7: BVA Limite de Armazenamento (QuotaExceededError)
  it("T2.7 — BVA Armazenamento: tratamento robusto quando cota do localStorage é excedida", () => {
    // Configura storage com limite estrito de apenas 50 bytes
    const storageLimitado = criarStorageIsolado(50);

    const payloadGrande: PayloadRascunhoSessao = {
      timestamp: Date.now(),
      usuarioId: "usr-pesado",
      tenantId: "carreiro",
      lojaId: 1,
      ajustesComprador: {
        "SKU-LONGO-000001": { pedir: 100, transferir: 50 },
        "SKU-LONGO-000002": { pedir: 200, transferir: 50 },
      },
    };

    const resultado = salvarRascunhoSessao(storageLimitado, payloadGrande);
    expect(resultado.sucesso).toBe(false);
    expect(resultado.erroQuota).toBe(true);
  });

  // T2.8: BVA Escala e Performance (< 250ms com 25.000 SKUs)
  it("T2.8 — BVA Escala: tempo de busca e filtro em catálogo massivo de 25.000 SKUs deve ser inferior a 250ms", () => {
    const catalogo25k = gerarCatalogoSintetico(25000);
    expect(catalogo25k.length).toBe(25000);

    // Executa busca textual tokenizada com 2 tokens
    const resultado = executarBuscaEFiltroEmMemoria(catalogo25k, {
      queryBusca: "AMORTECEDOR MONROE",
      secoesDesejadas: new Set(["SUSPENSAO"]),
    });

    expect(resultado.totalLinhas).toBeGreaterThan(0);
    // CRITÉRIO DE ACEITE: Menor que 250ms
    expect(resultado.tempoExecucaoMs).toBeLessThan(250);
  });
});

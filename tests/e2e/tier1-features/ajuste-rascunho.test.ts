/**
 * Tier 1: Cobertura de Features — Ajuste Humano com Múltiplos e Persistência de Rascunho
 * Requisitos: ORIGINAL_REQUEST R2 & PROJECT.md
 */

import { inferirLotePadraoPorCategoria } from "@adapters/comum/lote-autopecas";
import { describe, it, expect, beforeEach } from "vitest";
import {
  arredondarParaMultiplo,
  ajustarQuantidadePorLote,
} from "@core/travas/lote-multiplo";
import {
  executarAjusteHumanoPedido,
  salvarRascunhoSessao,
  recuperarRascunhoSessao,
  PayloadRascunhoSessao,
} from "../harness/runner-opaque";
import { criarStorageIsolado, SimulaLocalStorage } from "../harness/mock-ambiente";

describe("Tier 1 — Feature 4: Ajuste Humano com Múltiplos e Persistência de Rascunho", () => {
  let storage: SimulaLocalStorage;

  beforeEach(() => {
    storage = criarStorageIsolado();
  });

  // T1.4.1: Arredondamento para múltiplos de fábrica
  it("T1.4.1 — deve arredondar a quantidade para o próximo múltiplo inteiro de embalagem de fábrica", () => {
    // Caixa de óleo com 12 unidades: comprador digita 15 -> arredonda para 24
    const resultadoOleo = arredondarParaMultiplo(15, 12);
    expect(resultadoOleo).toBe(24);

    // Múltiplo exato: comprador digita 24 -> mantém 24
    const resultadoExato = arredondarParaMultiplo(24, 12);
    expect(resultadoExato).toBe(24);

    // Lote avulso (1 un): comprador digita 7 -> mantém 7
    const resultadoAvulso = arredondarParaMultiplo(7, 1);
    expect(resultadoAvulso).toBe(7);
  });

  // T1.4.2: Ajuste obrigatório para pares em amortecedores/discos
  it("T1.4.2 — deve forçar a compra em pares (múltiplo de 2) para amortecedores e discos de freio", () => {
    const loteAmortecedor = inferirLotePadraoPorCategoria("AMORTECEDOR DIANTEIRO");
    expect(loteAmortecedor).toBe(2);

    const ajustePar = ajustarQuantidadePorLote({
      quantidadeDesejada: 3,
      multiploLote: loteAmortecedor,
    });

    expect(ajustePar.quantidadeAjustada).toBe(4);
    expect(ajustePar.motivoAjuste).toContain("múltiplo de embalagem fechada (2 un)");
  });

  // T1.4.3: Sanitização de célula editável de entrada humana
  it("T1.4.3 — deve sanitizar entradas não numéricas e valores negativos na digitação rápida", () => {
    // Entrada com texto sujo
    const ajusteTexto = executarAjusteHumanoPedido("15 caixas", 2);
    expect(ajusteTexto.valido).toBe(true);
    expect(ajusteTexto.quantidadeFinal).toBe(16); // 15 sanitizado para 15 -> arredondado para múltiplo 2 = 16

    // Entrada negativa ou zerada
    const ajusteNegativo = executarAjusteHumanoPedido(-10, 2);
    expect(ajusteNegativo.quantidadeFinal).toBe(0);

    // Entrada puramente alfabética
    const ajusteInvalido = executarAjusteHumanoPedido("invalido", 2);
    expect(ajusteInvalido.quantidadeFinal).toBe(0);
  });

  // T1.4.4: Salvamento de rascunho sob chave isolada por usuário
  it("T1.4.4 — deve persistir os ajustes do comprador em rascunho de sessão isolado por userId", () => {
    const rascunhoComprador1: PayloadRascunhoSessao = {
      timestamp: Date.now(),
      usuarioId: "usr-comprador-01",
      tenantId: "carreiro",
      lojaId: 1,
      ajustesComprador: {
        "AM-MON-001": { pedir: 6, transferir: 2 },
        "VEL-NGK-002": { pedir: 8, transferir: 0 },
      },
    };

    const resultadoSalvar = salvarRascunhoSessao(storage, rascunhoComprador1);
    expect(resultadoSalvar.sucesso).toBe(true);
    expect(resultadoSalvar.erroQuota).toBe(false);

    const raw = storage.getItem("insight-compras-draft-usr-comprador-01");
    expect(raw).not.toBeNull();
    const parseado = JSON.parse(raw!);
    expect(parseado.usuarioId).toBe("usr-comprador-01");
    expect(parseado.ajustesComprador["AM-MON-001"].pedir).toBe(6);

    // Isolamento: não deve existir rascunho para outro usuário
    expect(storage.getItem("insight-compras-draft-usr-comprador-02")).toBeNull();
  });

  // T1.4.5: Recuperação guiada de sessão com validação de integridade
  it("T1.4.5 — deve restaurar os ajustes de sessão válidos preservando os valores configurados", () => {
    const agora = Date.now();
    const rascunhoSalvo: PayloadRascunhoSessao = {
      timestamp: agora - 3600 * 1000, // Salvo há 1 hora atrás
      usuarioId: "usr-comprador-01",
      tenantId: "carreiro",
      lojaId: 1,
      ajustesComprador: {
        "AM-MON-001": { pedir: 12, transferir: 4 },
      },
    };

    salvarRascunhoSessao(storage, rascunhoSalvo);

    const resultadoRecuperar = recuperarRascunhoSessao(storage, "usr-comprador-01");
    expect(resultadoRecuperar.expirado).toBe(false);
    expect(resultadoRecuperar.rascunho).not.toBeNull();
    expect(resultadoRecuperar.rascunho!.ajustesComprador["AM-MON-001"].pedir).toBe(12);
  });
});

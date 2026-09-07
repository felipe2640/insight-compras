import { describe, it, expect } from "vitest";
import { aplicarTravaMarcaZumbi } from "@core/travas/marca-zumbi";

describe("Trava Anti-Encalhe: Marca Zumbi", () => {
  it("MANDATÓRIO: deve travar a sugestão final em 0 se o SKU tiver saldo físico > 0 e 0 vendas nos últimos 180 dias", () => {
    const resultado = aplicarTravaMarcaZumbi({
      saldoFisico: 15,
      vendasLiquidas180dias: 0,
      sugestaoOriginal: 25,
      codigoSku: "ZUMBI-PARADO-01",
    });

    expect(resultado.travado).toBe(true);
    expect(resultado.sugestaoAjustada).toBe(0);
    expect(resultado.motivo).toContain("Bloqueio Marca Zumbi");
    expect(resultado.motivo).toContain("ZUMBI-PARADO-01");
    expect(resultado.motivo).toContain("15 un");
  });

  it("deve travar em 0 mesmo que o saldo físico seja pequeno (ex: 1 un) e a sugestão original seja alta", () => {
    const resultado = aplicarTravaMarcaZumbi({
      saldoFisico: 1,
      vendasLiquidas180dias: 0,
      sugestaoOriginal: 50,
      codigoSku: "ZUMBI-PEQUENO-02",
    });

    expect(resultado.travado).toBe(true);
    expect(resultado.sugestaoAjustada).toBe(0);
  });

  it("deve travar em 0 se as saídas nos últimos 180 dias forem negativas (devoluções superaram vendas)", () => {
    const resultado = aplicarTravaMarcaZumbi({
      saldoFisico: 8,
      vendasLiquidas180dias: -3,
      sugestaoOriginal: 10,
    });

    expect(resultado.travado).toBe(true);
    expect(resultado.sugestaoAjustada).toBe(0);
  });

  it("NÃO deve travar e deve manter a sugestão original se o item tiver vendas comprovadas nos últimos 180 dias", () => {
    const resultado = aplicarTravaMarcaZumbi({
      saldoFisico: 5,
      vendasLiquidas180dias: 42,
      sugestaoOriginal: 18,
      codigoSku: "ATIVO-GIRO-03",
    });

    expect(resultado.travado).toBe(false);
    expect(resultado.sugestaoAjustada).toBe(18);
    expect(resultado.motivo).toBeNull();
  });

  it("NÃO deve marcar como zumbi se o saldo físico for 0 (caso de ruptura normal)", () => {
    const resultado = aplicarTravaMarcaZumbi({
      saldoFisico: 0,
      vendasLiquidas180dias: 0,
      sugestaoOriginal: 0,
    });

    expect(resultado.travado).toBe(false);
    expect(resultado.sugestaoAjustada).toBe(0);
  });
});

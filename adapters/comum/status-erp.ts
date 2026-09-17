/**
 * Normalização de Status do ERP
 * Camada: Adapters / comum
 * 100% em Português do Brasil (pt-BR).
 *
 * Traduzir código de ERP é trabalho de quem conhece o ERP — e estava na rota
 * de histórico de pedidos (`status.includes("conc") || status === "F"`), onde
 * cada cliente novo exigiria mais um `if`.
 *
 * "desconhecido" existe de propósito: status que ninguém mapeou não é "aberto".
 * É não medido, e a tela mostra "—" em vez de afirmar um estado que a fonte
 * não confirmou.
 */

import type { StatusNormalizadoERP } from "../AdaptadorInventario";

/** Códigos do ConnectSoft ShopCash, conferidos no modelo semântico da Carreiro. */
const MAPA_PADRAO: Readonly<Record<string, StatusNormalizadoERP>> = {
  A: "aberto",
  P: "aberto",
  E: "aberto",
  F: "concluido",
  T: "concluido",
  C: "cancelado",
  X: "cancelado",
};

export function normalizarStatusERP(
  bruto: unknown,
  mapa: Readonly<Record<string, StatusNormalizadoERP>> = MAPA_PADRAO
): StatusNormalizadoERP {
  const texto = String(bruto ?? "").trim();
  if (texto.length === 0) return "desconhecido";

  const porCodigo = mapa[texto.toUpperCase()];
  if (porCodigo) return porCodigo;

  const minusculo = texto.toLowerCase();
  if (minusculo.includes("conc") || minusculo.includes("final") || minusculo.includes("fech")) {
    return "concluido";
  }
  if (minusculo.includes("cancel")) return "cancelado";
  if (minusculo.includes("abert") || minusculo.includes("pend")) return "aberto";

  return "desconhecido";
}

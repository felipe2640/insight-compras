/**
 * Montagem canônica de payload, fingerprint e comparação de destinos.
 * Camada: Aplicação (src/lib/cotacao-hub) — módulo PURO, sem import de
 * servidor: os componentes de tela e o conector compartilham exatamente a
 * mesma regra (fix de duplicação de parsing/montagem entre cockpit e pedidos).
 * 100% em Português do Brasil (pt-BR).
 */

import type { Destination } from "./types";

/**
 * Serialização canônica: chaves ordenadas recursivamente.
 *
 * O fingerprint e as comparações não podem depender da ordem em que os
 * campos foram montados em telas diferentes — `JSON.stringify` puro muda
 * com a ordem das propriedades. Aqui a ordem é sempre a mesma.
 */
export function canonicalJson(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor) ?? "null";
  if (Array.isArray(valor)) return `[${valor.map(canonicalJson).join(",")}]`;
  const registros = valor as Record<string, unknown>;
  const chaves = Object.keys(registros).filter((chave) => registros[chave] !== undefined).sort();
  return `{${chaves.map((chave) => `${JSON.stringify(chave)}:${canonicalJson(registros[chave])}`).join(",")}}`;
}

/** Destinos são iguais por CAMPOS canônicos, não por ordem de propriedades. */
export function destinosEquivalentes(a: Destination, b: Destination): boolean {
  return (
    a.external_id === b.external_id &&
    (a.name ?? "").trim() === (b.name ?? "").trim() &&
    (a.address ?? "").trim() === (b.address ?? "").trim()
  );
}

/**
 * Seleção normalizada que os dois fluxos de envio (cockpit e pedidos
 * compilados) entregam à API. O fingerprint cobre tudo o que muda o resultado
 * comercial: itens (produto, quantidade, loja, descrição, referência, marca,
 * marcas aceitas, observação), fornecedores com contato, destinos e pedidos
 * de origem. Ele NÃO cobre externalId/prazo, que são constantes da tentativa.
 */
export interface SelecaoNormalizada {
  readonly pedidoIds?: readonly number[];
  readonly filialId?: number;
  readonly supplierIds: readonly string[];
  readonly suppliersData: readonly { id: string; name: string; email: string }[];
  readonly destinations?: readonly Destination[];
  readonly items: readonly {
    produtoId: number;
    quantity: string;
    filialId?: number;
    description?: string;
    requested_reference?: string;
    requested_brand?: string;
    accepted_brands?: readonly string[];
    observacao?: string;
  }[];
}

/** Fingerprint canônico da seleção: mesma seleção, mesmo hash, qualquer ordem. */
export function fingerprintSelecao(selecao: SelecaoNormalizada): string {
  const itens = [...selecao.items]
    .map((item) => ({
      produtoId: item.produtoId,
      quantity: item.quantity,
      filialId: item.filialId,
      description: (item.description ?? "").trim() || undefined,
      requested_reference: (item.requested_reference ?? "").trim() || undefined,
      requested_brand: (item.requested_brand ?? "").trim() || undefined,
      accepted_brands:
        item.accepted_brands && item.accepted_brands.length > 0
          ? [...item.accepted_brands].map((marca) => marca.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"))
          : undefined,
      observacao: (item.observacao ?? "").trim() || undefined,
    }))
    .sort((a, b) => a.produtoId - b.produtoId || (a.filialId ?? 0) - (b.filialId ?? 0));
  return canonicalJson({
    pedidoIds: selecao.pedidoIds ? [...selecao.pedidoIds].sort((a, b) => a - b) : undefined,
    filialId: selecao.filialId,
    supplierIds: [...selecao.supplierIds].sort(),
    suppliersData: [...selecao.suppliersData]
      .map((s) => ({ id: s.id, name: (s.name ?? "").trim(), email: (s.email ?? "").trim().toLowerCase() }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    destinations: selecao.destinations
      ? [...selecao.destinations]
          .map((d) => ({ external_id: d.external_id, name: (d.name ?? "").trim(), address: (d.address ?? "").trim() }))
          .sort((a, b) => a.external_id.localeCompare(b.external_id))
      : undefined,
    items: itens,
  });
}

/** Divide um texto de marcas separadas por vírgula em lista normalizada. */
export function parseMarcasAceitas(texto: string | undefined | null): string[] {
  if (!texto) return [];
  return texto
    .split(",")
    .map((marca) => marca.trim())
    .filter(Boolean);
}

/** Nome de exibição de fornecedor quando o cadastro não trouxe um real. */
export function nomeExibicaoFornecedor(f: { id: string; name: string; email?: string }): string {
  // Nome real do cadastro sempre prevalece; genérico ("Fornecedor 20xxx")
  // é o sinal de que a fonte não tinha nome e a exibição precisa de fallback.
  if (f.name && !f.name.startsWith("Fornecedor 2000") && f.name !== `Fornecedor ${f.id}`) {
    return f.name;
  }
  if (f.email) {
    const dominio = f.email.split("@")[1]?.toLowerCase();
    const prefixo = dominio ? dominio.split(".")[0] : "";
    const GENERICOS = ["gmail", "hotmail", "outlook", "yahoo", "bol", "uol", "terra", "live"];
    if (prefixo && !GENERICOS.includes(prefixo)) {
      return prefixo.charAt(0).toUpperCase() + prefixo.slice(1);
    }
  }
  const idLimpo = f.id.replace(/^20+/, "");
  return f.name || `Fornecedor ${idLimpo || f.id}`;
}

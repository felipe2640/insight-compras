import { z } from "zod";
import type { Produto } from "@core/dominio/produto";
import type { ConfiguracaoTenant } from "@config/tenants";
import type { UsuarioAutenticado } from "@/lib/rbac/tipos";
import type { ConnectorConfig, Snapshot } from "./types";

export const selectionSchema = z.object({
  externalId: z.string().min(1).max(255),
  deadline: z.string().datetime(),
  filialId: z.number().int().positive().safe().optional(),
  pedidoIds: z.array(z.number().int().positive().safe()).optional(),
  supplierIds: z.array(z.string().regex(/^[1-9][0-9]*$/)).min(1).max(100),
  items: z.array(z.object({
    produtoId: z.number().int().positive().safe(),
    quantity: z.string().regex(/^[1-9][0-9]{0,13}$/),
    filialId: z.number().int().positive().safe().optional(),
    description: z.string().max(500).optional(),
    requested_reference: z.string().max(100).optional(),
    requested_brand: z.string().max(100).optional(),
    accepted_brands: z.array(z.string().min(1).max(100)).max(20).optional(),
  }).strict()).min(1).max(500),
  destinations: z.array(z.object({
    external_id: z.string().min(1),
    name: z.string().min(1),
    address: z.string(),
  }).strict()).optional(),
  suppliersData: z.array(z.object({
    id: z.string().regex(/^[1-9][0-9]*$/),
    name: z.string().min(1).max(255),
    email: z.string().email(),
  }).strict()).optional(),
}).strict();

export function createSnapshot(
  cfg: ConnectorConfig,
  user: UsuarioAutenticado,
  tenant: ConfiguracaoTenant,
  products: readonly Produto[],
  pending: ReadonlySet<number>,
  input: unknown
): Snapshot {
  const selection = selectionSchema.parse(input);
  if (tenant.id !== cfg.tenantId || user.tenantId !== cfg.tenantId || (cfg.allowedActorIds.length > 0 && !cfg.allowedActorIds.includes(user.id))) {
    throw new Error("Identidade fora da conexão.");
  }
  if (Date.parse(selection.deadline) <= Date.now()) {
    throw new Error("Prazo da cotação expirado.");
  }

  // Validação das lojas (filiais) envolvidas
  if (selection.filialId !== undefined) {
    if (!tenant.filiais.some(f => f.filialId === selection.filialId && f.ativa)) {
      throw new Error("Loja não cadastrada/ativa.");
    }
  }

  // Carteira aplica-se ao comprador em QUALQUER modo: grants nunca dão
  // acesso além da carteira individual (plano I1 do Hub).
  const allowed = user.allowedSupplierIds ? new Set(user.allowedSupplierIds) : new Set<number>();
  const restricted = user.role === "COMPRADOR";
  for (const id of selection.supplierIds) {
    // O navegador NÃO é autoridade de cadastro: só fornecedores presentes na
    // conexão validada no servidor (config + fonte autorizada) passam. Os
    // suppliersData do payload são conferidos pela rota antes daqui.
    const isKnown = cfg.suppliers.some(s => s.external_id === id);
    if (!isKnown || (restricted && !allowed.has(Number(id)))) throw new Error("Fornecedor fora da carteira/conexão.");
  }
  const categories = user.allowedCategoryIds ? new Set(user.allowedCategoryIds) : null;

  // Mapa de destinos disponíveis
  const destinationMap = new Map<string, typeof cfg.destinations[0]>();
  for (const d of cfg.destinations) {
    destinationMap.set(d.external_id, d);
  }
  if (cfg.mode === "production") {
    if (selection.destinations) {
      for (const d of selection.destinations) {
        if (!destinationMap.has(d.external_id)) destinationMap.set(d.external_id, d);
      }
    }
    for (const f of tenant.filiais) {
      const fidStr = String(f.filialId);
      if (!destinationMap.has(fidStr)) {
        destinationMap.set(fidStr, {
          external_id: fidStr,
          name: f.nome,
          address: f.cidade ? `${f.cidade} - ${f.uf}` : tenant.nome,
        });
      }
    }
  }

  if (selection.filialId !== undefined) {
    const rootDest = destinationMap.get(String(selection.filialId));
    if (!rootDest) throw new Error("Destino sem cadastro homologado.");
  }

  const seen = new Set<string>();
  const activeDestinations = new Map<string, typeof cfg.destinations[0]>();

  const items = selection.items.map(({
    produtoId,
    quantity,
    filialId: itemFilialId,
    description: customDesc,
    requested_reference: customRef,
    requested_brand: customBrand,
    accepted_brands: customAcceptedBrands,
  }) => {
    const effectiveFilialId = itemFilialId ?? selection.filialId;
    if (!effectiveFilialId) throw new Error("Item sem loja de destino definida.");

    if (!tenant.filiais.some(f => f.filialId === effectiveFilialId && f.ativa)) {
      throw new Error("Loja não cadastrada/ativa.");
    }

    const destination = destinationMap.get(String(effectiveFilialId));
    if (!destination) throw new Error("Destino sem cadastro homologado.");
    activeDestinations.set(destination.external_id, destination);

    const dupKey = `${produtoId}:${destination.external_id}`;
    if (seen.has(dupKey)) throw new Error("Produto duplicado na seleção.");
    seen.add(dupKey);

    const product = products.find(p => p.id === produtoId);
    if (!product || pending.has(produtoId) || (restricted && !allowed.has(product.fornecedorId)) ||
        (categories && (product.secaoId === null || !categories.has(product.secaoId)))) {
      throw new Error("Produto fora do escopo ou já pedido.");
    }

    const unit = Object.hasOwn(cfg.units, String(product.id))
      ? cfg.units[String(product.id)]
      : (Object.hasOwn(cfg.units, "default") ? cfg.units["default"] : undefined);
    if (!unit) throw new Error(`Produto ${produtoId} sem unidade homologada.`);

    // Marca solicitada: usa o ajuste confirmado se informado; senão preserva o catálogo
    const brand = customBrand !== undefined
      ? (customBrand.trim() || undefined)
      : (product.marca?.trim() || undefined);

    // Referência do fabricante: usa o ajuste confirmado se informado; senão preserva o catálogo
    const reference = customRef !== undefined
      ? (customRef.trim() || undefined)
      : (product.referenciaFabricante?.trim() || undefined);

    // Marcas alternativas aceitas
    const acceptedBrands = customAcceptedBrands && customAcceptedBrands.length > 0
      ? customAcceptedBrands.map(b => b.trim()).filter(Boolean)
      : undefined;

    return {
      external_id: JSON.stringify([String(product.id), destination.external_id]),
      description: (customDesc && customDesc.trim()) ? customDesc.trim() : product.descricao,
      requested_quantity: quantity,
      requested_unit: unit,
      destination_external_id: destination.external_id,
      ...(brand ? { requested_brand: brand } : {}),
      ...(reference ? { requested_reference: reference } : {}),
      ...(acceptedBrands && acceptedBrands.length > 0 ? { accepted_brands: acceptedBrands } : {}),
    };
  });

  return {
    externalId: selection.externalId,
    actorId: user.id,
    deadline: selection.deadline,
    items,
    supplierIds: [...new Set(selection.supplierIds)],
    destinations: Array.from(activeDestinations.values()),
  };
}

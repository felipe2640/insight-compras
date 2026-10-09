import { z } from "zod";
import type { Produto } from "@core/dominio/produto";
import type { ConfiguracaoTenant } from "@config/tenants";
import type { UsuarioAutenticado } from "@/lib/rbac/tipos";
import type { ConnectorConfig, Snapshot } from "./types";

export const selectionSchema = z.object({ externalId: z.string().min(1).max(255),
  deadline: z.string().datetime(), filialId: z.number().int().positive().safe(),
  supplierIds: z.array(z.string().regex(/^[1-9][0-9]*$/)).min(1).max(100),
  items: z.array(z.object({ produtoId: z.number().int().positive().safe(),
    quantity: z.string().regex(/^[1-9][0-9]{0,13}$/) }).strict()).min(1).max(500),
  suppliersData: z.array(z.object({
    id: z.string().regex(/^[1-9][0-9]*$/),
    name: z.string().min(1).max(255),
    email: z.string().email(),
  }).strict()).optional(),
}).strict();
export function createSnapshot(cfg: ConnectorConfig, user: UsuarioAutenticado, tenant: ConfiguracaoTenant,
  products: readonly Produto[], pending: ReadonlySet<number>, input: unknown): Snapshot {
  const selection = selectionSchema.parse(input);
  if (tenant.id !== cfg.tenantId || user.tenantId !== cfg.tenantId || (cfg.allowedActorIds.length > 0 && !cfg.allowedActorIds.includes(user.id))) throw new Error("Identidade fora da conexão.");
  if (Date.parse(selection.deadline) <= Date.now()) throw new Error("Prazo da cotação expirado.");
  if (!tenant.filiais.some(f => f.filialId === selection.filialId && f.ativa)) throw new Error("Loja não cadastrada/ativa.");
  const destination = cfg.destinations.find(d => d.external_id === String(selection.filialId));
  if (!destination) throw new Error("Destino sem cadastro homologado.");
  const allowed = user.allowedSupplierIds ? new Set(user.allowedSupplierIds) : new Set<number>();
  const restricted = user.role === "COMPRADOR" && cfg.mode === "synthetic-local";
  for (const id of selection.supplierIds) {
    const isKnown = cfg.suppliers.some(s => s.external_id === id) || (cfg.mode !== "synthetic-local" && selection.suppliersData?.some(s => s.id === id));
    if (!isKnown || (restricted && !allowed.has(Number(id)))) throw new Error("Fornecedor fora da carteira/conexão.");
  }
  const categories = user.allowedCategoryIds ? new Set(user.allowedCategoryIds) : null;
  const seen = new Set<number>();
  const items = selection.items.map(({ produtoId, quantity }) => {
    if (seen.has(produtoId)) throw new Error("Produto duplicado na seleção.");
    seen.add(produtoId);
    const product = products.find(p => p.id === produtoId);
    if (!product || pending.has(produtoId) || (restricted && !allowed.has(product.fornecedorId)) ||
        (categories && (product.secaoId === null || !categories.has(product.secaoId)))) throw new Error("Produto fora do escopo ou já pedido.");
    const unit = Object.hasOwn(cfg.units, String(product.id))
      ? cfg.units[String(product.id)]
      : (Object.hasOwn(cfg.units, "default") ? cfg.units["default"] : undefined);
    if (!unit) throw new Error(`Produto ${produtoId} sem unidade homologada.`);
    return { external_id: JSON.stringify([String(product.id), destination.external_id]),
      description: product.descricao, requested_quantity: quantity, requested_unit: unit,
      destination_external_id: destination.external_id,
      ...(product.marca ? { requested_brand: product.marca } : {}),
      ...(product.referenciaFabricante ? { requested_reference: product.referenciaFabricante } : {}) };
  });
  return { externalId: selection.externalId, actorId: user.id, deadline: selection.deadline,
    items, supplierIds: [...new Set(selection.supplierIds)], destinations: [destination] };
}

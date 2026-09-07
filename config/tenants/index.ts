/**
 * Catálogo e Registro Central de Tenants White-Label
 * Camada: Configurações & White-Label (config/tenants/index.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { ConfiguracaoTenant } from "./tipos";
import { TENANT_CARREIRO } from "./carreiro";

export * from "./tipos";
export * from "./carreiro";

/** Tenant padrão do sistema quando nenhum outro for identificado */
export const TENANT_PADRAO: ConfiguracaoTenant = TENANT_CARREIRO;

/** Mapa de Tenants indexados por slug / identificador */
export const CATALOGO_TENANTS: Readonly<Record<string, ConfiguracaoTenant>> = {
  carreiro: TENANT_CARREIRO,
};

/**
 * Resolve a configuração de tenant a partir de um identificador (id, slug, subdomínio ou custom domain).
 * Busca em O(1) e recorre ao TENANT_PADRAO caso não localize.
 */
export function obterConfiguracaoTenant(identificador?: string | null): ConfiguracaoTenant {
  if (!identificador) {
    return TENANT_PADRAO;
  }

  const idNormalizado = identificador.trim().toLowerCase();

  // 1. Busca direta por ID
  if (CATALOGO_TENANTS[idNormalizado]) {
    return CATALOGO_TENANTS[idNormalizado];
  }

  // 2. Busca por subdomínio cadastrado ou custom domain
  for (const tenant of Object.values(CATALOGO_TENANTS)) {
    if (
      tenant.subdominioPrincipal.toLowerCase() === idNormalizado ||
      tenant.subdominiosValidos.some((s) => s.toLowerCase() === idNormalizado) ||
      (tenant.customDomain && tenant.customDomain.toLowerCase() === idNormalizado)
    ) {
      return tenant;
    }
  }

  return TENANT_PADRAO;
}

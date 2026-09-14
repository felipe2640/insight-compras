/**
 * Catálogo e Registro Central de Tenants White-Label
 * Camada: Configurações & White-Label (config/tenants/index.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { ConfiguracaoTenant } from "./tipos";
import { TENANT_CARREIRO } from "./carreiro";
import { TENANT_DEMONSTRACAO } from "./demonstracao";

export * from "./tipos";
export * from "./carreiro";
export * from "./demonstracao";

/**
 * Tenant padrão: DEMONSTRAÇÃO, nunca um cliente.
 *
 * Sem configuração explícita, o que sobe é o ambiente de mostruário, com dados
 * sintéticos e sem o nome de nenhuma rede real. Apontar para um cliente é uma
 * decisão deliberada (TENANT_ATIVO), e não o efeito de um descuido — um deploy
 * errado não pode expor a operação de quem confiou os dados.
 */
export const TENANT_PADRAO: ConfiguracaoTenant = TENANT_DEMONSTRACAO;

const registroTenants: Record<string, ConfiguracaoTenant> = {
  demonstracao: TENANT_DEMONSTRACAO,
  carreiro: TENANT_CARREIRO,
};

/** Mapa de Tenants indexados por slug / identificador */
export const CATALOGO_TENANTS: Readonly<Record<string, ConfiguracaoTenant>> = registroTenants;

/**
 * Registra um novo tenant no catálogo dinamicamente.
 * Permite plugar novos clientes em tempo de execução ou em testes sem alterar código interno.
 */
export function registrarTenant(tenant: ConfiguracaoTenant): void {
  registroTenants[tenant.id.trim().toLowerCase()] = tenant;
}

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

/**
 * Tenant que ESTA instalação atende, por configuração de ambiente.
 *
 * É o único lugar que lê TENANT_ATIVO. Antes havia duas resoluções — o cockpit
 * pela variável e o middleware pelo host — e elas divergiam em localhost: o
 * middleware anunciava "demonstracao" enquanto o cockpit servia dados do
 * cliente, o que quebrava o login (o identificador interno é derivado do
 * tenant). Uma decisão, um lugar.
 *
 * Nome desconhecido cai na demonstração com aviso no log: derrubar tudo por uma
 * variável digitada errada seria pior do que abrir em modo mostruário.
 */
export function resolverTenantConfigurado(): ConfiguracaoTenant {
  const desejado = process.env.TENANT_ATIVO?.trim().toLowerCase();
  if (!desejado) return TENANT_PADRAO;

  const encontrado = CATALOGO_TENANTS[desejado];
  if (!encontrado) {
    console.warn(
      `[tenant] TENANT_ATIVO="${desejado}" não existe no catálogo; usando o modo demonstração.`
    );
    return TENANT_PADRAO;
  }
  return encontrado;
}

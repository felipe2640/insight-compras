/**
 * Motor Agnóstico de Resolução de Tenant e Injeção de Cabeçalhos para Edge Middleware
 * Camada: src/lib/middleware-tenant.ts
 * 100% em Português do Brasil (pt-BR). Zero dependências de Node.js (Edge-ready).
 */

import { obterConfiguracaoTenant, resolverTenantConfigurado, ConfiguracaoTenant } from "@config/tenants";

export interface EntradaResolucaoTenant {
  readonly hostname: string;
  readonly searchParams: URLSearchParams;
  readonly cookies?: Record<string, string>;
}

export interface ResultadoResolucaoTenant {
  readonly tenant: ConfiguracaoTenant;
  readonly tenantId: string;
  readonly origemResolucao: "ambiente" | "query" | "subdominio" | "custom_domain" | "cookie" | "fallback";
  readonly headersDownstream: Record<string, string>;
}

/**
 * Sanitiza o parâmetro de tenant contra caracteres perigosos (XSS, Path Traversal, Injeção).
 */
export function sanitizarParametroTenant(valor: string | null): string | null {
  if (!valor) return null;
  const limpo = valor.trim().toLowerCase();
  // Permite apenas caracteres alfanuméricos e hífens seguros (a-z, 0-9, -)
  if (!/^[a-z0-9-]+$/.test(limpo)) {
    return null;
  }
  return limpo;
}

/**
 * Extrai o subdomínio a partir do host (ex: "carreiro.insightdireto.com.br" -> "carreiro").
 */
export function extrairSubdominioDeHost(host: string): string | null {
  if (!host) return null;

  // Remove a porta se houver (ex: "carreiro.localhost:3000" -> "carreiro.localhost")
  const hostSemPorta = host.split(":")[0].toLowerCase().trim();

  // Ignora se for IP puro
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostSemPorta)) {
    return null;
  }

  // 1. Domínios da plataforma. `insightdireto.com.br` é o canônico; os outros
  // dois seguem aceitos enquanto houver host apontado para eles.
  //
  // Domínio .vercel.app não entra aqui de propósito: lá não há subdomínio de
  // tenant, e a resolução acontece por TENANT_ATIVO (instalação dedicada) ou
  // por ?tenant= — ambos com precedência sobre o subdomínio.
  const DOMINIOS_PLATAFORMA = [
    ".insightdireto.com.br",
    ".insightd.com.br",
    ".insight-compras.com.br",
  ];
  if (DOMINIOS_PLATAFORMA.some((dominio) => hostSemPorta.endsWith(dominio))) {
    const partes = hostSemPorta.split(".");
    // ex: ["carreiro", "insightdireto", "com", "br"]
    if (partes.length >= 4) {
      const sub = partes[0];
      if (sub !== "www" && sub !== "app" && sub !== "api") {
        return sub;
      }
    }
  }

  // 2. Tratamento para localhost com subdomínio (ex: "carreiro.localhost")
  if (hostSemPorta.endsWith(".localhost")) {
    const partes = hostSemPorta.split(".");
    if (partes.length >= 2 && partes[0] !== "www") {
      return partes[0];
    }
  }

  return null;
}

/**
 * Executa a lógica de resolução de tenant e monta o mapa de cabeçalhos downstream.
 */
export function processarRequisicaoTenant(entrada: EntradaResolucaoTenant): ResultadoResolucaoTenant {
  const { hostname, searchParams, cookies } = entrada;

  /**
   * Ordem 0: instalação DEDICADA a um cliente (TENANT_ATIVO no ambiente).
   *
   * Aqui ela decide sozinha, e nem query nem cookie a demovem. Sem esta porta,
   * bastava alguém abrir uma vez `…/compras?tenant=demonstracao` para o
   * middleware gravar o cookie `x-tenant-id` — que vence a variável — e aquele
   * navegador ficava PRESO no outro tenant: nomes de loja sintéticos e paleta
   * errada sobre o estoque real do cliente, sem aviso e sem desfazer, a não ser
   * limpando cookies. Foi o que aconteceu numa verificação nossa.
   *
   * A troca por query e subdomínio continua valendo onde ela existe para servir:
   * a instalação MULTI-cliente, que não define TENANT_ATIVO.
   */
  const dedicado = process.env.TENANT_ATIVO?.trim();
  if (dedicado) {
    return montarResultado(resolverTenantConfigurado(), "ambiente");
  }

  // 1. Ordem 1: Query param explícito (?tenant=carreiro) para dev local, CI e Vercel Preview
  const tenantQuery = sanitizarParametroTenant(searchParams.get("tenant"));
  if (tenantQuery) {
    const tenant = obterConfiguracaoTenant(tenantQuery);
    return montarResultado(tenant, "query");
  }

  // 2. Ordem 2: Subdomínio no hostname (carreiro.insightdireto.com.br)
  const subdominio = extrairSubdominioDeHost(hostname);
  if (subdominio) {
    const tenant = obterConfiguracaoTenant(subdominio);
    return montarResultado(tenant, "subdominio");
  }

  // 3. Ordem 3: Custom Domain
  const hostSemPorta = hostname.split(":")[0].toLowerCase().trim();
  const tenantCustom = obterConfiguracaoTenant(hostSemPorta);
  if (tenantCustom && tenantCustom.customDomain && tenantCustom.customDomain.toLowerCase() === hostSemPorta) {
    return montarResultado(tenantCustom, "custom_domain");
  }

  // 4. Ordem 4: Cookie prévio x-tenant-id
  const cookieTenant = sanitizarParametroTenant(cookies?.["x-tenant-id"] ?? null);
  if (cookieTenant) {
    const tenant = obterConfiguracaoTenant(cookieTenant);
    return montarResultado(tenant, "cookie");
  }

  // 5. Ordem 5: Fallback padrão (DEMONSTRAÇÃO, nunca um cliente)
  return montarResultado(resolverTenantConfigurado(), "fallback");
}

function montarResultado(
  tenant: ConfiguracaoTenant,
  origem: ResultadoResolucaoTenant["origemResolucao"]
): ResultadoResolucaoTenant {
  return {
    tenant,
    tenantId: tenant.id,
    origemResolucao: origem,
    headersDownstream: {
      "x-tenant-id": tenant.id,
      "x-tenant-nome": encodeURIComponent(tenant.nome),
      "x-tenant-subdominio": tenant.subdominioPrincipal,
      "x-tenant-cor-primaria": tenant.cores.primaria,
      "x-tenant-cor-secundaria": tenant.cores.secundaria,
      "x-tenant-cor-fundo": tenant.cores.fundo,
      "x-tenant-cor-card": tenant.cores.card,
      "x-tenant-cor-destaque-multiplo": tenant.cores.fundoDestaqueMultiplo,
    },
  };
}

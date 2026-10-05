/**
 * Catálogo e Registro Central de Tenants White-Label
 * Camada: Configurações & White-Label (config/tenants/index.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { ConfiguracaoTenant } from "./tipos";
import { TENANT_CARREIRO } from "./carreiro";
import { TENANT_DEMONSTRACAO } from "./demonstracao";
import { ErroTenant, ehAmbienteProducao } from "./erros";
import { validarConfiguracaoTenant } from "./esquema";

export * from "./tipos";
export * from "./erros";
export * from "./esquema";
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
 * Busca a configuração de tenant por identificador (id, slug, subdomínio ou
 * custom domain). Devolve `null` quando não existe — sem cair na demonstração.
 */
export function buscarConfiguracaoTenant(
  identificador?: string | null
): ConfiguracaoTenant | null {
  if (!identificador) return null;

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

  return null;
}

/**
 * Resolve a configuração de tenant a partir de um identificador.
 *
 * Identificador desconhecido é ERRO em produção (ADR-0001): um subdomínio
 * digitado errado abrindo a demonstração parece um cliente funcionando, e
 * ninguém percebe que está olhando dado sintético. Fora de produção, abre a
 * demonstração com aviso, que é o que serve para desenvolver.
 */
export function obterConfiguracaoTenant(identificador?: string | null): ConfiguracaoTenant {
  if (!identificador) {
    if (ehAmbienteProducao()) {
      throw new ErroTenant(
        "nao_configurado",
        "nenhum cliente informado na requisição e nenhum TENANT_ATIVO configurado"
      );
    }
    return TENANT_PADRAO;
  }

  const encontrado = buscarConfiguracaoTenant(identificador);
  if (encontrado) return encontrado;

  if (ehAmbienteProducao()) {
    throw new ErroTenant(
      "desconhecido",
      `cliente "${identificador}" não existe no catálogo`,
      identificador
    );
  }

  console.warn(`[tenant] "${identificador}" não existe no catálogo; usando a demonstração.`);
  return TENANT_PADRAO;
}

/**
 * Confere o cadastro de TODOS os tenants registrados.
 *
 * Roda na validação de ambiente (build e primeira requisição), não a cada
 * import: em Edge, validar duas configurações a cada requisição é custo sem
 * retorno, já que o cadastro é estático no bundle.
 */
export function validarCatalogoTenants(): readonly string[] {
  const problemas: string[] = [];
  for (const [chave, tenant] of Object.entries(CATALOGO_TENANTS)) {
    const { valido, erros } = validarConfiguracaoTenant(tenant);
    if (!valido) {
      problemas.push(...erros.map((erro) => `tenant "${chave}" → ${erro}`));
    }
  }
  return problemas;
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
 * Em PRODUÇÃO a variável é obrigatória e o nome precisa existir (ADR-0001):
 * a instalação é dedicada a um cliente, e sem ela sobrariam os caminhos de
 * resolução por URL — que foi por onde o vazamento entre tenants entrava.
 * Fora de produção, a ausência abre a demonstração, que é o modo de trabalho.
 */
export function resolverTenantConfigurado(): ConfiguracaoTenant {
  const desejado = process.env.TENANT_ATIVO?.trim().toLowerCase();

  if (!desejado) {
    if (ehAmbienteProducao()) {
      throw new ErroTenant(
        "nao_configurado",
        "TENANT_ATIVO é obrigatório em produção: cada instalação atende um cliente"
      );
    }
    return TENANT_PADRAO;
  }

  const encontrado = CATALOGO_TENANTS[desejado];
  if (!encontrado) {
    if (ehAmbienteProducao()) {
      throw new ErroTenant(
        "desconhecido",
        `TENANT_ATIVO="${desejado}" não existe no catálogo`,
        desejado
      );
    }
    console.warn(
      `[tenant] TENANT_ATIVO="${desejado}" não existe no catálogo; usando o modo demonstração.`
    );
    return TENANT_PADRAO;
  }
  return encontrado;
}

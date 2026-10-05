/**
 * Validação de Ambiente da Instalação
 * Camada: Aplicação (src/lib/ambiente)
 * 100% em Português do Brasil (pt-BR).
 *
 * Confere, de uma vez, se ESTA instalação tem o que o cliente dela exige.
 * Antes cada subsistema escolhia o provedor pelo que por acaso estivesse no
 * ambiente: dava para subir um cliente real com login de demonstração, pedidos
 * guardados só em memória e a fonte caindo em dados sintéticos — tudo em
 * silêncio, tudo parecendo funcionar.
 *
 * Roda no build de produção (falha o deploy) e na primeira requisição.
 */

import {
  ConfiguracaoTenant,
  ErroTenant,
  ehAmbienteProducao,
  naturezaTenant,
  resolverTenantConfigurado,
  validarCatalogoTenants,
} from "@config/tenants";

export interface ResultadoValidacaoAmbiente {
  readonly ok: boolean;
  readonly tenantId: string | null;
  /** Impede a instalação de operar. */
  readonly problemas: readonly string[];
  /** Não impede, mas alguém precisa saber. */
  readonly avisos: readonly string[];
}

const VARIAVEIS_FONTE_POWERBI = [
  "POWERBI_WORKSPACE_ID",
  "POWERBI_DATASET_ID",
  "POWERBI_TENANT_ID",
  "POWERBI_CLIENT_ID",
  "POWERBI_CLIENT_SECRET",
] as const;

function vazia(nome: string): boolean {
  return !process.env[nome]?.trim();
}

export function validarAmbiente(): ResultadoValidacaoAmbiente {
  const problemas: string[] = [];
  const avisos: string[] = [];

  // 1. O cadastro dos clientes precisa estar íntegro.
  problemas.push(...validarCatalogoTenants());

  // 2. Qual cliente esta instalação atende.
  let tenant: ConfiguracaoTenant | null = null;
  try {
    tenant = resolverTenantConfigurado();
  } catch (erro) {
    if (erro instanceof ErroTenant) {
      problemas.push(`TENANT_ATIVO: ${erro.message}`);
    } else {
      throw erro;
    }
  }

  if (!tenant) {
    return { ok: problemas.length === 0, tenantId: null, problemas, avisos };
  }

  if (!process.env.TENANT_ATIVO?.trim()) {
    avisos.push(
      "TENANT_ATIVO não definido: fora de produção a instalação abre em demonstração."
    );
  }

  // 3. Exigências por natureza do cliente.
  if (naturezaTenant(tenant) === "real") {
    if (tenant.fonte.adaptador === "powerbi-dax") {
      const faltando = VARIAVEIS_FONTE_POWERBI.filter(vazia);
      if (faltando.length > 0) {
        problemas.push(
          `fonte de dados de "${tenant.id}" sem credenciais: ${faltando.join(", ")}`
        );
      }
    }

    for (const variavel of ["SUPABASE_URL", "SUPABASE_ANON_KEY"]) {
      if (vazia(variavel)) {
        problemas.push(`cliente real exige ${variavel}`);
      }
    }

    /**
     * AUTH_SECRET NÃO é exigido aqui: ele só assina as sessões do provedor de
     * DEMONSTRAÇÃO, que cliente real não pode usar (AUTH_PROVIDER=demo é
     * bloqueado logo abaixo, e o login demo recusa tenant real). Cliente real
     * entra pelo Supabase, que tem a própria assinatura. A primeira versão
     * exigia a variável e, com isso, travava a instalação do cliente por uma
     * chave que ela nunca usa.
     */

    /**
     * Chaves que ligam dado ou provedor sintético não podem existir numa
     * instalação de cliente. Cada uma delas já foi, sozinha, capaz de fazer a
     * plataforma servir número inventado ou aceitar login de demonstração.
     */
    if (process.env.USE_MOCK_ADAPTER === "true") {
      problemas.push("USE_MOCK_ADAPTER=true é proibido em instalação de cliente real");
    }
    if (process.env.AUTH_PROVIDER?.trim().toLowerCase() === "demo") {
      problemas.push("AUTH_PROVIDER=demo é proibido em instalação de cliente real");
    }
    for (const variavel of ["PEDIDOS_PROVIDER", "AUDITORIA_PROVIDER", "APRENDIZADO_PROVIDER"]) {
      const valor = process.env[variavel]?.trim().toLowerCase();
      if (valor === "memoria" || valor === "memory") {
        problemas.push(`${variavel}=${valor} descarta dado do cliente ao reiniciar`);
      }
    }
    if (process.env.CARREIRO_PREFERIR_SNAPSHOT === "true" && ehAmbienteProducao()) {
      problemas.push("CARREIRO_PREFERIR_SNAPSHOT=true serviria um retrato antigo em produção");
    }
  }

  // 4. Apresentação publicada sem segredo de sessão próprio.
  if (naturezaTenant(tenant) === "sintetica" && ehAmbienteProducao() && vazia("AUTH_SECRET")) {
    avisos.push(
      "AUTH_SECRET não definido: as sessões da demonstração usam o segredo de " +
        "desenvolvimento e podem ser forjadas. Só há dado sintético aqui, mas " +
        "defina um segredo próprio."
    );
  }

  return { ok: problemas.length === 0, tenantId: tenant.id, problemas, avisos };
}

let resultadoMemorizado: ResultadoValidacaoAmbiente | null = null;

/** Valida uma vez por processo (usado na primeira requisição). */
export function validarAmbienteUmaVez(): ResultadoValidacaoAmbiente {
  if (!resultadoMemorizado) {
    resultadoMemorizado = validarAmbiente();
    for (const aviso of resultadoMemorizado.avisos) {
      console.warn(`[ambiente] ${aviso}`);
    }
    for (const problema of resultadoMemorizado.problemas) {
      console.error(`[ambiente] ${problema}`);
    }
  }
  return resultadoMemorizado;
}

/** Só para testes: esquece o resultado memorizado. */
export function limparCacheValidacaoAmbiente(): void {
  resultadoMemorizado = null;
}

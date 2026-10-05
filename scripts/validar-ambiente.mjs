/**
 * Validação de ambiente no BUILD.
 *
 * Falha apenas no build de PRODUÇÃO da Vercel (VERCEL_ENV=production). Preview
 * e build local continuam passando, com os problemas impressos: um cliente não
 * pode ir ao ar sem credencial, mas ninguém precisa de credencial de produção
 * para compilar na própria máquina.
 *
 * Roda com tsx/esbuild-register? Não: para não depender de toolchain extra, a
 * checagem é reimplementada aqui em JS puro, espelhando
 * src/lib/ambiente/validacao-ambiente.ts. O teste
 * tests/ambiente/validacao-ambiente.test.ts cobre a versão TypeScript, e este
 * script é conferido por tests/ambiente/script-build.test.ts.
 */

const ehProducao = process.env.VERCEL_ENV === "production";

const VARIAVEIS_FONTE_POWERBI = [
  "POWERBI_WORKSPACE_ID",
  "POWERBI_DATASET_ID",
  "POWERBI_TENANT_ID",
  "POWERBI_CLIENT_ID",
  "POWERBI_CLIENT_SECRET",
];

const SUPABASE = ["SUPABASE_URL", "SUPABASE_ANON_KEY"];

/** Tenants com fonte real. Mantido junto ao cadastro em config/tenants. */
const TENANTS_REAIS = new Set(["carreiro"]);

function vazia(nome) {
  return !String(process.env[nome] ?? "").trim();
}

const problemas = [];
const tenantAtivo = String(process.env.TENANT_ATIVO ?? "").trim().toLowerCase();

if (!tenantAtivo) {
  problemas.push("TENANT_ATIVO é obrigatório: cada instalação atende um cliente");
} else if (TENANTS_REAIS.has(tenantAtivo)) {
  const faltandoFonte = VARIAVEIS_FONTE_POWERBI.filter(vazia);
  if (faltandoFonte.length > 0) {
    problemas.push(`fonte de dados sem credenciais: ${faltandoFonte.join(", ")}`);
  }
  for (const variavel of SUPABASE) {
    if (vazia(variavel)) problemas.push(`cliente real exige ${variavel}`);
  }
  // AUTH_SECRET não entra: só assina sessão do login de DEMONSTRAÇÃO, que
  // cliente real não usa (ele entra pelo Supabase).
  if (process.env.USE_MOCK_ADAPTER === "true") {
    problemas.push("USE_MOCK_ADAPTER=true é proibido em instalação de cliente real");
  }
  if (String(process.env.AUTH_PROVIDER ?? "").toLowerCase() === "demo") {
    problemas.push("AUTH_PROVIDER=demo é proibido em instalação de cliente real");
  }
  if (process.env.CARREIRO_PREFERIR_SNAPSHOT === "true") {
    problemas.push("CARREIRO_PREFERIR_SNAPSHOT=true serviria um retrato antigo");
  }
}

if (problemas.length === 0) {
  console.log(`[ambiente] ok${tenantAtivo ? ` (cliente: ${tenantAtivo})` : ""}`);
  process.exit(0);
}

const cabecalho = ehProducao
  ? "[ambiente] build de PRODUÇÃO bloqueado:"
  : "[ambiente] problemas (build segue, pois não é produção):";
console.error(cabecalho);
for (const problema of problemas) console.error(`  - ${problema}`);

process.exit(ehProducao ? 1 : 0);

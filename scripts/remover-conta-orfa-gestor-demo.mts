/**
 * Script de expurgo da conta órfã gestor.demo.
 *
 * Remove a conta legada "gestor.demo" criada antes da migração para login por usuário.
 *
 * Uso:
 *   npx tsx scripts/remover-conta-orfa-gestor-demo.mts
 */
import fs from "node:fs";

if (fs.existsSync(".env.local")) {
  const env = fs.readFileSync(".env.local", "utf8").replace(/^\uFEFF/, "");
  for (const linha of env.split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

const { obterProvedorAutenticacao } = await import("../src/lib/autenticacao/index.ts");
const provedor = obterProvedorAutenticacao();

console.log(`[expurgo] Verificando contas no provedor "${provedor.id}"...`);

if (provedor.id === "supabase") {
  const { ProvedorAutenticacaoSupabase } = await import("../src/lib/autenticacao/provedores/supabase.ts");
  const supabase = provedor as unknown as ProvedorAutenticacaoSupabase;
  const resultado = await supabase.expurgarContaOrfaGestorDemo();
  console.log(`[expurgo] Concluído: ${resultado.removidos} conta(s) órfã(s) removida(s).`);
} else {
  console.log("[expurgo] Modo demo: conta órfã gestor.demo não existe no catálogo de demonstração.");
}

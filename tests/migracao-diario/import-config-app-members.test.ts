import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260921230908_diario_app_identity.sql",
  "utf8"
);
const script = readFileSync("scripts/migracao-diario/import-config.mjs", "utf8");

describe("importador do Diário com identidade app-scoped", () => {
  it("resolve usuário legado somente em app_members do Diário", () => {
    expect(migration).toMatch(
      /join public\.app_members[\s\S]*m\.app_id = 'diario'/i
    );
    expect(migration).not.toContain("p_mapa_usuarios");
    expect(migration).not.toMatch(
      /importar_configuracoes_diario[\s\S]*references public\.tenant_members/i
    );
  });

  it("remove o mapa histórico de admin e valmir do CLI", () => {
    expect(script).not.toContain("MIGRACAO_USUARIO_MAP_JSON");
    expect(script).not.toContain("p_mapa_usuarios");
    expect(script).toContain("p_manifesto");
    expect(script).toContain("MIGRACAO_TENANT_ID");
  });

  it("mantém RPC de duas entradas restrita ao service_role", () => {
    expect(migration).toMatch(
      /function public\.importar_configuracoes_diario\(\s*p_tenant_id text,\s*p_manifesto jsonb\s*\)/i
    );
    expect(migration).toMatch(
      /grant execute on function public\.importar_configuracoes_diario\(text, jsonb\)\s+to service_role/i
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.importar_configuracoes_diario\(text, jsonb\)\s+to (?:anon|authenticated)/i
    );
  });
});

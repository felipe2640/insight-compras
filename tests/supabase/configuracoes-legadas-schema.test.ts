import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migracao = readFileSync(
  "supabase/migrations/202609210003_configuracoes_legadas_tenant.sql",
  "utf8"
);
const correcaoApp = readFileSync(
  "supabase/migrations/20260921230908_diario_app_identity.sql",
  "utf8"
);

describe("schema tenant-scoped das configurações do Diário", () => {
  const tabelas = [
    "fornecedor_grupo",
    "usuario_grupo",
    "secao_multiplo_compra",
    "margem_alvo",
  ];

  it.each(tabelas)("%s habilita RLS", (tabela) => {
    expect(migracao).toContain(`alter table public.${tabela} enable row level security`);
  });

  it("a correção final vincula usuários e grupos pelo mesmo tenant e app", () => {
    expect(correcaoApp).toMatch(
      /foreign key \(tenant_id, app_id, user_id\)[\s\S]*references public\.app_members \(tenant_id, app_id, user_id\)/
    );
    expect(correcaoApp).toMatch(
      /foreign key \(tenant_id, app_id, grupo_id\)[\s\S]*references public\.fornecedor_grupo \(tenant_id, app_id, id\)/
    );
  });

  it("escritas exigem gestor do app e anon não recebe grants", () => {
    expect(correcaoApp.match(/private\.is_app_manager\(tenant_id, app_id\)/g)?.length).toBeGreaterThanOrEqual(12);
    expect(correcaoApp).toMatch(/revoke all[\s\S]*from anon, authenticated/);
    expect(correcaoApp).not.toMatch(/grant [^;]+ to anon/);
  });

  it("mantém o identificador legado apenas como rastreabilidade", () => {
    expect(migracao).toContain("legacy_user_ref text");
    expect(migracao).toContain("user_id uuid not null");
  });
});

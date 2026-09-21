import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migracao = readFileSync(
  "supabase/migrations/202609210003_configuracoes_legadas_tenant.sql",
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

  it("vínculos referenciam membro e grupo pelo mesmo tenant", () => {
    expect(migracao).toMatch(
      /foreign key \(tenant_id, user_id\)[\s\S]*references public\.tenant_members \(tenant_id, user_id\)/
    );
    expect(migracao).toMatch(
      /foreign key \(tenant_id, grupo_id\)[\s\S]*references public\.fornecedor_grupo \(tenant_id, id\)/
    );
  });

  it("escritas exigem papel de gestor e anon não recebe grants", () => {
    expect(migracao.match(/public\.is_tenant_manager\(tenant_id\)/g)?.length).toBeGreaterThanOrEqual(12);
    expect(migracao).toMatch(/revoke all[\s\S]*from anon, authenticated/);
    expect(migracao).not.toMatch(/grant [^;]+ to anon/);
  });

  it("mantém o identificador legado apenas como rastreabilidade", () => {
    expect(migracao).toContain("legacy_user_ref text");
    expect(migracao).toContain("user_id uuid not null");
  });
});

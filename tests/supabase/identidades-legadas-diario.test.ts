import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/202609210005_identidades_legadas_diario.sql", import.meta.url),
  "utf8",
);
const rollback = readFileSync(
  new URL(
    "../../supabase/migrations/202609210005_identidades_legadas_diario.rollback.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("identidades legadas do Diário", () => {
  it("não armazena senhas e referencia membros do mesmo tenant", () => {
    const tabela = migration.match(/create table public\.legacy_identity_map \(([\s\S]*?)\n\);/)?.[1];
    expect(tabela).toBeTruthy();
    expect(tabela).not.toMatch(/^\s*(password|senha)\s/mi);
    expect(migration).toContain("foreign key (tenant_id, user_id)");
    expect(migration).toContain("references public.tenant_members (tenant_id, user_id)");
  });

  it("mantém tabela e RPCs fora do acesso operacional", () => {
    expect(migration).toMatch(/revoke all on public\.legacy_identity_map from public, anon, authenticated/);
    expect(migration).toMatch(/revoke all on function public\.vincular_identidades_diario[\s\S]+from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function public\.vincular_identidades_diario[\s\S]+to service_role/);
    expect(migration.match(/security definer/g)).toHaveLength(2);
    expect(migration.match(/set search_path = ''/g)).toHaveLength(2);
  });

  it("preserva e restaura os UUIDs anteriores", () => {
    expect(migration).toContain("previous_user_id uuid");
    expect(migration).toContain("previous_migration_batch_id uuid");
    expect(migration).toContain("set user_id = mapa.previous_user_id");
    expect(rollback).toContain("set user_id = mapa.previous_user_id");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260921230908_diario_app_identity.sql",
  "utf8"
);

describe("identidade app-scoped do Diário", () => {
  it("separa app_members de tenant_members", () => {
    expect(sql).toMatch(/create table(?: if not exists)? public\.app_members/i);
    expect(sql).toMatch(/primary key \(tenant_id, app_id, user_id\)/i);
    expect(sql).toMatch(/references auth\.users\s*\(id\)/i);
  });

  it("restringe as tabelas do Diário por tenant e aplicação", () => {
    for (const table of [
      "fornecedor_grupo",
      "usuario_grupo",
      "secao_multiplo_compra",
      "margem_alvo",
      "diario_lojas",
    ]) {
      expect(sql).toContain(`public.${table}`);
    }
    expect(sql).toMatch(/is_app_member\(tenant_id, app_id\)/g);
    expect(sql).not.toMatch(/grant [^;]+ to anon/i);
  });

  it("usuario_grupo referencia app_members e grupo pelo mesmo escopo", () => {
    expect(sql).toMatch(
      /foreign key \(tenant_id, app_id, user_id\)[\s\S]*references public\.app_members/i
    );
    expect(sql).toMatch(
      /foreign key \(tenant_id, app_id, grupo_id\)[\s\S]*references public\.fornecedor_grupo/i
    );
  });

  it("protege helpers privilegiados e indexa o escopo RLS", () => {
    expect(sql).toMatch(/create schema if not exists private/i);
    expect(sql).toMatch(/security definer[\s\S]*set search_path = ''/i);
    expect(sql).toMatch(/revoke all on function private\.is_app_member/i);
    expect(sql).toMatch(
      /grant execute on function private\.is_app_member\(text, text\) to authenticated/i
    );
    expect(sql).not.toMatch(
      /grant execute on function private\.is_app_member\(text, text\) to anon/i
    );
    expect(sql).toMatch(/create index[\s\S]*app_members[\s\S]*tenant_id, app_id, user_id/i);
  });

  it("runbook mantém o banco antigo até o aceite final", () => {
    const runbook = readFileSync("docs/migracao-diario/02-cutover-final.md", "utf8");
    expect(runbook).toMatch(/não excluir/i);
    expect(runbook).toContain("DIARIO_AUTH_BACKEND=supabase");
    expect(runbook).toContain("1 fornecedor_grupo");
    expect(runbook).toContain("2 usuario_grupo");
    expect(runbook).toContain("96 secao_multiplo_compra");
    expect(runbook).toContain("1 margem_alvo");
    expect(runbook).toContain("previsao-ia-diaria.yml");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260923171321_runtime_rls_tenant_app.sql", "utf8");
const diarioRead = readFileSync("supabase/migrations/20260923171249_diario_read_aprendizado.sql", "utf8");

describe("RLS do runtime e migração repetível", () => {
  it("limita a auditoria ao comprador autenticado do próprio tenant", () => {
    expect(migration).toMatch(/auditoria_pedido_insert_own_tenant/);
    expect(migration).toMatch(/is_tenant_member\(tenant_id\)/);
    expect(migration).toMatch(/comprador_id = \(select auth\.uid\(\)\)::text/);
    expect(migration).not.toMatch(/grant [^;]+ to anon/i);
  });

  it("JWT do Diário não vira membro do Insight por vínculo acidental", () => {
    expect(migration).toMatch(/app_metadata' ->> 'app_id'/);
    expect(migration).toMatch(/= 'insight-compras'/);
  });

  it("políticas de leitura do Diário podem ser reaplicadas com segurança", () => {
    for (const table of ["snapshot", "item", "feedback", "confirmacao"]) {
      expect(diarioRead).toContain(`drop policy if exists aprendizado_${table}_select_diario`);
      expect(diarioRead).toContain(`create policy aprendizado_${table}_select_diario`);
    }
    expect(diarioRead).not.toMatch(/for insert|for update|for delete/i);
  });
});

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validarManifesto } from "../../scripts/migracao-diario/import-config.mjs";

function manifestoValido(tenantId = "carreiro") {
  const base = {
    schemaVersion: 1,
    origem: "diario",
    destino: "insight-compras",
    tenantId,
    exportadoEm: "2026-09-21T00:00:00.000Z",
    somenteConfiguracoes: true,
    classificacao: {},
    contagens: {},
    dados: {
      fornecedor_grupo: [],
      usuario_grupo: [],
      secao_multiplo_compra: [],
      margem_alvo: [],
    },
  };
  return {
    ...base,
    integridade: {
      algoritmo: "sha256",
      checksum: createHash("sha256").update(JSON.stringify(base)).digest("hex"),
    },
  };
}

describe("importação das configurações do Diário", () => {
  it("aceita manifesto íntegro para qualquer tenant configurado", () => {
    expect(validarManifesto(manifestoValido()).tenantId).toBe("carreiro");
    expect(validarManifesto(manifestoValido("novo_cliente")).tenantId).toBe("novo_cliente");
    const adulterado = manifestoValido();
    (adulterado.dados.margem_alvo as Array<{ id: number }>).push({ id: 1 });
    expect(() => validarManifesto(adulterado)).toThrow(/Checksum/);
  });

  it("mantém as RPCs privilegiadas e o rollback limitado ao lote", () => {
    const sql = readFileSync(
      new URL("../../supabase/migrations/20260921230908_diario_app_identity.sql", import.meta.url),
      "utf8",
    );
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toMatch(/revoke all on function public\.importar_configuracoes_diario[\s\S]+from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.importar_configuracoes_diario[\s\S]+to service_role/);
    expect(sql.match(/migration_batch_id = p_batch_id/g)).toHaveLength(4);
  });
});

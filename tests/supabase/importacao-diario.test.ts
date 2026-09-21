import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// O script operacional permanece em JavaScript ESM para execução direta pelo Node.
// @ts-expect-error O módulo não publica declarações TypeScript.
import { validarManifesto, validarMapaUsuarios } from "../../scripts/migracao-diario/import-config.mjs";

function manifestoValido() {
  const base = {
    schemaVersion: 1,
    origem: "diario",
    destino: "insight-compras",
    tenantId: "carreiro",
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
  it("aceita apenas manifesto íntegro do tenant Carreiro", () => {
    expect(validarManifesto(manifestoValido()).tenantId).toBe("carreiro");
    const adulterado = manifestoValido();
    adulterado.dados.margem_alvo.push({ id: 1 });
    expect(() => validarManifesto(adulterado)).toThrow(/Checksum/);
  });

  it("exige mapeamento distinto e completo para 2 e 5", () => {
    const mapa = validarMapaUsuarios(JSON.stringify({
      "2": "11111111-1111-4111-8111-111111111111",
      "5": "22222222-2222-4222-8222-222222222222",
    }));
    expect(Object.keys(mapa).sort()).toEqual(["2", "5"]);
    expect(() => validarMapaUsuarios(JSON.stringify({ "2": mapa["2"] }))).toThrow(/exatamente/);
    expect(() => validarMapaUsuarios(JSON.stringify({ "2": mapa["2"], "5": mapa["2"] }))).toThrow(/mesmo UUID/);
  });

  it("mantém as RPCs privilegiadas e o rollback limitado ao lote", () => {
    const sql = readFileSync(
      new URL("../../supabase/migrations/202609210004_importacao_config_diario.sql", import.meta.url),
      "utf8",
    );
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toMatch(/revoke all on function public\.importar_configuracoes_diario[\s\S]+from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.importar_configuracoes_diario[\s\S]+to service_role/);
    expect(sql.match(/migration_batch_id = p_batch_id/g)).toHaveLength(4);
  });
});

import "server-only";

import type { ConfiguracaoLotesTenant } from "@config/tenants/tipos";
import { sbSelecionar, sbUpsert, supabaseConfigurado } from "@/lib/aprendizado/supabase";

const TABELA = "configuracao_lotes";
const memoria = new Map<string, ConfiguracaoLotesTenant>();

interface LinhaConfiguracaoLotes {
  usar_erp: boolean;
  usar_historico: boolean;
  usar_vocabulario: boolean;
  multiplos_por_sku: Record<string, number> | null;
}

export async function carregarConfiguracaoLotes(
  tenantId: string,
  padrao: ConfiguracaoLotesTenant
): Promise<ConfiguracaoLotesTenant> {
  if (supabaseConfigurado()) {
    try {
      const linhas = await sbSelecionar<LinhaConfiguracaoLotes>(
        TABELA,
        `select=usar_erp,usar_historico,usar_vocabulario,multiplos_por_sku&tenant_id=eq.${encodeURIComponent(tenantId)}&limit=1`
      );
      const linha = linhas[0];
      if (linha) {
        return {
          usarErp: linha.usar_erp,
          usarHistorico: linha.usar_historico,
          usarVocabulario: linha.usar_vocabulario,
          multiplosPorSku: linha.multiplos_por_sku ?? {},
        };
      }
    } catch (erro) {
      console.warn("[configuração/lotes] falha ao carregar do Supabase; usando fallback:", erro);
    }
  }
  return memoria.get(tenantId) ?? padrao;
}

export async function salvarConfiguracaoLotes(
  tenantId: string,
  configuracao: ConfiguracaoLotesTenant,
  usuario: string | null
): Promise<void> {
  if (supabaseConfigurado()) {
    await sbUpsert(TABELA, "tenant_id", {
      tenant_id: tenantId,
      usar_erp: configuracao.usarErp,
      usar_historico: configuracao.usarHistorico,
      usar_vocabulario: configuracao.usarVocabulario,
      multiplos_por_sku: configuracao.multiplosPorSku,
      atualizado_por: usuario,
      updated_at: new Date().toISOString(),
    });
  }
  memoria.set(tenantId, configuracao);
}

export function validarConfiguracaoLotes(valor: unknown): ConfiguracaoLotesTenant {
  if (!valor || typeof valor !== "object") throw new Error("Configuração inválida.");
  const v = valor as Record<string, unknown>;
  if ([v.usarErp, v.usarHistorico, v.usarVocabulario].some((x) => typeof x !== "boolean")) {
    throw new Error("As fontes de múltiplo devem estar habilitadas ou desabilitadas.");
  }
  const bruto = v.multiplosPorSku;
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) {
    throw new Error("A lista de exceções por SKU é inválida.");
  }
  const multiplosPorSku: Record<string, number> = {};
  for (const [skuBruto, multiploBruto] of Object.entries(bruto as Record<string, unknown>)) {
    const sku = skuBruto.trim();
    const multiplo = Number(multiploBruto);
    if (!sku || !Number.isInteger(multiplo) || multiplo < 1 || multiplo > 999) {
      throw new Error(`Exceção inválida para o SKU "${skuBruto}".`);
    }
    multiplosPorSku[sku] = multiplo;
  }
  return {
    usarErp: v.usarErp as boolean,
    usarHistorico: v.usarHistorico as boolean,
    usarVocabulario: v.usarVocabulario as boolean,
    multiplosPorSku,
  };
}

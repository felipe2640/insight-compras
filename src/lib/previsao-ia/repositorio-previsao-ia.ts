/**
 * Repositório de Previsões de Demanda por Inteligência Artificial
 * Camada: Aplicação / Previsão IA (src/lib/previsao-ia)
 * 100% em Português do Brasil (pt-BR).
 *
 * Lê as projeções probabilísticas de demanda (p50, p80) geradas pelo
 * modelo campeão (Chronos-Bolt) e publicadas na tabela `demanda_ia_previsao` do Supabase.
 */

export interface PrevisaoDemandaIaItem {
  readonly filialId: number;
  readonly produtoId: number;
  readonly sku: string;
  readonly previsaoCentral: number;
  readonly demandaP50: number;
  readonly demandaP80: number;
  readonly modeloUtilizado: string;
  readonly dataPrevisao: string;
}

interface LinhaPrevisaoDb {
  filial_id: number;
  produto_id: number;
  sku: string;
  previsao_central: number;
  demanda_p50: number;
  demanda_p80: number;
  modelo_utilizado: string;
  data_previsao: string;
}

/**
 * Carrega o mapa de previsões de demanda por IA indexado por `${produtoId}:${filialId}`.
 * Resiliente: se o Supabase não estiver configurado ou a tabela não existir,
 * retorna um mapa vazio sem quebrar a renderização do cockpit.
 */
export async function carregarMapaPrevisoesIa(
  tenantId: string,
  filialId?: number
): Promise<Map<string, PrevisaoDemandaIaItem>> {
  const mapa = new Map<string, PrevisaoDemandaIaItem>();

  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !chave) {
    return mapa;
  }

  try {
    let consulta = `select=filial_id,produto_id,sku,previsao_central,demanda_p50,demanda_p80,modelo_utilizado,data_previsao&tenant_id=eq.${encodeURIComponent(tenantId)}`;
    if (filialId !== undefined && filialId !== null) {
      consulta += `&filial_id=eq.${filialId}`;
    }

    const res = await fetch(`${url}/rest/v1/demanda_ia_previsao?${consulta}`, {
      method: "GET",
      headers: {
        apikey: chave,
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      // Tabela ainda não criada ou sem permissão: fallback gracioso para baseline
      return mapa;
    }

    const linhas = (await res.json()) as LinhaPrevisaoDb[];
    if (Array.isArray(linhas)) {
      for (const l of linhas) {
        const item: PrevisaoDemandaIaItem = {
          filialId: Number(l.filial_id),
          produtoId: Number(l.produto_id),
          sku: String(l.sku ?? ""),
          previsaoCentral: Number(l.previsao_central ?? 0),
          demandaP50: Number(l.demanda_p50 ?? 0),
          demandaP80: Number(l.demanda_p80 ?? 0),
          modeloUtilizado: String(l.modelo_utilizado ?? "IA"),
          dataPrevisao: String(l.data_previsao ?? ""),
        };
        const chave = `${item.produtoId}:${item.filialId}`;
        mapa.set(chave, item);
      }
    }
  } catch (erro) {
    // Falha de rede ou PostgREST não interrompe a operação do cockpit
    console.warn("[PrevisaoIA] Aviso ao carregar projeções do Supabase:", erro);
  }

  return mapa;
}

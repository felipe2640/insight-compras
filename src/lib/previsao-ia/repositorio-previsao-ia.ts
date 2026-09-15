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

interface CachePrevisoesIa {
  carregadoEm: number;
  mapa: Map<string, PrevisaoDemandaIaItem>;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos de TTL em memória
const cachePrevisoes = new Map<string, CachePrevisoesIa>();

/**
 * Limpa o cache em memória (usado em testes ou após reprocessamento do pipeline).
 */
export function limparCachePrevisoesIa(): void {
  cachePrevisoes.clear();
}

/**
 * Carrega o mapa de previsões de demanda por IA indexado por `${produtoId}:${filialId}`.
 * Resiliente: se o Supabase não estiver configurado ou a tabela não existir,
 * retorna um mapa vazio sem quebrar a renderização do cockpit.
 *
 * Implementa paginação transparente de 1.000 em 1.000 linhas para contornar
 * o limite padrão do PostgREST e carregar o catálogo completo de previsões.
 */
export async function carregarMapaPrevisoesIa(
  tenantId: string,
  filialId?: number
): Promise<Map<string, PrevisaoDemandaIaItem>> {
  const chaveCache = `${tenantId}:${filialId ?? "todas"}`;
  const emCache = cachePrevisoes.get(chaveCache);
  if (emCache && Date.now() - emCache.carregadoEm < CACHE_TTL_MS) {
    return emCache.mapa;
  }

  const mapa = new Map<string, PrevisaoDemandaIaItem>();

  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !chave) {
    return mapa;
  }

  try {
    let filtroBase = `tenant_id=eq.${encodeURIComponent(tenantId)}`;
    if (filialId !== undefined && filialId !== null) {
      filtroBase += `&filial_id=eq.${filialId}`;
    }

    const campos = "filial_id,produto_id,sku,previsao_central,demanda_p50,demanda_p80,modelo_utilizado,data_previsao";
    const tamanhoPagina = 1000;
    let offset = 0;
    let continuarPaginando = true;

    while (continuarPaginando) {
      const consulta = `select=${campos}&${filtroBase}&limit=${tamanhoPagina}&offset=${offset}&order=produto_id.asc,filial_id.asc`;

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
        break;
      }

      const linhas = (await res.json()) as LinhaPrevisaoDb[];
      if (!Array.isArray(linhas) || linhas.length === 0) {
        break;
      }

      for (const l of linhas) {
        const item: PrevisaoDemandaIaItem = {
          filialId: Number(l.filial_id),
          produtoId: Number(l.produto_id),
          sku: String(l.sku ?? ""),
          previsaoCentral: Number(l.previsao_central ?? 0),
          demandaP50: Number(l.demanda_p50 ?? 0),
          demandaP80: Number(l.demanda_p80 ?? 0),
          modeloUtilizado: String(l.modelo_utilizado ?? "Chronos-Bolt (Small)"),
          dataPrevisao: String(l.data_previsao ?? ""),
        };

        // Chave canônica primária: produtoId:filialId
        const chaveComposta = `${item.produtoId}:${item.filialId}`;
        mapa.set(chaveComposta, item);

        // Chave secundária por SKU: filialId se produtoId não bater
        if (item.sku) {
          mapa.set(`${item.sku}:${item.filialId}`, item);
        }

        // Chave fallback só por produtoId (caso filial não seja encontrada)
        if (!mapa.has(String(item.produtoId))) {
          mapa.set(String(item.produtoId), item);
        }
      }

      if (linhas.length < tamanhoPagina) {
        continuarPaginando = false;
      } else {
        offset += tamanhoPagina;
      }
    }

    if (mapa.size > 0) {
      cachePrevisoes.set(chaveCache, {
        carregadoEm: Date.now(),
        mapa,
      });
    }
  } catch (erro) {
    // Falha de rede ou PostgREST não interrompe a operação do cockpit
    console.warn("[PrevisaoIA] Aviso ao carregar projeções do Supabase:", erro);
  }

  return mapa;
}

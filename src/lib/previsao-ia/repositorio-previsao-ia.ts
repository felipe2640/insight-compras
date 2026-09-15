/**
 * Repositório de Previsões de Demanda por Inteligência Artificial
 * Camada: Aplicação / Previsão IA (src/lib/previsao-ia) — server-only.
 * 100% em Português do Brasil (pt-BR).
 *
 * Env (somente servidor):
 *   SUPABASE_URL=https://<projeto>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...   (a tabela não é exposta a anon/authenticated)
 *
 * Lê as projeções probabilísticas de demanda (p50, p80) geradas pelo
 * modelo campeão (Chronos-Bolt) e publicadas na tabela `demanda_ia_previsao` do Supabase.
 *
 * Duas regras não são opcionais nesta leitura:
 * 1. FRESCOR — o pipeline faz upsert por (tenant, filial, produto) e nunca apaga
 *    nada. Item que parou de vender sai do lote diário mas a linha antiga
 *    permanece; sem filtro de data o cockpit compraria contra demanda de meses
 *    atrás. Só entram projeções dentro da janela de validade.
 * 2. PAGINAÇÃO — o PostgREST corta a resposta no limite de linhas do projeto
 *    (1.000 por padrão no Supabase) devolvendo HTTP 200. Sem paginar, a maior
 *    parte da rede cairia em silêncio no baseline.
 */

/** Validade padrão de uma projeção, em dias. */
export const VALIDADE_PREVISAO_IA_DIAS = 3;

/** Tamanho da página na leitura do PostgREST. */
const TAMANHO_PAGINA = 1000;

/** Teto de segurança de páginas, para nunca virar laço infinito. */
const MAXIMO_PAGINAS = 200;

export interface PrevisaoDemandaIaItem {
  readonly filialId: number;
  readonly produtoId: number;
  readonly sku: string;
  readonly previsaoCentral: number;
  readonly demandaP50: number;
  readonly demandaP80: number;
  /** Horizonte, em dias, para o qual o modelo projetou a demanda. */
  readonly horizonteDias: number;
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
  horizonte_dias: number;
  modelo_utilizado: string;
  data_previsao: string;
}

const COLUNAS_SELECIONADAS = [
  "filial_id",
  "produto_id",
  "sku",
  "previsao_central",
  "demanda_p50",
  "demanda_p80",
  "horizonte_dias",
  "modelo_utilizado",
  "data_previsao",
].join(",");

/** Data mínima aceita (YYYY-MM-DD) para uma projeção ser considerada vigente. */
export function dataMinimaPrevisaoVigente(
  validadeDias = VALIDADE_PREVISAO_IA_DIAS,
  agora: Date = new Date()
): string {
  const limite = new Date(agora.getTime());
  limite.setUTCDate(limite.getUTCDate() - Math.max(0, validadeDias));
  return limite.toISOString().slice(0, 10);
}

export interface OpcoesCarregarPrevisoesIa {
  readonly filialId?: number;
  /** Dias de validade da projeção. Padrão: VALIDADE_PREVISAO_IA_DIAS. */
  readonly validadeDias?: number;
}

/**
 * Carrega o mapa de previsões de demanda por IA indexado por `${produtoId}:${filialId}`.
 * Resiliente: se o Supabase não estiver configurado ou a tabela não existir,
 * retorna um mapa vazio sem quebrar a renderização do cockpit.
 */
export async function carregarMapaPrevisoesIa(
  tenantId: string,
  opcoes: OpcoesCarregarPrevisoesIa = {}
): Promise<Map<string, PrevisaoDemandaIaItem>> {
  const mapa = new Map<string, PrevisaoDemandaIaItem>();

  const url = process.env.SUPABASE_URL;
  // Service role apenas, como no resto do projeto: `demanda_ia_previsao` não tem
  // grant para anon/authenticated, então a chave pública só renderia 401.
  const chaveApi = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !chaveApi) {
    return mapa;
  }

  const { filialId, validadeDias = VALIDADE_PREVISAO_IA_DIAS } = opcoes;

  try {
    const filtros = [
      `select=${COLUNAS_SELECIONADAS}`,
      `tenant_id=eq.${encodeURIComponent(tenantId)}`,
      `data_previsao=gte.${dataMinimaPrevisaoVigente(validadeDias)}`,
      // Ordem estável: sem ela a paginação por offset pode repetir ou pular linhas.
      "order=filial_id.asc,produto_id.asc",
    ];
    if (filialId !== undefined && filialId !== null) {
      filtros.push(`filial_id=eq.${filialId}`);
    }
    const consulta = filtros.join("&");

    for (let pagina = 0; pagina < MAXIMO_PAGINAS; pagina++) {
      const inicio = pagina * TAMANHO_PAGINA;
      const fim = inicio + TAMANHO_PAGINA - 1;

      const res = await fetch(`${url}/rest/v1/demanda_ia_previsao?${consulta}`, {
        method: "GET",
        headers: {
          apikey: chaveApi,
          Authorization: `Bearer ${chaveApi}`,
          // Range pagina do lado do servidor, respeitando o teto do projeto.
          Range: `${inicio}-${fim}`,
          "Range-Unit": "items",
        },
        cache: "no-store",
      });

      if (!res.ok) {
        // Tabela ainda não criada ou sem permissão: fallback gracioso para baseline.
        // 416 significa que o range passou do fim — nada mais a paginar.
        if (res.status !== 416 && mapa.size === 0) {
          console.warn(
            `[PrevisaoIA] Leitura interrompida (HTTP ${res.status}). Cockpit segue no baseline.`
          );
        }
        return mapa;
      }

      const linhas = (await res.json()) as LinhaPrevisaoDb[];
      if (!Array.isArray(linhas) || linhas.length === 0) {
        return mapa;
      }

      for (const l of linhas) {
        const item: PrevisaoDemandaIaItem = {
          filialId: Number(l.filial_id),
          produtoId: Number(l.produto_id),
          sku: String(l.sku ?? ""),
          previsaoCentral: Number(l.previsao_central ?? 0),
          demandaP50: Number(l.demanda_p50 ?? 0),
          demandaP80: Number(l.demanda_p80 ?? 0),
          horizonteDias: Number(l.horizonte_dias ?? 0),
          modeloUtilizado: String(l.modelo_utilizado ?? "IA"),
          dataPrevisao: String(l.data_previsao ?? ""),
        };
        mapa.set(`${item.produtoId}:${item.filialId}`, item);
      }

      // Página incompleta = última página.
      if (linhas.length < TAMANHO_PAGINA) {
        return mapa;
      }

      if (pagina === MAXIMO_PAGINAS - 1) {
        console.warn(
          `[PrevisaoIA] Teto de ${MAXIMO_PAGINAS} páginas atingido com ${mapa.size} projeções; ` +
            "podem existir linhas não lidas."
        );
      }
    }
  } catch (erro) {
    // Falha de rede ou PostgREST não interrompe a operação do cockpit
    console.warn("[PrevisaoIA] Aviso ao carregar projeções do Supabase:", erro);
  }

  return mapa;
}

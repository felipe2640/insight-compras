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
 * Três regras não são opcionais nesta leitura:
 * 1. PAGINAÇÃO — o PostgREST corta a resposta no limite de linhas do projeto
 *    (1.000 por padrão no Supabase) devolvendo HTTP 200. Sem paginar, a maior
 *    parte da rede cairia em silêncio no baseline.
 * 2. FRESCOR — o pipeline faz upsert por (tenant, filial, produto) e nunca apaga
 *    nada. Item que parou de vender sai do lote diário mas a linha antiga
 *    permanece; sem filtro de data o cockpit compraria contra demanda de meses
 *    atrás. Aqui aplicamos só o TETO de idade (VALIDADE_MAXIMA_DIAS), porque a
 *    validade real depende do que o item fez desde a projeção — e isso exige o
 *    histórico de venda, que vive na carga de inventário. A decisão por item
 *    está em `vigencia-previsao.ts`, aplicada pelo gerador da matriz.
 * 3. HORIZONTE — a projeção é um TOTAL de período (o pipeline publica 30 dias).
 *    `horizonte_dias` vem junto porque o motor precisa reescalar o número para o
 *    horizonte do perfil de giro do item (20/15/7 dias).
 */

import { VALIDADE_MAXIMA_DIAS } from "./vigencia-previsao";

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

interface CachePrevisoesIa {
  carregadoEm: number;
  mapa: Map<string, PrevisaoDemandaIaItem>;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos de TTL em memória
const cachePrevisoes = new Map<string, CachePrevisoesIa>();

const CAMPOS = [
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

/**
 * Limpa o cache em memória (usado em testes ou após reprocessamento do pipeline).
 */
export function limparCachePrevisoesIa(): void {
  cachePrevisoes.clear();
}

/**
 * Conta as projeções distintas no mapa.
 *
 * O mapa é indexado duas vezes por linha (`produtoId:filialId` e `sku:filialId`),
 * então `mapa.size` é o dobro do número de séries — use isto sempre que o número
 * for exibido ou registrado.
 */
export function contarProjecoesIa(mapa: ReadonlyMap<string, PrevisaoDemandaIaItem>): number {
  let total = 0;
  for (const [chave, item] of mapa) {
    if (chave === `${item.produtoId}:${item.filialId}`) total += 1;
  }
  return total;
}

/**
 * Rótulo honesto da origem das projeções carregadas.
 *
 * O campeão do benchmark pode ser a PRÓPRIA régua heurística — foi o que
 * aconteceu quando a eleição passou a ser por custo financeiro. Nesse caso o
 * pipeline republica a heurística recalculada em Python, e chamar isso de
 * "previsão probabilística" no cockpit seria falso: não há distribuição
 * nenhuma, é a mesma conta do motor analítico.
 *
 * Devolve null quando não há projeção utilizável.
 */
export function descreverOrigemPrevisoesIa(
  mapa: ReadonlyMap<string, PrevisaoDemandaIaItem>
): { readonly rotulo: string; readonly series: number } | null {
  const series = contarProjecoesIa(mapa);
  if (series === 0) return null;

  const contagemPorModelo = new Map<string, number>();
  for (const [chave, item] of mapa) {
    if (chave !== `${item.produtoId}:${item.filialId}`) continue;
    const nome = item.modeloUtilizado || "modelo não identificado";
    contagemPorModelo.set(nome, (contagemPorModelo.get(nome) ?? 0) + 1);
  }

  const [modeloDominante] = [...contagemPorModelo.entries()].sort((a, b) => b[1] - a[1])[0] ?? [
    "modelo não identificado",
  ];

  // A heurística não é distribuição: o rótulo diz o que ela é.
  const ehHeuristica = /baseline|heuris/i.test(modeloDominante);
  const rotulo = ehHeuristica
    ? `Régua analítica recalculada (${series} séries)`
    : `Previsão probabilística — ${modeloDominante} (${series} séries)`;

  return { rotulo, series };
}

/** Data mínima aceita (YYYY-MM-DD) para uma projeção ser considerada vigente. */
export function dataMinimaPrevisaoVigente(
  validadeDias = VALIDADE_MAXIMA_DIAS,
  agora: Date = new Date()
): string {
  const limite = new Date(agora.getTime());
  limite.setUTCDate(limite.getUTCDate() - Math.max(0, validadeDias));
  return limite.toISOString().slice(0, 10);
}

export interface OpcoesCarregarPrevisoesIa {
  /** Teto de idade das projeções lidas, em dias. Padrão: VALIDADE_MAXIMA_DIAS. */
  readonly validadeDias?: number;
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
  filialId?: number,
  opcoes: OpcoesCarregarPrevisoesIa = {}
): Promise<Map<string, PrevisaoDemandaIaItem>> {
  const { validadeDias = VALIDADE_MAXIMA_DIAS } = opcoes;

  const chaveCache = `${tenantId}:${filialId ?? "todas"}:${validadeDias}`;
  const emCache = cachePrevisoes.get(chaveCache);
  if (emCache && Date.now() - emCache.carregadoEm < CACHE_TTL_MS) {
    return emCache.mapa;
  }

  const mapa = new Map<string, PrevisaoDemandaIaItem>();

  const url = process.env.SUPABASE_URL;
  // Service role apenas, como no resto do projeto: `demanda_ia_previsao` não tem
  // grant para anon/authenticated, então a chave pública só renderia 401.
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !chave) {
    return mapa;
  }

  try {
    let filtroBase = `tenant_id=eq.${encodeURIComponent(tenantId)}`;
    if (filialId !== undefined && filialId !== null) {
      filtroBase += `&filial_id=eq.${filialId}`;
    }
    // Teto de idade: o pipeline nunca apaga linha antiga, e projeção de meses
    // atrás não deve nem sair do banco. A validade fina é por item, depois.
    filtroBase += `&data_previsao=gte.${dataMinimaPrevisaoVigente(validadeDias)}`;

    let offset = 0;
    let continuarPaginando = true;
    let pagina = 0;

    while (continuarPaginando && pagina < MAXIMO_PAGINAS) {
      // Ordem estável: sem ela a paginação por offset pode repetir ou pular linhas.
      const consulta = `select=${CAMPOS}&${filtroBase}&limit=${TAMANHO_PAGINA}&offset=${offset}&order=produto_id.asc,filial_id.asc`;

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
        if (mapa.size === 0) {
          console.warn(
            `[PrevisaoIA] Leitura interrompida (HTTP ${res.status}). Cockpit segue no baseline.`
          );
        }
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
          horizonteDias: Number(l.horizonte_dias ?? 0),
          modeloUtilizado: String(l.modelo_utilizado ?? "Chronos-Bolt (Small)"),
          dataPrevisao: String(l.data_previsao ?? ""),
        };

        // Chave canônica primária: produtoId:filialId
        mapa.set(`${item.produtoId}:${item.filialId}`, item);

        // Chave secundária por SKU, também amarrada à filial: serve quando o
        // cockpit conhece o item pelo código do ERP e não pelo id interno.
        //
        // NÃO existe chave só por produtoId: demanda é por loja. Uma projeção da
        // filial 1 respondendo pela filial 3 faria a loja comprar contra a
        // demanda da loja vizinha — melhor cair no motor analítico da própria loja.
        if (item.sku) {
          mapa.set(`${item.sku}:${item.filialId}`, item);
        }
      }

      if (linhas.length < TAMANHO_PAGINA) {
        continuarPaginando = false;
      } else {
        offset += TAMANHO_PAGINA;
        pagina += 1;
        if (pagina >= MAXIMO_PAGINAS) {
          console.warn(
            `[PrevisaoIA] Teto de ${MAXIMO_PAGINAS} páginas atingido com ${mapa.size} projeções; ` +
              "podem existir linhas não lidas."
          );
        }
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

/**
 * Harness de Teste E2E: Runner Opaque-Box e Medição de Performance
 * Camada: Test Harness Opaque-Box
 */

import { LinhaMatrizDecisaoE2E, UsuarioAutenticado } from "./contexto-teste";
import { SimulaLocalStorage } from "./mock-ambiente";
import { ajustarQuantidadePorLote } from "@core/travas/lote-multiplo";
import { RegistroAuditoriaPedido, TipoAcaoAuditoria } from "@core/dominio/auditoria";

export interface FiltrosCockpit {
  readonly queryBusca?: string;
  readonly marcasDesejadas?: ReadonlySet<string>;
  readonly secoesDesejadas?: ReadonlySet<string>;
  readonly apenasRuptura?: boolean;
}

export interface ResultadoBuscaFiltro {
  readonly itensFiltrados: readonly LinhaMatrizDecisaoE2E[];
  readonly totalLinhas: number;
  readonly tempoExecucaoMs: number;
}

/**
 * Executa o pipeline de busca textual tokenizada e filtros facetados em memória,
 * medindo a latência real de processamento em milissegundos.
 */
export function executarBuscaEFiltroEmMemoria(
  todosItens: readonly LinhaMatrizDecisaoE2E[],
  filtros: FiltrosCockpit,
  usuario?: UsuarioAutenticado
): ResultadoBuscaFiltro {
  const inicio = performance.now();

  const queryLimpa = filtros.queryBusca
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const tokens = queryLimpa ? queryLimpa.split(/\s+/).filter(Boolean) : [];

  const filtrados = todosItens.filter((item) => {
    // 1. RBAC Server-Side: Comprador só vê fornecedores autorizados
    if (usuario && usuario.role === "COMPRADOR") {
      if (!usuario.allowedSupplierIds.has(item.fornecedorId)) {
        return false;
      }
    }

    // 2. Filtros de Marca e Seção (O(1))
    if (filtros.marcasDesejadas && filtros.marcasDesejadas.size > 0) {
      if (!filtros.marcasDesejadas.has(item.marca)) return false;
    }

    if (filtros.secoesDesejadas && filtros.secoesDesejadas.size > 0) {
      if (!filtros.secoesDesejadas.has(item.nomeSecao)) return false;
    }

    // 3. Filtro de Ruptura
    if (filtros.apenasRuptura) {
      if (item.saldoEstoqueLojaFoco > 0) return false;
    }

    // 4. Busca Textual por múltiplos tokens
    if (tokens.length > 0) {
      for (let i = 0; i < tokens.length; i++) {
        if (!item._searchIndex.includes(tokens[i])) {
          return false;
        }
      }
    }

    return true;
  });

  const fim = performance.now();

  return {
    itensFiltrados: filtrados,
    totalLinhas: filtrados.length,
    tempoExecucaoMs: fim - inicio,
  };
}

/**
 * Simula o ajuste humano em célula editável de pedido com sanitização e múltiplos.
 */
export function executarAjusteHumanoPedido(
  entradaComprador: string | number,
  multiploLote: number,
  embalagemMinima: number = 1
): {
  quantidadeFinal: number;
  valido: boolean;
  ajustadoPorMultiplo: boolean;
  motivoAjuste: string | null;
} {
  // 1. Sanitização
  let valorNumerico: number;
  if (typeof entradaComprador === "string") {
    const limpo = entradaComprador.replace(/[^\d]/g, "");
    valorNumerico = limpo.length > 0 ? parseInt(limpo, 10) : 0;
  } else {
    valorNumerico = Number.isFinite(entradaComprador) ? Math.floor(entradaComprador) : 0;
  }

  if (valorNumerico <= 0) {
    return {
      quantidadeFinal: 0,
      valido: true,
      ajustadoPorMultiplo: false,
      motivoAjuste: null,
    };
  }

  const resultado = ajustarQuantidadePorLote({
    quantidadeDesejada: valorNumerico,
    multiploLote,
    embalagemMinima,
  });

  return {
    quantidadeFinal: resultado.quantidadeAjustada,
    valido: true,
    ajustadoPorMultiplo: resultado.quantidadeAjustada !== valorNumerico,
    motivoAjuste: resultado.motivoAjuste,
  };
}

export interface PayloadRascunhoSessao {
  readonly timestamp: number;
  readonly usuarioId: string;
  readonly tenantId: string;
  readonly lojaId: number;
  readonly ajustesComprador: Record<string, { pedir: number; transferir: number }>;
}

/**
 * Persiste o rascunho de sessão no storage isolado.
 */
export function salvarRascunhoSessao(
  storage: SimulaLocalStorage,
  rascunho: PayloadRascunhoSessao
): { sucesso: boolean; erroQuota: boolean } {
  const chave = `insight-compras-draft-${rascunho.usuarioId}`;
  try {
    storage.setItem(chave, JSON.stringify(rascunho));
    return { sucesso: true, erroQuota: false };
  } catch (erro: any) {
    if (erro?.name === "QuotaExceededError" || erro?.message?.includes("QuotaExceededError")) {
      return { sucesso: false, erroQuota: true };
    }
    throw erro;
  }
}

/**
 * Recupera e valida o rascunho de sessão, aplicando regra de TTL (expiração).
 */
export function recuperarRascunhoSessao(
  storage: SimulaLocalStorage,
  usuarioId: string,
  maxTtlMs: number = 24 * 3600 * 1000 // 24 horas
): { rascunho: PayloadRascunhoSessao | null; expirado: boolean } {
  const chave = `insight-compras-draft-${usuarioId}`;
  const raw = storage.getItem(chave);
  if (!raw) {
    return { rascunho: null, expirado: false };
  }

  try {
    const payload: PayloadRascunhoSessao = JSON.parse(raw);
    const idadeMs = Date.now() - payload.timestamp;

    if (idadeMs > maxTtlMs) {
      storage.removeItem(chave);
      return { rascunho: null, expirado: true };
    }

    return { rascunho: payload, expirado: false };
  } catch {
    storage.removeItem(chave);
    return { rascunho: null, expirado: false };
  }
}

/**
 * Registra a ordem de compra na trilha de auditoria imutável.
 */
export function criarRegistroAuditoria(
  usuario: UsuarioAutenticado,
  sku: string,
  produtoId: number,
  filialId: number,
  sugerido: number,
  ajustado: number,
  tipo: TipoAcaoAuditoria = "AJUSTE_SUGESTAO"
): RegistroAuditoriaPedido {
  const divergencia = ajustado - sugerido;
  let justificativa: string | null = null;

  if (divergencia > 0) {
    justificativa = `Sobrecompra manual de +${divergencia} un pelo comprador ${usuario.nome}. Divergência em relação à sugestão do motor (${sugerido} un).`;
  }

  return {
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    timestamp: new Date().toISOString(),
    usuarioId: usuario.id,
    usuarioNome: usuario.nome,
    tenantId: usuario.tenantId,
    tipoAcao: divergencia > 0 ? "SOBRECOMPRA_CONFIRMADA" : tipo,
    produtoId,
    codigoSku: sku,
    filialId,
    quantidadeSugeridaSistema: sugerido,
    quantidadeDefinidaComprador: ajustado,
    divergenciaJustificativa: justificativa,
  };
}

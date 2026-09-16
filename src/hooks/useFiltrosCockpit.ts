"use client";

import { useState, useMemo, useDeferredValue, useTransition, useCallback } from "react";
import {
  LinhaCockpitMatriz,
  FiltrosCockpitState,
  StatusFilterOption,
} from "@/tipos/cockpit";
import { CurvaABC } from "@core/dominio";
import { ContagensStatusGrade } from "@/lib/cockpit/escopo-grade";

const REGEX_DIACRITICOS = /[\u0300-\u036f]/g;

/**
 * Normaliza uma string para busca em memória (remove acentos e converte para minúsculas).
 */
export function normalizarTexto(texto: string): string {
  if (!texto) return "";
  return texto.normalize("NFD").replace(REGEX_DIACRITICOS, "").toLowerCase();
}

/**
 * Pré-computa o índice de busca textual para um SKU individual.
 * Realizado 1x na carga dos dados para que cada tecla digitada leve < 20ms no Chrome V8.
 */
export function preIndexarLinhaMatriz(item: LinhaCockpitMatriz): LinhaCockpitMatriz {
  const campos = [
    item.codigoSku,
    item.descricao,
    item.marca,
    item.fabricante,
    item.referenciaFabricante ?? "",
    item.aplicacaoVeicular ?? "",
    item.secaoNome ?? "",
    item.nomeFornecedor ?? "",
  ];

  return {
    ...item,
    _searchIndex: normalizarTexto(campos.join(" ")),
  };
}

/**
 * Pré-indexa uma lista completa de produtos da matriz de decisão.
 */
export function preIndexarListaMatriz(
  itens: readonly LinhaCockpitMatriz[]
): LinhaCockpitMatriz[] {
  return itens.map(preIndexarLinhaMatriz);
}

/**
 * Pipeline de filtragem pura de alta performance.
 * Combina validação categórica O(1) com Sets e busca textual por tokens com bail-out imediato.
 */
export function filtrarLinhasCockpit(
  itens: readonly LinhaCockpitMatriz[],
  filtros: {
    query: string;
    fornecedoresPermitidos?: ReadonlySet<number> | null;
    marcasDeselecionadas?: ReadonlySet<string>;
    secoesDeselecionadas?: ReadonlySet<number>;
    curvasDeselecionadas?: ReadonlySet<CurvaABC>;
    statusFiltro?: StatusFilterOption;
  }
): LinhaCockpitMatriz[] {
  const {
    query,
    fornecedoresPermitidos = null,
    marcasDeselecionadas = new Set(),
    secoesDeselecionadas = new Set(),
    curvasDeselecionadas = new Set(),
    statusFiltro = "ALL",
  } = filtros;

  // 1. Normaliza tokens de busca apenas 1 vez para todo o lote
  const queryLimpa = normalizarTexto(query.trim());
  const tokens = queryLimpa.length > 0 ? queryLimpa.split(/\s+/).filter(Boolean) : [];
  const temBuscaTexto = tokens.length > 0;

  const resultado: LinhaCockpitMatriz[] = [];
  const total = itens.length;

  for (let i = 0; i < total; i++) {
    const item = itens[i];

    // Etapa A: RBAC de Fornecedores da carteira (O(1))
    if (fornecedoresPermitidos !== null && item.fornecedorId !== undefined) {
      if (!fornecedoresPermitidos.has(item.fornecedorId)) {
        continue;
      }
    }

    // Etapa B: Filtros Facetados de Marca (O(1))
    if (marcasDeselecionadas.size > 0 && marcasDeselecionadas.has(item.marca)) {
      continue;
    }

    // Etapa C: Filtros Facetados de Seção (O(1))
    if (secoesDeselecionadas.size > 0 && item.secaoId !== undefined && secoesDeselecionadas.has(item.secaoId)) {
      continue;
    }

    // Etapa D: Filtro de Curva ABC (O(1))
    if (curvasDeselecionadas.size > 0 && curvasDeselecionadas.has(item.curvaAbc)) {
      continue;
    }

    // Etapa E: Filtro por Status Operacional (O(1))
    if (statusFiltro !== "ALL") {
      if (statusFiltro === "PEDIR" && item.sugestaoFinalCompra <= 0) {
        continue;
      }
      if (statusFiltro === "TRANSFERIR" && item.quantidadeTransferenciaSugerida <= 0) {
        continue;
      }
      if (
        statusFiltro === "RUPTURA" &&
        item.classificacaoRuptura !== "Grave" &&
        item.classificacaoRuptura !== "Atenção"
      ) {
        continue;
      }
      if (statusFiltro === "ZUMBI" && !item.isMarcaZumbi) {
        continue;
      }
      if (
        statusFiltro === "SUGESTAO_ERP" &&
        (!item.sugestaoQtdErp || item.sugestaoQtdErp <= 0) &&
        !item.temSugestaoErp
      ) {
        continue;
      }
    }

    // Etapa F: Casamento de Tokens de Busca Multi-Palavra
    if (temBuscaTexto) {
      const idx = item._searchIndex ?? normalizarTexto(`${item.codigoSku} ${item.descricao} ${item.marca}`);
      let casou = true;
      for (let t = 0; t < tokens.length; t++) {
        if (!idx.includes(tokens[t])) {
          casou = false;
          break; // Bail-out antecipado imediato
        }
      }
      if (!casou) continue;
    }

    resultado.push(item);
  }

  return resultado;
}

export interface UseFiltrosCockpitParams {
  /** Contagens calculadas no servidor sobre o catálogo inteiro (carga progressiva). */
  contagensCatalogo?: ContagensStatusGrade;
  itens: readonly LinhaCockpitMatriz[];
  fornecedoresPermitidos?: readonly number[] | null;
  /** Aba aberta ao entrar no cockpit. Padrão: "PEDIR" (o trabalho do dia). */
  statusInicial?: StatusFilterOption;
}

export function useFiltrosCockpit({
  itens,
  fornecedoresPermitidos = null,
  statusInicial = "PEDIR",
  contagensCatalogo,
}: UseFiltrosCockpitParams) {
  // Input imediato para feedback a 60fps sem lag
  const [rawQuery, setRawQuery] = useState("");
  // useDeferredValue posterga a computação pesada de 25k itens para não travar a digitação
  const deferredQuery = useDeferredValue(rawQuery);

  const [isPending, startTransition] = useTransition();

  const [marcasDeselecionadas, setMarcasDeselecionadas] = useState<Set<string>>(new Set());
  const [secoesDeselecionadas, setSecoesDeselecionadas] = useState<Set<number>>(new Set());
  const [curvasDeselecionadas, setCurvasDeselecionadas] = useState<Set<CurvaABC>>(new Set());
  // Abre no que EXIGE AÇÃO, não no catálogo inteiro.
  // O comprador entra na ferramenta para saber o que comprar; abrir em 19 mil
  // linhas onde a maioria não pede nada esconde justamente o trabalho do dia.
  const [statusFiltro, setStatusFiltro] = useState<StatusFilterOption>(statusInicial);
  const fornecedoresSet = useMemo(() => {
    if (!fornecedoresPermitidos) return null;
    return new Set(fornecedoresPermitidos);
  }, [fornecedoresPermitidos]);

  // Lista pré-indexada memorizada
  const itensIndexados = useMemo(() => {
    return preIndexarListaMatriz(itens);
  }, [itens]);

  // Lista filtrada em memória computada via useMemo
  const itensFiltrados = useMemo(() => {
    return filtrarLinhasCockpit(itensIndexados, {
      query: deferredQuery,
      fornecedoresPermitidos: fornecedoresSet,
      marcasDeselecionadas,
      secoesDeselecionadas,
      curvasDeselecionadas,
      statusFiltro,
    });
  }, [
    itensIndexados,
    deferredQuery,
    fornecedoresSet,
    marcasDeselecionadas,
    secoesDeselecionadas,
    curvasDeselecionadas,
    statusFiltro,
  ]);

  // Facetas disponíveis calculadas sobre o dataset completo
  const facetas = useMemo(() => {
    const marcasMap = new Map<string, number>();
    const secoesMap = new Map<number, { nome: string; count: number }>();
    const curvasMap = new Map<CurvaABC, number>();

    let totalPedir = 0;
    let totalTransferir = 0;
    let totalRuptura = 0;
    let totalZumbi = 0;
    let totalSugestaoErp = 0;

    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];

      // Marcas
      marcasMap.set(item.marca, (marcasMap.get(item.marca) ?? 0) + 1);

      // Seções
      if (item.secaoId !== undefined) {
        const atual = secoesMap.get(item.secaoId);
        if (atual) {
          atual.count++;
        } else {
          secoesMap.set(item.secaoId, {
            nome: item.secaoNome ?? `Seção ${item.secaoId}`,
            count: 1,
          });
        }
      }

      // Curvas
      curvasMap.set(item.curvaAbc, (curvasMap.get(item.curvaAbc) ?? 0) + 1);

      // Status
      if (item.sugestaoFinalCompra > 0) totalPedir++;
      if (item.quantidadeTransferenciaSugerida > 0) totalTransferir++;
      if (item.classificacaoRuptura === "Grave" || item.classificacaoRuptura === "Atenção") totalRuptura++;
      if (item.isMarcaZumbi) totalZumbi++;
      if ((item.sugestaoQtdErp && item.sugestaoQtdErp > 0) || item.temSugestaoErp) totalSugestaoErp++;
    }

    return {
      marcas: marcasMap,
      secoes: secoesMap,
      curvas: curvasMap,
      // As contagens do servidor, quando existem, valem sobre as locais: enquanto
      // o catálogo completo não chegou, contar só o que está em memória faria os
      // chips mentirem sobre o tamanho do catálogo.
      contagensStatus: contagensCatalogo ?? {
        total: itens.length,
        pedir: totalPedir,
        transferir: totalTransferir,
        ruptura: totalRuptura,
        zumbi: totalZumbi,
        sugestaoErp: totalSugestaoErp,
      },
    };
  }, [itens, contagensCatalogo]);

  const toggleMarca = useCallback((marca: string) => {
    startTransition(() => {
      setMarcasDeselecionadas((prev) => {
        const next = new Set(prev);
        if (next.has(marca)) next.delete(marca);
        else next.add(marca);
        return next;
      });
    });
  }, []);

  const toggleSecao = useCallback((secaoId: number) => {
    startTransition(() => {
      setSecoesDeselecionadas((prev) => {
        const next = new Set(prev);
        if (next.has(secaoId)) next.delete(secaoId);
        else next.add(secaoId);
        return next;
      });
    });
  }, []);

  const toggleCurva = useCallback((curva: CurvaABC) => {
    startTransition(() => {
      setCurvasDeselecionadas((prev) => {
        const next = new Set(prev);
        if (next.has(curva)) next.delete(curva);
        else next.add(curva);
        return next;
      });
    });
  }, []);

  const definirMarcasDeselecionadas = useCallback((novas: Set<string>) => {
    startTransition(() => {
      setMarcasDeselecionadas(novas);
    });
  }, []);

  const definirCurvasDeselecionadas = useCallback((novas: Set<CurvaABC>) => {
    startTransition(() => {
      setCurvasDeselecionadas(novas);
    });
  }, []);

  const alterarStatus = useCallback((novoStatus: StatusFilterOption) => {
    startTransition(() => {
      setStatusFiltro(novoStatus);
    });
  }, []);

  const limparFiltros = useCallback(() => {
    startTransition(() => {
      setRawQuery("");
      setMarcasDeselecionadas(new Set());
      setSecoesDeselecionadas(new Set());
      setCurvasDeselecionadas(new Set());
      setStatusFiltro("ALL");
    });
  }, []);

  return {
    rawQuery,
    setRawQuery,
    deferredQuery,
    isPending,
    marcasDeselecionadas,
    secoesDeselecionadas,
    curvasDeselecionadas,
    statusFiltro,
    itensFiltrados,
    facetas,
    toggleMarca,
    toggleSecao,
    toggleCurva,
    definirMarcasDeselecionadas,
    definirCurvasDeselecionadas,
    alterarStatus,
    limparFiltros,
  };
}

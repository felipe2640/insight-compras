"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  RascunhoSessaoPayload,
  ItemDeltaRascunho,
  EstadoFiltrosRascunho,
  DraftSaveError,
} from "@/tipos/cockpit";

export const VERSAO_SCHEMA_RASCUNHO = 1;
export const DRAFT_SCHEMA_VERSION = VERSAO_SCHEMA_RASCUNHO;
export const DEBOUNCE_RASCUNHO_PADRAO_MS = 1500;
export const DEFAULT_DRAFT_DEBOUNCE_MS = DEBOUNCE_RASCUNHO_PADRAO_MS;
export const TTL_RASCUNHO_PADRAO_MS = 60 * 60 * 1000; // 1 hora de validade
export const DEFAULT_DRAFT_TTL_MS = TTL_RASCUNHO_PADRAO_MS;

export interface UseSessionDraftParams {
  tenantId: string;
  userId: string;
  deltas: Record<string, ItemDeltaRascunho>;
  filtros?: EstadoFiltrosRascunho;
  config?: RascunhoSessaoPayload["config"];
  debounceMs?: number;
  ttlMs?: number;
  habilitado?: boolean;
}

export interface UseSessionDraftReturn {
  draftAvailable: RascunhoSessaoPayload | null;
  isSaving: boolean;
  lastSavedAt: number | null;
  saveError: DraftSaveError | null;
  restaurarRascunho: () => RascunhoSessaoPayload | null;
  descartarRascunho: () => void;
  limparRascunho: () => void;
  salvarImediatamente: () => void;
}

function identificarErroStorage(erro: unknown): DraftSaveError {
  const nome = typeof erro === "object" && erro && "name" in erro ? String((erro as { name?: string }).name) : "";
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  const texto = `${nome} ${mensagem}`.toLowerCase();

  if (texto.includes("quota") || texto.includes("quotaexceeded") || texto.includes("ns_error_dom_quota_reached")) {
    return {
      tipo: "QUOTA",
      mensagem: "Falha ao salvar rascunho: cota de armazenamento local do navegador esgotada.",
      dica: "Limpe dados do navegador ou conclua o pedido para liberar espaço.",
    };
  }

  if (texto.includes("security") || texto.includes("denied") || texto.includes("blocked") || texto.includes("insecure")) {
    return {
      tipo: "SEGURANCA",
      mensagem: "Acesso ao armazenamento local bloqueado por políticas do navegador.",
      dica: "Verifique o modo anônimo ou as permissões de cookies/storage.",
    };
  }

  return {
    tipo: "DESCONHECIDO",
    mensagem: "Falha ao salvar rascunho de sessão.",
    dica: mensagem || undefined,
  };
}

export function useSessionDraft({
  tenantId,
  userId,
  deltas,
  filtros,
  config,
  debounceMs = DEBOUNCE_RASCUNHO_PADRAO_MS,
  ttlMs = TTL_RASCUNHO_PADRAO_MS,
  habilitado = true,
}: UseSessionDraftParams): UseSessionDraftReturn {
  const [draftAvailable, setDraftAvailable] = useState<RascunhoSessaoPayload | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<DraftSaveError | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const deltasRef = useRef(deltas);
  const filtrosRef = useRef(filtros);
  const configRef = useRef(config);

  deltasRef.current = deltas;
  filtrosRef.current = filtros;
  configRef.current = config;

  // Chave padronizada e isolada por tenant e usuário
  const storageKey = useMemo(() => {
    if (!tenantId || !userId) return null;
    return `insight-compras-draft-${tenantId}-${userId}`;
  }, [tenantId, userId]);

  // 1. Leitura inicial na montagem (Mount)
  useEffect(() => {
    if (typeof window === "undefined" || !storageKey || !habilitado) {
      setDraftAvailable(null);
      return;
    }

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setDraftAvailable(null);
        return;
      }

      const parsed: RascunhoSessaoPayload = JSON.parse(raw);

      // Validação de integridade do payload
      if (
        !parsed ||
        parsed.versao !== VERSAO_SCHEMA_RASCUNHO ||
        parsed.tenantId !== tenantId ||
        parsed.userId !== userId
      ) {
        localStorage.removeItem(storageKey);
        setDraftAvailable(null);
        return;
      }

      // Validação de TTL (1 hora)
      const idadeMs = Date.now() - parsed.timestamp;
      if (idadeMs > ttlMs) {
        localStorage.removeItem(storageKey);
        setDraftAvailable(null);
        return;
      }

      // Só disponibiliza se houver deltas registrados
      if (parsed.deltas && Object.keys(parsed.deltas).length > 0) {
        setDraftAvailable(parsed);
        setLastSavedAt(parsed.timestamp);
      } else {
        setDraftAvailable(null);
      }
    } catch (erro) {
      setSaveError(identificarErroStorage(erro));
      setDraftAvailable(null);
    }
  }, [storageKey, tenantId, userId, ttlMs, habilitado]);

  // Função interna para gravar
  const executarGravacao = useCallback(() => {
    if (typeof window === "undefined" || !storageKey || !habilitado) return;

    const totalDeltas = Object.keys(deltasRef.current).length;
    if (totalDeltas === 0) return;

    try {
      setIsSaving(true);
      const payload: RascunhoSessaoPayload = {
        versao: VERSAO_SCHEMA_RASCUNHO,
        timestamp: Date.now(),
        tenantId,
        userId,
        deltas: deltasRef.current,
        filtros: filtrosRef.current,
        config: configRef.current,
      };

      localStorage.setItem(storageKey, JSON.stringify(payload));
      setLastSavedAt(payload.timestamp);
      setSaveError(null);
    } catch (erro) {
      setSaveError(identificarErroStorage(erro));
    } finally {
      setIsSaving(false);
    }
  }, [storageKey, tenantId, userId, habilitado]);

  // 2. Persistência automática com Debounce
  useEffect(() => {
    if (typeof window === "undefined" || !storageKey || !habilitado) return;

    // Se existe um rascunho anterior pendente de restauração pelo usuário, não sobrescreve
    if (draftAvailable) return;

    const totalDeltas = Object.keys(deltas).length;
    if (totalDeltas === 0) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setIsSaving(true);

    timerRef.current = setTimeout(() => {
      executarGravacao();
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [deltas, filtros, config, storageKey, debounceMs, habilitado, draftAvailable, executarGravacao]);

  // 3. Restaurar rascunho
  const restaurarRascunho = useCallback((): RascunhoSessaoPayload | null => {
    if (!draftAvailable) return null;
    const rascunho = draftAvailable;
    setDraftAvailable(null);
    return rascunho;
  }, [draftAvailable]);

  // 4. Descartar rascunho
  const descartarRascunho = useCallback(() => {
    if (typeof window !== "undefined" && storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (erro) {
        setSaveError(identificarErroStorage(erro));
      }
    }
    setDraftAvailable(null);
    setLastSavedAt(null);
  }, [storageKey]);

  // 5. Limpar rascunho (após emitir pedido)
  const limparRascunho = useCallback(() => {
    if (typeof window !== "undefined" && storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (erro) {
        setSaveError(identificarErroStorage(erro));
      }
    }
    setDraftAvailable(null);
    setIsSaving(false);
    setLastSavedAt(null);
    setSaveError(null);
  }, [storageKey]);

  // 6. Forçar salvamento síncrono imediato
  const salvarImediatamente = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    executarGravacao();
  }, [executarGravacao]);

  return {
    draftAvailable,
    isSaving,
    lastSavedAt,
    saveError,
    restaurarRascunho,
    descartarRascunho,
    limparRascunho,
    salvarImediatamente,
  };
}

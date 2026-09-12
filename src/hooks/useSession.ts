"use client";

/**
 * Hook de sessão do usuário no cliente.
 * Camada: Aplicação / UI (src/hooks/useSession.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { useState, useEffect, useCallback } from "react";
import type { PapelUsuario } from "@/lib/rbac/tipos";

export interface UsuarioSessao {
  readonly id: string;
  readonly nome: string;
  readonly usuario: string;
  readonly papel: PapelUsuario;
  readonly papelRotulo: string;
  readonly tenantId: string;
  readonly allowedSupplierIds: readonly number[] | null;
  readonly carteiraRestrita: boolean;
}

export interface UseSessionReturn {
  readonly usuario: UsuarioSessao | null;
  readonly carregando: boolean;
  readonly erro: string | null;
  readonly recarregar: () => Promise<void>;
}

export function useSession(usuarioInicial?: Partial<UsuarioSessao> | null): UseSessionReturn {
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(() => {
    if (!usuarioInicial) return null;
    return {
      id: usuarioInicial.id ?? "",
      nome: usuarioInicial.nome ?? "",
      usuario: usuarioInicial.usuario ?? "",
      papel: (usuarioInicial.papel as PapelUsuario) ?? "COMPRADOR",
      papelRotulo: usuarioInicial.papelRotulo ?? "Comprador",
      tenantId: usuarioInicial.tenantId ?? "",
      allowedSupplierIds: usuarioInicial.allowedSupplierIds ?? null,
      carteiraRestrita: usuarioInicial.carteiraRestrita ?? (usuarioInicial.allowedSupplierIds !== null),
    };
  });
  const [carregando, setCarregando] = useState(!usuarioInicial);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/auth/sessao");
      if (!res.ok) {
        setUsuario(null);
        if (res.status !== 401) {
          setErro("Falha ao carregar sessão");
        }
        return;
      }
      const data = (await res.json()) as { usuario?: UsuarioSessao };
      if (data.usuario) {
        setUsuario(data.usuario);
      } else {
        setUsuario(null);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro de conexão ao carregar sessão");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    // Se já temos a sessão completa vinda do servidor, não precisa refazer fetch imediatamente
    if (usuarioInicial?.id && usuarioInicial?.allowedSupplierIds !== undefined) {
      return;
    }
    void recarregar();
  }, [usuarioInicial, recarregar]);

  return {
    usuario,
    carregando,
    erro,
    recarregar,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AbrirNoHubProps {
  portalOrigin: string;
  applicationId: string;
  /** Cotação enviada que o comprador acompanhará no Hub. */
  quotationId?: string;
}

/**
 * Abre o portal do Cotação Hub com a sessão INDIVIDUAL do comprador
 * (CCR-013): o popup do portal cria o browser state (PKCE) e devolve
 * state/nonce por postMessage; pedimos o launch ao backend da própria
 * origem (que assina a assertion com a identidade do usuário logado) e
 * devolvemos launch_url ao portal, que resgata a sessão própria.
 *
 * Cookie da origem não é compartilhado e o token M2M nunca aparece no
 * navegador — o launch_url é de uso único (TTL 120 s) e some no resgate.
 */
export function AbrirNoHub({ portalOrigin, applicationId, quotationId }: AbrirNoHubProps) {
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receberRef = useRef<(event: MessageEvent) => void>(() => {});

  const limpar = useCallback(() => {
    window.removeEventListener("message", receberRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => () => limpar(), [limpar]);

  const abrir = () => {
    if (!quotationId) {
      setErro("Envie uma cotação antes de abrir o Hub.");
      return;
    }
    setErro(null);
    setAbrindo(true);
    const popup = window.open(`${portalOrigin}/#sso/${applicationId}`, "_blank");
    if (!popup) {
      setAbrindo(false);
      setErro("Permita a abertura de janelas do site para entrar no Cotação Hub.");
      return;
    }
    const receber = (event: MessageEvent) => {
      if (event.source !== popup || event.origin !== portalOrigin) return;
      const dados = event.data as { type?: string; application_id?: string; browser_state_id?: string; nonce?: string };
      if (dados?.type !== "cotacao-hub.browser-context.v1" || dados.application_id !== applicationId) return;
      limpar();
      fetch("/api/cotacao-hub/sso-launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: applicationId,
          browser_state_id: dados.browser_state_id,
          nonce: dados.nonce,
          quotation_id: quotationId,
        }),
      })
        .then(async (resposta) => {
          const corpo = await resposta.json().catch(() => null);
          if (!resposta.ok) throw new Error(corpo?.erro || "Não foi possível abrir o Hub com seu acesso.");
          return corpo as { launch_url: string };
        })
        .then(({ launch_url }) => {
          popup.postMessage({ type: "cotacao-hub.launch.v1", launch_url }, portalOrigin);
          setAbrindo(false);
        })
        .catch((falha: unknown) => {
          setAbrindo(false);
          setErro(falha instanceof Error ? falha.message : "Não foi possível abrir o Hub.");
        });
    };
    receberRef.current = receber;
    window.addEventListener("message", receber);
    // O estado do browser expira em 10 min; o handshake costuma levar segundos.
    timeoutRef.current = setTimeout(() => {
      limpar();
      setAbrindo(false);
      setErro("O Hub não respondeu à abertura. Tente novamente.");
    }, 60_000);
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={abrir}
        disabled={abrindo || !quotationId}
        title={quotationId ? "Abrir a cotação no portal do Cotação Hub com o seu acesso individual" : "Disponível após o envio de uma cotação"}
        className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
      >
        {abrindo ? "Abrindo no Hub…" : "🔗 Abrir no Hub"}
      </button>
      {erro && <p className="text-[11px] text-rose-600 max-w-56">{erro}</p>}
    </div>
  );
}

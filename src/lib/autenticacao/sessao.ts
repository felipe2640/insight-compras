/**
 * Cookie de sessão — Edge-safe (sem Node APIs), sem dependência.
 * Camada: Aplicação (src/lib/autenticacao).
 *
 * O cookie guarda só o necessário para o provedor reconhecer a sessão:
 * qual provedor, o token opaco, o token de renovação e quando expira.
 * Nunca guarda papel/carteira: isso vem do provedor a cada validação.
 */

import type { IdProvedorAutenticacao } from "./porta";

export const NOME_COOKIE_SESSAO = "insight_sessao";

export interface CookieSessao {
  readonly provedor: IdProvedorAutenticacao;
  readonly token: string;
  readonly tokenRenovacao: string | null;
  readonly expiraEm: number;
}

export function base64UrlCodificar(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecodificar(valor: string): string | null {
  try {
    const normalizado = valor.replace(/-/g, "+").replace(/_/g, "/");
    const preenchido = normalizado + "=".repeat((4 - (normalizado.length % 4)) % 4);
    const binario = atob(preenchido);
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function codificarCookieSessao(sessao: CookieSessao): string {
  return base64UrlCodificar(
    JSON.stringify({ p: sessao.provedor, t: sessao.token, r: sessao.tokenRenovacao, e: sessao.expiraEm })
  );
}

export function decodificarCookieSessao(valor: string | undefined | null): CookieSessao | null {
  if (!valor) return null;
  const json = base64UrlDecodificar(valor);
  if (!json) return null;
  try {
    const obj = JSON.parse(json) as { p?: unknown; t?: unknown; r?: unknown; e?: unknown };
    if ((obj.p !== "supabase" && obj.p !== "demo") || typeof obj.t !== "string" || typeof obj.e !== "number") {
      return null;
    }
    return {
      provedor: obj.p,
      token: obj.t,
      tokenRenovacao: typeof obj.r === "string" ? obj.r : null,
      expiraEm: obj.e,
    };
  } catch {
    return null;
  }
}

/** Expirada (ou prestes a expirar dentro da margem). */
export function sessaoExpirada(sessao: CookieSessao, agora: number = Date.now(), margemMs = 60_000): boolean {
  return sessao.expiraEm - margemMs <= agora;
}

export interface OpcoesCookie {
  readonly name: string;
  readonly value: string;
  readonly httpOnly: true;
  readonly sameSite: "lax";
  readonly secure: boolean;
  readonly path: "/";
  readonly maxAge: number;
}

/** Vida do cookie = vida do refresh (30 dias) quando existe; senão a do token. */
export function opcoesCookieSessao(sessao: CookieSessao, producao: boolean): OpcoesCookie {
  const segundosToken = Math.max(0, Math.floor((sessao.expiraEm - Date.now()) / 1000));
  return {
    name: NOME_COOKIE_SESSAO,
    value: codificarCookieSessao(sessao),
    httpOnly: true,
    sameSite: "lax",
    secure: producao,
    path: "/",
    maxAge: sessao.tokenRenovacao ? 30 * 24 * 3600 : segundosToken,
  };
}

export function opcoesCookieLimpar(producao: boolean): OpcoesCookie {
  return { name: NOME_COOKIE_SESSAO, value: "", httpOnly: true, sameSite: "lax", secure: producao, path: "/", maxAge: 0 };
}

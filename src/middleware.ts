/**
 * Edge Middleware: resolução de tenant, identidade visual, cabeçalhos de segurança
 * e PORTÃO DE SESSÃO.
 * Camada: src/middleware.ts — Edge-safe (sem Node APIs).
 *
 * Portão de sessão (barato, sem chamada de rede na maioria dos casos):
 *  - rota pública (login, /api/auth/*, /api/health): passa.
 *  - sem cookie de sessão ou expirado sem renovação: página -> /login?next=..., API -> 401.
 *  - token vencido com token de renovação: renova no provedor e regrava o cookie.
 * A validação FORTE (quem é o usuário, papel, carteira) acontece nas rotas via
 * src/lib/autenticacao/servidor — o middleware só decide se vale tentar.
 */

import { processarRequisicaoTenant } from "./lib/middleware-tenant";
import { ErroTenant } from "@config/tenants/erros";
import { CABECALHOS_SEGURANCA_HTTP } from "./lib/seguranca/headers";
import { NextResponse } from "next/server";
import {
  NOME_COOKIE_SESSAO,
  CookieSessao,
  decodificarCookieSessao,
  obterProvedorAutenticacao,
  opcoesCookieLimpar,
  opcoesCookieSessao,
  sessaoExpirada,
} from "./lib/autenticacao";

// Tipagem flexível para runtime Edge / Next.js
export interface NextRequestLike {
  headers: Headers;
  nextUrl: {
    searchParams: URLSearchParams;
    pathname: string;
  };
  cookies: {
    get: (nome: string) => { value: string } | undefined;
  };
}

export type MiddlewareResponse = NextResponse & {
  request: { headers: Headers };
  cookiesToSet: { name: string; value: string; path: string; sameSite: "lax" };
  /** Decisão do portão de sessão (exposta para testes). */
  decisaoSessao: "publica" | "autenticada" | "renovada" | "redirecionar_login" | "nao_autenticado_api";
};

/**
 * `/api/health` é público e simples. `/api/health/fonte` NÃO entra aqui: ele
 * toca a fonte do cliente e exige sessão de gestor/admin ou HEALTH_TOKEN.
 */
const PREFIXOS_PUBLICOS = ["/login", "/api/auth/"];
const ROTAS_PUBLICAS_EXATAS = ["/api/health"];

export function rotaPublica(pathname: string): boolean {
  if (ROTAS_PUBLICAS_EXATAS.includes(pathname)) return true;
  return PREFIXOS_PUBLICOS.some((p) => pathname === p || pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}

function urlAbsoluta(request: NextRequestLike, caminho: string): URL {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost";
  const proto = request.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return new URL(caminho, `${proto}://${host}`);
}

export async function middleware(request: NextRequestLike): Promise<MiddlewareResponse> {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "localhost";
  const searchParams = request.nextUrl.searchParams;
  const pathname = request.nextUrl.pathname;

  const cookiesMap: Record<string, string> = {};
  const cookieTenant = request.cookies.get("x-tenant-id");
  if (cookieTenant?.value) {
    cookiesMap["x-tenant-id"] = cookieTenant.value;
  }

  /**
   * Em produção, cliente desconhecido e instalação sem TENANT_ATIVO são erro
   * (ADR-0001). O middleware não pode deixar isso virar uma página em branco:
   * responde 503 com um texto curto, sem detalhe de infraestrutura.
   */
  let resultado;
  try {
    resultado = processarRequisicaoTenant({
      hostname: host,
      searchParams,
      cookies: cookiesMap,
    });
  } catch (erro) {
    if (erro instanceof ErroTenant) {
      console.error("[middleware] resolução de tenant falhou:", erro.message);
      return new NextResponse(
        "Instalação sem cliente configurado. Fale com o suporte do Insight Direto.",
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
      ) as unknown as MiddlewareResponse;
    }
    throw erro;
  }

  // Clona e enriquece os cabeçalhos para os Server Components / RSC
  const requestHeaders = new Headers(request.headers);
  for (const [chave, valor] of Object.entries(resultado.headersDownstream)) {
    requestHeaders.set(chave, valor);
  }
  for (const [chave, valor] of Object.entries(CABECALHOS_SEGURANCA_HTTP)) {
    requestHeaders.set(chave, valor);
  }

  // ------------------------------------------------------------------
  // Portão de sessão
  // ------------------------------------------------------------------
  const publica = rotaPublica(pathname);
  let sessao: CookieSessao | null = decodificarCookieSessao(request.cookies.get(NOME_COOKIE_SESSAO)?.value);
  let sessaoRenovada: CookieSessao | null = null;
  let limparCookieSessao = false;

  if (sessao && sessaoExpirada(sessao)) {
    if (sessao.tokenRenovacao) {
      try {
        const nova = await obterProvedorAutenticacao(sessao.provedor).renovar(sessao.tokenRenovacao, resultado.tenantId);
        if (nova) {
          sessaoRenovada = { provedor: nova.provedor, token: nova.token, tokenRenovacao: nova.tokenRenovacao, expiraEm: nova.expiraEm };
          sessao = sessaoRenovada;
        } else {
          sessao = null;
        }
      } catch {
        sessao = null;
      }
    } else {
      sessao = null;
    }
    if (!sessao) limparCookieSessao = true;
  }

  if (sessaoRenovada) {
    // O cookie na resposta atende a próxima navegação; a requisição atual
    // também precisa ver o JWT novo nos Route Handlers e Server Components.
    const renovado = opcoesCookieSessao(sessaoRenovada, process.env.NODE_ENV === "production");
    const anteriores = (requestHeaders.get("cookie") ?? "").split(";")
      .map((item) => item.trim())
      .filter((item) => item && !item.startsWith(`${renovado.name}=`));
    requestHeaders.set("cookie", [...anteriores, `${renovado.name}=${renovado.value}`].join("; "));
  }

  let decisaoSessao: MiddlewareResponse["decisaoSessao"];
  let response: NextResponse;

  if (publica) {
    decisaoSessao = "publica";
    // Já logado e indo ao /login: manda para o cockpit.
    if (pathname === "/login" && sessao) {
      response = NextResponse.redirect(urlAbsoluta(request, "/compras"));
    } else {
      response = NextResponse.next({ request: { headers: requestHeaders } });
    }
  } else if (!sessao) {
    if (pathname.startsWith("/api/")) {
      decisaoSessao = "nao_autenticado_api";
      response = NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    } else {
      decisaoSessao = "redirecionar_login";
      const destino = urlAbsoluta(request, "/login");
      const proximo = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
      if (proximo !== "/") destino.searchParams.set("next", proximo);
      response = NextResponse.redirect(destino);
    }
  } else {
    decisaoSessao = sessaoRenovada ? "renovada" : "autenticada";
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  const producao = process.env.NODE_ENV === "production";
  if (sessaoRenovada) {
    response.cookies.set(opcoesCookieSessao(sessaoRenovada, producao));
  } else if (limparCookieSessao) {
    response.cookies.set(opcoesCookieLimpar(producao));
  }

  response.cookies.set({
    name: "x-tenant-id",
    value: resultado.tenantId,
    path: "/",
    sameSite: "lax",
  });

  // Anexa propriedades para interoperabilidade estrita com testes unitários
  Object.assign(response, {
    request: { headers: requestHeaders },
    cookiesToSet: { name: "x-tenant-id", value: resultado.tenantId, path: "/", sameSite: "lax" as const },
    decisaoSessao,
  });

  return response as unknown as MiddlewareResponse;
}

export const config = {
  matcher: [
    /*
     * Intercepta todas as requisições exceto:
     * - _next/static (arquivos estáticos JS/CSS)
     * - _next/image (otimização de imagens)
     * - favicon.ico, sitemap.xml, robots.txt
     * - assets estáticos públicos (/tenants/, /logos/)
     * - rotas de healthcheck (/api/health)
     */
    "/((?!api/health$|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|tenants/|logos/).*)",
  ],
};

/**
 * Edge Middleware da Vercel para Resolução de Tenant, Injeção White-Label e Headers de Segurança
 * Camada: src/middleware.ts
 * 100% em Português do Brasil (pt-BR).
 */

import { processarRequisicaoTenant } from "./lib/middleware-tenant";
import { CABECALHOS_SEGURANCA_HTTP } from "./lib/seguranca/headers";
import { NextResponse } from "next/server";

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
};

export function middleware(request: NextRequestLike): MiddlewareResponse {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "localhost";
  const searchParams = request.nextUrl.searchParams;

  const cookiesMap: Record<string, string> = {};
  const cookieTenant = request.cookies.get("x-tenant-id");
  if (cookieTenant?.value) {
    cookiesMap["x-tenant-id"] = cookieTenant.value;
  }

  const resultado = processarRequisicaoTenant({
    hostname: host,
    searchParams,
    cookies: cookiesMap,
  });

  // Clona e enriquece os cabeçalhos para os Server Components / RSC
  const requestHeaders = new Headers(request.headers);
  for (const [chave, valor] of Object.entries(resultado.headersDownstream)) {
    requestHeaders.set(chave, valor);
  }

  // Aplica os cabeçalhos de segurança HTTP em conformidade com as diretrizes
  for (const [chave, valor] of Object.entries(CABECALHOS_SEGURANCA_HTTP)) {
    requestHeaders.set(chave, valor);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.cookies.set({
    name: "x-tenant-id",
    value: resultado.tenantId,
    path: "/",
    sameSite: "lax",
  });

  // Anexa propriedades para interoperabilidade estrita com testes unitários
  Object.assign(response, {
    request: {
      headers: requestHeaders,
    },
    cookiesToSet: {
      name: "x-tenant-id",
      value: resultado.tenantId,
      path: "/",
      sameSite: "lax" as const,
    },
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
    "/((?!api/health|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|tenants/|logos/).*)",
  ],
};

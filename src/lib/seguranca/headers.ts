/**
 * Módulo de Cabeçalhos HTTP de Segurança e Políticas de Defesa
 * Camada: src/lib/seguranca/headers.ts
 * 100% em Português do Brasil (pt-BR).
 */

/**
 * Matriz de Cabeçalhos de Segurança HTTP Recomendados para a Plataforma Insight Compras.
 * Aplicados via Edge Middleware para mitigar XSS, Clickjacking, MIME-sniffing e vazamento de referenciadores.
 */
export const CABECALHOS_SEGURANCA_HTTP: Readonly<Record<string, string>> = {
  // 1. Content Security Policy (CSP) Estrita
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),

  // 2. Proteção contra MIME Type Sniffing
  "X-Content-Type-Options": "nosniff",

  // 3. Proteção contra Clickjacking
  "X-Frame-Options": "DENY",

  // 4. Política de Referenciador Estrita
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // 5. Restrição de Recursos e Sensores do Navegador (Permissions Policy)
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=()",

  // 6. Strict Transport Security (HSTS)
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",

  // 7. Controle de Pré-Resolução DNS
  "X-DNS-Prefetch-Control": "on",
};

/**
 * Utilitário para injetar todos os cabeçalhos de segurança em uma resposta HTTP (Response).
 */
export function aplicarCabecalhosSeguranca(resposta: Response): Response {
  for (const [chave, valor] of Object.entries(CABECALHOS_SEGURANCA_HTTP)) {
    resposta.headers.set(chave, valor);
  }
  return resposta;
}

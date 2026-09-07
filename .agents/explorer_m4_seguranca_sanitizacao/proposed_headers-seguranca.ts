/**
 * Módulo de Cabeçalhos HTTP de Segurança e Isolamento Server-Side
 * Proposta de Implementação para: src/lib/seguranca/headers-seguranca.ts e src/middleware.ts
 * 100% em Português do Brasil (pt-BR).
 */

/**
 * Matriz de Cabeçalhos de Segurança HTTP Recomendados para a Plataforma Insight Compras.
 * Aplicados via Edge Middleware ou next.config.js para mitigar XSS, Clickjacking,
 * MIME-sniffing e vazamento de referenciadores.
 */
export const CABECALHOS_SEGURANCA_HTTP: Readonly<Record<string, string>> = {
  // 1. Content Security Policy (CSP) Estrita
  // Restringe a origem de scripts, estilos e conexões.
  // Em produção com Next.js, bloqueia frame-ancestors, object-src e conexões externas não autorizadas.
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline e unsafe-eval tolerados para hidratação do React
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'", // Bloqueia carregamento em <iframe> (anti-Clickjacking)
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'", // Bloqueia Flash/Applets/Plugins
  ].join("; "),

  // 2. Proteção contra MIME Type Sniffing
  // Força o navegador a respeitar rigorosamente o Content-Type declarado pelo servidor.
  "X-Content-Type-Options": "nosniff",

  // 3. Proteção contra Clickjacking (Camada Redundante ao frame-ancestors)
  // Rejeita totalmente a exibição do SaaS dentro de frames de terceiros.
  "X-Frame-Options": "DENY",

  // 4. Política de Referenciador Estrita
  // Não vaza caminhos ou tokens de busca para origens externas; envia apenas a origem em conexões HTTPS.
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // 5. Restrição de Recursos e Sensores do Navegador (Permissions Policy)
  // Desativa microfone, câmera, geolocalização e tópicos de navegação publicitária.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=()",

  // 6. Strict Transport Security (HSTS)
  // Força conexão HTTPS obrigatória por 2 anos (63.072.000 segundos) com subdomínios inclusos.
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",

  // 7. Controle de Pré-Resolução DNS
  "X-DNS-Prefetch-Control": "on",
};

/**
 * Utilitário para injetar todos os cabeçalhos de segurança em uma resposta HTTP (Response / NextResponse).
 */
export function aplicarCabecalhosSeguranca(resposta: Response): Response {
  for (const [chave, valor] of Object.entries(CABECALHOS_SEGURANCA_HTTP)) {
    resposta.headers.set(chave, valor);
  }
  return resposta;
}

/**
 * Diretrizes Arquiteturais de Isolamento Server-Side e Proteção de Segredos:
 *
 * 1. NUNCA utilizar o prefixo NEXT_PUBLIC_ para segredos de infraestrutura:
 *    - POWERBI_CLIENT_SECRET (Segredo do Service Principal)
 *    - POWERBI_CLIENT_ID (App Registration ID no Azure Entra ID)
 *    - POWERBI_TENANT_ID (ID do Tenant Azure)
 *    - POWERBI_ACCESS_TOKEN (Token estático ou dinâmico)
 *    - SESSION_JWT_SECRET (Segredo de assinatura de tokens de sessão)
 *
 * 2. Barreira Server-Only:
 *    - Garantir que arquivos que instanciam `ClienteDaxPowerBI` ou realizam fetch
 *      ao Power BI Fabric contenham no topo:
 *      import "server-only";
 *    - Isso dispara falha de compilação estrita caso algum componente cliente tente importar o módulo.
 *
 * 3. Projeção Estrita de DTOs nas Fronteiras RSC:
 *    - Conforme a Regra 3.2 do AGENTS.md, os Server Components devem serializar apenas
 *      os campos mínimos requeridos pela UI, descartando tokens, headers e dados de depuração.
 *
 * 4. Isolamento e Criptografia de Sessão:
 *    - Cookies de autenticação devem possuir as flags:
 *      HttpOnly: true (inacessível para scripts maliciosos / XSS)
 *      Secure: true (apenas transmitido via TLS/HTTPS)
 *      SameSite: "Strict" ou "Lax" (proteção contra CSRF)
 *    - A carteira do comprador (allowedSupplierIds) deve ser validada e assinada no JWT
 *      ou recuperada do banco de dados na sessão server-side, JAMAIS aceita cegamente do cliente.
 */

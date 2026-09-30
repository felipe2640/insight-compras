# Contratos de segurança — G0

Este documento fixa defaults verificáveis para o MVP do Cotação Hub. Configuração por instalação pode **reduzir** TTL ou limites; aumento exige revisão de risco documentada, versão da política e teste. O relógio autoritativo é UTC do servidor. Falhas de autorização retornam `404` para recurso fora do escopo e `403` para ação sem permissão em recurso visível; autenticação ausente/inválida retorna `401`. Respostas de OTP e convite não revelam existência de pessoa ou organização.

## TrustedIdentityProvider

Registro administrado no Hub, nunca criado por cabeçalho do cliente:

| Campo | Contrato |
|---|---|
| `provider_id` | ID interno imutável; selecionado por configuração da aplicação/tenant |
| `type` | `oidc`, `jwt_jwks` ou `hub_session` |
| `issuer` | URL/identificador exato; obrigatório para OIDC e JWT/JWKS |
| `audience` | audiência exclusiva do Hub; correspondência exata |
| `key_source` | JWKS HTTPS registrado e algoritmos permitidos, ou chaves próprias do Hub; sem URL escolhida pelo token |
| `tenant_mapping` | regra administrada pelo Hub que vincula issuer + subject/aplicação ao tenant; claim isolada não concede acesso |
| `subject_mapping` | claim estável e não reutilizável para ator; e-mail é atributo, não chave de identidade |
| `role_mapping` | allowlist de papéis/scopes concedidos no Hub; claims externos só reduzem privilégios |
| `enabled` | bloqueio imediato de novas sessões e possibilidade de revogar sessões existentes |
| `policy_version` | versão imutável auditada da configuração usada na troca |

Validar assinatura, algoritmo allowlist (nunca `none`), `kid`, `iss`, `aud`, `exp`, `nbf`, `iat` e desvio de relógio máximo de 60 s. JWKS usa HTTPS, cache limitado a 15 min, atualização segura na rotação e rejeição se chave desconhecida persistir. OIDC usa Authorization Code + PKCE, `state` e `nonce`, callback registrado exato e sessão própria do Hub após troca. JWT/JWKS do host é aceito apenas de issuer pré-registrado; o token do host nunca vira sessão automaticamente por simples header de identidade. `hub_session` é emitida e revogada pelo próprio Hub. Sessão browser usa cookie `Secure`, `HttpOnly`, `SameSite=Lax` ou mais restrito, CSRF em mutações e callback/deep link em allowlist. Token M2M não vai ao navegador.

## Supplier M2M

**Fora do MVP e fora da superfície estável `/api/v1`.** Nenhum endpoint v1 anuncia `offer:write` para credencial M2M supplier. No MVP, submissão direta exige sessão de pessoa supplier identificável; importação por buyer permanece `assisted_unconfirmed` até confirmação individual. Futuro M2M requer contrato próprio de issuer/audience, credencial vinculada à organização, mandato por buyer e participação, scopes, revogação, rotação, TTL, rate limit e auditoria. `supplier_id` do corpo nunca selecionará outra organização.

## TTL e limites padrão

| Superfície | Default | Regra |
|---|---:|---|
| Convite | 7 dias como sugestão da UI; máximo 30 dias | API exige `expires_at` explícito; token 256 bits, hash em repouso, resgate único, revogável; resgate não cria sessão global |
| OTP challenge | 5 min | código de uso único, vinculado a propósito, convite/participação e destinatário |
| Tentativas OTP | 5 por challenge | esgotou: invalidar; 10 falhas por identidade/IP em 1 h: bloqueio temporário de 30 min |
| Reenvio OTP | 60 s | máximo 5 emissões por identidade/convite em 1 h |
| Sessão supplier | 30 min ociosa; 12 h absoluta | revogação por usuário/organização/participação; reautenticação para alteração sensível |
| Sessão buyer federada | 30 min ociosa; 8 h absoluta | nova validação do provedor na renovação; revogação local |
| Registro de idempotência | 72 h | chave + ator/aplicação + tenant + método + rota e hash do payload; mesmo payload devolve mesma resposta; diferente retorna `409` |
| URL assinada de documento | 5 min | objeto e ação específicos; URL não permite listagem, `no-store` |
| Janela de assinatura webhook | 5 min | HMAC SHA-256 dos bytes brutos + timestamp + event ID; deduplicação de event ID pelo consumidor |

Rate limits padrão por janela deslizante, aplicados em camadas e com `429`/`Retry-After`: API autenticada 120 req/min por IP, 60 req/min por identidade, 600 req/min por tenant e 300 req/min por aplicação; resgate de convite 10 req/h por IP e 5 req/h por convite; OTP usa os limites próprios acima. Limites cumulativos: atingir qualquer um bloqueia a chamada. Backoff e quotas de webhook protegem destino sem afetar transação de domínio. Observabilidade registra contador e correlation ID sem token, OTP ou segredo.

## Documentos, eventos e auditoria

`GET /api/v1/documents/{documentId}` resolve o pedido pai e a decisão de acesso antes de gerar bytes ou URL. Buyer precisa pertencer ao tenant e possuir `order:read`; supplier precisa da sessão individual, vínculo com organização e pedido pai, e só lê documento de pedido emitido destinado a essa organização. Aplicação precisa `order:read` e tenant do recurso. Outros tipos de documento exigirão escopo e rota próprios. ID conhecido não concede acesso. Resposta fora do escopo é `404`, inclusive se ID existir em outro tenant. URL assinada é específica para objeto/versão/ação, não enumerável, expira em 5 min; acesso e emissão de URL são auditados. A resposta de metadados e o download usam `Cache-Control: private, no-store`.

`GET /api/v1/events` é tenant-scoped e requer `event:read`; cursor, filtros e IDs são vinculados ao tenant da credencial. Supplier não recebe feed de eventos buyer. Subscrição webhook requer `integration:manage` do tenant e só recebe eventos daquele tenant; payload público segue schemas estáveis do OpenAPI, sem OTP, token, chave, e-mail/telefone pessoal ou conteúdo integral de documento. Evento interno/experimental não é promessa de compatibilidade v1. Consulta de auditoria exige `audit:read` e tenant/recurso, com acesso de suporte excepcional justificado, temporário e auditado. Nenhum administrador técnico ganha leitura comercial geral por padrão.

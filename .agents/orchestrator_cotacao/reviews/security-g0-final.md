# Revisão independente de segurança — G0

**Veredito: APPROVE para o contrato pré-G0.** Reavaliado após correções. O ensaio stateful passou com **111 verificações** nesta revisão. Aprovação limitada à especificação e provas de contrato; não autoriza H0–H7 nem afirma segurança de uma implementação futura.

## Evidência verificada

- `openapi/cotacao-hub-v1.yaml` e `docs/security/security-contracts.md` concordam sobre TTL de convite, OTP, sessões, documento e webhook. Supplier M2M permanece fora da v1.
- `POST /api/v1/sso/launches` declara sessão buyer Hub **ou** credencial da aplicação junto com asserção do IdP registrado. O ensaio cobre caminho válido por ambos, issuer e audience inválidos, replay de `jti`, tenant divergente e callback fora da allowlist, com status e código de erro definidos.
- Sessão supplier preserva `actor_id` para a mesma identidade e separa permissões de proposta e pedido. Convite de cotação não recebe `order:respond`.
- IDOR entre tenants e fornecedores, replay de convite/OTP, tentativas e cooldown, ETag, idempotência e sessão ociosa são negados no ensaio.
- Documento resolve autorização pelo pedido pai; resposta de download contém URL curta, expiração e `Cache-Control: private, no-store`. O ensaio nega URL a outro ator e após expiração.
- Cursor de eventos é vinculado ao tenant; o ensaio nega cursor de T1 em T2. Webhook HMAC, assinatura adulterada, timestamp expirado e replay estão exercitados.
- Retenção por categoria e decisões LGPD pendentes estão explicitadas sem alegação de conformidade jurídica já obtida.

## Limites para G1

A simulação SSO usa assinatura HMAC de teste, enquanto o contrato de produção exige IdP/JWKS registrado, validação completa de claims, algoritmo allowlist, CSRF e sessões revogáveis. Testes contra a implementação real devem cobrir essas propriedades, rate limits por camada, SSRF de webhook, importação XLSX hostil, storage privado e isolamento de consultas. Essas verificações não são pré-condição adicional do contrato G0.

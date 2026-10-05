# ADR-0005 — Acesso operacional ao Supabase via JWT

- Status: proposto
- Data: 2026-09-21
- Depende de: ADR-0004 e migração `202609210001_tenant_rls_foundation.sql`

## Decisão

O cliente PostgREST usado pela aplicação envia `SUPABASE_ANON_KEY` no cabeçalho
`apikey` e o access token da sessão Supabase no `Authorization`. Assim, toda
operação normal passa pelas políticas RLS e pela associação em
`tenant_members`.

Não existe fallback automático para `service_role`. Sem uma sessão Supabase
válida, a operação falha fechada.

O acesso privilegiado precisa ser solicitado explicitamente no código e fica
limitado, nesta etapa, a:

1. administração de usuários;
2. escrita e manutenção do log de auditoria imutável;
3. migrações e tarefas administrativas;
4. pipeline diário de previsão de demanda.

O pipeline `.github/workflows/previsao-ia-diaria.yml` continua usando
`SUPABASE_SERVICE_ROLE_KEY`: ele é um job privilegiado, separado de uma sessão
interativa, e sempre informa `TENANT_ATIVO`.

As funções `SECURITY DEFINER` usadas pelas políticas RLS não são executáveis
por `anon`. Elas permanecem disponíveis para `authenticated` porque as próprias
políticas precisam avaliá-las durante cada operação do usuário.

## Pré-condição de rollout

Aplicar e validar a migração da ADR-0004 antes de promover esta alteração. Sem
as políticas RLS e os membros do tenant, o acesso autenticado falha fechado.

## Rollback

Reverter esta PR restaura o cliente anterior. A fundação RLS não precisa ser
removida e o pipeline diário não é afetado.

# ADR-0006 — Configurações úteis do Diário no backend white-label

- Status: aceito
- Data: 2026-09-21
- Depende de: ADR-0004, ADR-0005 e PR `diario#61`

## Decisão

O backend recebe quatro estruturas tenant/app-scoped: grupos de fornecedores,
vínculos de usuários, múltiplos por seção e pisos de margem. Todas carregam
`tenant_id` e `app_id`, usam RLS e permitem alteração de configuração apenas
para administradores do aplicativo.

Não recriamos `shadow_*`: o ciclo atual usa `aprendizado_*`. Também não
importamos tabelas vazias ou parâmetros antigos incompatíveis.

## Identidade legada

O Diário identifica usuários por uma referência textual, enquanto o Supabase
Auth usa UUID. `usuario_grupo.user_id` referencia obrigatoriamente
`app_members(tenant_id, app_id, user_id)`; `legacy_user_ref` existe para
rastreabilidade e para a resolução controlada durante a importação.

Os usuários do Diário são diferentes de `admin` e `valmir`, que permanecem no
Insight Compras em `tenant_members`. O RPC resolve cada referência legada em
`app_members` com `app_id='diario'` e falha se não encontrar exatamente um
membro ativo no tenant de destino. Não existe mais mapa manual de usuários.

## Rollout

1. confirmar as migrations `202609210003` e `202609210004` no schema;
2. aplicar `20260921230908_diario_app_identity.sql`;
3. executar o teste adversarial em banco descartável;
4. criar os usuários do Diário no Auth e em `app_members`;
5. exportar o manifesto do Diário;
6. importar em transação idempotente;
7. comparar leituras antes de habilitar qualquer feature flag.

## Rollback

Antes da importação, o rollback apenas remove as quatro tabelas novas. Depois
da importação, exportar a conferência antes de executar o rollback. O Supabase
do Diário permanece operacional durante toda esta etapa.

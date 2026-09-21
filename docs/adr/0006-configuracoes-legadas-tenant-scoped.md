# ADR-0006 — Configurações úteis do Diário no backend white-label

- Status: proposto
- Data: 2026-09-21
- Depende de: ADR-0004, ADR-0005 e PR `diario#61`

## Decisão

O backend recebe quatro estruturas tenant-scoped: grupos de fornecedores,
vínculos de usuários, múltiplos por seção e pisos de margem. Todas carregam
`tenant_id`, usam RLS e permitem escrita apenas para `ADMIN`/`GESTOR`.

Não recriamos `shadow_*`: o ciclo atual usa `aprendizado_*`. Também não
importamos tabelas vazias ou parâmetros antigos incompatíveis.

## Identidade legada

O Diário identifica os usuários dos grupos como texto (`2` e `5`), enquanto o
Supabase Auth usa UUID. `usuario_grupo.user_id` referencia obrigatoriamente
`tenant_members`; `legacy_user_ref` existe apenas para rastreabilidade.

A futura importação exigirá um mapa explícito `identificador legado -> UUID` e
falhará se algum valor estiver ausente, duplicado ou apontar para outro tenant.

## Rollout

1. aplicar a migração `202609210003`;
2. executar o teste adversarial em banco descartável;
3. exportar o manifesto do Diário;
4. validar o mapa dos usuários `2` e `5`;
5. importar em transação idempotente;
6. comparar leituras antes de habilitar qualquer feature flag.

## Rollback

Antes da importação, o rollback apenas remove as quatro tabelas novas. Depois
da importação, exportar a conferência antes de executar o rollback. O Supabase
do Diário permanece operacional durante toda esta etapa.

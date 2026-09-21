# ADR-0008 — Identidades legadas do Diário

- Status: proposto
- Data: 2026-09-21
- Depende de: ADR-0007 e `diario#61`

## Contexto

O Diário autentica sete usuários ativos por uma planilha Google. O backend do
Insight possui duas contas Supabase Auth. A troca direta da origem de dados
deixaria cinco usuários sem acesso e incentivaria o uso operacional indevido da
`service_role` para contornar RLS.

## Decisão

Cada usuário ativo da planilha receberá uma conta própria no Supabase Auth,
preservando a senha atual durante a migração one-shot. A senha será lida em
memória pelo sincronizador do Diário e enviada diretamente à API administrativa
do Auth; não será registrada, exportada ou armazenada em tabelas próprias.

`legacy_identity_map` registra somente tenant, origem, referência legada, UUID e
login normalizado. A tabela e as RPCs de vínculo são exclusivamente
administrativas. Usuários `anon` e `authenticated` não recebem acesso.

Depois que as contas e `tenant_members` existirem, uma RPC transacional remapeia
os vínculos `usuario_grupo` das referências legadas para os novos UUIDs. O UUID
anterior é preservado para rollback.

## Rollout

1. aplicar a migração `202609210005` no Supabase `rede-carreiro`;
2. executar o sincronizador do Diário em dry-run;
3. criar/atualizar as sete contas com um lote identificável;
4. registrar `tenant_members` e chamar a RPC de vínculo;
5. testar login e RLS sem alterar ainda o provedor ativo do Diário;
6. habilitar o novo login por feature flag em PR posterior.

## Rollback

A RPC de reversão restaura os UUIDs anteriores em `usuario_grupo` e remove o
mapa do lote. A remoção das contas criadas é uma etapa explícita e separada do
sincronizador, para evitar exclusões acidentais de usuários preexistentes.

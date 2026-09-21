# Migrações Supabase

Os arquivos em `migrations/` são aplicados em ordem. Os schemas em
`docs/supabase/` continuam sendo o bootstrap das tabelas de domínio; depois
deles, aplique a fundação multi-tenant.

## PR 1 — fundação RLS

1. faça backup lógico ou confirme o backup disponível;
2. execute `migrations/202609210001_tenant_rls_foundation.sql`;
3. execute `migrations/202609210002_revoke_anon_tenant_helpers.sql`;
4. confira que os usuários atuais aparecem em `tenant_members`;
5. em um banco descartável, execute `tests/tenant_rls_adversarial.sql`;
6. só avance o runtime para JWT depois desses checks.

O arquivo `.rollback.sql` restaura o acesso exclusivamente por `service_role`
sem excluir dados das tabelas de domínio. Não aplique a migração nem o rollback
automaticamente em produção a partir de uma PR.

## PR 3 — configurações úteis do Diário

1. execute `migrations/202609210003_configuracoes_legadas_tenant.sql`;
2. em banco descartável, execute `tests/configuracoes_legadas_rls_adversarial.sql`;
3. só importe o manifesto do Diário após mapear cada usuário legado para um UUID
   de `tenant_members` do mesmo tenant;
4. não desligue o Supabase antigo até o aceite do cutover.

## PR 4 — importação transacional

1. execute `migrations/202609210004_importacao_config_diario.sql`;
2. gere o manifesto pelo script versionado no `diario`;
3. execute primeiro `npm run migration:import-diario -- --manifest <arquivo>`;
4. confira o resumo e só então repita adicionando `--apply`;
5. guarde o `batchId` retornado: ele permite rollback seletivo pela função
   `reverter_importacao_diario`.

O mapa de usuários deve ser fornecido por `MIGRACAO_USUARIO_MAP_JSON`. Ele não
é versionado e cada UUID precisa ser membro ativo do tenant `carreiro`.

## PR 5 — identidades da planilha do Diário

1. execute `migrations/202609210005_identidades_legadas_diario.sql`;
2. rode o sincronizador versionado no `diario` primeiro em dry-run;
3. confirme que as sete identidades são únicas e que nenhuma senha é impressa;
4. somente no `--apply`, crie as contas e registre os membros do tenant;
5. chame `vincular_identidades_diario` com o lote retornado;
6. mantenha a autenticação da planilha ativa até concluir testes de login e RLS.

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

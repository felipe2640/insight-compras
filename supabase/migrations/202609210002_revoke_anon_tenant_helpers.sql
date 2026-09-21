begin;

-- Funções SECURITY DEFINER usadas internamente pelas políticas RLS não devem
-- ficar expostas como RPC para sessões anônimas. Usuários autenticados precisam
-- de EXECUTE para que as políticas consigam avaliar a associação ao tenant.
revoke execute on function public.is_tenant_member(text) from anon;
revoke execute on function public.is_tenant_manager(text) from anon;

grant execute on function public.is_tenant_member(text) to authenticated, service_role;
grant execute on function public.is_tenant_manager(text) to authenticated, service_role;

commit;

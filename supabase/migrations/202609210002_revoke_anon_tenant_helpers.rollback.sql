begin;

grant execute on function public.is_tenant_member(text) to anon;
grant execute on function public.is_tenant_manager(text) to anon;

commit;

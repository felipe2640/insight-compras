begin;

delete from public.tenants
where id = 'trairi'
  and not exists (select 1 from public.tenant_members where tenant_id = 'trairi')
  and not exists (select 1 from public.app_members where tenant_id = 'trairi');

commit;

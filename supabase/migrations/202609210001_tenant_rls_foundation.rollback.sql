begin;

-- Rollback operacional: restaura o modelo anterior, fechado para usuários e
-- acessível somente por service_role. Não remove dados de domínio.
do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'aprendizado_snapshot', 'aprendizado_item', 'aprendizado_feedback',
    'aprendizado_confirmacao', 'parametros_modelo', 'exportacao_modelo',
    'demanda_ia_previsao', 'auditoria_pedido', 'configuracao_lotes'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      for policy_name in
        select policyname from pg_policies
        where schemaname = 'public' and tablename = table_name
      loop
        execute format('drop policy if exists %I on public.%I', policy_name, table_name);
      end loop;
      execute format('revoke all on public.%I from anon, authenticated', table_name);
      execute format('grant select, insert, update, delete on public.%I to service_role', table_name);
    end if;
  end loop;
end $$;

alter table public.aprendizado_item
  drop constraint if exists aprendizado_item_tenant_snapshot_fkey,
  add constraint aprendizado_item_snapshot_id_fkey
    foreign key (snapshot_id) references public.aprendizado_snapshot(id) on delete cascade;
alter table public.aprendizado_feedback
  drop constraint if exists aprendizado_feedback_tenant_item_fkey,
  add constraint aprendizado_feedback_item_id_fkey
    foreign key (item_id) references public.aprendizado_item(id) on delete cascade;
alter table public.aprendizado_confirmacao
  drop constraint if exists aprendizado_confirmacao_tenant_item_fkey,
  add constraint aprendizado_confirmacao_item_id_fkey
    foreign key (item_id) references public.aprendizado_item(id) on delete cascade;

alter table public.aprendizado_snapshot
  drop constraint if exists aprendizado_snapshot_tenant_id_id_key;
alter table public.aprendizado_item
  drop constraint if exists aprendizado_item_tenant_id_id_key;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'aprendizado_snapshot', 'aprendizado_item', 'aprendizado_feedback',
    'aprendizado_confirmacao', 'parametros_modelo', 'exportacao_modelo',
    'demanda_ia_previsao', 'auditoria_pedido', 'configuracao_lotes'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I drop constraint if exists %I', table_name, table_name || '_tenant_id_fkey');
    end if;
  end loop;
end $$;

drop policy if exists tenant_members_select_self_or_manager on public.tenant_members;
drop policy if exists tenants_select_member on public.tenants;
drop function if exists public.is_tenant_manager(text);
drop function if exists public.is_tenant_member(text);
drop function if exists public.jwt_tenant_id();
drop table if exists public.tenant_members;
drop table if exists public.tenants;

commit;

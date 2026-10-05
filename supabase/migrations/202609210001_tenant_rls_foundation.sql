begin;

create table if not exists public.tenants (
  id text primary key,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint tenants_id_formato check (id ~ '^[a-z0-9][a-z0-9_-]{1,62}$')
);

create table if not exists public.tenant_members (
  tenant_id text not null references public.tenants(id) on update cascade on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'COMPRADOR',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  constraint tenant_members_papel check (papel in ('ADMIN', 'GESTOR', 'COMPRADOR'))
);

insert into public.tenants (id, nome)
values ('carreiro', 'Rede Carreiro')
on conflict (id) do update set nome = excluded.nome;

-- Compatibilidade com os usuários já existentes. A associação passa a ser a
-- fonte de autorização; app_metadata continua sendo uma defesa adicional.
insert into public.tenant_members (tenant_id, user_id, papel)
select
  u.raw_app_meta_data ->> 'tenant_id',
  u.id,
  case upper(coalesce(u.raw_app_meta_data ->> 'papel', 'COMPRADOR'))
    when 'ADMIN' then 'ADMIN'
    when 'GESTOR' then 'GESTOR'
    else 'COMPRADOR'
  end
from auth.users u
join public.tenants t on t.id = u.raw_app_meta_data ->> 'tenant_id'
where u.raw_app_meta_data ->> 'tenant_id' is not null
on conflict (tenant_id, user_id) do update
set papel = excluded.papel, ativo = true;

create or replace function public.jwt_tenant_id()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '');
$$;

create or replace function public.is_tenant_member(target_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and target_tenant = public.jwt_tenant_id()
    and exists (
      select 1
      from public.tenant_members tm
      join public.tenants t on t.id = tm.tenant_id
      where tm.tenant_id = target_tenant
        and tm.user_id = auth.uid()
        and tm.ativo
        and t.ativo
    );
$$;

create or replace function public.is_tenant_manager(target_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_tenant_member(target_tenant)
    and exists (
      select 1
      from public.tenant_members tm
      where tm.tenant_id = target_tenant
        and tm.user_id = auth.uid()
        and tm.ativo
        and tm.papel in ('ADMIN', 'GESTOR')
    );
$$;

revoke all on function public.jwt_tenant_id() from public;
revoke all on function public.is_tenant_member(text) from public;
revoke all on function public.is_tenant_manager(text) from public;
grant execute on function public.jwt_tenant_id() to authenticated, service_role;
grant execute on function public.is_tenant_member(text) to authenticated, service_role;
grant execute on function public.is_tenant_manager(text) to authenticated, service_role;

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;

drop policy if exists tenants_select_member on public.tenants;
create policy tenants_select_member on public.tenants
  for select to authenticated
  using (public.is_tenant_member(id));

drop policy if exists tenant_members_select_self_or_manager on public.tenant_members;
create policy tenant_members_select_self_or_manager on public.tenant_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_tenant_manager(tenant_id));

revoke all on public.tenants, public.tenant_members from anon, authenticated;
grant select on public.tenants, public.tenant_members to authenticated;
grant select, insert, update, delete on public.tenants, public.tenant_members to service_role;

-- Vincula todos os dados de domínio ao catálogo de tenants.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'aprendizado_snapshot', 'aprendizado_item', 'aprendizado_feedback',
    'aprendizado_confirmacao', 'parametros_modelo', 'exportacao_modelo',
    'demanda_ia_previsao', 'auditoria_pedido', 'configuracao_lotes'
  ] loop
    if to_regclass('public.' || table_name) is not null
       and not exists (
         select 1 from pg_constraint
         where conrelid = to_regclass('public.' || table_name)
           and conname = table_name || '_tenant_id_fkey'
       ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (tenant_id) references public.tenants(id) on update cascade on delete restrict',
        table_name, table_name || '_tenant_id_fkey'
      );
    end if;
  end loop;
end $$;

-- FKs compostas impedem que um filho use um ID válido pertencente a outro tenant.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.aprendizado_snapshot'::regclass
      and conname = 'aprendizado_snapshot_tenant_id_id_key'
  ) then
    alter table public.aprendizado_snapshot
      add constraint aprendizado_snapshot_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.aprendizado_item'::regclass
      and conname = 'aprendizado_item_tenant_id_id_key'
  ) then
    alter table public.aprendizado_item
      add constraint aprendizado_item_tenant_id_id_key unique (tenant_id, id);
  end if;
end $$;

alter table public.aprendizado_item
  drop constraint if exists aprendizado_item_snapshot_id_fkey,
  add constraint aprendizado_item_tenant_snapshot_fkey
    foreign key (tenant_id, snapshot_id)
    references public.aprendizado_snapshot (tenant_id, id)
    on update cascade on delete cascade;

alter table public.aprendizado_feedback
  drop constraint if exists aprendizado_feedback_item_id_fkey,
  add constraint aprendizado_feedback_tenant_item_fkey
    foreign key (tenant_id, item_id)
    references public.aprendizado_item (tenant_id, id)
    on update cascade on delete cascade;

alter table public.aprendizado_confirmacao
  drop constraint if exists aprendizado_confirmacao_item_id_fkey,
  add constraint aprendizado_confirmacao_tenant_item_fkey
    foreign key (tenant_id, item_id)
    references public.aprendizado_item (tenant_id, id)
    on update cascade on delete cascade;

-- Acesso humano usa o JWT real. service_role continua disponível para
-- migrações, administração e jobs privilegiados, e jamais é concedida ao browser.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'aprendizado_snapshot', 'aprendizado_item', 'aprendizado_feedback',
    'aprendizado_confirmacao', 'parametros_modelo', 'exportacao_modelo',
    'demanda_ia_previsao', 'auditoria_pedido', 'configuracao_lotes'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on public.%I from anon, authenticated', table_name);
      execute format('grant select on public.%I to authenticated', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_select_tenant', table_name);
      execute format(
        'create policy %I on public.%I for select to authenticated using (public.is_tenant_member(tenant_id))',
        table_name || '_select_tenant', table_name
      );
    end if;
  end loop;
end $$;

-- Tabelas interativas. As APIs ainda aplicam RBAC; o banco garante a fronteira
-- de tenant mesmo diante de filtro ausente ou payload adulterado.
grant insert, update on public.aprendizado_snapshot, public.aprendizado_item,
  public.aprendizado_feedback, public.aprendizado_confirmacao to authenticated;
grant insert, update, delete on public.exportacao_modelo to authenticated;
grant insert, update on public.parametros_modelo to authenticated;

create policy aprendizado_snapshot_insert_tenant on public.aprendizado_snapshot
  for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy aprendizado_snapshot_update_tenant on public.aprendizado_snapshot
  for update to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy aprendizado_item_insert_tenant on public.aprendizado_item
  for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy aprendizado_item_update_tenant on public.aprendizado_item
  for update to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy aprendizado_feedback_insert_tenant on public.aprendizado_feedback
  for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy aprendizado_feedback_update_tenant on public.aprendizado_feedback
  for update to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy aprendizado_confirmacao_insert_tenant on public.aprendizado_confirmacao
  for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy aprendizado_confirmacao_update_tenant on public.aprendizado_confirmacao
  for update to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy exportacao_modelo_insert_tenant on public.exportacao_modelo
  for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy exportacao_modelo_update_tenant on public.exportacao_modelo
  for update to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));
create policy exportacao_modelo_delete_tenant on public.exportacao_modelo
  for delete to authenticated using (public.is_tenant_member(tenant_id));

create policy parametros_modelo_insert_manager on public.parametros_modelo
  for insert to authenticated with check (public.is_tenant_manager(tenant_id));
create policy parametros_modelo_update_manager on public.parametros_modelo
  for update to authenticated
  using (public.is_tenant_manager(tenant_id))
  with check (public.is_tenant_manager(tenant_id));

-- Identidades geradas por sequence também precisam de USAGE para INSERT REST.
grant usage, select on all sequences in schema public to authenticated;

comment on table public.tenant_members is
  'Fonte de autorização tenant por usuário; app_metadata.tenant_id deve coincidir como defesa adicional.';

commit;

begin;

create schema if not exists private;

create table if not exists public.app_members (
  tenant_id text not null references public.tenants(id) on update cascade on delete restrict,
  app_id text not null check (app_id ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_type text not null default 'human' check (account_type in ('human', 'runtime', 'job')),
  legacy_user_ref text,
  username text not null,
  username_normalized text not null,
  papel text not null check (papel in ('admin', 'user')),
  loja_ids text[],
  allowed_supplier_ids text[],
  allowed_supplier_ids_unrestricted boolean not null default false,
  allowed_page_ids text[] not null default '{}',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, app_id, user_id),
  unique (tenant_id, app_id, legacy_user_ref),
  unique (tenant_id, app_id, username_normalized)
);

create index if not exists app_members_scope_user_idx
  on public.app_members (tenant_id, app_id, user_id);
create index if not exists app_members_scope_legacy_idx
  on public.app_members (tenant_id, app_id, legacy_user_ref);

create table if not exists public.diario_lojas (
  tenant_id text not null references public.tenants(id) on update cascade on delete restrict,
  app_id text not null default 'diario' check (app_id = 'diario'),
  id text not null,
  nome text not null default '',
  completo text not null default '',
  imagem_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, app_id, id)
);

-- The four tables were created by 003/004 without an app dimension. Existing
-- rows are the Diario configuration and are explicitly marked as such.
alter table public.fornecedor_grupo add column if not exists app_id text;
update public.fornecedor_grupo set app_id = 'diario' where app_id is null;
alter table public.fornecedor_grupo alter column app_id set default 'diario';
alter table public.fornecedor_grupo alter column app_id set not null;
alter table public.fornecedor_grupo
  drop constraint if exists fornecedor_grupo_app_id_check,
  add constraint fornecedor_grupo_app_id_check check (app_id = 'diario');

alter table public.usuario_grupo add column if not exists app_id text;
update public.usuario_grupo set app_id = 'diario' where app_id is null;
alter table public.usuario_grupo alter column app_id set default 'diario';
alter table public.usuario_grupo alter column app_id set not null;
alter table public.usuario_grupo
  drop constraint if exists usuario_grupo_app_id_check,
  add constraint usuario_grupo_app_id_check check (app_id = 'diario');

alter table public.secao_multiplo_compra add column if not exists app_id text;
update public.secao_multiplo_compra set app_id = 'diario' where app_id is null;
alter table public.secao_multiplo_compra alter column app_id set default 'diario';
alter table public.secao_multiplo_compra alter column app_id set not null;
alter table public.secao_multiplo_compra
  drop constraint if exists secao_multiplo_compra_app_id_check,
  add constraint secao_multiplo_compra_app_id_check check (app_id = 'diario');

alter table public.margem_alvo add column if not exists app_id text;
update public.margem_alvo set app_id = 'diario' where app_id is null;
alter table public.margem_alvo alter column app_id set default 'diario';
alter table public.margem_alvo alter column app_id set not null;
alter table public.margem_alvo
  drop constraint if exists margem_alvo_app_id_check,
  add constraint margem_alvo_app_id_check check (app_id = 'diario');

alter table public.fornecedor_grupo
  drop constraint if exists fornecedor_grupo_pkey,
  drop constraint if exists fornecedor_grupo_tenant_id_nome_key,
  drop constraint if exists fornecedor_grupo_tenant_id_legacy_id_key;
alter table public.fornecedor_grupo
  add constraint fornecedor_grupo_pkey primary key (tenant_id, app_id, id),
  add constraint fornecedor_grupo_tenant_app_nome_key unique (tenant_id, app_id, nome),
  add constraint fornecedor_grupo_tenant_app_legacy_id_key unique (tenant_id, app_id, legacy_id);

alter table public.secao_multiplo_compra
  drop constraint if exists secao_multiplo_compra_pkey;
alter table public.secao_multiplo_compra
  add constraint secao_multiplo_compra_pkey primary key (tenant_id, app_id, secao_id);

alter table public.margem_alvo
  drop constraint if exists margem_alvo_pkey,
  drop constraint if exists margem_alvo_tenant_id_escopo_chave_mes_key,
  drop constraint if exists margem_alvo_tenant_id_legacy_id_key;
alter table public.margem_alvo
  add constraint margem_alvo_pkey primary key (tenant_id, app_id, id),
  add constraint margem_alvo_tenant_app_escopo_chave_mes_key unique (tenant_id, app_id, escopo, chave, mes),
  add constraint margem_alvo_tenant_app_legacy_id_key unique (tenant_id, app_id, legacy_id);

alter table public.usuario_grupo
  drop constraint if exists usuario_grupo_pkey,
  drop constraint if exists usuario_grupo_tenant_member_fkey,
  drop constraint if exists usuario_grupo_tenant_grupo_fkey;
alter table public.usuario_grupo
  add constraint usuario_grupo_pkey primary key (tenant_id, app_id, user_id, grupo_id),
  add constraint usuario_grupo_app_member_fkey
    foreign key (tenant_id, app_id, user_id)
    references public.app_members (tenant_id, app_id, user_id)
    on update cascade on delete cascade,
  add constraint usuario_grupo_app_grupo_fkey
    foreign key (tenant_id, app_id, grupo_id)
    references public.fornecedor_grupo (tenant_id, app_id, id)
    on update cascade on delete cascade;

create index if not exists fornecedor_grupo_scope_idx
  on public.fornecedor_grupo (tenant_id, app_id, id);
create index if not exists usuario_grupo_scope_user_idx
  on public.usuario_grupo (tenant_id, app_id, user_id);
create index if not exists usuario_grupo_scope_group_idx
  on public.usuario_grupo (tenant_id, app_id, grupo_id);
create index if not exists secao_multiplo_scope_idx
  on public.secao_multiplo_compra (tenant_id, app_id, secao_id);
create index if not exists margem_alvo_scope_idx
  on public.margem_alvo (tenant_id, app_id, id);

create table if not exists public.margem_alerta (
  tenant_id text not null references public.tenants(id) on update cascade on delete restrict,
  app_id text not null default 'diario' check (app_id = 'diario'),
  id bigint generated always as identity,
  produto_id text not null,
  mes text not null,
  acao text,
  usuario text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, app_id, id),
  unique (tenant_id, app_id, produto_id, mes)
);

create table if not exists public.margem_mensal (
  tenant_id text not null references public.tenants(id) on update cascade on delete restrict,
  app_id text not null default 'diario' check (app_id = 'diario'),
  mes text not null,
  produto_id text not null,
  fornecedor_id text,
  qtd numeric,
  receita numeric,
  custo_unit numeric,
  margem_pct numeric,
  primary key (tenant_id, app_id, mes, produto_id)
);

create table if not exists public.margem_tendencia (
  tenant_id text not null references public.tenants(id) on update cascade on delete restrict,
  app_id text not null default 'diario' check (app_id = 'diario'),
  loja text not null,
  mes text not null,
  receita numeric not null default 0,
  custo numeric not null default 0,
  itens integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, app_id, loja, mes)
);

create or replace function private.is_app_member(target_tenant text, target_app text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and target_tenant = nullif((select auth.jwt() -> 'app_metadata' ->> 'tenant_id'), '')
    and target_app = nullif((select auth.jwt() -> 'app_metadata' ->> 'app_id'), '')
    and exists (
      select 1
      from public.app_members am
      join public.tenants t on t.id = am.tenant_id
      where am.tenant_id = target_tenant
        and am.app_id = target_app
        and am.user_id = (select auth.uid())
        and am.ativo
        and t.ativo
    );
$$;

create or replace function private.is_app_manager(target_tenant text, target_app text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_app_member(target_tenant, target_app)
    and exists (
      select 1 from public.app_members am
      where am.tenant_id = target_tenant
        and am.app_id = target_app
        and am.user_id = (select auth.uid())
        and am.ativo
        and am.papel = 'admin'
    );
$$;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke all on function private.is_app_member(text, text) from public, anon, authenticated, service_role;
revoke all on function private.is_app_manager(text, text) from public, anon, authenticated, service_role;
grant execute on function private.is_app_member(text, text) to authenticated;
grant execute on function private.is_app_manager(text, text) to authenticated;

alter table public.app_members enable row level security;
alter table public.diario_lojas enable row level security;
alter table public.fornecedor_grupo enable row level security;
alter table public.usuario_grupo enable row level security;
alter table public.secao_multiplo_compra enable row level security;
alter table public.margem_alvo enable row level security;
alter table public.margem_alerta enable row level security;
alter table public.margem_mensal enable row level security;
alter table public.margem_tendencia enable row level security;

drop policy if exists app_members_select_self_or_manager on public.app_members;
create policy app_members_select_self_or_manager on public.app_members
  for select to authenticated
  using (
    private.is_app_member(tenant_id, app_id)
    and (
      user_id = (select auth.uid())
      or private.is_app_manager(tenant_id, app_id)
    )
  );

drop policy if exists diario_lojas_select_member on public.diario_lojas;
create policy diario_lojas_select_member on public.diario_lojas
  for select to authenticated using (private.is_app_member(tenant_id, app_id));
drop policy if exists diario_lojas_insert_manager on public.diario_lojas;
create policy diario_lojas_insert_manager on public.diario_lojas
  for insert to authenticated with check (private.is_app_manager(tenant_id, app_id));
drop policy if exists diario_lojas_update_manager on public.diario_lojas;
create policy diario_lojas_update_manager on public.diario_lojas
  for update to authenticated
  using (private.is_app_manager(tenant_id, app_id))
  with check (private.is_app_manager(tenant_id, app_id));
drop policy if exists diario_lojas_delete_manager on public.diario_lojas;
create policy diario_lojas_delete_manager on public.diario_lojas
  for delete to authenticated using (private.is_app_manager(tenant_id, app_id));

drop policy if exists fornecedor_grupo_select_tenant on public.fornecedor_grupo;
drop policy if exists fornecedor_grupo_insert_manager on public.fornecedor_grupo;
drop policy if exists fornecedor_grupo_update_manager on public.fornecedor_grupo;
drop policy if exists fornecedor_grupo_delete_manager on public.fornecedor_grupo;
create policy fornecedor_grupo_select_tenant on public.fornecedor_grupo
  for select to authenticated using (private.is_app_member(tenant_id, app_id));
create policy fornecedor_grupo_insert_manager on public.fornecedor_grupo
  for insert to authenticated with check (private.is_app_manager(tenant_id, app_id));
create policy fornecedor_grupo_update_manager on public.fornecedor_grupo
  for update to authenticated
  using (private.is_app_manager(tenant_id, app_id))
  with check (private.is_app_manager(tenant_id, app_id));
create policy fornecedor_grupo_delete_manager on public.fornecedor_grupo
  for delete to authenticated using (private.is_app_manager(tenant_id, app_id));

drop policy if exists usuario_grupo_select_self_or_manager on public.usuario_grupo;
drop policy if exists usuario_grupo_insert_manager on public.usuario_grupo;
drop policy if exists usuario_grupo_update_manager on public.usuario_grupo;
drop policy if exists usuario_grupo_delete_manager on public.usuario_grupo;
create policy usuario_grupo_select_self_or_manager on public.usuario_grupo
  for select to authenticated
  using (private.is_app_member(tenant_id, app_id) and (user_id = (select auth.uid()) or private.is_app_manager(tenant_id, app_id)));
create policy usuario_grupo_insert_manager on public.usuario_grupo
  for insert to authenticated with check (private.is_app_manager(tenant_id, app_id));
create policy usuario_grupo_update_manager on public.usuario_grupo
  for update to authenticated
  using (private.is_app_manager(tenant_id, app_id))
  with check (private.is_app_manager(tenant_id, app_id));
create policy usuario_grupo_delete_manager on public.usuario_grupo
  for delete to authenticated using (private.is_app_manager(tenant_id, app_id));

drop policy if exists secao_multiplo_compra_select_tenant on public.secao_multiplo_compra;
drop policy if exists secao_multiplo_compra_insert_manager on public.secao_multiplo_compra;
drop policy if exists secao_multiplo_compra_update_manager on public.secao_multiplo_compra;
drop policy if exists secao_multiplo_compra_delete_manager on public.secao_multiplo_compra;
create policy secao_multiplo_compra_select_tenant on public.secao_multiplo_compra
  for select to authenticated using (private.is_app_member(tenant_id, app_id));
create policy secao_multiplo_compra_insert_manager on public.secao_multiplo_compra
  for insert to authenticated with check (private.is_app_manager(tenant_id, app_id));
create policy secao_multiplo_compra_update_manager on public.secao_multiplo_compra
  for update to authenticated
  using (private.is_app_manager(tenant_id, app_id))
  with check (private.is_app_manager(tenant_id, app_id));
create policy secao_multiplo_compra_delete_manager on public.secao_multiplo_compra
  for delete to authenticated using (private.is_app_manager(tenant_id, app_id));

drop policy if exists margem_alvo_select_tenant on public.margem_alvo;
drop policy if exists margem_alvo_insert_manager on public.margem_alvo;
drop policy if exists margem_alvo_update_manager on public.margem_alvo;
drop policy if exists margem_alvo_delete_manager on public.margem_alvo;
create policy margem_alvo_select_tenant on public.margem_alvo
  for select to authenticated using (private.is_app_member(tenant_id, app_id));
create policy margem_alvo_insert_manager on public.margem_alvo
  for insert to authenticated with check (private.is_app_manager(tenant_id, app_id));
create policy margem_alvo_update_manager on public.margem_alvo
  for update to authenticated
  using (private.is_app_manager(tenant_id, app_id))
  with check (private.is_app_manager(tenant_id, app_id));
create policy margem_alvo_delete_manager on public.margem_alvo
  for delete to authenticated using (private.is_app_manager(tenant_id, app_id));

drop policy if exists margem_alerta_all_member on public.margem_alerta;
create policy margem_alerta_all_member on public.margem_alerta
  for all to authenticated
  using (private.is_app_member(tenant_id, app_id))
  with check (private.is_app_member(tenant_id, app_id));
drop policy if exists margem_mensal_all_member on public.margem_mensal;
create policy margem_mensal_all_member on public.margem_mensal
  for all to authenticated
  using (private.is_app_member(tenant_id, app_id))
  with check (private.is_app_member(tenant_id, app_id));
drop policy if exists margem_tendencia_all_member on public.margem_tendencia;
create policy margem_tendencia_all_member on public.margem_tendencia
  for all to authenticated
  using (private.is_app_member(tenant_id, app_id))
  with check (private.is_app_member(tenant_id, app_id));

revoke all on public.app_members, public.diario_lojas, public.fornecedor_grupo,
  public.usuario_grupo, public.secao_multiplo_compra, public.margem_alvo,
  public.margem_alerta, public.margem_mensal, public.margem_tendencia
  from anon, authenticated;
grant select on public.app_members, public.diario_lojas, public.fornecedor_grupo,
  public.usuario_grupo, public.secao_multiplo_compra, public.margem_alvo,
  public.margem_alerta, public.margem_mensal, public.margem_tendencia to authenticated;
grant insert, update, delete on public.diario_lojas, public.fornecedor_grupo,
  public.usuario_grupo, public.secao_multiplo_compra, public.margem_alvo,
  public.margem_alerta, public.margem_mensal, public.margem_tendencia to authenticated;
grant select, insert, update, delete on public.app_members, public.diario_lojas,
  public.fornecedor_grupo, public.usuario_grupo, public.secao_multiplo_compra,
  public.margem_alvo, public.margem_alerta, public.margem_mensal,
  public.margem_tendencia to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

comment on table public.app_members is
  'Membership scoped by tenant and application; Diario users are intentionally not tenant_members.';
comment on column public.usuario_grupo.legacy_user_ref is
  'Diario spreadsheet id retained for traceability; authorization uses app_members UUID.';

commit;

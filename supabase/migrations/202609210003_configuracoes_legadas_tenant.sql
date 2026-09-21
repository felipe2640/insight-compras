begin;

create table public.fornecedor_grupo (
  tenant_id text not null references public.tenants(id) on update cascade on delete restrict,
  id bigint generated always as identity,
  legacy_id bigint,
  nome text not null,
  fornecedor_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, nome),
  unique (tenant_id, legacy_id)
);

create table public.usuario_grupo (
  tenant_id text not null,
  user_id uuid not null,
  grupo_id bigint not null,
  legacy_user_ref text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id, grupo_id),
  constraint usuario_grupo_tenant_member_fkey
    foreign key (tenant_id, user_id)
    references public.tenant_members (tenant_id, user_id)
    on update cascade on delete cascade,
  constraint usuario_grupo_tenant_grupo_fkey
    foreign key (tenant_id, grupo_id)
    references public.fornecedor_grupo (tenant_id, id)
    on update cascade on delete cascade
);

create table public.secao_multiplo_compra (
  tenant_id text not null references public.tenants(id) on update cascade on delete restrict,
  secao_id bigint not null,
  secao_nome text not null,
  multiplo smallint not null default 1 check (multiplo in (1, 2)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, secao_id)
);

create table public.margem_alvo (
  tenant_id text not null references public.tenants(id) on update cascade on delete restrict,
  id bigint generated always as identity,
  legacy_id bigint,
  escopo text not null check (escopo in ('global', 'fornecedor', 'item')),
  chave text not null default '',
  margem_min_pct numeric not null,
  mes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, escopo, chave, mes),
  unique (tenant_id, legacy_id)
);

alter table public.fornecedor_grupo enable row level security;
alter table public.usuario_grupo enable row level security;
alter table public.secao_multiplo_compra enable row level security;
alter table public.margem_alvo enable row level security;

revoke all on public.fornecedor_grupo, public.usuario_grupo,
  public.secao_multiplo_compra, public.margem_alvo from anon, authenticated;

grant select on public.fornecedor_grupo, public.secao_multiplo_compra,
  public.margem_alvo to authenticated;
grant select on public.usuario_grupo to authenticated;
grant insert, update, delete on public.fornecedor_grupo, public.usuario_grupo,
  public.secao_multiplo_compra, public.margem_alvo to authenticated;
grant select, insert, update, delete on public.fornecedor_grupo,
  public.usuario_grupo, public.secao_multiplo_compra, public.margem_alvo to service_role;

create policy fornecedor_grupo_select_tenant on public.fornecedor_grupo
  for select to authenticated using (public.is_tenant_member(tenant_id));
create policy fornecedor_grupo_insert_manager on public.fornecedor_grupo
  for insert to authenticated with check (public.is_tenant_manager(tenant_id));
create policy fornecedor_grupo_update_manager on public.fornecedor_grupo
  for update to authenticated
  using (public.is_tenant_manager(tenant_id))
  with check (public.is_tenant_manager(tenant_id));
create policy fornecedor_grupo_delete_manager on public.fornecedor_grupo
  for delete to authenticated using (public.is_tenant_manager(tenant_id));

create policy usuario_grupo_select_self_or_manager on public.usuario_grupo
  for select to authenticated
  using (user_id = auth.uid() or public.is_tenant_manager(tenant_id));
create policy usuario_grupo_insert_manager on public.usuario_grupo
  for insert to authenticated with check (public.is_tenant_manager(tenant_id));
create policy usuario_grupo_update_manager on public.usuario_grupo
  for update to authenticated
  using (public.is_tenant_manager(tenant_id))
  with check (public.is_tenant_manager(tenant_id));
create policy usuario_grupo_delete_manager on public.usuario_grupo
  for delete to authenticated using (public.is_tenant_manager(tenant_id));

create policy secao_multiplo_compra_select_tenant on public.secao_multiplo_compra
  for select to authenticated using (public.is_tenant_member(tenant_id));
create policy secao_multiplo_compra_insert_manager on public.secao_multiplo_compra
  for insert to authenticated with check (public.is_tenant_manager(tenant_id));
create policy secao_multiplo_compra_update_manager on public.secao_multiplo_compra
  for update to authenticated
  using (public.is_tenant_manager(tenant_id))
  with check (public.is_tenant_manager(tenant_id));
create policy secao_multiplo_compra_delete_manager on public.secao_multiplo_compra
  for delete to authenticated using (public.is_tenant_manager(tenant_id));

create policy margem_alvo_select_tenant on public.margem_alvo
  for select to authenticated using (public.is_tenant_member(tenant_id));
create policy margem_alvo_insert_manager on public.margem_alvo
  for insert to authenticated with check (public.is_tenant_manager(tenant_id));
create policy margem_alvo_update_manager on public.margem_alvo
  for update to authenticated
  using (public.is_tenant_manager(tenant_id))
  with check (public.is_tenant_manager(tenant_id));
create policy margem_alvo_delete_manager on public.margem_alvo
  for delete to authenticated using (public.is_tenant_manager(tenant_id));

grant usage, select on sequence public.fornecedor_grupo_id_seq to authenticated, service_role;
grant usage, select on sequence public.margem_alvo_id_seq to authenticated, service_role;

comment on column public.usuario_grupo.legacy_user_ref is
  'Identificador do Diário preservado apenas para rastreabilidade; autorização usa user_id UUID.';

commit;

begin;

create table public.legacy_identity_map (
  tenant_id text not null,
  source text not null check (source = 'diario'),
  legacy_user_ref text not null,
  user_id uuid not null,
  login_normalizado text not null,
  previous_user_id uuid,
  previous_migration_batch_id uuid,
  migration_batch_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, source, legacy_user_ref),
  unique (tenant_id, source, user_id),
  constraint legacy_identity_map_member_fkey
    foreign key (tenant_id, user_id)
    references public.tenant_members (tenant_id, user_id)
    on update cascade on delete cascade,
  constraint legacy_identity_map_previous_member_fkey
    foreign key (tenant_id, previous_user_id)
    references public.tenant_members (tenant_id, user_id)
    on update cascade on delete restrict
);

alter table public.legacy_identity_map enable row level security;
revoke all on public.legacy_identity_map from public, anon, authenticated;
grant select, insert, update, delete on public.legacy_identity_map to service_role;

create or replace function public.vincular_identidades_diario(
  p_tenant_id text,
  p_vinculos jsonb,
  p_batch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_vinculos_atualizados integer;
  v_item record;
begin
  if p_tenant_id <> 'carreiro' or p_batch_id is null then
    raise exception 'tenant ou lote inválido';
  end if;
  if jsonb_typeof(p_vinculos) <> 'array' or jsonb_array_length(p_vinculos) = 0 then
    raise exception 'mapa de identidades vazio ou inválido';
  end if;

  v_total := jsonb_array_length(p_vinculos);
  if (select count(distinct value ->> 'legacyUserRef') from jsonb_array_elements(p_vinculos)) <> v_total
    or (select count(distinct value ->> 'userId') from jsonb_array_elements(p_vinculos)) <> v_total
  then
    raise exception 'referências legadas e UUIDs devem ser únicos';
  end if;

  for v_item in
    select *
    from jsonb_to_recordset(p_vinculos)
      as x("legacyUserRef" text, "userId" uuid, "loginNormalizado" text)
  loop
    if v_item."legacyUserRef" is null
      or v_item."userId" is null
      or nullif(trim(v_item."loginNormalizado"), '') is null
    then
      raise exception 'identidade legada incompleta';
    end if;
    if not exists (
      select 1
      from public.tenant_members tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = v_item."userId"
        and tm.ativo
    ) then
      raise exception 'usuário % não é membro ativo do tenant', v_item."legacyUserRef";
    end if;
  end loop;

  insert into public.legacy_identity_map (
    tenant_id,
    source,
    legacy_user_ref,
    user_id,
    login_normalizado,
    previous_user_id,
    previous_migration_batch_id,
    migration_batch_id
  )
  select
    p_tenant_id,
    'diario',
    x."legacyUserRef",
    x."userId",
    x."loginNormalizado",
    (
      select min(ug.user_id::text)::uuid
      from public.usuario_grupo ug
      where ug.tenant_id = p_tenant_id
        and ug.legacy_user_ref = x."legacyUserRef"
    ),
    (
      select min(ug.migration_batch_id::text)::uuid
      from public.usuario_grupo ug
      where ug.tenant_id = p_tenant_id
        and ug.legacy_user_ref = x."legacyUserRef"
    ),
    p_batch_id
  from jsonb_to_recordset(p_vinculos)
    as x("legacyUserRef" text, "userId" uuid, "loginNormalizado" text)
  on conflict (tenant_id, source, legacy_user_ref) do update set
    user_id = excluded.user_id,
    login_normalizado = excluded.login_normalizado,
    previous_user_id = coalesce(
      public.legacy_identity_map.previous_user_id,
      excluded.previous_user_id
    ),
    previous_migration_batch_id = coalesce(
      public.legacy_identity_map.previous_migration_batch_id,
      excluded.previous_migration_batch_id
    ),
    migration_batch_id = excluded.migration_batch_id,
    updated_at = now();

  if exists (
    select 1
    from public.usuario_grupo antigo
    join public.legacy_identity_map mapa
      on mapa.tenant_id = antigo.tenant_id
      and mapa.source = 'diario'
      and mapa.legacy_user_ref = antigo.legacy_user_ref
    join public.usuario_grupo existente
      on existente.tenant_id = antigo.tenant_id
      and existente.user_id = mapa.user_id
      and existente.grupo_id = antigo.grupo_id
      and existente.user_id <> antigo.user_id
    where antigo.tenant_id = p_tenant_id
      and mapa.migration_batch_id = p_batch_id
  ) then
    raise exception 'remapeamento criaria vínculo duplicado de grupo';
  end if;

  update public.usuario_grupo ug
  set user_id = mapa.user_id,
      migration_batch_id = p_batch_id
  from public.legacy_identity_map mapa
  where mapa.tenant_id = p_tenant_id
    and mapa.source = 'diario'
    and mapa.migration_batch_id = p_batch_id
    and ug.tenant_id = mapa.tenant_id
    and ug.legacy_user_ref = mapa.legacy_user_ref
    and ug.user_id <> mapa.user_id;
  get diagnostics v_vinculos_atualizados = row_count;

  return jsonb_build_object(
    'tenantId', p_tenant_id,
    'batchId', p_batch_id,
    'identidades', v_total,
    'vinculosAtualizados', v_vinculos_atualizados
  );
end;
$$;

create or replace function public.reverter_identidades_diario(
  p_tenant_id text,
  p_batch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vinculos_restaurados integer;
  v_identidades_removidas integer;
begin
  update public.usuario_grupo ug
  set user_id = mapa.previous_user_id,
      migration_batch_id = mapa.previous_migration_batch_id
  from public.legacy_identity_map mapa
  where mapa.tenant_id = p_tenant_id
    and mapa.source = 'diario'
    and mapa.migration_batch_id = p_batch_id
    and mapa.previous_user_id is not null
    and ug.tenant_id = mapa.tenant_id
    and ug.legacy_user_ref = mapa.legacy_user_ref
    and ug.user_id = mapa.user_id;
  get diagnostics v_vinculos_restaurados = row_count;

  delete from public.legacy_identity_map
  where tenant_id = p_tenant_id
    and source = 'diario'
    and migration_batch_id = p_batch_id;
  get diagnostics v_identidades_removidas = row_count;

  return jsonb_build_object(
    'tenantId', p_tenant_id,
    'batchId', p_batch_id,
    'identidadesRemovidas', v_identidades_removidas,
    'vinculosRestaurados', v_vinculos_restaurados
  );
end;
$$;

revoke all on function public.vincular_identidades_diario(text, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.reverter_identidades_diario(text, uuid)
  from public, anon, authenticated;
grant execute on function public.vincular_identidades_diario(text, jsonb, uuid)
  to service_role;
grant execute on function public.reverter_identidades_diario(text, uuid)
  to service_role;

comment on table public.legacy_identity_map is
  'Mapa administrativo entre identidades externas legadas e Supabase Auth; nunca contém senhas.';

commit;

begin;

alter table public.fornecedor_grupo add column migration_batch_id uuid;
alter table public.usuario_grupo add column migration_batch_id uuid;
alter table public.secao_multiplo_compra add column migration_batch_id uuid;
alter table public.margem_alvo add column migration_batch_id uuid;

create or replace function public.importar_configuracoes_diario(
  p_tenant_id text,
  p_manifesto jsonb,
  p_mapa_usuarios jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_id uuid := gen_random_uuid();
  v_ref text;
  v_user_id uuid;
  v_grupos integer;
  v_vinculos integer;
  v_secoes integer;
  v_margens integer;
begin
  if p_tenant_id <> 'carreiro'
    or p_manifesto ->> 'tenantId' <> p_tenant_id
    or p_manifesto ->> 'origem' <> 'diario'
    or p_manifesto ->> 'destino' <> 'insight-compras'
  then
    raise exception 'tenant do manifesto inválido';
  end if;
  if p_manifesto ->> 'schemaVersion' <> '1' or coalesce((p_manifesto ->> 'somenteConfiguracoes')::boolean, false) is not true then
    raise exception 'manifesto incompatível';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id and ativo) then
    raise exception 'tenant de destino ausente ou inativo';
  end if;
  if coalesce((p_manifesto #>> '{contagens,fornecedor_grupo}')::integer, -1)
      <> jsonb_array_length(coalesce(p_manifesto #> '{dados,fornecedor_grupo}', '[]'::jsonb))
    or coalesce((p_manifesto #>> '{contagens,usuario_grupo}')::integer, -1)
      <> jsonb_array_length(coalesce(p_manifesto #> '{dados,usuario_grupo}', '[]'::jsonb))
    or coalesce((p_manifesto #>> '{contagens,secao_multiplo_compra}')::integer, -1)
      <> jsonb_array_length(coalesce(p_manifesto #> '{dados,secao_multiplo_compra}', '[]'::jsonb))
    or coalesce((p_manifesto #>> '{contagens,margem_alvo}')::integer, -1)
      <> jsonb_array_length(coalesce(p_manifesto #> '{dados,margem_alvo}', '[]'::jsonb))
  then
    raise exception 'contagens do manifesto não conferem com os dados';
  end if;

  for v_ref in
    select distinct value ->> 'user_id'
    from jsonb_array_elements(coalesce(p_manifesto #> '{dados,usuario_grupo}', '[]'::jsonb))
  loop
    if not (p_mapa_usuarios ? v_ref) then
      raise exception 'usuário legado sem mapeamento: %', v_ref;
    end if;
    begin
      v_user_id := (p_mapa_usuarios ->> v_ref)::uuid;
    exception when invalid_text_representation then
      raise exception 'UUID inválido para usuário legado %', v_ref;
    end;
    if not exists (
      select 1 from public.tenant_members
      where tenant_id = p_tenant_id and user_id = v_user_id and ativo
    ) then
      raise exception 'mapeamento fora do tenant ou inativo para usuário legado %', v_ref;
    end if;
  end loop;

  if (
    select count(distinct p_mapa_usuarios ->> (value ->> 'user_id'))
    from jsonb_array_elements(coalesce(p_manifesto #> '{dados,usuario_grupo}', '[]'::jsonb))
  ) <> (
    select count(distinct value ->> 'user_id')
    from jsonb_array_elements(coalesce(p_manifesto #> '{dados,usuario_grupo}', '[]'::jsonb))
  ) then
    raise exception 'usuários legados não podem apontar para o mesmo UUID';
  end if;

  insert into public.fornecedor_grupo (
    tenant_id, legacy_id, nome, fornecedor_ids, created_at, updated_at, migration_batch_id
  )
  select p_tenant_id, x.id, x.nome, coalesce(x.fornecedor_ids, '{}'),
    coalesce(x.created_at, now()), coalesce(x.updated_at, now()), v_batch_id
  from jsonb_to_recordset(coalesce(p_manifesto #> '{dados,fornecedor_grupo}', '[]'::jsonb))
    as x(id bigint, nome text, fornecedor_ids text[], created_at timestamptz, updated_at timestamptz)
  on conflict (tenant_id, legacy_id) do update set
    nome = excluded.nome,
    fornecedor_ids = excluded.fornecedor_ids,
    updated_at = excluded.updated_at,
    migration_batch_id = excluded.migration_batch_id;
  get diagnostics v_grupos = row_count;

  insert into public.usuario_grupo (
    tenant_id, user_id, grupo_id, legacy_user_ref, migration_batch_id
  )
  select p_tenant_id, (p_mapa_usuarios ->> x.user_id)::uuid, g.id, x.user_id, v_batch_id
  from jsonb_to_recordset(coalesce(p_manifesto #> '{dados,usuario_grupo}', '[]'::jsonb))
    as x(user_id text, grupo_id bigint)
  join public.fornecedor_grupo g
    on g.tenant_id = p_tenant_id and g.legacy_id = x.grupo_id
  on conflict (tenant_id, user_id, grupo_id) do update set
    legacy_user_ref = excluded.legacy_user_ref,
    migration_batch_id = excluded.migration_batch_id;
  get diagnostics v_vinculos = row_count;

  if v_vinculos <> jsonb_array_length(coalesce(p_manifesto #> '{dados,usuario_grupo}', '[]'::jsonb)) then
    raise exception 'nem todos os vínculos encontraram um grupo de destino';
  end if;

  insert into public.secao_multiplo_compra (
    tenant_id, secao_id, secao_nome, multiplo, created_at, updated_at, migration_batch_id
  )
  select p_tenant_id, x.secao_id, x.secao_nome, x.multiplo,
    coalesce(x.created_at, now()), coalesce(x.updated_at, now()), v_batch_id
  from jsonb_to_recordset(coalesce(p_manifesto #> '{dados,secao_multiplo_compra}', '[]'::jsonb))
    as x(secao_id bigint, secao_nome text, multiplo smallint, created_at timestamptz, updated_at timestamptz)
  on conflict (tenant_id, secao_id) do update set
    secao_nome = excluded.secao_nome,
    multiplo = excluded.multiplo,
    updated_at = excluded.updated_at,
    migration_batch_id = excluded.migration_batch_id;
  get diagnostics v_secoes = row_count;

  insert into public.margem_alvo (
    tenant_id, legacy_id, escopo, chave, margem_min_pct, mes, updated_at, migration_batch_id
  )
  select p_tenant_id, x.id, x.escopo, coalesce(x.chave, ''), x.margem_min_pct,
    coalesce(x.mes, ''), coalesce(x.updated_at, now()), v_batch_id
  from jsonb_to_recordset(coalesce(p_manifesto #> '{dados,margem_alvo}', '[]'::jsonb))
    as x(id bigint, escopo text, chave text, margem_min_pct numeric, mes text, updated_at timestamptz)
  on conflict (tenant_id, legacy_id) do update set
    escopo = excluded.escopo,
    chave = excluded.chave,
    margem_min_pct = excluded.margem_min_pct,
    mes = excluded.mes,
    updated_at = excluded.updated_at,
    migration_batch_id = excluded.migration_batch_id;
  get diagnostics v_margens = row_count;

  return jsonb_build_object(
    'batchId', v_batch_id,
    'tenantId', p_tenant_id,
    'fornecedorGrupo', v_grupos,
    'usuarioGrupo', v_vinculos,
    'secaoMultiploCompra', v_secoes,
    'margemAlvo', v_margens
  );
end;
$$;

create or replace function public.reverter_importacao_diario(
  p_tenant_id text,
  p_batch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vinculos integer;
  v_grupos integer;
  v_secoes integer;
  v_margens integer;
begin
  delete from public.usuario_grupo where tenant_id = p_tenant_id and migration_batch_id = p_batch_id;
  get diagnostics v_vinculos = row_count;
  delete from public.fornecedor_grupo where tenant_id = p_tenant_id and migration_batch_id = p_batch_id;
  get diagnostics v_grupos = row_count;
  delete from public.secao_multiplo_compra where tenant_id = p_tenant_id and migration_batch_id = p_batch_id;
  get diagnostics v_secoes = row_count;
  delete from public.margem_alvo where tenant_id = p_tenant_id and migration_batch_id = p_batch_id;
  get diagnostics v_margens = row_count;
  return jsonb_build_object(
    'batchId', p_batch_id,
    'tenantId', p_tenant_id,
    'fornecedorGrupo', v_grupos,
    'usuarioGrupo', v_vinculos,
    'secaoMultiploCompra', v_secoes,
    'margemAlvo', v_margens
  );
end;
$$;

revoke all on function public.importar_configuracoes_diario(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.reverter_importacao_diario(text, uuid) from public, anon, authenticated;
grant execute on function public.importar_configuracoes_diario(text, jsonb, jsonb) to service_role;
grant execute on function public.reverter_importacao_diario(text, uuid) to service_role;

commit;

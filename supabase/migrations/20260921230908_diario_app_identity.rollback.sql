begin;

-- Este rollback só é seguro antes do bootstrap/cutover. Ele preserva as
-- configurações já existentes, mas se recusa a apagar identidades ou dados
-- operacionais criados pelo novo runtime.
do $$
begin
  if exists (select 1 from public.app_members)
    or exists (select 1 from public.diario_lojas)
    or exists (select 1 from public.margem_alerta)
    or exists (select 1 from public.margem_mensal)
    or exists (select 1 from public.margem_tendencia)
    or exists (select 1 from public.usuario_grupo)
  then
    raise exception using message =
      'rollback abortado: existem identidades, vínculos ou dados do Diário; use o runbook de rollback de dados';
  end if;
end;
$$;

drop policy if exists app_members_select_self_or_manager on public.app_members;
drop policy if exists diario_lojas_select_member on public.diario_lojas;
drop policy if exists diario_lojas_insert_manager on public.diario_lojas;
drop policy if exists diario_lojas_update_manager on public.diario_lojas;
drop policy if exists diario_lojas_delete_manager on public.diario_lojas;
drop policy if exists margem_alerta_all_member on public.margem_alerta;
drop policy if exists margem_mensal_all_member on public.margem_mensal;
drop policy if exists margem_tendencia_all_member on public.margem_tendencia;

drop policy if exists fornecedor_grupo_select_tenant on public.fornecedor_grupo;
drop policy if exists fornecedor_grupo_insert_manager on public.fornecedor_grupo;
drop policy if exists fornecedor_grupo_update_manager on public.fornecedor_grupo;
drop policy if exists fornecedor_grupo_delete_manager on public.fornecedor_grupo;
drop policy if exists usuario_grupo_select_self_or_manager on public.usuario_grupo;
drop policy if exists usuario_grupo_insert_manager on public.usuario_grupo;
drop policy if exists usuario_grupo_update_manager on public.usuario_grupo;
drop policy if exists usuario_grupo_delete_manager on public.usuario_grupo;
drop policy if exists secao_multiplo_compra_select_tenant on public.secao_multiplo_compra;
drop policy if exists secao_multiplo_compra_insert_manager on public.secao_multiplo_compra;
drop policy if exists secao_multiplo_compra_update_manager on public.secao_multiplo_compra;
drop policy if exists secao_multiplo_compra_delete_manager on public.secao_multiplo_compra;
drop policy if exists margem_alvo_select_tenant on public.margem_alvo;
drop policy if exists margem_alvo_insert_manager on public.margem_alvo;
drop policy if exists margem_alvo_update_manager on public.margem_alvo;
drop policy if exists margem_alvo_delete_manager on public.margem_alvo;

alter table public.usuario_grupo
  drop constraint if exists usuario_grupo_app_member_fkey,
  drop constraint if exists usuario_grupo_app_grupo_fkey,
  drop constraint if exists usuario_grupo_pkey;

alter table public.fornecedor_grupo
  drop constraint if exists fornecedor_grupo_pkey,
  drop constraint if exists fornecedor_grupo_tenant_app_nome_key,
  drop constraint if exists fornecedor_grupo_tenant_app_legacy_id_key,
  drop constraint if exists fornecedor_grupo_app_id_check;
alter table public.fornecedor_grupo
  add constraint fornecedor_grupo_pkey primary key (tenant_id, id),
  add constraint fornecedor_grupo_tenant_id_nome_key unique (tenant_id, nome),
  add constraint fornecedor_grupo_tenant_id_legacy_id_key unique (tenant_id, legacy_id);

alter table public.usuario_grupo
  add constraint usuario_grupo_pkey primary key (tenant_id, user_id, grupo_id),
  add constraint usuario_grupo_tenant_member_fkey
    foreign key (tenant_id, user_id)
    references public.tenant_members (tenant_id, user_id)
    on update cascade on delete cascade,
  add constraint usuario_grupo_tenant_grupo_fkey
    foreign key (tenant_id, grupo_id)
    references public.fornecedor_grupo (tenant_id, id)
    on update cascade on delete cascade;

alter table public.secao_multiplo_compra
  drop constraint if exists secao_multiplo_compra_pkey,
  drop constraint if exists secao_multiplo_compra_app_id_check;
alter table public.secao_multiplo_compra
  add constraint secao_multiplo_compra_pkey primary key (tenant_id, secao_id);

alter table public.margem_alvo
  drop constraint if exists margem_alvo_pkey,
  drop constraint if exists margem_alvo_tenant_app_escopo_chave_mes_key,
  drop constraint if exists margem_alvo_tenant_app_legacy_id_key,
  drop constraint if exists margem_alvo_app_id_check;
alter table public.margem_alvo
  add constraint margem_alvo_pkey primary key (tenant_id, id),
  add constraint margem_alvo_tenant_id_escopo_chave_mes_key unique (tenant_id, escopo, chave, mes),
  add constraint margem_alvo_tenant_id_legacy_id_key unique (tenant_id, legacy_id);

alter table public.usuario_grupo drop constraint if exists usuario_grupo_app_id_check;
alter table public.usuario_grupo drop column if exists app_id;
alter table public.fornecedor_grupo drop column if exists app_id;
alter table public.secao_multiplo_compra drop column if exists app_id;
alter table public.margem_alvo drop column if exists app_id;

create policy fornecedor_grupo_select_tenant on public.fornecedor_grupo
  for select to authenticated using (public.is_tenant_member(tenant_id));
create policy fornecedor_grupo_insert_manager on public.fornecedor_grupo
  for insert to authenticated with check (public.is_tenant_manager(tenant_id));
create policy fornecedor_grupo_update_manager on public.fornecedor_grupo
  for update to authenticated using (public.is_tenant_manager(tenant_id))
  with check (public.is_tenant_manager(tenant_id));
create policy fornecedor_grupo_delete_manager on public.fornecedor_grupo
  for delete to authenticated using (public.is_tenant_manager(tenant_id));

create policy usuario_grupo_select_self_or_manager on public.usuario_grupo
  for select to authenticated using (user_id = (select auth.uid()) or public.is_tenant_manager(tenant_id));
create policy usuario_grupo_insert_manager on public.usuario_grupo
  for insert to authenticated with check (public.is_tenant_manager(tenant_id));
create policy usuario_grupo_update_manager on public.usuario_grupo
  for update to authenticated using (public.is_tenant_manager(tenant_id))
  with check (public.is_tenant_manager(tenant_id));
create policy usuario_grupo_delete_manager on public.usuario_grupo
  for delete to authenticated using (public.is_tenant_manager(tenant_id));

create policy secao_multiplo_compra_select_tenant on public.secao_multiplo_compra
  for select to authenticated using (public.is_tenant_member(tenant_id));
create policy secao_multiplo_compra_insert_manager on public.secao_multiplo_compra
  for insert to authenticated with check (public.is_tenant_manager(tenant_id));
create policy secao_multiplo_compra_update_manager on public.secao_multiplo_compra
  for update to authenticated using (public.is_tenant_manager(tenant_id))
  with check (public.is_tenant_manager(tenant_id));
create policy secao_multiplo_compra_delete_manager on public.secao_multiplo_compra
  for delete to authenticated using (public.is_tenant_manager(tenant_id));

create policy margem_alvo_select_tenant on public.margem_alvo
  for select to authenticated using (public.is_tenant_member(tenant_id));
create policy margem_alvo_insert_manager on public.margem_alvo
  for insert to authenticated with check (public.is_tenant_manager(tenant_id));
create policy margem_alvo_update_manager on public.margem_alvo
  for update to authenticated using (public.is_tenant_manager(tenant_id))
  with check (public.is_tenant_manager(tenant_id));
create policy margem_alvo_delete_manager on public.margem_alvo
  for delete to authenticated using (public.is_tenant_manager(tenant_id));

drop table public.margem_tendencia;
drop table public.margem_mensal;
drop table public.margem_alerta;
drop table public.diario_lojas;
drop table public.app_members;

revoke all on function private.is_app_member(text, text) from public, anon, authenticated, service_role;
revoke all on function private.is_app_manager(text, text) from public, anon, authenticated, service_role;
drop function private.is_app_manager(text, text);
drop function private.is_app_member(text, text);

commit;

-- Execute após todas as migrations de Diario/Insight, somente em banco
-- descartável. Testa isolamento por tenant, aplicação e referências compostas.
begin;

insert into public.tenants (id, nome) values
  ('teste_diario_alpha', 'Diário Alpha'),
  ('teste_diario_beta', 'Diário Beta');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'diario-alpha@test.invalid', '', '{"tenant_id":"teste_diario_alpha","app_id":"diario"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'diario-beta@test.invalid', '', '{"tenant_id":"teste_diario_beta","app_id":"diario"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'insight-alpha@test.invalid', '', '{"tenant_id":"teste_diario_alpha","app_id":"insight-compras"}', '{}', now(), now());

insert into public.app_members (
  tenant_id, app_id, user_id, legacy_user_ref, username,
  username_normalized, papel
) values
  ('teste_diario_alpha', 'diario', 'a1000000-0000-0000-0000-000000000001', 'alpha', 'Alpha', 'alpha', 'admin'),
  ('teste_diario_beta', 'diario', 'b1000000-0000-0000-0000-000000000001', 'beta', 'Beta', 'beta', 'admin');

insert into public.tenant_members (tenant_id, user_id, papel) values
  ('teste_diario_alpha', 'a2000000-0000-0000-0000-000000000002', 'GESTOR'),
  -- Associação acidental não pode transformar um JWT do Diario em Insight.
  ('teste_diario_alpha', 'a1000000-0000-0000-0000-000000000001', 'GESTOR');

insert into public.fornecedor_grupo (tenant_id, app_id, legacy_id, nome, fornecedor_ids) values
  ('teste_diario_alpha', 'diario', 1, 'Grupo Alpha', array['10']),
  ('teste_diario_beta', 'diario', 1, 'Grupo Beta', array['20']);

insert into public.aprendizado_snapshot (
  tenant_id, layout_id, formato, n_itens, usuario
) values
  ('teste_diario_alpha', 'teste', 'xlsx', 1, 'insight-alpha'),
  ('teste_diario_beta', 'teste', 'xlsx', 1, 'insight-beta');

insert into public.aprendizado_item (tenant_id, snapshot_id, produto_id, qtd_comprador)
select tenant_id, id, 1, 2 from public.aprendizado_snapshot
where tenant_id in ('teste_diario_alpha', 'teste_diario_beta');

create temporary table diario_test_groups as
select tenant_id, app_id, id
from public.fornecedor_grupo
where tenant_id in ('teste_diario_alpha', 'teste_diario_beta');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"tenant_id":"teste_diario_alpha","app_id":"diario"}}',
  true
);

do $$
declare
  alpha_count integer;
  beta_count integer;
  insight_count integer;
  alpha_group bigint;
  beta_group bigint;
begin
  select count(*) into alpha_count
  from public.fornecedor_grupo
  where tenant_id = 'teste_diario_alpha' and app_id = 'diario';
  select count(*) into beta_count
  from public.fornecedor_grupo
  where tenant_id = 'teste_diario_beta' and app_id = 'diario';
  if alpha_count <> 1 or beta_count <> 0 then
    raise exception 'SELECT cross-tenant do Diário não foi bloqueado';
  end if;

  select count(*) into insight_count from public.aprendizado_snapshot;
  if insight_count <> 1 then
    raise exception 'Diário não leu somente snapshot do próprio tenant';
  end if;
  select count(*) into insight_count from public.aprendizado_item;
  if insight_count <> 1 then
    raise exception 'Diário não leu somente item do próprio tenant';
  end if;

  begin
    insert into public.aprendizado_snapshot (tenant_id, layout_id, formato, n_itens)
    values ('teste_diario_alpha', 'invasao', 'xlsx', 0);
    raise exception 'JWT do Diário escreveu aprendizado_snapshot';
  exception when insufficient_privilege or check_violation then null;
  end;
  update public.aprendizado_snapshot set usuario = 'invasao'
  where tenant_id = 'teste_diario_alpha';
  if found then
    raise exception 'JWT do Diário atualizou aprendizado_snapshot';
  end if;
  begin
    delete from public.aprendizado_snapshot where tenant_id = 'teste_diario_alpha';
    if found then
      raise exception 'JWT do Diário apagou aprendizado_snapshot';
    end if;
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.margem_alvo (
      tenant_id, app_id, escopo, margem_min_pct
    ) values ('teste_diario_beta', 'diario', 'global', 20);
    raise exception 'INSERT cross-tenant do Diário foi permitido';
  exception when insufficient_privilege or check_violation then null;
  end;

  update public.fornecedor_grupo
  set nome = 'Invadido'
  where tenant_id = 'teste_diario_beta' and app_id = 'diario';
  if found then
    raise exception 'UPDATE cross-tenant do Diário foi permitido';
  end if;

  delete from public.fornecedor_grupo
  where tenant_id = 'teste_diario_beta' and app_id = 'diario';
  if found then
    raise exception 'DELETE cross-tenant do Diário foi permitido';
  end if;

  select id into alpha_group from diario_test_groups
  where tenant_id = 'teste_diario_alpha';
  select id into beta_group from diario_test_groups
  where tenant_id = 'teste_diario_beta';

  begin
    insert into public.usuario_grupo (
      tenant_id, app_id, user_id, grupo_id, legacy_user_ref
    ) values (
      'teste_diario_alpha', 'diario',
      'a1000000-0000-0000-0000-000000000001', beta_group, 'alpha'
    );
    raise exception 'FK composta aceitou grupo de outro tenant';
  exception when foreign_key_violation or insufficient_privilege then null;
  end;

  begin
    insert into public.usuario_grupo (
      tenant_id, app_id, user_id, grupo_id, legacy_user_ref
    ) values (
      'teste_diario_alpha', 'diario',
      'b1000000-0000-0000-0000-000000000001', alpha_group, 'beta'
    );
    raise exception 'FK composta aceitou usuário de outro tenant';
  exception when foreign_key_violation or insufficient_privilege then null;
  end;
end;
$$;

-- O mesmo usuário com app_id diferente deve receber zero linhas.
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"tenant_id":"teste_diario_alpha","app_id":"insight-compras"}}',
  true
);
do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.fornecedor_grupo;
  if visible_count <> 0 then
    raise exception 'SELECT cross-app do Diário não foi bloqueado';
  end if;
  select count(*) into visible_count from public.app_members;
  if visible_count <> 0 then
    raise exception 'app_members vazou com app_id incorreto';
  end if;
end;
$$;

-- Um tenant_member do Insight não ganha acesso às configurações do Diário.
select set_config(
  'request.jwt.claims',
  '{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"tenant_id":"teste_diario_alpha","app_id":"insight-compras"}}',
  true
);
do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.fornecedor_grupo;
  if visible_count <> 0 then
    raise exception 'tenant_member do Insight leu configurações do Diário';
  end if;
end;
$$;

reset role;
-- A FK composta de aprendizado_item deve rejeitar snapshot de outro tenant
-- mesmo para um operador privilegiado que ignore RLS na importação.
do $$
declare
  beta_snapshot bigint;
begin
  select id into beta_snapshot from public.aprendizado_snapshot
  where tenant_id = 'teste_diario_beta' limit 1;
  begin
    insert into public.aprendizado_item (tenant_id, snapshot_id, produto_id, qtd_comprador)
    values ('teste_diario_alpha', beta_snapshot, 999, 1);
    raise exception 'FK composta de aprendizado_item aceitou snapshot cross-tenant';
  exception when foreign_key_violation then null;
  end;
end;
$$;
rollback;

-- Executar após 202609210003_configuracoes_legadas_tenant.sql em banco descartável.
-- Testa SELECT/INSERT/UPDATE/DELETE e FKs compostas sem deixar dados.
begin;

insert into public.tenants (id, nome) values
  ('teste_config_alpha', 'Config Alpha'),
  ('teste_config_beta', 'Config Beta');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'config-alpha@test.invalid', '', '{"tenant_id":"teste_config_alpha","papel":"GESTOR"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'config-beta@test.invalid', '', '{"tenant_id":"teste_config_beta","papel":"GESTOR"}', '{}', now(), now());

insert into public.tenant_members (tenant_id, user_id, papel) values
  ('teste_config_alpha', '30000000-0000-0000-0000-000000000003', 'GESTOR'),
  ('teste_config_beta', '40000000-0000-0000-0000-000000000004', 'GESTOR');

insert into public.fornecedor_grupo (tenant_id, legacy_id, nome, fornecedor_ids) values
  ('teste_config_alpha', 4, 'Grupo Alpha', array['10']),
  ('teste_config_beta', 4, 'Grupo Beta', array['20']);

create temporary table config_test_groups as
select tenant_id, id from public.fornecedor_grupo
where tenant_id in ('teste_config_alpha', 'teste_config_beta');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"tenant_id":"teste_config_alpha"}}', true);

do $$
declare
  alpha_count integer;
  beta_count integer;
  alpha_group bigint;
  beta_group bigint;
begin
  select count(*) into alpha_count from public.fornecedor_grupo where tenant_id = 'teste_config_alpha';
  select count(*) into beta_count from public.fornecedor_grupo where tenant_id = 'teste_config_beta';
  if alpha_count <> 1 or beta_count <> 0 then
    raise exception 'SELECT cross-tenant de configuração não foi bloqueado';
  end if;

  begin
    insert into public.margem_alvo (tenant_id, escopo, margem_min_pct)
    values ('teste_config_beta', 'global', 20);
    raise exception 'INSERT cross-tenant de configuração foi permitido';
  exception when insufficient_privilege or check_violation then null;
  end;

  update public.secao_multiplo_compra set multiplo = 2
  where tenant_id = 'teste_config_beta';
  if found then raise exception 'UPDATE cross-tenant de configuração foi permitido'; end if;

  delete from public.fornecedor_grupo where tenant_id = 'teste_config_beta';
  if found then raise exception 'DELETE cross-tenant de configuração foi permitido'; end if;

  select id into alpha_group from config_test_groups where tenant_id = 'teste_config_alpha';
  select id into beta_group from config_test_groups where tenant_id = 'teste_config_beta';

  begin
    insert into public.usuario_grupo (tenant_id, user_id, grupo_id, legacy_user_ref)
    values ('teste_config_alpha', '30000000-0000-0000-0000-000000000003', beta_group, '2');
    raise exception 'FK composta aceitou grupo de outro tenant';
  exception when foreign_key_violation or insufficient_privilege then null;
  end;

  insert into public.usuario_grupo (tenant_id, user_id, grupo_id, legacy_user_ref)
  values ('teste_config_alpha', '30000000-0000-0000-0000-000000000003', alpha_group, '2');
end $$;

reset role;
rollback;

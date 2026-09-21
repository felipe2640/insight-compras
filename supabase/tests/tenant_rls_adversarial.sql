-- Executar após 202609210001_tenant_rls_foundation.sql em banco descartável.
-- O teste usa transação e não deixa dados para trás.
begin;

insert into public.tenants (id, nome) values
  ('teste_alpha', 'Teste Alpha'),
  ('teste_beta', 'Teste Beta');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'alpha@test.invalid', '', '{"tenant_id":"teste_alpha","papel":"GESTOR"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'beta@test.invalid', '', '{"tenant_id":"teste_beta","papel":"GESTOR"}', '{}', now(), now());

insert into public.tenant_members (tenant_id, user_id, papel) values
  ('teste_alpha', '10000000-0000-0000-0000-000000000001', 'GESTOR'),
  ('teste_beta', '20000000-0000-0000-0000-000000000002', 'GESTOR');

insert into public.aprendizado_snapshot
  (tenant_id, filial_id, usuario, layout_id, formato, n_itens)
values
  ('teste_alpha', 1, 'alpha', 'teste', 'csv', 1),
  ('teste_beta', 1, 'beta', 'teste', 'csv', 1);

insert into public.exportacao_modelo
  (tenant_id, id, nome, escopo, formato, colunas, nome_arquivo)
values
  ('teste_alpha', 'modelo', 'Alpha', 'pedido', 'csv', '[]', 'alpha.csv'),
  ('teste_beta', 'modelo', 'Beta', 'pedido', 'csv', '[]', 'beta.csv');

create temporary table rls_test_ids as
select tenant_id, id from public.aprendizado_snapshot
where tenant_id in ('teste_alpha', 'teste_beta');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"tenant_id":"teste_alpha"}}', true);

do $$
declare
  alpha_count integer;
  beta_count integer;
  alpha_snapshot bigint;
  beta_snapshot bigint;
begin
  select count(*) into alpha_count from public.aprendizado_snapshot where tenant_id = 'teste_alpha';
  select count(*) into beta_count from public.aprendizado_snapshot where tenant_id = 'teste_beta';
  if alpha_count <> 1 or beta_count <> 0 then
    raise exception 'SELECT cross-tenant não foi bloqueado: alpha %, beta %', alpha_count, beta_count;
  end if;

  begin
    insert into public.aprendizado_snapshot
      (tenant_id, filial_id, usuario, layout_id, formato, n_itens)
    values ('teste_beta', 1, 'intruso', 'teste', 'csv', 1);
    raise exception 'INSERT cross-tenant foi permitido';
  exception when insufficient_privilege or check_violation then null;
  end;

  update public.aprendizado_snapshot set usuario = 'intruso'
  where tenant_id = 'teste_beta';
  if found then raise exception 'UPDATE cross-tenant foi permitido'; end if;

  delete from public.exportacao_modelo where tenant_id = 'teste_beta';
  if found then raise exception 'DELETE cross-tenant foi permitido'; end if;

  select id into alpha_snapshot from rls_test_ids where tenant_id = 'teste_alpha';
  select id into beta_snapshot from rls_test_ids where tenant_id = 'teste_beta';

  insert into public.aprendizado_item
    (tenant_id, snapshot_id, produto_id, qtd_comprador, elegivel)
  values ('teste_alpha', alpha_snapshot, 1, 1, true);

  begin
    insert into public.aprendizado_item
      (tenant_id, snapshot_id, produto_id, qtd_comprador, elegivel)
    values ('teste_alpha', beta_snapshot, 2, 1, true);
    raise exception 'FK composta aceitou referência entre tenants';
  exception when foreign_key_violation then null;
  end;
end $$;

reset role;
rollback;

begin;

insert into public.tenants (id, nome, ativo)
values ('trairi', 'Trairi', true)
on conflict (id) do update set
  nome = excluded.nome,
  ativo = excluded.ativo;

comment on table public.tenants is
  'Clientes isolados do backend compartilhado; Carreiro e Trairi são tenants distintos.';

commit;

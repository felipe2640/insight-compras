-- A identidade do Insight não pode ser emprestada a um JWT do app Diário,
-- mesmo se alguém criar por engano um tenant_members para a mesma pessoa.
-- Os usuários atuais do Insight não têm app_id no app_metadata; ambos os
-- formatos (ausente ou insight-compras) continuam válidos.
create or replace function public.is_tenant_member(target_tenant text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and target_tenant = public.jwt_tenant_id()
    and coalesce(nullif((select auth.jwt() -> 'app_metadata' ->> 'app_id'), ''), 'insight-compras') = 'insight-compras'
    and exists (
      select 1
      from public.tenant_members tm
      join public.tenants t on t.id = tm.tenant_id
      where tm.tenant_id = target_tenant
        and tm.user_id = (select auth.uid())
        and tm.ativo
        and t.ativo
    );
$$;

-- Registro de pedido é uma operação do comprador autenticado, não um job
-- privilegiado. O servidor ainda monta o hash; a RLS limita quem pode inserir
-- uma linha e impede tenant ou comprador de terceiros.
grant insert on public.auditoria_pedido to authenticated;
drop policy if exists auditoria_pedido_insert_own_tenant on public.auditoria_pedido;
create policy auditoria_pedido_insert_own_tenant
  on public.auditoria_pedido for insert to authenticated
  with check (
    public.is_tenant_member(tenant_id)
    and comprador_id = (select auth.uid())::text
  );

-- Leitura normal de previsão já tem RLS de tenant; garantir o grant sem
-- disponibilizar escrita ou acesso anônimo.
grant select on public.demanda_ia_previsao to authenticated;

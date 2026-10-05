-- O Diário/Trairi pode justificar decisões históricas, mas não pode criar
-- snapshots, itens ou confirmações nem escrever no tenant Carreiro.
grant insert, update on public.aprendizado_feedback to authenticated;

drop policy if exists aprendizado_feedback_insert_diario on public.aprendizado_feedback;
create policy aprendizado_feedback_insert_diario
  on public.aprendizado_feedback
  for insert to authenticated
  with check (private.is_app_member(tenant_id, 'diario'));

drop policy if exists aprendizado_feedback_update_diario on public.aprendizado_feedback;
create policy aprendizado_feedback_update_diario
  on public.aprendizado_feedback
  for update to authenticated
  using (private.is_app_member(tenant_id, 'diario'))
  with check (private.is_app_member(tenant_id, 'diario'));

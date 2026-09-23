-- Permite ao app Diário consultar o comparativo histórico migrado.
-- Escritas e calibração continuam exclusivas do backend do Insight.

drop policy if exists aprendizado_snapshot_select_diario on public.aprendizado_snapshot;

create policy aprendizado_snapshot_select_diario
  on public.aprendizado_snapshot
  for select to authenticated
  using (private.is_app_member(tenant_id, 'diario'));

drop policy if exists aprendizado_item_select_diario on public.aprendizado_item;
create policy aprendizado_item_select_diario
  on public.aprendizado_item
  for select to authenticated
  using (private.is_app_member(tenant_id, 'diario'));

drop policy if exists aprendizado_feedback_select_diario on public.aprendizado_feedback;
create policy aprendizado_feedback_select_diario
  on public.aprendizado_feedback
  for select to authenticated
  using (private.is_app_member(tenant_id, 'diario'));

drop policy if exists aprendizado_confirmacao_select_diario on public.aprendizado_confirmacao;
create policy aprendizado_confirmacao_select_diario
  on public.aprendizado_confirmacao
  for select to authenticated
  using (private.is_app_member(tenant_id, 'diario'));

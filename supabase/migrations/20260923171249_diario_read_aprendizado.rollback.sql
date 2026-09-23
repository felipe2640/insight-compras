-- Reverte somente a leitura histórica do Diário.
drop policy if exists aprendizado_snapshot_select_diario on public.aprendizado_snapshot;
drop policy if exists aprendizado_item_select_diario on public.aprendizado_item;
drop policy if exists aprendizado_feedback_select_diario on public.aprendizado_feedback;
drop policy if exists aprendizado_confirmacao_select_diario on public.aprendizado_confirmacao;

begin;

drop function if exists public.reverter_importacao_diario(text, uuid);
drop function if exists public.importar_configuracoes_diario(text, jsonb, jsonb);

alter table public.fornecedor_grupo drop column if exists migration_batch_id;
alter table public.usuario_grupo drop column if exists migration_batch_id;
alter table public.secao_multiplo_compra drop column if exists migration_batch_id;
alter table public.margem_alvo drop column if exists migration_batch_id;

commit;

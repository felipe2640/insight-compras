begin;

update public.usuario_grupo ug
set user_id = mapa.previous_user_id,
    migration_batch_id = mapa.previous_migration_batch_id
from public.legacy_identity_map mapa
where mapa.source = 'diario'
  and mapa.previous_user_id is not null
  and ug.tenant_id = mapa.tenant_id
  and ug.legacy_user_ref = mapa.legacy_user_ref
  and ug.user_id = mapa.user_id;

drop function if exists public.reverter_identidades_diario(text, uuid);
drop function if exists public.vincular_identidades_diario(text, jsonb, uuid);
drop table if exists public.legacy_identity_map;

commit;

begin;

create index if not exists app_members_user_id_idx
  on public.app_members (user_id);

commit;

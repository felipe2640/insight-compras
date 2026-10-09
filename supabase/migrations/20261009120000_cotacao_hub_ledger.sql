-- Ledger durável da integração com o Cotação Hub (produção, inclusive Vercel).
--
-- O arquivo local continua valendo para o laboratório sintético; a conexão de
-- produção persiste AQUI: /tmp nunca é a única fonte de envios, vínculos de
-- fornecedores e retornos (janela de funções serverless é efêmera).
--
-- Identidade da conexão (tenant_id + hub_tenant_id + source_system +
-- application_id) acompanha cada linha: um ledger pertence a uma conexão,
-- como o FileLedger confere no laboratório (ADR-0004: tabela de domínio
-- referencia tenant; ADR-0005: humano autenticado via JWT + RLS, webhook
-- como job privilegiado explícito via service_role).

create table if not exists public.cotacao_hub_submission (
  external_id text primary key,
  tenant_id text not null,
  hub_tenant_id uuid not null,
  source_system text not null,
  application_id uuid not null,
  fingerprint text not null,
  snapshot jsonb not null,
  operations jsonb not null default '{}'::jsonb,
  suppliers jsonb not null default '{}'::jsonb,
  quotation_id text,
  state text not null default 'partial',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.cotacao_hub_inbox (
  event_id uuid primary key,
  tenant_id text not null,
  hub_tenant_id uuid not null,
  source_system text not null,
  application_id uuid not null,
  hash text not null,
  event jsonb not null,
  processed boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists public.cotacao_hub_draft (
  id text primary key,
  tenant_id text not null,
  hub_tenant_id uuid not null,
  source_system text not null,
  application_id uuid not null,
  quotation_id text not null,
  award_run_id text not null,
  result_hash text not null,
  supplier_id text not null,
  supplier_external_id text not null,
  destination_id text not null,
  state text not null,
  items jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists cotacao_hub_submission_tenant_idx on public.cotacao_hub_submission (tenant_id);
create index if not exists cotacao_hub_submission_quotation_idx on public.cotacao_hub_submission (quotation_id);
create index if not exists cotacao_hub_inbox_pendentes_idx on public.cotacao_hub_inbox (tenant_id, processed);
create index if not exists cotacao_hub_draft_quotation_idx on public.cotacao_hub_draft (tenant_id, quotation_id);

alter table public.cotacao_hub_submission enable row level security;
alter table public.cotacao_hub_inbox enable row level security;
alter table public.cotacao_hub_draft enable row level security;

-- Comprador autenticado opera somente o próprio tenant. O webhook chega sem
-- sessão humana: roda como job privilegiado explícito (service_role), que o
-- Supabase isenta do RLS por definição — exatamente o modelo do ADR-0005.
-- Sem grant de delete: rascunho é marcado superseded, nunca apagado.
grant select, insert, update on public.cotacao_hub_submission to authenticated;
grant select, insert, update on public.cotacao_hub_inbox to authenticated;
grant select, insert, update on public.cotacao_hub_draft to authenticated;

drop policy if exists cotacao_hub_submission_own_tenant on public.cotacao_hub_submission;
create policy cotacao_hub_submission_own_tenant
  on public.cotacao_hub_submission for all to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

drop policy if exists cotacao_hub_inbox_own_tenant on public.cotacao_hub_inbox;
create policy cotacao_hub_inbox_own_tenant
  on public.cotacao_hub_inbox for all to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

drop policy if exists cotacao_hub_draft_own_tenant on public.cotacao_hub_draft;
create policy cotacao_hub_draft_own_tenant
  on public.cotacao_hub_draft for all to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

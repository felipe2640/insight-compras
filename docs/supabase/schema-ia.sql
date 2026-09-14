-- ============================================================================
-- Previsão de Demanda com Inteligência Artificial — Supabase / Postgres
-- Tabela para armazenar as projeções probabilísticas de demanda (p50, p80)
-- geradas pelo pipeline local de IA e consumidas pelo cockpit de compras.
--
-- Executar no SQL Editor do Supabase (projeto rede-carreiro).
-- ============================================================================

create table if not exists demanda_ia_previsao (
  id                  bigint generated always as identity primary key,
  tenant_id           text        not null,
  filial_id           smallint    not null,
  produto_id          bigint      not null,
  sku                 text,
  descricao           text,
  previsao_central    numeric(12, 4) not null default 0,
  demanda_p50         numeric(12, 4) not null default 0,
  demanda_p80         numeric(12, 4) not null default 0,
  horizonte_dias      smallint    not null default 30,
  modelo_utilizado    text        not null,
  data_previsao       date        not null default current_date,
  atualizado_em       timestamptz not null default now(),

  -- Garante upsert atômico por produto e filial dentro de cada tenant
  constraint uq_demanda_ia_tenant_filial_produto unique (tenant_id, filial_id, produto_id)
);

-- Índices de alta velocidade para consulta no Cockpit de Compras
create index if not exists idx_demanda_ia_lookup
  on demanda_ia_previsao (tenant_id, filial_id, produto_id);

create index if not exists idx_demanda_ia_data
  on demanda_ia_previsao (tenant_id, data_previsao desc);

-- RLS (Row Level Security)
alter table demanda_ia_previsao enable row level security;

-- Política de leitura: autenticados ou aplicação via chave anon/service_role
create policy "Leitura pública autenticada por tenant"
  on demanda_ia_previsao
  for select
  using (true);

-- Política de escrita: pipeline local autenticado via service_role key
create policy "Pipeline diário IA pode inserir e atualizar"
  on demanda_ia_previsao
  for all
  using (auth.role() = 'service_role' or current_user = 'postgres');

comment on table demanda_ia_previsao is 'Projeções de demanda por IA (Chronos-Bolt/Croston/DLinear) por filial e SKU para cálculo do estoque ótimo';

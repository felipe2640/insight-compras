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

-- ============================================================================
-- RLS (Row Level Security)
--
-- Mesma convenção do schema-aprendizado.sql: a tabela NÃO é exposta a anon nem a
-- authenticated. Todo acesso é server-side com a service_role key (que passa por
-- cima do RLS) — tanto a leitura do cockpit quanto o upsert do pipeline diário.
--
-- Por que não há política de SELECT permissiva: `using (true)` não isola tenant
-- nenhum. Com a chave anon (que vai para o navegador) qualquer pessoa poderia ler
-- `?tenant_id=eq.<outro_cliente>` e levar a demanda por SKU da rede alheia.
-- ============================================================================
alter table demanda_ia_previsao enable row level security;

-- Remove as políticas permissivas da primeira versão deste schema (idempotente:
-- reexecutar este arquivo corrige um projeto onde elas já foram aplicadas).
drop policy if exists "Leitura pública autenticada por tenant" on demanda_ia_previsao;
drop policy if exists "Pipeline diário IA pode inserir e atualizar" on demanda_ia_previsao;

revoke all on table demanda_ia_previsao from anon, authenticated;
grant select, insert, update, delete on table demanda_ia_previsao to service_role;

comment on table demanda_ia_previsao is 'Projeções de demanda por IA (Chronos-Bolt/Croston/DLinear) por filial e SKU para cálculo do estoque ótimo';

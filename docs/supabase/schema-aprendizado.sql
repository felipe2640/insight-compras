-- ============================================================================
-- Ciclo de aprendizado (modelo × comprador) — esquema Supabase / Postgres
-- Rodar no SQL Editor do projeto. Idempotente (create if not exists).
--
-- Só dados LEVES: o que foi exportado, o que o comprador decidiu, o que de fato
-- entrou, o motivo da divergência e os parâmetros publicados. A grade diária e o
-- catálogo NUNCA vêm para cá — ficam no Power BI / ERP do cliente.
--
-- WHITE-LABEL: toda tabela carrega tenant_id. Vários clientes podem compartilhar o
-- mesmo projeto Supabase sem misturar dados; a aplicação sempre filtra por tenant.
-- ============================================================================

-- O que foi exportado (uma linha por clique em Exportar)
create table if not exists aprendizado_snapshot (
  id            bigint generated always as identity primary key,
  tenant_id     text        not null,
  exportado_em  timestamptz not null default now(),
  filial_id     smallint,                    -- loja em foco no cockpit
  usuario       text,
  layout_id     text        not null,        -- ex.: 'pedido_fornecedor'
  formato       text        not null,        -- 'csv' | 'xlsx' | 'pdf'
  n_itens       integer     not null,
  app_version   text
);
create index if not exists idx_aprendizado_snapshot_tenant_data
  on aprendizado_snapshot (tenant_id, exportado_em desc);

-- Cada item exportado: decisão do comprador × sugestão do modelo, com o contexto
-- que o modelo usou (para a calibração recalcular sem depender do Power BI).
create table if not exists aprendizado_item (
  id                          bigint generated always as identity primary key,
  snapshot_id                 bigint  not null references aprendizado_snapshot(id) on delete cascade,
  tenant_id                   text    not null,
  produto_id                  bigint  not null,
  sku                         text,
  descricao                   text,
  filial_id                   smallint,
  custo                       numeric,
  -- decisão do comprador (o que saiu no arquivo)
  qtd_comprador               numeric not null,
  qtd_transferencia_comprador numeric,
  -- sugestão do modelo no momento da exportação
  qtd_modelo                  numeric,             -- null = inelegível
  qtd_transferencia_modelo    numeric,
  -- contexto do cálculo (congelado)
  perfil                      text,
  consumo_diario              numeric,
  horizonte_dias              integer,
  margem_aplicada             numeric,
  fator_calibracao            numeric,
  previsao_bruta              numeric,             -- max(demanda, piso), antes do fator
  elegivel                    boolean not null default true,
  motivo_inelegibilidade      text,
  sinal_governanca            text                 -- MANTER | REDUZIR | PAUSAR | null
);
create index if not exists idx_aprendizado_item_snapshot on aprendizado_item (snapshot_id);
create index if not exists idx_aprendizado_item_tenant_produto
  on aprendizado_item (tenant_id, produto_id, filial_id);

-- Motivo da divergência (human-in-the-loop). Um por item — upsert.
create table if not exists aprendizado_feedback (
  id          bigint generated always as identity primary key,
  item_id     bigint not null references aprendizado_item(id) on delete cascade,
  tenant_id   text   not null,
  motivo      text   not null,   -- ver MOTIVOS_DIVERGENCIA em core/aprendizado
  comentario  text,
  usuario     text,
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_aprendizado_feedback_item on aprendizado_feedback (item_id);

-- O que DE FATO entrou na janela após a exportação (fecha o ciclo).
-- Indicador, não vínculo contábil: o casamento é por (produto, loja, janela).
create table if not exists aprendizado_confirmacao (
  item_id          bigint primary key references aprendizado_item(id) on delete cascade,
  tenant_id        text    not null,
  janela_dias      integer not null,
  qtd_entrada      numeric not null default 0,   -- compra do fornecedor
  qtd_transferida  numeric not null default 0,   -- veio de outra loja
  status           text    not null,             -- ver StatusConfirmacao em core/aprendizado
  confirmado_em    timestamptz not null default now()
);

-- Parâmetros do motor PUBLICADOS por tenant. O arquivo do tenant é o padrão;
-- a versão mais recente aqui prevalece. Publicar é decisão de gente (rota POST
-- restrita), nunca efeito colateral de uma simulação.
create table if not exists parametros_modelo (
  id            bigint generated always as identity primary key,
  tenant_id     text    not null,
  versao        text    not null,
  margens       jsonb   not null,   -- { ALTO_GIRO: 0.25, MEDIO_GIRO: 0.45, ... }
  fator_calibracao numeric not null,
  procedencia   jsonb,              -- proposta completa que originou a publicação
  publicado_por text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_parametros_modelo_tenant
  on parametros_modelo (tenant_id, created_at desc);

-- Segurança: só a chave service_role (server-side) acessa. Nada de anon/authenticated.
alter table aprendizado_snapshot    enable row level security;
alter table aprendizado_item        enable row level security;
alter table aprendizado_feedback    enable row level security;
alter table aprendizado_confirmacao enable row level security;
alter table parametros_modelo       enable row level security;

revoke all on table aprendizado_snapshot, aprendizado_item, aprendizado_feedback,
  aprendizado_confirmacao, parametros_modelo from anon, authenticated;
grant select, insert, update, delete on table aprendizado_snapshot, aprendizado_item,
  aprendizado_feedback, aprendizado_confirmacao, parametros_modelo to service_role;

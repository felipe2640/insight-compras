-- ============================================================================
-- Trilha Imutavel de Auditoria de Pedidos - esquema Supabase / Postgres
-- ============================================================================

CREATE TABLE IF NOT EXISTS auditoria_pedido (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  timestamp timestamptz NOT NULL,
  comprador_id text NOT NULL,
  comprador_nome text NOT NULL,
  comprador_email text NOT NULL,
  comprador_papel text NOT NULL,
  filial_id integer NOT NULL,
  filial_nome text,
  produto_id text NOT NULL,
  codigo_sku text NOT NULL,
  descricao_produto text,
  fornecedor_id text NOT NULL,
  nome_fornecedor text,
  quantidade_sugerida_sistema numeric NOT NULL,
  quantidade_digitada_comprador numeric NOT NULL,
  divergencia_quantidade numeric NOT NULL,
  divergencia_percentual numeric,
  preco_custo_unitario numeric NOT NULL,
  impacto_financeiro_divergencia numeric NOT NULL,
  tipo_acao text NOT NULL,
  classificacao_divergencia text NOT NULL,
  justificativa_override text,
  hash_registro_anterior text NOT NULL,
  hash_integridade text NOT NULL,
  sequencia bigint GENERATED ALWAYS AS IDENTITY,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_pedido_tenant ON auditoria_pedido(tenant_id, criado_em DESC);

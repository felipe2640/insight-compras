# Módulo de Cotação — Contratos congelados

> Este arquivo é a **fronteira entre as unidades de trabalho**. A unidade C0
> transforma o que está aqui em código (migração, tipos, porta, flag). Depois
> do portão G0, **ninguém muda contrato sozinho**: quem precisar de mudança
> escreve em `.agents/orchestrator_cotacao/pedidos-de-contrato.md` e o
> orquestrador decide. Assim as unidades paralelas não se quebram.

## 1. Decisões que moldam os contratos

1. **Pedido = `aprendizado_snapshot`.** Em produção, o pedido exportado já é
   um snapshot com `status`, `enviado_em`, `confirmado_em` e `recebido_em`
   (lido por `src/lib/pedidos/provedores/supabase.ts`). A cotação gera um
   snapshot por fornecedor e filial, com `origem = 'cotacao'`. Não existe
   tabela `pedido_compra` (ver `docs/pontas-soltas.md`, observação do grupo A).
2. **Portal sem login.** O vendedor entra por um token de convite. O banco
   guarda só `sha256(token)`. Todo acesso do portal passa por RPC
   `security definer`; o papel `anon` não tem grant em nenhuma tabela.
3. **O Diário cria rascunho por RPC, não por HTTP.** O Diário já fala com o
   mesmo Supabase usando o JWT da conta runtime (`lib/purchase-intelligence/supabase.ts`).
   Ele chama `cotacao_criar_rascunho` e abre `INSIGHT_COMPRAS_URL/cotacoes/<id>`.
   Assim não é preciso autenticação entre os dois apps.
4. **O corte é função pura** em `core/cotacao/`, sem banco, e é testável sozinho.
5. **Tudo nasce desligado.** Sem flag, nenhuma rota, tela ou link novo aparece
   em produção (seção 6).

## 2. Migração `supabase/migrations/202609280001_cotacao_foundation.sql`

Aditiva: só `create table`, `add column ... null` e `create function`. Tem um
par `.rollback.sql` que remove apenas o que ela criou. As convenções são as de
`202609210001_tenant_rls_foundation.sql`: `tenant_id text references tenants`
e FKs compostas `(tenant_id, id)`.

| Tabela | Colunas (tipo) | Chaves e regras |
|---|---|---|
| `fornecedor` | tenant_id, id uuid, codigo_erp text, cnpj text, razao_social text, faturamento_minimo numeric null, ativo bool | pk (tenant_id, id); unique (tenant_id, codigo_erp) |
| `vendedor` | id uuid, nome text, email text, whatsapp text null, ativo bool | global (sem tenant); unique lower(email) |
| `fornecedor_vendedor` | tenant_id, fornecedor_id, vendedor_id, ativo | pk (tenant_id, fornecedor_id, vendedor_id) |
| `cotacao` | tenant_id, id uuid, numero bigint, filial_id smallint, origem text, snapshot_origem_id bigint null, status text, prazo timestamptz, observacao text null, criada_por text, criada_em, corte_em null, fechada_em null | origem ∈ {diario, insight}; status ∈ {rascunho, aberta, em_corte, fechada, cancelada}; unique (tenant_id, numero) |
| `cotacao_item` | tenant_id, cotacao_id, id uuid, produto_id bigint, sku text, referencia text, descricao text, marca_pedida text null, marcas_aceitas text[] default '{}', quantidade numeric, unidade text, ultimo_custo numeric null | quantidade > 0; FK composta para cotacao |
| `cotacao_convite` | tenant_id, cotacao_id, id uuid, fornecedor_id, vendedor_id, token_hash bytea, expira_em, status text, aberto_em null, terminou_em null | status ∈ {enviado, aberto, respondendo, terminou, revogado}; unique (token_hash); unique (cotacao_id, vendedor_id, fornecedor_id) |
| `proposta_item` | tenant_id, convite_id, item_id, preco_unit numeric null, marca_ofertada text null, qtd_disponivel numeric null, prazo_dias int null, sem_estoque bool default false, observacao text null, atualizado_em | pk (convite_id, item_id); preco_unit > 0 ou sem_estoque; length(observacao) ≤ 500 |
| `cotacao_corte_item` | tenant_id, cotacao_id, item_id, convite_id null, quantidade numeric, origem text, motivo text null, decidido_por text, decidido_em | origem ∈ {automatico, manual}; motivo obrigatório quando manual |
| `cotacao_evento` | tenant_id, id bigint identity, cotacao_id, tipo text, ator text, dados jsonb, em | somente INSERT para authenticated (imutável, como `auditoria_pedido`) |

Colunas novas em tabelas existentes (todas `null`, sem default que reescreva linhas):

- `aprendizado_snapshot`: `origem text null` (null = exportação atual),
  `cotacao_id uuid null`, `fornecedor_id uuid null`, `valor_total numeric null`.
- `aprendizado_item`: `preco_cotado numeric null`, `convite_id uuid null`.

RLS: `authenticated` lê e escreve as tabelas do módulo quando é membro ativo do
tenant (`tenant_members`, e `app_members` com `app_id='diario'` só para
`cotacao_criar_rascunho`). `anon` não recebe grant de tabela. Reaproveite os
auxiliares que já existem no schema `private` (`private.is_app_member`,
`private.is_app_manager`) e os da fundação RLS, em vez de reescrevê-los.
`pgcrypto` já está instalado no schema `extensions`.

## 3. RPCs

Todas com `security definer`, `set search_path = public, private, extensions`,
e `revoke all ... from public` antes de cada grant.

| Função | Executa | Entrada | Saída | Regras |
|---|---|---|---|---|
| `cotacao_criar_rascunho` | authenticated | p_tenant text, p_app text, p_filial smallint, p_itens jsonb, p_snapshot_id bigint null | uuid | Confere a associação ativa; `origem` = p_app; status `rascunho` |
| `portal_listar_cotacoes` | anon | p_token text | jsonb | Resolve o vendedor pelo token e lista os convites abertos dele em todos os tenants (nome da loja, número, prazo, itens respondidos/total) |
| `portal_obter_cotacao` | anon | p_token text | jsonb | Itens da cotação e **só** as propostas do próprio convite; marca `aberto` na primeira leitura |
| `portal_salvar_propostas` | anon | p_token text, p_itens jsonb | jsonb `{salvos, rejeitados[]}` | Recusa se expirado, revogado ou cotação ≠ `aberta`; valida item ∈ cotação; status → `respondendo` |
| `portal_terminar` | anon | p_token text | jsonb | Status → `terminou`; grava `cotacao_evento` |
| `portal_pedidos` | anon | p_token text | jsonb | Snapshots `origem='cotacao'` do fornecedor do convite, com itens e preço; nunca preço de concorrente |
| `portal_aceitar_pedido` | anon | p_token text, p_snapshot_id bigint | jsonb | Snapshot precisa ser do fornecedor do convite; status do pedido → `confirmado` |

O token tem 32 bytes aleatórios em base64url e é gerado no servidor do
Insight. O hash é `extensions.digest(p_token, 'sha256')`. Token inválido gera
sempre o mesmo erro genérico `convite_invalido`, sem distinguir "não existe" de
"expirou".

## 4. Tipos TypeScript

`core/cotacao/tipos.ts` (puro, sem import de fora do `core/`):

```ts
export interface ItemParaCorte { itemId: string; quantidade: number; marcaPedida: string | null; marcasAceitas: readonly string[]; }
export interface PropostaParaCorte { conviteId: string; fornecedorId: string; itemId: string; precoUnit: number | null; marcaOfertada: string | null; qtdDisponivel: number | null; prazoDias: number | null; semEstoque: boolean; }
export interface FornecedorParaCorte { fornecedorId: string; faturamentoMinimo: number | null; }
export interface EntradaCorte { itens: readonly ItemParaCorte[]; propostas: readonly PropostaParaCorte[]; fornecedores: readonly FornecedorParaCorte[]; }
export interface DecisaoItem { itemId: string; conviteId: string; fornecedorId: string; quantidade: number; precoUnit: number; motivo: "menor_preco" | "desempate_prazo" | "desempate_concentracao" | "saldo_segundo_colocado"; }
export interface PendenciaItem { itemId: string; razao: "sem_proposta" | "so_marca_nao_aceita" | "quantidade_insuficiente"; quantidadeFaltante: number; }
export interface AlertaMinimo { fornecedorId: string; valorGanho: number; faturamentoMinimo: number; }
export interface SaidaCorte { decisoes: readonly DecisaoItem[]; pendencias: readonly PendenciaItem[]; alertasMinimo: readonly AlertaMinimo[]; }
export declare function calcularCorte(entrada: EntradaCorte): SaidaCorte;
```

`src/lib/cotacao/tipos.ts`: entidades de aplicação (`Cotacao`, `ItemCotacao`,
`ConviteCotacao`, `PropostaItem`, `StatusCotacao`, `StatusConvite`), espelhando
a migração em camelCase.

`src/lib/cotacao/porta-repositorio.ts`: segue o padrão de `src/lib/pedidos/porta-repositorio.ts`.

```ts
export type IdProvedorCotacao = "supabase" | "memoria";
export interface RepositorioCotacao {
  readonly id: IdProvedorCotacao;
  criarRascunho(p: { tenantId: string; filialId: number; itens: readonly NovoItemCotacao[]; snapshotOrigemId?: number | null; criadaPor: string }): Promise<Cotacao>;
  obter(tenantId: string, cotacaoId: string): Promise<Cotacao | null>;
  listar(f: { tenantId: string; status?: StatusCotacao; filialId?: number; limite?: number }): Promise<readonly Cotacao[]>;
  abrir(tenantId: string, cotacaoId: string, prazo: string): Promise<Cotacao>;
  criarConvites(tenantId: string, cotacaoId: string, convites: readonly { fornecedorId: string; vendedorId: string; tokenHash: Uint8Array; expiraEm: string }[]): Promise<readonly ConviteCotacao[]>;
  listarPropostas(tenantId: string, cotacaoId: string): Promise<readonly PropostaItem[]>;
  gravarCorte(tenantId: string, cotacaoId: string, decisoes: readonly DecisaoCorteGravada[], responsavel: string): Promise<void>;
  gerarPedidos(tenantId: string, cotacaoId: string, responsavel: string): Promise<readonly number[]>; // ids de aprendizado_snapshot
  registrarEvento(tenantId: string, cotacaoId: string, tipo: string, ator: string, dados?: Record<string, unknown>): Promise<void>;
}
```

## 5. Rotas do Insight Compras

Todas usam `contextoDaRequisicao()`; nenhuma lê `x-tenant-id`. O teste
`tests/arquitetura/sem-atalho-de-tenant.test.ts` tem que continuar verde.

| Rota | Entrada | Saída |
|---|---|---|
| `POST /api/cotacoes` | `{ filialId, itens[] }` ou `{ snapshotId }` | `201 { cotacao }` |
| `GET /api/cotacoes` | `?status&filialId` | `{ cotacoes[] }` |
| `GET /api/cotacoes/:id` | — | `{ cotacao, itens[], convites[] }` |
| `POST /api/cotacoes/:id/convites` | `{ prazo, convidados: [{ fornecedorId, vendedorId }] }` | `{ convites[], links[] }` (os links saem uma única vez) |
| `GET /api/cotacoes/:id/mapa` | — | `{ itens[], propostasPorItem, corteSugerido: SaidaCorte }` |
| `POST /api/cotacoes/:id/corte` | `{ ajustes?: [{ itemId, conviteId, motivo }] }` | `{ corte }` |
| `POST /api/cotacoes/:id/pedidos` | — | `{ snapshotIds[] }` |
| `GET /api/cotacoes/:id/pedidos/:snapshotId/documento` | `?formato=pdf\|xlsx` | arquivo |
| `GET /api/cron/cotacao-prazos` | cabeçalho `Authorization: Bearer $CRON_SECRET` | lembretes e expiração |

Com o módulo desligado, todas respondem `404` com o corpo padrão de `resposta-erro.ts`.

## 6. Flags e variáveis

| Onde | Nome | Padrão | Efeito |
|---|---|---|---|
| Insight, cadastro do tenant | `modulos.cotacao` (novo campo opcional em `config/tenants/tipos.ts`) | ausente = desligado | O tenant pode usar o módulo |
| Insight, ambiente | `COTACAO_HABILITADA` | ausente = desligado | Liga o módulo nesta instalação; só vale se o tenant também permitir |
| Insight, ambiente | `COTACAO_PORTAL_URL`, `RESEND_API_KEY`, `COTACAO_EMAIL_REMETENTE`, `CRON_SECRET` | — | Exigidas pela `validacao-ambiente` **apenas** quando o módulo está ligado |
| Diário, ambiente | `DIARIO_COTACAO_HABILITADA`, `INSIGHT_COMPRAS_URL` | ausente = desligado | Mostra o botão "Enviar para cotação" |
| Diário, acesso de página | `cotacao-enviar` em `PAGE_ACCESS` | fora da lista = sem botão | Só usuários liberados veem o botão |
| Portal, ambiente | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | — | Nenhuma chave privilegiada no portal |

A regra única fica em `src/lib/cotacao/habilitacao.ts`:
`cotacaoHabilitada(contexto) = env.COTACAO_HABILITADA === "true" && tenant.modulos?.cotacao === true`.

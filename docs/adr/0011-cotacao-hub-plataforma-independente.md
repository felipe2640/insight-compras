# ADR 0011 — Cotação Hub independente

**Estado:** proposta pré-G0 v2.

## Contexto

O plano anterior colocava tabelas de cotação no Supabase compartilhado, rotas no Insight e escrita do Diário via RPC. Isso impedia um terceiro de usar o produto sem conhecer os hospedeiros.

## Decisão

Criar `cotacao-hub` em repositório e infraestrutura próprios, inicialmente monólito modular. Todos os clientes usam API `/api/v1`, autenticação própria/federada e eventos. O Hub possui cotações, fornecedores, respostas, corte e pedidos. Insight, Diário e ERPs podem manter projeções e adapters independentes. Nenhuma FK cruza banco de aplicação.

## Consequências

Infraestrutura e identidade próprias têm custo operacional, mas permitem tenancy, isolamento e comercialização. Dados de origem são snapshots e IDs externos opacos. O rollout começa por prova de contrato pré-G0, depois Hub isolado; adapters só depois. Microserviços não são necessários para o MVP.

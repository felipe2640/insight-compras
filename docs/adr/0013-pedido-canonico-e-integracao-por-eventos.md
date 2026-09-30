# ADR 0013 — Pedido canônico no Hub

**Estado:** proposta pré-G0 v2.

## Decisão

`purchase_order` e `purchase_order_item` pertencem ao Hub, com snapshot suficiente, número interno estável, revisão antes da emissão, ciclo de vida e auditoria. `aprendizado_snapshot` do Insight pode ser projeção gerada por adapter, nunca pedido canônico. Diário cria cotação via API. ERP recebe/fornece IDs externos por namespace; outbox e webhooks entregam eventos versionados e assinados.

## Consequências

Criação e emissão são eventos diferentes. Retentativas são idempotentes. A indisponibilidade do ERP não impede operação do Hub baseada em snapshots. Nenhuma migração do Supabase compartilhado é pré-requisito.

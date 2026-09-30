> **SUPERSEDED — NÃO UTILIZAR PARA IMPLEMENTAÇÃO.** Fonte vigente: `docs/SOURCE_OF_TRUTH.md`.

# Enviar para cotação (unidade C7 do módulo de cotação)

> Plano mestre, contratos e regras de produção ficam no repositório
> `felipe2640/insight-compras`: `.agents/orchestrator_cotacao/plan.md` e
> `docs/cotacao/`. Este arquivo é o recorte que cabe ao Diário.

## O que muda no Diário

Só uma coisa: na **Compra Nova** (`/compra-auto/novo`, que usa
`compra-auto/components/CalcDiaTable.tsx`) aparece o botão **Enviar para
cotação**. O CALC DIA oficial (`compra-auto/oficial/**`) não muda nesta leva. O botão pega os itens aprovados e cria uma cotação em rascunho no
Supabase compartilhado. Depois abre o Insight Compras na cotação criada. A
tela de corte, os convites e os pedidos ficam no Insight.

## Como o botão fala com o backend

- Usa o cliente que já existe em `lib/purchase-intelligence/supabase.ts`, com o
  JWT da conta runtime (`DIARIO_RUNTIME_EMAIL`), e nenhuma chave nova.
- Chama a RPC `cotacao_criar_rascunho(p_tenant, p_app = 'diario', p_filial, p_itens, p_snapshot_id)`.
  O Postgres confere se o usuário é `app_members` ativo do tenant com
  `app_id = 'diario'`.
- Cada item de `p_itens`: `produto_id`, `sku`, `referencia`, `descricao`,
  `marca_pedida`, `quantidade`, `unidade`, `ultimo_custo`.
- A RPC devolve o `uuid` da cotação, e o navegador abre `${INSIGHT_COMPRAS_URL}/cotacoes/<uuid>`.

## Arquivos que a unidade C7 pode tocar

| Arquivo | Mudança |
|---|---|
| `lib/cotacao/enviar.ts` (novo) | Monta `p_itens` a partir das linhas da Compra Nova e chama a RPC |
| `lib/cotacao/habilitacao.ts` (novo) | `DIARIO_COTACAO_HABILITADA === "true"` e página `cotacao-enviar` liberada |
| `compra-auto/components/calc-dia/EnviarParaCotacao.tsx` (novo) | Botão, confirmação e erro |
| `compra-auto/components/calc-dia/TopToolbar.tsx` | Só renderizar o botão quando habilitado |
| `lib/page-access.ts` | Acrescentar o id `cotacao-enviar` |
| `tests/cotacao-*.test.mjs` (novos) | Montagem dos itens, flag desligada e erro da RPC |

## Pronto quando

- [ ] Sem `DIARIO_COTACAO_HABILITADA` ou sem a página `cotacao-enviar`, nada muda na tela.
- [ ] Com a flag ligada no preview, o botão cria o rascunho e abre o Insight.
- [ ] Linha com quantidade zero ou sem referência não é enviada, e o botão diz quantas ficaram de fora.
- [ ] `npm test` e `npm run build` verdes; nenhum teste removido.
- [ ] Só esta RPC é nova como escrita no Supabase; nenhuma tabela é acessada diretamente.

## Depende de

A migração `202609280001_cotacao_foundation.sql` (unidade C0 do insight-compras)
precisa estar aplicada no Supabase compartilhado antes do merge desta unidade.

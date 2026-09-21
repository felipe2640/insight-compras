# ADR-0007 — Importação transacional das configurações do Diário

- Status: proposto
- Data: 2026-09-21
- Depende de: ADR-0006 e `diario#61`

## Decisão

A transferência das quatro configurações aprovadas será feita por uma RPC
privilegiada e atômica. A aplicação normal não recebe acesso à RPC: somente a
`service_role`, usada deliberadamente durante o cutover, pode executá-la.

Antes de escrever, o fluxo valida a integridade do manifesto, o tenant
`carreiro`, as contagens e o mapa explícito dos usuários legados. O banco ainda
confirma que cada UUID é membro ativo do mesmo tenant. A importação faz upsert
por chaves tenant-scoped e falha por inteiro se qualquer vínculo for inválido.

Os identificadores reais do Admin e do Valmir não são versionados. O mapa
`2 -> Admin` e `5 -> Valmir` é fornecido somente por variável de ambiente no
momento controlado da execução.

## Rastreabilidade e rollback

Cada execução recebe um `batchId`, gravado nas linhas inseridas ou atualizadas.
Durante a janela de validação, a RPC de rollback remove somente as linhas que
ainda carregam esse lote. O `batchId` deve ser guardado junto ao registro do
cutover.

O rollback é indicado antes de liberar edição operacional dessas configurações.
Depois do aceite, novas alterações passam a ser dados correntes do Insight e
não devem ser removidas por uma reversão tardia.

## Rollout

1. aplicar a migração `202609210004` no Supabase `rede-carreiro`;
2. exportar um manifesto novo e somente leitura do Supabase do Diário;
3. executar o importador em dry-run com o mapa de identidades;
4. executar com `--apply` e guardar o `batchId`;
5. conferir as contagens `1 / 2 / 96 / 1` e testar as leituras com JWT;
6. manter o Supabase do Diário ativo até o aceite final.

Não são importadas linhas `shadow_*`; `aprendizado_*` continua sendo o modelo
maduro do backend white-label.

# Integração Cotação Hub — branch de teste

Esta branch contém o conector sintético do Insight Compras para o Cotação Hub.
Ela implementa seleção no cockpit, envio HTTP OAuth, cadastro idempotente de
fornecedores, cotação, abertura, convites e recebimento de decisão assinada em
rascunhos agrupados por fornecedor e destino.

O laboratório exige `INSIGHT_HUB_TEST_MODE=synthetic-local` e um arquivo JSON
privado em `INSIGHT_HUB_TEST_CONFIG` com caminho absoluto. A configuração aceita
somente API e portal em localhost, ledger próprio e credenciais sintéticas.
`NODE_ENV=production` e Vercel são recusados. O widget fica indisponível sem
essa configuração; não há fallback para banco compartilhado ou Excel.

Para testar a jornada integrada, use o comando `node test/e2e/connections-run.mjs`
na branch de teste do Cotação Hub. O comando inicia Hub, PostgreSQL, SMTP e
receptores HTTPS descartáveis e importa este checkout. Consulte o manual do
Hub em `docs/operations/test-connections.md`.

Validação local desta branch: `npm run typecheck` e `npm test -- --run
tests/cotacao-hub`.

Este é um artefato de teste autorizado em 08/10/2026. Não é deployment, não
certifica SSO/autenticação real do sistema hospedeiro e não representa aprovação
de G1.

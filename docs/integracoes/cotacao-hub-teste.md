# Integração Cotação Hub — laboratório e produção

A integração tem dois regimes, separados no código e na configuração:

- **Produção** (`mode: "production"`): conexão real e explícita, HTTPS, credenciais privadas via `INSIGHT_HUB_CONFIG_JSON` (Vercel) e ledger durável em Supabase (tabelas de `20261009120000_cotacao_hub_ledger.sql`). Falha de comunicação é falha: não existe resposta simulada, "Enviada" fabricada nem credencial/cadastro padrão embutido.
- **Laboratório** (`mode: "synthetic-local"`): arquivo JSON privado em `INSIGHT_HUB_TEST_CONFIG` com caminho absoluto, API em localhost, ledger próprio em arquivo com lock, e recusa em `NODE_ENV=production` e Vercel.

A jornada integrada do laboratório é a `node test/e2e/connections-run.mjs` na branch de teste do Cotação Hub (`codex/test-conexoes-insight-diario`): ela sobe Hub, PostgreSQL, SMTP e receptores HTTPS descartáveis, semeia a instalação buyer e importa `src/lib/cotacao-hub/connector.ts` deste checkout via `createConnector(config, { env })`. Consulte `docs/operations/test-connections.md` do Hub.

O conector continua expondo `submit` / `receive` / `retryInbox` / `status` com o contrato original da jornada (quantidade inteira positiva em string decimal, itens com `requested_brand`/`requested_reference`, destinos homologados, assinatura HMAC `timestamp.eventId.corpo`).

Validação local desta branch: `npm run typecheck` e `npm test -- --run tests/cotacao-hub`.

Este artefato de teste foi autorizado em 08/10/2026 e atualizado em 09/10/2026. Não é deployment, não certifica SSO/autenticação real do sistema hospedeiro e não representa aprovação de G1.

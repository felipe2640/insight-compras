# Manifesto de transferência

A lista exata, reproduzível e sem glob está em `contracts/repository-package-manifest.json`. Copiar somente seus arquivos, preservando caminhos. `README-cotacao-hub.md` poderá virar README.md apenas após autorização de criação. Esta lista não autoriza criação ou execução.

## Incluir

Fontes canônicas de arquitetura, domínio, segurança, produto, ADR 0011–0013, OpenAPI G0 original, validadores/resultados, fixtures sintéticas, plano v2/briefing/portões/registro de mudanças, seis pareceres finais, fechamento G0, índice de histórico excluído e relatórios de transferência.

## Não incluir

Código/config/tenants/adapters/componentes React do Insight; código/runtime account do Diário; SQL/migrations do Supabase compartilhado; aprendizado_snapshot como domínio; Power BI; código de cliente; ADR 0001–0007 do Insight; .env, segredos, dados reais, arquivos temporários; documentos C0–C9/C7/v1 e reviews intermediários completos. O resultado Prism antigo `mock-result.txt` é histórico e excluído. `run_mock.py` acompanha o pacote porque `run_stateful.py` reutiliza seu gerador sintético `sample`; sua presença não transforma smoke em prova G0.

## Inventário exato

```text
.agents/orchestrator_cotacao/BRIEFING.md
.agents/orchestrator_cotacao/GATE_STATUS.md
.agents/orchestrator_cotacao/contract-change-requests.md
.agents/orchestrator_cotacao/plan-v2.md
.agents/orchestrator_cotacao/progress.md
.agents/orchestrator_cotacao/reviews/api-g0-final.md
.agents/orchestrator_cotacao/reviews/architecture-g0-final.md
.agents/orchestrator_cotacao/reviews/auditor-g0-final.md
.agents/orchestrator_cotacao/reviews/challenger-g0-final.md
.agents/orchestrator_cotacao/reviews/domain-g0-final.md
.agents/orchestrator_cotacao/reviews/security-g0-final.md
README-cotacao-hub.md
contracts/examples/cenario-dourado-corte/README.md
contracts/examples/cenario-dourado-corte/expected/quotations.json
contracts/examples/cenario-dourado-corte/input/scenario.json
contracts/examples/cenario-dourado-corte/scenario.json
contracts/examples/cenario-dourado-corte/verify.py
contracts/examples/cliente-terceiro/README.md
contracts/examples/cliente-terceiro/run_mock.py
contracts/examples/cliente-terceiro/run_stateful.py
contracts/examples/cliente-terceiro/stateful-result.json
contracts/examples/cliente-terceiro/stateful_mock.py
contracts/openapi-validation-result.json
contracts/repository-package-manifest.json
contracts/repository-package-validation-result.json
contracts/requirements.txt
contracts/validate_openapi.py
contracts/validate_repository_package.py
docs/REPOSITORY_TRANSFER_MANIFEST.md
docs/SOURCE_OF_TRUTH.md
docs/adr/0011-cotacao-hub-plataforma-independente.md
docs/adr/0012-corte-comparavel-e-reproduzivel.md
docs/adr/0013-pedido-canonico-e-integracao-por-eventos.md
docs/architecture/overview.md
docs/archive/pre-g0/README.md
docs/domain/award.md
docs/domain/commercial-conditions.md
docs/domain/purchasing.md
docs/domain/sourcing.md
docs/domain/supplier-network.md
docs/gates/G0.md
docs/product/buyer-flow.md
docs/product/mvp-scope.md
docs/product/supplier-flow.md
docs/repository-readiness-report.md
docs/security/data-retention.md
docs/security/roles-permissions.md
docs/security/security-contracts.md
docs/security/threat-model.md
openapi-validation-report.md
openapi/cotacao-hub-v1.yaml
```

# Prontidão do pacote canônico — 2026-09-30

**Veredito do pacote: READY_TO_CREATE_REPOSITORY.** G0 READY permanece contratual. Esta conclusão valida a consolidação; não autoriza criar repositório nem implementar.

## Estado real e divergência de sequência

O repositório independente já foi criado em uma etapa anterior e recebeu H0/H1; H2–H4 possuem trabalho local incompleto. A missão anexada mais recente suspendeu essa execução. Nenhum desses arquivos funcionais integra este pacote; nada foi apagado. Não será criado outro repositório nesta etapa. A decisão humana posterior precisa definir o uso do repositório já existente. O plano, índice e portões agora registram esta situação explicitamente.

## Estrutura preparada

51 arquivos exatos no manifesto; árvore completa:

```text
├── .agents/
│   └── orchestrator_cotacao/
│       ├── BRIEFING.md
│       ├── GATE_STATUS.md
│       ├── contract-change-requests.md
│       ├── plan-v2.md
│       ├── progress.md
│       └── reviews/
│           ├── api-g0-final.md
│           ├── architecture-g0-final.md
│           ├── auditor-g0-final.md
│           ├── challenger-g0-final.md
│           ├── domain-g0-final.md
│           └── security-g0-final.md
├── README-cotacao-hub.md
├── contracts/
│   ├── examples/
│   │   ├── cenario-dourado-corte/
│   │   │   ├── README.md
│   │   │   ├── expected/
│   │   │   │   └── quotations.json
│   │   │   ├── input/
│   │   │   │   └── scenario.json
│   │   │   ├── scenario.json
│   │   │   └── verify.py
│   │   └── cliente-terceiro/
│   │       ├── README.md
│   │       ├── run_mock.py
│   │       ├── run_stateful.py
│   │       ├── stateful-result.json
│   │       └── stateful_mock.py
│   ├── openapi-validation-result.json
│   ├── repository-package-manifest.json
│   ├── repository-package-validation-result.json
│   ├── requirements.txt
│   ├── validate_openapi.py
│   └── validate_repository_package.py
├── docs/
│   ├── REPOSITORY_TRANSFER_MANIFEST.md
│   ├── SOURCE_OF_TRUTH.md
│   ├── adr/
│   │   ├── 0011-cotacao-hub-plataforma-independente.md
│   │   ├── 0012-corte-comparavel-e-reproduzivel.md
│   │   └── 0013-pedido-canonico-e-integracao-por-eventos.md
│   ├── architecture/
│   │   └── overview.md
│   ├── archive/
│   │   └── pre-g0/
│   │       └── README.md
│   ├── domain/
│   │   ├── award.md
│   │   ├── commercial-conditions.md
│   │   ├── purchasing.md
│   │   ├── sourcing.md
│   │   └── supplier-network.md
│   ├── gates/
│   │   └── G0.md
│   ├── product/
│   │   ├── buyer-flow.md
│   │   ├── mvp-scope.md
│   │   └── supplier-flow.md
│   ├── repository-readiness-report.md
│   └── security/
│       ├── data-retention.md
│       ├── roles-permissions.md
│       ├── security-contracts.md
│       └── threat-model.md
├── openapi/
│   └── cotacao-hub-v1.yaml
└── openapi-validation-report.md
```

## Arquivos criados nesta consolidação

- `.agents/orchestrator_cotacao/BRIEFING.md`
- `.agents/orchestrator_cotacao/contract-change-requests.md`
- `README-cotacao-hub.md`
- `contracts/examples/cenario-dourado-corte/expected/quotations.json`
- `contracts/examples/cenario-dourado-corte/input/scenario.json`
- `contracts/repository-package-manifest.json`
- `contracts/repository-package-validation-result.json`
- `contracts/validate_repository_package.py`
- `docs/REPOSITORY_TRANSFER_MANIFEST.md`
- `docs/archive/pre-g0/README.md`
- `docs/archive/pre-g0/cotacao-hub-especificacao-v1.md`
- `docs/archive/pre-g0/diario-c7.md`
- `docs/archive/pre-g0/progress-c0-c9.md`
- `docs/archive/pre-g0/revisao-pre-g0-v2.md`
- `docs/gates/G0.md`
- `docs/repository-readiness-report.md`

## Arquivos atualizados

- `.agents/orchestrator_cotacao/GATE_STATUS.md`
- `.agents/orchestrator_cotacao/plan-v2.md`
- `.agents/orchestrator_cotacao/progress.md`
- `.agents/orchestrator_cotacao/reviews/api-g0-final.md`
- `.agents/orchestrator_cotacao/reviews/auditor-v2.md`
- `.agents/orchestrator_cotacao/reviews/challenger-v2.md`
- `.agents/orchestrator_cotacao/reviews/orchestrator-v2.md`
- `contracts/examples/cenario-dourado-corte/README.md`
- `contracts/examples/cenario-dourado-corte/verify.py`
- `contracts/examples/cliente-terceiro/stateful-result.json`
- `docs/SOURCE_OF_TRUTH.md`

## Arquivados e SUPERSEDED

- `.agents/orchestrator_cotacao/DISPATCH.md`
- `.agents/orchestrator_cotacao/pedidos-de-contrato.md`
- `.agents/orchestrator_cotacao/plan.md`
- `.agents/orchestrator_cotacao/reviews/auditor-v2.md`
- `.agents/orchestrator_cotacao/reviews/challenger-v2.md`
- `.agents/orchestrator_cotacao/reviews/orchestrator-v2.md`
- `docs/archive/pre-g0/README.md`
- `docs/archive/pre-g0/cotacao-hub-especificacao-v1.md`
- `docs/archive/pre-g0/diario-c7.md`
- `docs/archive/pre-g0/progress-c0-c9.md`
- `docs/archive/pre-g0/revisao-pre-g0-v2.md`
- `docs/cotacao/00-contexto.md`
- `docs/cotacao/01-contratos.md`
- `docs/cotacao/02-producao.md`

Históricos permanecem no branch de planejamento, claramente identificados; o manifesto exclui seu conteúdo. `progress.md` antigo foi preservado em `docs/archive/pre-g0/progress-c0-c9.md` antes de substituí-lo pelo registro da consolidação. ADR 0001–0007 continuam vigentes somente para Insight e são excluídos do pacote.

## OpenAPI

PASS: 44 paths, 49 operações, 34 mutações, 616 referências resolvidas, 49 declarações de segurança, dez eventos públicos estáveis, zero erro semântico e zero campos monetários number/float. Arquivo aprovado preservado byte a byte em relação ao HEAD anterior da branch. SHA-256: `bdba10b37ab3e9e756892d4c2b77baefee396659d8f5472b151362d2308cbb6e`.

Comando reproduzível e dependências fixadas no README e `contracts/requirements.txt`; resultado em `contracts/openapi-validation-result.json`. Os avisos da ferramenta Python sobre RefResolver não invalidam o resultado.

## Cliente terceiro

PASS 111 verificações encadeadas e negativas: autenticação app, T1/T2, supplier, cotação, bulk, convite/redeem/OTP/sessão, oferta/submit, fechamento, corte/ajuste/aprovação, draft/revisão/emissão, supplier confirm, eventos, documentos, scopes, IDOR, replay, idempotência, ETag, SSO e webhook assinado. Resultado em `stateful-result.json`; contém apenas status/códigos e ID de evento gerado sinteticamente. Harness contratual em memória; não comprova implementação real, persistência ou segurança operacional.

## Cenário dourado

PASS Decimal: dois tenants, três suppliers, duas filiais de T1 e destino independente de T2, 12 itens totais. T1 gera cenários B/F1 631.50 e B/F2 258.00, total 889.50, com saldos I06=2, I10=3, I11=1. README explica necessidades, propostas, nominal/elegível, mínimo, múltiplo, frete, alternativas, empate, parcial, sem estoque, assisted, warning/hard_constraint/requires_review. Projeções input/expected são conferidas contra scenario.json pelo verificador; não constituem novo motor.

## Segurança de dados e autonomia

Busca automatizada e inspeção manual no conjunto exato do manifesto: zero chaves privadas, JWTs reais ou credenciais com os padrões verificados; e-mails apenas .example/.test; URLs de API/IdP/documentos fictícias e loopback 127.0.0.1 do smoke de teste; telefone +5511999990001 e CNPJ 00000000000191 são exemplos explicitamente sintéticos. Nomes e valores monetários são dados fictícios das provas. Referências a Insight/Diário/Connectsoft/Supabase/cliente descrevem exclusões ou adapters opcionais; nenhuma exige runtime, banco, autenticação, config/tenants ou código hospedeiro. Documentos históricos que podem conter contexto de cliente estão excluídos.

A busca por padrões não prova ausência universal de segredos. O relatório automático lista domínios, URLs e telefone para revisão reproduzível, sem imprimir credenciais. Nenhuma fonte de produção foi consultada para criar fixtures.

| Checklist de independência do pacote | Resultado |
|---|---|
| Sem o repositório Insight é possível entender e implementar o Hub? | SIM |
| Sem o Diário é possível implementar o Hub? | SIM |
| Sem Connectsoft é possível implementar o Hub? | SIM |
| Outra aplicação integra somente pela API pública? | SIM, como contrato G0; execução real é gate G1 |

## Referências

116 referências verificadas automaticamente, zero quebradas. O ensaio isolado detectou dependência no helper sintético `run_mock.py`; ele foi adicionado ao manifesto. Corrigida uma abreviação de paths no parecer API que expandia para três nomes inválidos; veredito APPROVE preservado. Referências históricas excluídas estão explicitamente marcadas e não são dependências. O ensaio de cópia do manifesto em diretório temporário isolado repete os validadores sem código dos hospedeiros. Resultado automático em `contracts/repository-package-validation-result.json`.

## Manifesto

Inclui fontes canônicas, ADR 0011–0013, OpenAPI aprovado, fixtures/validadores/resultados, plano/briefing/portões, seis pareceres finais, fechamento e relatórios. Exclui produto/config/adapters dos hospedeiros, Supabase migrations, segredos/.env, dados reais, ADRs Insight, C0–C9/C7/v1, reviews intermediários completos e resultado smoke Prism histórico. O helper `run_mock.py` está incluído por ser importado pelo harness stateful. A lista exata está em `contracts/repository-package-manifest.json`; orientações em `docs/REPOSITORY_TRANSFER_MANIFEST.md`.

## Pendências

Nenhum artefato obrigatório ausente. G1 real, implementação, produção e decisões jurídicas de retenção continuam fora do veredito de transferência. A sequência anterior já criou o repositório; uso/reconciliação desse checkout aguarda revisão humana conforme a missão atual. Novos reviews multiagente desta consolidação não foram emitidos: workers anteriores atingiram o limite de uso; os seis pareceres G0 originais foram preservados e todas as provas foram repetidas pelo orquestrador.

**READY_TO_CREATE_REPOSITORY**

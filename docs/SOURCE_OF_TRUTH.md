# Cotação Hub — fonte de verdade pré-G0

**Estado:** G0 READY contratual. Esta etapa consolida o pacote para revisão humana de transferência; não autoriza criação de repositório nem implementação. A execução anteriormente iniciada em outro checkout foi suspensa pela missão de consolidação de 30/09/2026; ver `docs/repository-readiness-report.md`.

## Autoridade por assunto

| Assunto | Fonte canônica |
|---|---|
| Arquitetura, bounded contexts, ownership e direção de deployment | `docs/architecture/overview.md` |
| Entidades, estados e regras comerciais | `docs/domain/{sourcing,supplier-network,commercial-conditions,award,purchasing}.md` |
| Identidade, ameaças, autorização, limites e retenção | `docs/security/{threat-model,roles-permissions,security-contracts,data-retention}.md` |
| Wire contract, nomes de campos, enums, rotas, erros, eventos estáveis e exemplos HTTP | `openapi/cotacao-hub-v1.yaml` |
| Escopo e fluxos de produto | `docs/product/{mvp-scope,buyer-flow,supplier-flow}.md` |
| Decisões arquiteturais vigentes do Hub | `docs/adr/0011-*.md`, `0012-*.md`, `0013-*.md` |
| Provas pré-G0 | `contracts/examples/cliente-terceiro/**`, `contracts/examples/cenario-dourado-corte/**`, `openapi-validation-report.md` |
| Portões e ownership multiagente | `.agents/orchestrator_cotacao/{plan-v2,GATE_STATUS}.md` |

Se um documento conceitual e o OpenAPI divergirem em campo ou comportamento HTTP, **G0 fica BLOCKED** até ambos serem corrigidos; o OpenAPI prevalece apenas para wire format, não para alterar regra de domínio silenciosamente. ADR vigente prevalece sobre nota histórica. Nenhum agente pode receber documentos `SUPERSEDED` como instrução de implementação.

## Precedência e resolução de conflitos

1. Este índice determina quais documentos são vigentes e seu escopo.
2. ADR vigente determina decisão arquitetural.
3. OpenAPI determina nomes, schemas e comportamento wire/API.
4. Domínio e segurança determinam regras e invariantes.
5. Plano multiagente determina ownership, dependências e gates.
6. Fixtures exemplificam e verificam contratos.
7. `docs/gates/G0.md` registra a evidência histórica de aprovação.
8. Histórico/SUPERSEDED não tem autoridade de implementação.

Conflito entre fontes vigentes deve ser registrado em `.agents/orchestrator_cotacao/contract-change-requests.md` e bloqueia transferência ou o gate afetado até revisão. A precedência não autoriza modificar silenciosamente invariantes. O OpenAPI aprovado é preservado nesta consolidação.

## Ordem obrigatória de leitura para H0–H7 após liberação humana

1. Este arquivo e `.agents/orchestrator_cotacao/GATE_STATUS.md`.
2. `docs/architecture/overview.md` e ADR 0011–0013.
3. Os cinco documentos de `docs/domain/` e os contratos de `docs/security/`.
4. `openapi/cotacao-hub-v1.yaml` e `openapi-validation-report.md`.
5. Fixtures `cliente-terceiro` e `cenario-dourado-corte` com resultados.
6. `docs/product/` e `.agents/orchestrator_cotacao/plan-v2.md`.

H0–H7 continuam proibidos enquanto G0 estiver `BLOCKED`, mesmo que a leitura acima esteja completa.

## SUPERSEDED — material histórico, não contrato do Hub

| Documento | Motivo |
|---|---|
| `docs/cotacao/00-contexto.md` | Caso de uso histórico de cliente; não limita plataforma |
| `docs/cotacao/01-contratos.md` | Define pedido como `aprendizado_snapshot`, RPC Supabase e token amplo |
| `docs/cotacao/02-producao.md` | Prescreve migração no Supabase compartilhado e implantação acoplada |
| `.agents/orchestrator_cotacao/{DISPATCH,plan,pedidos-de-contrato,progress}.md` (corpo antigo) | Plano C0–C9/S1 cancelado; usar apenas os avisos de supersessão e `plan-v2.md` |
| Anexo do Diário `2026-09-27-enviar-para-cotacao.md` | C7 por RPC do plano anterior; não executar |
| `docs/archive/pre-g0/cotacao-hub-especificacao-v1.md` | Rascunho v1 antes dos contratos comerciais/segurança v2; não enviar a workers |
| ADR 0001–0007 do repositório Insight | Vigentes para o Insight, não são ADRs do Hub; não transferir como contrato do Hub |

Relatórios finais em `.agents/orchestrator_cotacao/reviews/*-g0-final.md` são evidência de aprovação e devem acompanhar a transferência; não substituem contratos. Revisões intermediárias são históricas.

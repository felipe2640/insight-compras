# Cotação Hub — fonte de verdade pré-G0

**Estado:** contratos em revisão; nenhuma unidade de implementação autorizada. Esta árvore documental no branch de planejamento será transferida ao futuro repositório independente `cotacao-hub` quando G0 for aprovado e revisado por humano.

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
| `/Users/felipebarbosa/Documents/Codex/2026-09-29/antes-de-implementar-qualquer-c-digo/outputs/cotacao-hub-especificacao-v1.md` | Rascunho v1 antes dos contratos comerciais/segurança v2; não enviar a workers |
| ADR 0001–0007 do repositório Insight | Vigentes para o Insight, não são ADRs do Hub; não transferir como contrato do Hub |

Relatórios em `.agents/orchestrator_cotacao/reviews/` são evidência histórica de revisão, não fonte de contrato. No novo repositório, transferir apenas fontes canônicas e ADRs vigentes, mantendo este índice atualizado.

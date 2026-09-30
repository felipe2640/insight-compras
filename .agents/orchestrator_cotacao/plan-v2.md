# Plano multiagente pré-G0 v2 — Cotação Hub

**Estado:** G0 READY após revisões independentes e auditor CLEAN. C0–C9 e S1 anteriores foram cancelados. Os contratos foram transferidos ao checkout independente `cotacao-hub` em 29/09/2026; o usuário autorizou iniciar H0/H1 no novo repositório. I1 e D1 dependem de Hub isolado operacional. Este branch do Insight conserva a trilha documental G0; o plano de execução vigente está em `cotacao-hub/.agents/orchestrator_cotacao/plan-g1.md`.

## Equipe e ownership

| Papel | Ownership documental | Revisão |
|---|---|---|
| Orquestrador | plano, rastreabilidade, status e integração dos achados | não aprova o próprio trabalho |
| A1 arquitetura de domínio | `docs/architecture/overview.md`, sourcing, supplier network | limites e autonomia |
| A2 domínio comercial | condições comerciais e cenário dourado | operação real |
| A3 decisão | award e políticas | preço comparável e replay |
| A4 API/contratos | OpenAPI e fixture cliente-terceiro | integração sem banco |
| A5 segurança | threat model e matriz de papéis | ameaça e isolamento |
| A6 UX | jornadas buyer e supplier | escala operacional |
| A7 challenger | relatório de quebra em `.agents/orchestrator_cotacao/reviews/` | acoplamento e inviabilidade |
| A8 auditor | relatório final em `.agents/orchestrator_cotacao/reviews/` | CLEAN ou BLOCKED após A1–A7 |

Agentes trabalham em arquivos isolados. O orquestrador resolve conflitos por decisão registrada; contrato nenhum é congelado antes do fim das revisões. Para componentes pós-MVP, cada revisão diz se bastam porta/schema agora ou se implementação é necessária no piloto. Auditor só começa após achados e correções dos demais.

## Portões

**G0:** OpenAPI 3.1 válido e completo, mock gerável, fixture `cliente-terceiro` executável cobrindo 20 passos sem SQL nem código dos hospedeiros; cenário dourado com 2 tenants, 3 suppliers, 2 filiais e 8–12 itens; concorrência, preço comparável, mínimo/múltiplo, snapshots e autorização definidos; reviewers APPROVE, challenger sem crítico e auditor CLEAN. Se qualquer critério faltar, `G0 BLOCKED`. G0 é contratual e não requer implementação do Hub. Parar após documentação e veredito para revisão humana.

**G1 após liberação humana:** autorizado em 29/09/2026 no repositório independente; H0 fundação/tenancy/identidade e H1 sourcing/supplier network em execução. H2 API/idempotência, H3 supplier/OTP/importação, H4 award, H5 purchasing/documentos, H6 outbox/comunicação e H7 buyer/observabilidade seguem o plano G1. Cada unidade: worker com ownership exclusivo → reviewer → challenger; auditor em cada portão. Teste contra Hub real isolado e segurança adversarial no G1.

**G2:** preview com tenant sintético, provedores isolados e fluxo ponta a ponta. **G3:** piloto consentido e reversível. I1 Insight e D1 Diário só após Hub isolado operacional; E1 ERP é opcional. Adapters usam API, SSO e eventos públicos, nunca banco compartilhado. Mudança de contrato após G0 exige proposta, revisão impactada e nova versão quando quebrar compatibilidade.

## Riscos e status

G0 foi encerrado como **READY**: OpenAPI e fixtures passaram; arquitetura, domínio, API e segurança `APPROVE`; challenger `PASS`; auditor `CLEAN`. Ver `GATE_STATUS.md` e `reviews/*-g0-final.md`. G1 permanece aberto no repositório independente.

# Plano multiagente pré-G0 v2 — Cotação Hub

**Estado:** G0 READY contratual. A missão atual é consolidar e validar o pacote para revisão humana. Criação de repositório e H0–H7 estão suspensos nesta etapa. Trabalho anteriormente iniciado em checkout independente é registrado no relatório de prontidão e não integra este pacote. I1/D1 dependem de Hub isolado operacional.

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

**G1 após nova liberação humana:** worker com ownership exclusivo → reviewer independente → challenger → auditor do portão. Exige teste contra Hub real isolado, segurança adversarial e jornada da terceira aplicação. Nenhuma aprovação documental implica implementação funcional.

**G2:** preview com tenant sintético, provedores isolados e fluxo ponta a ponta. **G3:** piloto consentido e reversível. I1 Insight e D1 Diário só após Hub isolado operacional; E1 ERP é opcional. Adapters usam API, SSO e eventos públicos, nunca banco compartilhado. Mudança de contrato após G0 exige proposta, revisão impactada e nova versão quando quebrar compatibilidade.

## Riscos e status

G0 foi encerrado como **READY**: OpenAPI e fixtures passaram; arquitetura, domínio, API e segurança `APPROVE`; challenger `PASS`; auditor `CLEAN`. Ver `GATE_STATUS.md` e `reviews/*-g0-final.md`. G1 não está aprovado. A execução está suspensa durante a consolidação.


## Unidades e ondas futuras

| Unidade | Ownership futuro | Dependências | Reviewer / saída |
|---|---|---|---|
| H0 Foundation | foundation, tenancy, identidade buyer, entitlement | G0 + autorização | arquitetura/segurança: isolamento próprio |
| H1 Supplier Network/Sourcing | organizações, relações, snapshots, ofertas | H0 | domínio/segurança: ator e invariantes |
| H2 API/idempotência | HTTP v1, autenticação app, ledger | H0/H1 | API/segurança: wire, replay e ETag |
| H3 Supplier/importação | portal, OTP individual, staging XLSX | H1/H2 | domínio/segurança: autorização por recurso |
| H4 Award | estratégia, snapshot, execução/replay | H1/H2 | domínio/arquitetura: golden decimal |
| H5 Purchasing/documentos | pedidos, transições, documentos privados | H4/H3 | domínio/segurança: draft/issue e confirmação |
| H6 Integração/comunicação | outbox, webhooks, providers, auditoria | H0/H2/H5 | API/segurança: assinatura, retry, dedup |
| H7 Buyer/observabilidade | jornada buyer, métricas, operação | H2–H6 | UX/arquitetura: fluxo isolado completo |
| I1 Insight adapter | somente adapter Insight | G1 aprovado | API: sem acesso ao banco Hub |
| D1 Diário adapter | somente adapter Diário | G1 aprovado | API: API pública substitui RPC |
| E1 ERP adapter | importação, provenance, IDs externos | G1 aprovado; opcional | domínio/API: Hub opera offline da fonte |

Ondas: 1 H0; 2 H1/H2 conforme interfaces; 3 H3/H4; 4 H5/H6; 5 H7 e ensaio G1; 6 adapters após G1. Paralelismo exige ownership sem sobreposição. Challenger tenta quebrar autonomia, isolamento e invariantes em cada unidade. Auditor consolida evidência após reviews e correções; não aprova o próprio código.

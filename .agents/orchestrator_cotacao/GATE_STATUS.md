# Portões — Cotação Hub pré-G0

| Portão | Veredito | Evidência / motivo |
|---|---|---|
| G0 documental | **READY** | `SOURCE_OF_TRUTH.md` consolidado; OpenAPI 3.1 PASS (44 paths, 49 operações, 616 refs, 0 erros semânticos); harness stateful PASS 111; cenário dourado Decimal PASS; arquitetura, domínio, API e segurança `APPROVE`; challenger `PASS`; auditor `CLEAN`. Ver `reviews/*-g0-final.md`. |
| G1 Hub isolado | **SUSPENSO — NÃO APROVADO** | Trabalho anterior existe em outro checkout; missão atual limita-se à consolidação. Nova execução depende de autorização após revisão do pacote. |
| G2 preview | Não iniciado | Depende de G1. |
| G3 piloto | Não iniciado | Depende de G2. |

C0–C9 anteriores estão canceladas como plano de implementação. H0–H4 tiveram trabalho anterior fora deste pacote; H5–H7 e adapters não iniciados. A execução funcional foi suspensa nesta etapa. Não aplicar migrações no Supabase compartilhado. G0 READY aprova somente contratos e provas pré-implementação; parar para revisão humana antes de iniciar código funcional.

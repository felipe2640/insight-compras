# Revisão independente de arquitetura — G0

**Veredito: APPROVE (reavaliação após correções).** Revisão somente dos contratos; não houve implementação funcional. O desenho central é autônomo: monólito modular, dados próprios, API pública, identidades e pedidos canônicos. O cliente fictício consegue percorrer a cadeia sem SQL ou código específico de Insight, Diário, Supabase compartilhado ou Connectsoft. Nenhum bloqueio arquitetural permanece nesta revisão.

## Achados resolvidos na revisão

1. `PriceBasis` e `FreightTerms` têm agora campos/enums coerentes entre `docs/domain/commercial-conditions.md`, `docs/domain/award.md` e o OpenAPI. O cenário de caixa 10 para necessidade 7 foi identificado como hipótese com `allow_overbuy=true`; a fixture P1 usa `false`. O OpenAPI `AwardPolicy` agora exige `allow_overbuy:boolean`, tornando a decisão legível e versionada.
2. `contracts/examples/cliente-terceiro/README.md` identifica o harness stateful como ensaio contratual atual e preserva Prism apenas como evidência histórica. As origens narradas foram ajustadas para `authenticated_supplier` e `assisted_unconfirmed`, inclusive em `commercial-conditions.md`.

## Evidência positiva e limite

- `docs/architecture/overview.md` define ownership, transações locais e proíbe consultas a cadastro externo no corte; `docs/SOURCE_OF_TRUTH.md` marca os antigos contratos de RPC/Supabase como `SUPERSEDED`.
- O OpenAPI expõe rotas de supplier, quotation, award, purchase order, documento, evento e webhook. O resultado gravado de `contracts/validate_openapi.py` informa 44 paths, 49 operações, 614 refs resolvidas e nenhum erro semântico detectado. O teste stateful gravado relata 96 verificações e nenhuma resposta não declarada. O README agora identifica corretamente esse ensaio como prova contratual G0, sem substituir implementação ou testes G1.
- O bootstrap de tenant/credencial/política é pré-condição administrativa documentada, não acesso a um banco de host. Isto é aceitável para a prova contratual, desde que o provisionamento seja implementado pelo Hub em H0 e a fixture continue usando apenas o contrato público após bootstrap.

O parecer de arquitetura **APPROVE** não substitui os pareceres de domínio, API, segurança, challenger e auditor, nem libera H0–H7. A validação estrutural/semântica do OpenAPI e os resultados do harness precisam compor a decisão G0 consolidada do orquestrador.

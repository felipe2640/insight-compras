# Auditoria independente final — G0 do Cotação Hub

**CLEAN.** Não encontrei blocker contratual aberto para o G0. Este veredito aprova somente a especificação e a prova pré-implementação; não afirma que o Cotação Hub funcional exista e não libera H0–H7 automaticamente.

## Evidência reexecutada

| Prova | Resultado observado nesta auditoria |
|---|---|
| `contracts/validate_openapi.py` | PASS: OpenAPI 3.1, 44 paths, 49 operações, 34 mutações, 616 referências resolvidas, 49 declarações de segurança, 10 eventos públicos estáveis tipados, 0 campos monetários numéricos e 0 erros semânticos detectados. |
| `contracts/examples/cliente-terceiro/run_stateful.py` | PASS: 111 verificações encadeadas e negativas; IDs, tokens, desafios, ETags, cursor e eventos são consumidos das respostas anteriores; nenhuma resposta fora dos status declarados. |
| `contracts/examples/cenario-dourado-corte/verify.py` | PASS: aritmética `Decimal`, cenários comerciais, proveniência e IDs escopados ao tenant. |
| `git diff --check` | PASS. |
| Pareceres independentes | Arquitetura, domínio, API e segurança: `APPROVE`; challenger final: `PASS`, sem blocker. |

## Rastreabilidade dos blockers e P1 anteriores

| Achado anterior | Contrato e prova atual | Resultado |
|---|---|---|
| Documentos v1/v2 divergentes e C0–C9 antigos | `docs/SOURCE_OF_TRUTH.md` define autoridade e ordem de leitura; cabeçalhos antigos estão `SUPERSEDED`; `plan-v2.md` suspende C0–C9, H0–H7, I1 e D1. | Fechado. |
| Smoke Prism sem estado; terceiro não percorria a jornada | Harness stateful deriva rotas/schemas do OpenAPI e encadeia bootstrap, credencial, cotação, convite, OTP, oferta, corte, pedido, confirmação e evento; 111 verificações passam. Prism permanece evidência histórica. | Fechado no nível contratual G0. |
| Autorização e replay sem prova negativa | Harness nega T1/T2, supplier cruzado, convite Q1/Q2, documento e pedido alheios, OTP errado/expirado, convite expirado/revogado/reutilizado, falta de scope, ETag/`If-Match`, conflito de idempotência, emissão dupla, reabertura após emissão, webhook adulterado/expirado/repetido e sessão ociosa. Cada negação compara status e `problem+json.code`. | Fechado no nível contratual G0. |
| `lowest_eligible_cost_by_item` ambíguo | `docs/domain/award.md`, `commercial-conditions.md`, OpenAPI e fixture separam `lowest_unit_price`, elegibilidade por candidato, cenário fornecedor × destino × moeda, viabilidade e sugestão. I04: C tem preço unitário 29.00, mas pedido isolado C custa 340.00 com frete; B custa 310.00. | Fechado. |
| Mínimo, frete, múltiplo, base de preço e resposta assistida | Política tipa `minimum_order_mode` e `assisted_response_mode`; frete desconhecido exige revisão; fixture usa 2 tenants, 3 fornecedores, 2 filiais, 12 itens, total Q1 889.50 (B/F1 631.50, B/F2 258.00), pendências I06/I10/I11 e probes de warning/hard constraint, múltiplo, alternativa, parcial e proveniência. | Fechado. |
| Reopen × draft/issued, submit × close e emissão dupla | Domínio e OpenAPI definem ETag, idempotência, ordem transacional; reabertura cancela drafts e supersede award atomicamente; pedido emitido bloqueia. Harness exercita stale version, retry, duplicate issue e reabertura com draft/issued. | Fechado no nível contratual G0. |
| Buyer forjava autoria supplier; representação por convite | `response_origin` e ator individual permanecem explícitos; buyer só importa como `assisted_unconfirmed`; convite não concede membership nem acesso global. Política governa confirmação/exceção. Negativos de troca de `supplier_id` e convite fora do escopo passam. | Fechado. |
| Supplier M2M, SSO, TTL/rate, documentos, eventos e LGPD incompletos | Supplier M2M formalmente pós-MVP; `TrustedIdentityProvider` admite OIDC/JWT-JWKS/sessão Hub com mapeamento controlado; `security-contracts.md` fixa defaults e autorização pelo recurso pai; eventos v1 têm schemas tipados; `data-retention.md` classifica categorias e decisões jurídicas pendentes. Parecer de segurança final é `APPROVE`. | Fechado como contrato G0. |
| Acoplamento a Insight, Diário, Supabase compartilhado ou Connectsoft | `overview.md` e ADR 0011–0013 atribuem banco, snapshot, identidades, pedido, API e outbox ao Hub; ERP é importação opcional; challenger procurou dependências ocultas e concluiu `PASS`. | Fechado. |

## Limites da prova

O harness chama um mock Python em memória e valida contratos derivados do OpenAPI. Ele não demonstra autenticação criptográfica de produção, isolamento SQL, concorrência real, persistência, cálculo do `AwardStrategy`, entrega de e-mail/webhook ou geração de documentos por um servidor Hub. A fixture dourada valida aritmética e resultados esperados, não executa o motor. Esses testes pertencem ao G1 no repositório independente. O bootstrap administrativo de tenant/credencial/política continua pré-condição do cliente fictício, descrita como capacidade própria do Hub.

Os pareceres de arquitetura, domínio e API registram contagens intermediárias de refs/chamadas; a execução final acima substitui essas contagens como evidência numérica. A antiga `GATE_STATUS.md` ainda registra o bloqueio histórico e deve ser atualizada pelo orquestrador após esta auditoria para evitar leitura de status divergente.

**Veredito do auditor: CLEAN.** Recomendo registrar `G0 READY` somente após atualizar o status consolidado e entregar à revisão humana, sem iniciar implementação funcional nesta etapa.

> **SUPERSEDED — NÃO UTILIZAR PARA IMPLEMENTAÇÃO.** Revisão intermediária; fontes vigentes em `docs/SOURCE_OF_TRUTH.md`, pareceres finais em `reviews/*-g0-final.md`.

# Consolidação do orquestrador — pré-G0 v2

**Branch:** `codex/cotacao-pre-g0-v2`, derivado de `origin/claude/plano-cotacao-multiagente`. **Estado:** documentação/contratos; sem produto implementado.

## Decisões mantidas

Repositório `cotacao-hub` independente, monólito modular, banco e infraestrutura próprios, API `/api/v1`, organização fornecedora global separada de usuário/relacionamento buyer, convite limitado, autenticação individual, decimais exatos, corte versionado, pedido canônico, outbox/webhooks e entitlement. Insight e Diário permanecem consumidores por adapters posteriores. Nenhum conector Connectsoft é necessário à operação.

## Decisões novas nesta revisão

Proposta possui cabeçalho comercial tipado e linhas com unidade, mínimo, múltiplo, disponibilidade, marca/referência alternativa e `price_basis`. Resultado de corte distingue menor preço nominal, menor custo elegível e cenário sugerido; base inconclusiva produz `requires_review`. Frete fixo e faturamento mínimo são avaliados no nível do pedido por fornecedor/destino. Pedido nasce `draft`, é revisado e só depois emitido. Supplier recebe convite próprio de pedido para confirmar/recusar com OTP, sem ampliar o convite da cotação. `TrustedIdentityProvider` admite OIDC, JWT/JWKS e sessão própria com verificações comuns. Operações em lote suportam grade e importação assistida sem forjar autoria. G0 é prova de contrato pré-código; G1 testa Hub real.

## Decisões descartadas

`Pedido = aprendizado_snapshot`, RPC do Diário no Supabase compartilhado, portal por RPC/tokens que listam outras cotações, proposta por convite e `number` binário para dinheiro: todos criam acoplamento, acesso excessivo ou decisão não reproduzível. Menor preço unitário como vencedor automático foi descartado porque embalagem, mínimo, frete e base fiscal mudam a compra. OIDC como único SSO foi descartado porque a plataforma deve aceitar outros provedores verificáveis. Otimizador global, motor tributário, frete por faixa, marketplace e integração direta com supplier foram adiados sem bloquear o MVP.

## Evidência obtida

- OpenAPI 3.1 validado com `openapi-spec-validator`.
- Mock Prism 5.16 derivado do OpenAPI, modo dinâmico `--errors`: `run_mock.py` executou 31 chamadas HTTP que cobrem os 20 passos documentados, com status 2xx declarados (`contracts/examples/cliente-terceiro/mock-result.txt`). É smoke de contrato sem estado.
- Cenário dourado tem 2 tenants, 3 suppliers, 2 filiais em Q1, 12 itens no total; `verify.py` passou aritmética decimal, isolamento de IDs por tenant e probes de múltiplo/frete/mínimo/parcial/substituição/snapshot. O cálculo do resultado declarado não executa a estratégia real.
- Arquitetura A1 e domínio comercial A2/Award A3 aprovaram a direção condicionada a contrato/prova. Segurança A5 e UX A6 reportaram riscos e correções. Challenger A7 e auditor A8 fecharam com `BLOCKED`.

## Limites da prova e riscos ainda abertos

O mock Prism não mantém estado, não encadeia IDs/ETags de respostas e não aplica isolamento, OTP, assinatura, idempotência nem concorrência. Os exemplos de request são gerados por schema, não são o corpus semântico completo da jornada. `verify.py` não implementa `AwardStrategy`; replay real pertence ao G1. Faltam testes de contrato negativos executáveis que simulem T1/T2, convite Q1/Q2, chave idempotente repetida, ETag stale e assinatura webhook. Também faltam decisões finais de retenção/LGPD, TTL/limites e ownership de membership supplier para release. O relatório do auditor define se algum desses bloqueia G0.

## Status de portões

C0–C9 anteriores suspensas; H0–H7, I1 e D1 não iniciadas. Não aplicar migração no Supabase compartilhado. **G0 BLOCKED** pelo veredito do auditor. Mesmo após eventual READY em nova revisão, parar para revisão humana antes de código funcional.

> **SUPERSEDED — NÃO UTILIZAR PARA IMPLEMENTAÇÃO.** Revisão intermediária; fontes vigentes em `docs/SOURCE_OF_TRUTH.md`, pareceres finais em `reviews/*-g0-final.md`.

# A8 Auditor — revisão pré-G0 v2 do Cotação Hub

**Veredito: BLOCKED.** Auditoria realizada depois da publicação do OpenAPI, do smoke contra Prism e do veredito final A7. Este parecer não altera contratos nem autoriza H0–H7, I1, D1 ou C0–C9.

## Rastreabilidade e evidência verificada

| Critério | Evidência | Resultado |
|---|---|---|
| Independência do produto | `docs/architecture/overview.md`, `docs/domain/**` e ADR 0011–0013 definem monólito modular, banco próprio, snapshots, IDs externos opacos, API pública e pedidos canônicos. `docs/cotacao/**` e plano antigo estão marcados como históricos/suspensos. | Direção consistente; nenhuma dependência obrigatória de Insight, Diário, Supabase compartilhado ou Connectsoft nos novos contratos. |
| OpenAPI 3.1 | `openapi/cotacao-hub-v1.yaml` passou `openapi-spec-validator` conforme evidência do orquestrador; auditor verificou parse YAML e 392 `$ref` resolvidos. | PASS estrutural. Validação sintática não prova semântica da jornada. |
| Mock derivado do contrato | Prism 5.16 em modo dinâmico `--errors`; `contracts/examples/cliente-terceiro/mock-result.txt` registra 31 respostas 2xx para rotas dos passos 1–20. | PASS como smoke HTTP. |
| Terceiro independente | `contracts/examples/cliente-terceiro/README.md` descreve 20 passos e uso exclusivo da API; `run_mock.py` gera corpos mínimos a partir dos schemas. | **Não demonstrado como jornada executável encadeada.** O script usa UUID, token, ETag e chave idempotente fixos; não captura IDs/ETags de respostas, não carrega os dados semânticos do caso, não troca credenciais buyer/supplier reais, não confirma evento/HMAC e não verifica negações ou retries. O mock não mantém estado. |
| Cenário dourado | `scenario.json` tem 2 tenants, 3 suppliers, 2 filiais e 12 itens; `verify.py` passa com Decimal e probes de mínimo/múltiplo, frete, parcial, alternativa, base desconhecida e snapshot. | PASS como consistência de dados/aritmética. Não executa `AwardStrategy` nem verifica produção das razões esperadas; estratégia real é G1. |
| Segurança | `docs/security/threat-model.md` e `roles-permissions.md` cobrem isolamento, convite, OTP, SSO, uploads, webhooks, PII, concorrência e autoria assistida. | Modelo amplo, mas A5 registra **BLOCKED**; mandato supplier M2M, perfis `TrustedIdentityProvider`, TTL/limites, retenção/LGPD e autorização de eventos/documentos precisam de fechamento contratual e provas negativas. |
| Revisão independente | A1/A2/A3 aprovaram direção condicionada; A5 registra BLOCKED; A7 final registra BLOCKED; não há quatro pareceres formais `APPROVE` de arquitetura, domínio, segurança e API. | Critério expresso de G0 não cumprido. |

## Achados que impedem congelar o contrato

1. **Prova G0 insuficiente:** a fixture `cliente-terceiro` deve capturar e reutilizar IDs, ETags, sessões e segredos de respostas anteriores, alimentar requests realistas para os 20 passos e verificar resultados semânticos, mesmo que por mock de contrato com estado/fixtures. As negações T1/T2, convite Q1/Q2, autoria buyer/supplier, retry idempotente, `412/428`, assinatura e deduplicação de evento precisam ser exercitadas ou receber exceção explícita aprovada pelos reviewers. O smoke atual não satisfaz a demonstração pedida na missão.
2. **Achados A7 P1 abertos:** `lowest_eligible_cost_by_item` depende de agrupamento/frete/mínimo e precisa hipótese de cenário ou resultado indeterminado; reabertura concorrente com pedido `draft`/emissão exige transição atômica; proposta assistida exige regra tipada de confirmação/exceção antes da emissão; a representação supplier após convite precisa nível de garantia e autoria visíveis. Ver `challenger-v2.md`.
3. **Eventos anunciados além dos dois pedidos:** `WebhookSubscriptionCreate.event_types` enumera eventos de cotação, convite, oferta, corte e pedido, enquanto apenas `purchase_order.issued.v1` e `.confirmed.v1` possuem payloads estáveis específicos; declarar os demais experimentais ou tipá-los antes de prometer estabilidade v1.
4. **Segurança e governança:** concluir as pendências expressas em `docs/security/threat-model.md` e obter `APPROVE` de segurança após evidência revisada. A ausência de implementação não impede definir esses limites no contrato.
5. **Pareceres exigidos:** registrar `APPROVE` explícito de architecture, domain, security e API reviewers após as correções, obter A7 sem achado crítico e então repetir auditoria. Um parecer condicional ou a aprovação da direção não equivale a aprovação G0.

## Conflitos e limites aceitos

O smoke Prism é evidência útil de que as rotas da jornada existem e respondem segundo o OpenAPI; não é evidência de autorização, persistência, idempotência, serialização ou corte. `verify.py` demonstra que o resultado declarado no cenário dourado é aritmeticamente coerente; teste do motor real e de suas corridas pertence a G1. Esses limites estão reconhecidos em `orchestrator-v2.md` e no relatório A7, sem falsa alegação de implementação do Hub.

**Status final:** `G0 BLOCKED`. Não iniciar implementação funcional. Após fechar os achados, rodar novamente OpenAPI, mock e fixtures, recolher os quatro `APPROVE` e o challenger sem crítico, e solicitar nova auditoria para eventual `CLEAN`.

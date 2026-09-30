# Cenário dourado de corte — fixture sintética pré-G0 v2

Este cenário é dado de contrato, não código de produto. Valores e nomes são fictícios. Todos os números de dinheiro/quantidade abaixo correspondem a strings decimais na API; a apresentação em tabela usa ponto decimal. BRL, escala monetária 2, `half_up` por linha. A política e as propostas são snapshots imutáveis do `award_run`.

## Participantes e fronteira multi-tenant

| ID | Tipo | Dados |
|---|---|---|
| T1 | buyer tenant | Aplicação independente `cliente-terceiro-um`; cotação Q1; filiais F1 Centro e F2 Norte. |
| T2 | buyer tenant | Aplicação independente `cliente-terceiro-dois`; cotação Q2; destino D2. Não possui acesso a Q1/F1/F2. |
| A | supplier organization global | `Fornecedor Alfa`; relação T1: mínimo BRL 1500.00 por pedido/destino, CIF, pagamento 30 dias, prazo padrão 5 dias. Relação T2: mínimo 0.00, CIF, pagamento 15 dias. |
| B | supplier organization global | `Fornecedor Beta`; em T1: sem mínimo, CIF incluído, pagamento 30 dias, prazo padrão 3 dias. |
| C | supplier organization global | `Fornecedor Gama`; em T1: sem mínimo, FOB fixo BRL 50.00 por pedido/destino, pagamento 30 dias, prazo padrão 4 dias; linhas apenas em múltiplos de 10 peças. |

As três organizações existem globalmente, mas códigos ERP, contatos, mínimos, preços, histórico e propostas são exclusivos de cada relacionamento/tenant. T2 vê A com suas próprias condições e não consegue inferir a condição T1. Q2 usa o mesmo `external_id` opaco `Q-17` que Q1 para provar escopo `(tenant, source_system, external_id)`.

Q1 fecha para respostas em `2026-10-10T18:00:00Z`. A proposta A foi importada por buyer identificado, com arquivo/hash e estado `assisted_unconfirmed`; não é submissão autenticada do fornecedor. B e C foram submetidas por usuários individuais com OTP. Todas têm validade `2026-10-15T18:00:00Z`. O corte ocorre `2026-10-11T12:00:00Z`. A política P1 exige `tax_status=included`, `discounts_applied=yes`, unidade peças, mesma moeda, marca aceita, prazo máximo 7 dias, `allow_overbuy=false`, `minimum_order_mode=hard_constraint` e saldos parciais permitidos. Proposta assistida pode entrar no cálculo com alerta de proveniência, mas pedido que dependa dela requer confirmação do supplier antes de emissão.

Todas as linhas precificadas declaram `price_basis={currency:BRL,priced_unit:piece,tax_status:included,freight_status:included|separate_known,discounts_applied:yes}`. A e B declaram frete incluído; C declara frete separado com valor fixo conhecido no cabeçalho. Nenhuma condição de pagamento altera o custo na política P1; a comparação expõe os prazos financeiros e registra essa regra como ignorada pelo motor.

## Itens solicitados e linhas ofertadas de Q1

`—` significa sem resposta; `Ø` significa `no_stock=true`; `pN` indica disponibilidade N; `m10` indica mínimo e múltiplo de 10; todos os demais vendem por peça unitária e têm disponibilidade igual ou maior que a solicitada. Cada oferta guarda referência/marca ofertada, mesmo quando coincidem com a solicitada.

| Item | Filial | Referência / marca solicitada | Qtd | A preço e condição | B preço e condição | C preço e condição | Decisão P1 |
|---|---|---|---:|---|---|---|---|
| I01 | F1 | `REF-01` / ORIGINAL | 7 | 10.00, caixa 10, m10 | 10.50 | 9.80, m10 | B 7 × 10.50 = 73.50; A/C não vendem 7 sem sobrecompra. |
| I02 | F1 | `REF-02` / ORIGINAL | 4 | 20.00 | 21.00 | 19.00, m10 | B 4 × 21.00 = 84.00; A bloqueado pelo mínimo no cenário. |
| I03 | F1 | `REF-03` / ORIGINAL | 2 | 50.00 | 52.00 | 49.00, m10 | B 2 × 52.00 = 104.00. |
| I04 | F1 | `REF-04` / ORIGINAL | 10 | 30.00 | 31.00 | 29.00, m10 | B 10 × 31.00 = 310.00; C custa 290.00 + 50.00 de frete se for seu único pedido F1. |
| I05 | F1 | `REF-05` / ORIGINAL | 5 | — | 12.00 | 11.00, m10 | B 5 × 12.00 = 60.00; A sem resposta não equivale a sem estoque. |
| I06 | F1 | `REF-06` / ORIGINAL | 2 | 40.00 | Ø | 39.00, m10 | Pendente 2; B declarou sem estoque, A não alcança mínimo, C não vende 2. |
| I07 | F2 | `REF-07` / MOBENSANI | 4 | 15.00, `ALT-07` / MARCA-X, substituição não aceita | 17.00, exato | 16.00, m10 | B 4 × 17.00 = 68.00; A rejeitado por marca/referência. |
| I08 | F2 | `REF-08` / MOBENSANI | 6 | 9.00, `ALT-08` / AXIOS, alternativa aceita com equivalência confirmada | 10.00, exato | 8.00, m10 | B 6 × 10.00 = 60.00; A seria elegível como item, mas pedido A fica abaixo do mínimo. |
| I09 | F2 | `REF-09` / ORIGINAL | 8 | 11.00, prazo 2 dias | 11.00, prazo 4 dias | 10.00, m10 | B 8 × 11.00 = 88.00; empate nominal A/B, A bloqueado pelo mínimo. |
| I10 | F2 | `REF-10` / ORIGINAL | 6 | 13.00 | 14.00, p3 | 12.00, m10 | B 3 × 14.00 = 42.00; saldo pendente 3. |
| I11 | F2 | `REF-11` / ORIGINAL | 1 | — | — | — | Pendente 1 por ausência de resposta de todos. |

Em I01, A especifica `sales_unit=piece`, `minimum_quantity="10.000000"`, `sales_multiple="10.000000"` e embalagem física `box_size="10.000000"`: preço nominal 10.00 por peça, não por caixa. C usa a mesma semântica de múltiplo. Assim, A custaria 100.00 para comprar 10 contra necessidade 7; B custa 73.50 por 7. A política proíbe sobrecompra, logo A fica inelegível antes mesmo da comparação de total.

I08 mostra alternativa aceita sem presumir que toda equivalência de marca seja automaticamente válida. I07 mostra alternativa recusada. O código `ALT-08` é apenas referência ofertada; aceitação técnica explícita consta no snapshot P1. I09 documenta empate e desempate: numa política `warning` em que A participasse, A venceria o empate por 2 dias contra 4 de B, com alerta de faturamento mínimo; P1 `hard_constraint` exclui A e escolhe B.

## Cálculo do cenário P1

| Pedido preparado | Linhas | Mercadorias | Frete | Total | Mínimo |
|---|---|---:|---:|---:|---|
| B → F1 | I01 73.50 + I02 84.00 + I03 104.00 + I04 310.00 + I05 60.00 | 631.50 | 0.00 CIF | 631.50 | Nenhum |
| B → F2 | I07 68.00 + I08 60.00 + I09 88.00 + I10 42.00 | 258.00 | 0.00 CIF | 258.00 | Nenhum |
| **Q1 total** | 9 linhas adjudicadas | **889.50** | **0.00** | **889.50** | I06 2, I10 3 e I11 1 pendentes |

Mesmo concedendo a A todas as suas linhas comercialmente admissíveis sem limite de quantidade, A alcançaria no máximo F1 `100.00 + 80.00 + 100.00 + 300.00 + 80.00 = 660.00` (I01 pressuporia sobrecompra, proibida em P1) e F2 `54.00 + 88.00 + 78.00 = 220.00`. O limite superior generoso de 880.00 continua inferior a 1500.00; por filial a inviabilidade é ainda mais evidente. Portanto nenhuma realocação de Q1 viabiliza um pedido A sob o mínimo vigente. Esta prova evita que uma heurística por linha declare A vencedor e gere pedido impossível.

O preço nominal mais baixo em I04 é C 29.00, mas custo para atender dez peças em pedido isolado C/F1 é `10 × 29.00 + 50.00 = 340.00`, frente a B `10 × 31.00 = 310.00`. Em cenário com outros itens C/F1, o frete de 50.00 seria compartilhado no total do pedido, jamais somado a cada linha. `lowest_unit_price` indica C em I04, enquanto `supplier_destination_scenario` de C/F1 isolado totaliza 340.00 e o de B/F1 para a linha totaliza 310.00. Em I01 o menor nominal é C 9.80; a sugestão viável P1 é B 73.50. Em I02 o menor nominal é C 19.00; A 20.00 é menor preço de linha comprável, mas fica inviável no pedido por mínimo, portanto o corte sugere B 84.00.

`AwardResult` esperado: duas alocações de pedido B, três saldos pendentes, exclusões por `SALES_MULTIPLE`, `MIN_ORDER_UNMET`, `NO_STOCK`, `NO_RESPONSE` e `SUBSTITUTION_REJECTED`, componente de frete calculado em nível de pedido, condições de pagamento e proveniência de cada proposta. Uma decisão manual do buyer pode manter I06 pendente para nova rodada, alterar prioridade de I09 com motivo ou solicitar ao fornecedor A uma revisão autenticada que dispense o mínimo. Enquanto tal revisão não existir, um ajuste manual não autoriza emissão de pedido A abaixo de 1500.00.

## Q2 e isolamento

Q2, tenant T2, contém I12 no destino D2: necessidade de 2 peças `REF-12` / ORIGINAL. T2 possui relações próprias com A, B e C. A oferece 25.00 por peça, CIF, sem mínimo no relacionamento T2; B oferece 26.00, CIF; C oferece 24.00, m10. Política P2 proíbe sobrecompra. A vence `2 × 25.00 = 50.00`. A mesma organização A permanece inviável em Q1 sob P1. O corte de Q2 não lê proposta, frete, mínimo, filial, usuário buyer nem histórico de Q1; repetir `external_id=Q-17` não colide entre tenants. Uma sessão supplier restrita a Q1 não consegue ler Q2, mesmo que o usuário trabalhe na organização A.

## Provas contratuais para G0

1. Rodar P1 com snapshots acima e verificar valores exatos, códigos de exclusão, saldos e dois pedidos B separados por filial.
2. Alterar cadastro atual de A para mínimo 2000.00 após o corte e reproduzir o resultado anterior de 889.50 usando o snapshot/hash e a mesma versão de estratégia.
3. Rodar política derivada `minimum_order_mode=warning`: A pode aparecer como candidata de linha, I09 desempata por prazo, mas toda alocação abaixo de 1500.00 recebe alerta e impede emissão automática sem resolução explícita.
4. Trocar I04 de C para FOB com valor de frete desconhecido: comparação automática C versus B retorna `requires_review`, sem total inventado.
5. Tentar comprar 7 unidades de A em I01, 3 adicionais de B em I10, ou aceitar I07 de A sem aceite: contrato retorna restrição/erro de domínio.
6. Testar Q2 com token buyer T1 e sessão de convite Q1: `403` ou `404` sem revelar preços/relacionamento T2.

Veredito histórico A2: fixture consistente. **G0 READY contratual** após validações e pareceres finais; esta fixture não é implementação do motor.

## Probes adicionais e vocabulário do contrato

`scenario.json` contém `minimum_modes`: subtotal 200.00 abaixo do mínimo 1500.00 produz `warning` ou `infeasible` conforme `minimum_order_mode`; duas linhas 800.00 + 700.00 tornam o agrupamento `feasible`. O agrupamento é fornecedor × destino × moeda; nunca se testa mínimo por item. O probe `scenario_vs_unit` prova que C tem `lowest_unit_price` em I04, mas B tem menor custo de cenário isolado conhecido. A estratégia pode sugerir B sem declarar ótimo global.

`freight_modes` distingue CIF/included com zero adicional, fixed com 50.00 cobrado uma vez, FOB/unknown com valor ausente e `requires_review`. `assisted_modes` testa `exclude`, `allow_with_warning`, `require_confirmation` e a confirmação posterior da mesma revisão. `alternative_reference` exige aceite explícito; `tie` distingue o desempate local por prazo da inviabilidade comercial do mínimo. `verify.py` calcula todos os valores usando `Decimal` e valida o contrato esperado, sem implementar `AwardStrategy`.


## Leitura humana de cada caso

A tabela I01–I11 acima documenta necessidade, três propostas e decisão por linha; I12/Q2 demonstra isolamento e condição privada. As seções P1, Q2 e probes documentam cenário final, alertas, pendências, nominal versus elegível e motivos. Os arquivos em `input/` e `expected/` são projeções verificadas de `scenario.json`, que continua sendo a fixture aprovada.

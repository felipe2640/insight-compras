# Condições comerciais da cotação — contrato pré-G0 v2

Status: proposta de domínio para revisão; não autoriza implementação. Aplica-se ao Cotação Hub independente, sem regra de ERP, cliente ou catálogo específico.

## Escopo e ownership

`offer` pertence à organização fornecedora na cotação. Uma revisão submetida congela cabeçalho comercial e linhas ofertadas, com ator, origem e horário. Convites apenas indicam destinatários. Condições da relação buyer × supplier servem como valores iniciais; somente o snapshot da proposta e da política usado no `award_run` participa da decisão. Alterar cadastro depois não altera cortes anteriores.

O Hub registra preço e condições informados, compara bases declaradas e explica limitações. Ele não presume tributos, conversão de unidades, câmbio, equivalência de produto nem frete não informado.

## Cabeçalho comercial tipado

| Campo | Semântica e validação |
|---|---|
| `currency` | ISO 4217, igual à moeda da cotação no MVP. |
| `payment_terms` | Texto estruturado `{code?, description, installments?}`; prazo financeiro não se confunde com entrega. |
| `minimum_order_amount` | Decimal não negativo na moeda da proposta, aplicado ao total de mercadorias adjudicadas ao fornecedor por pedido/destino conforme `minimum_scope`. |
| `minimum_scope` | `per_order` ou `per_destination`; se a regra real exigir escopo não suportado, `requires_review`. |
| `freight_terms` | `{mode: CIF|FOB|included|fixed|unknown, payer: buyer|supplier|unknown, amount?, amount_kind: fixed|unknown}`. Valor fixo conhecido é cobrado uma vez por pedido/destino; CIF/incluído não acrescenta frete. FOB sem valor conhecido exige revisão. |
| `default_lead_time_days` | Inteiro não negativo; linha pode sobrescrever. Não é deadline da cotação. |
| `offer_valid_until` | Instante UTC; proposta vencida não é elegível sem revalidação auditada. |
| `adjustments` | Acréscimos/descontos tipados, com escopo, base e valor; tipos não calculáveis pelo motor retornam `requires_review`. |
| `commercial_note` | Texto sem efeito de cálculo até ser convertido em condição tipada e aceita. |

Campos desconhecidos podem ser preservados como metadados versionados, mas nunca participar silenciosamente do cálculo. `payment_terms` deve aparecer no corte e no pedido mesmo quando a política MVP apenas alerta diferenças; sem equivalência econômica, pagamento diferente exige revisão se a política requer preço líquido comparável.

## Linha ofertada

Cada linha aponta ao `quotation_item_id` interno e registra snapshot de `requested_reference`, `requested_brand`, `requested_quantity`, `requested_unit`; mais `offered_reference`, `offered_brand`, `available_quantity`, `unit_price`, `sales_unit`, `minimum_quantity`, `sales_multiple`, `lead_time_days`, `estimated_delivery_at?`, `no_stock`, `substitution_type`, `substitution_note` e `note`. `substitution_type` é `none|reference|brand|both`. O fornecedor pode omitir linhas: omissão é `unanswered`, distinta de `no_stock`.

`price_basis` obrigatório para linha com preço: `{currency, priced_unit, tax_status: included|excluded_with_amount|excluded_unknown, tax_amount?, freight_status: included|separate_known|unknown, discounts_applied: yes|no_known|unknown, unit_conversion?: {numerator, denominator, policy_version}}`. Na fase inicial, `priced_unit` deve ser idêntica à unidade comprada ou possuir conversão racional publicada na política. Imposto ou desconto de valor desconhecido e frete desconhecido produzem `comparison_status=requires_review`; não se inventa preço líquido. Tributos informados separadamente podem ser exibidos, mas só entram em custo quando há fórmula tipada e versionada.

Quantidade, preço, mínimo e múltiplo são strings decimais canônicas na API e `DECIMAL(20,6)` no banco. O motor usa decimal exato. Para BRL, linhas são arredondadas a centavos após `ordered_quantity × unit_price`, por `half_up` nesta fixture; total do pedido soma linhas já arredondadas e frete fixo uma vez. A política congela escala e arredondamento. Não arredondar preço unitário para escolher vencedor.

## Elegibilidade e preço comparável

Para necessidade `q`, uma linha tem quantidade comprável `p` se `p ≥ minimum_quantity`, `p` é múltiplo de `sales_multiple`, `p ≤ available_quantity` e satisfaz a política de sobrecompra. `available_quantity` significa unidades vendáveis na `sales_unit`, não caixas implícitas. No MVP da fixture, `allow_overbuy=false`; logo `p ≤ saldo solicitado`. Se nenhuma quantidade positiva satisfaz as restrições, a linha é inelegível. Saldo pode ser distribuído entre fornecedores em quantidades válidas para cada um.

Uma alternativa de referência/marca exige política `exact_only|accepted_brands|allow_review` e evidência explícita de aceite da marca/referência aplicável. `allow_review` não aprova automaticamente. Uma referência substituta aceita pela marca ainda pode exigir confirmação técnica do comprador se não houver mapeamento de equivalência aprovado; a fixture registra essa confirmação. Oferta vencida, sem estoque, sem resposta, prazo acima do máximo, moeda incompatível ou base de preço não comparável não pode receber vitória automática.

Cinco conceitos distintos devem constar no resultado: `lowest_unit_price` (linha nominal por item), `line_eligibility` (em `candidates[]` por item × fornecedor, somente critérios locais), `supplier_destination_scenario` (agrupamento fornecedor × destino × moeda), `scenario_feasibility` (`feasible|warning|requires_review|infeasible`) e `suggested_award` (resultado da estratégia). Nenhum custo total por item é apresentado quando frete ou mínimo dependem do agrupamento.

O `AwardResult` deve mostrar por linha quantidade solicitada, comprada e pendente; preço nominal, quantidade comprável, custo de mercadoria, componente de frete no total do pedido, condição de pagamento, prazo, status de comparação, exclusões e desempate. Por cenário, mostrar total de mercadorias por fornecedor/destino, frete, faturamento mínimo, regra aplicada/ignorada, alertas e `reason_code` estável. Frete fixo não deve ser somado repetidamente a cada item.

## Faturamento mínimo e divisão de pedidos

`minimum_order_mode` é `ignore|warning|hard_constraint` e fica no snapshot da política. `ignore` não bloqueia nem alerta; `warning` mantém alocação com alerta e exige decisão consciente antes da emissão; `hard_constraint` torna inviável qualquer pedido ao fornecedor abaixo do mínimo. A avaliação é por pedido/destino se esse for o escopo comercial; dividir o mesmo fornecedor entre filiais pode fazer ambos os pedidos falharem. O motor deve recalcular o mínimo sobre o cenário inteiro, não linha por linha. Frete não conta para faturamento mínimo, salvo termo contratual tipado dizendo expressamente o contrário.

Pedido é separado por fornecedor, destino e moeda. Uma cotação pode gerar vários pedidos e deixar saldos pendentes; pedido não pode exceder quantidade comprável sem decisão de sobrecompra explícita. Ajuste humano cria nova revisão de corte com ator, motivo e exceções comerciais autorizadas. Comprador não pode unilateralmente apagar o mínimo declarado pelo fornecedor: dispensa exige nova revisão/atestado do fornecedor ou condição contratual registrada. Antes de emissão, pedido preparado pode ser revisado/cancelado; depois, transições formais preservam histórico.

## Matriz de entrega

| Capacidade | MVP | Pós-MVP | Preparar contrato agora |
|---|---|---|---|
| Cabeçalho comercial, linha, disponibilidade, mínimo/múltiplo, frete conhecido, prazo e validade | Sim | — | Sim |
| Base de preço e `requires_review` | Sim | Fórmulas tributárias | Sim |
| Split e saldo pendente | Sim | Otimização global | Sim |
| Alternativa de marca/referência com aceite humano | Sim | Matching inteligente/catálogo universal | Sim |
| Importação assistida com autoria real | Sim | API supplier e canais adicionais | Sim |
| Frete por faixa, câmbio e conversão de unidades | Não | Sim | Campos/versionamento, sem cálculo inicial |
| Condições financeiras comparadas por custo de capital | Não | Sim | Preservar condições no snapshot |

## Achados comerciais que bloqueiam contrato incompleto

- `unit_price` isolado não ordena ofertas com caixa, mínimo, frete ou bases fiscais diferentes.
- `minimum_order_amount` é restrição de cenário/pedido, não atributo de item. Um greedy puramente por linha pode propor pedido inexequível.
- `available_quantity` e `sales_multiple` precisam usar unidade explícita; `7 peças` contra `caixa de 10` é verificável apenas com essa relação.
- `assisted_unconfirmed` não pode ser rotulado como `authenticated_supplier`. O corte mostra a proveniência e o comprador decide se aceita a evidência.
- `award_run` precisa congelar condições de cabeçalho e snapshots de unidade, política e destino para reprodução posterior.

Veredito A2: **contratos comercialmente suficientes como direção, pendentes de formalização OpenAPI e prova da fixture antes de G0**.

## Interpretação de custo e proveniência

`lowest_unit_price` pertence à comparação do item; `line_eligibility` pertence a cada candidato item × fornecedor e considera somente condições locais. Mínimo e frete entram apenas em `supplier_destination_scenario` por fornecedor × destino × moeda. `scenario_feasibility` distingue `feasible`, `warning`, `requires_review` e `infeasible`; `suggested_award` é resultado da estratégia versionada. `minimum_order_mode` é `ignore|warning|hard_constraint`. Condição FOB sem frete conhecido, ou `unknown`, impede comparação de custo total. Não distribuir frete ou faturamento mínimo artificialmente por linha.

Revisão `authenticated_supplier` é enviada por usuário autenticado do fornecedor. `assisted_unconfirmed` preserva operador real, fornecedor representado, origem, arquivo/hash e `on_behalf_of`; confirmação individual gera `assisted_confirmed` para a mesma revisão. A política `assisted_response_mode=exclude|allow_with_warning|require_confirmation` controla participação e aprovação, sem alterar a autoria histórica.

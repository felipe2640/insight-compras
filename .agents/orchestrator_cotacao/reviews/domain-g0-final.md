# Revisão independente de domínio — G0 final

**Veredito reavaliado: APPROVE para o contrato de domínio pré-G0.** Revisão feita sem editar contratos. Fontes lidas: `docs/SOURCE_OF_TRUTH.md`, cinco documentos de `docs/domain/`, OpenAPI v1, fixture dourada/`verify.py` e ensaio stateful do cliente terceiro. A aprovação é documental, não atesta uma implementação do motor.

## Blockers anteriores e fechamento

1. **`price_basis`: fechado.** `commercial-conditions.md`, `award.md` e OpenAPI agora usam `priced_unit`, `tax_status`, `freight_status`, `discounts_applied`, `tax_amount?` e conversão com os mesmos enums. Descontos separados ficam em `adjustments`.

2. **Precedência de cenário: fechado.** `SupplierDestinationScenario.allOf` agora exige `comparison_status=requires_review` se o frete é desconhecido e `scenario_feasibility=infeasible` se há violação hard conhecida. Os estados coexistem conforme o domínio.

3. **Cardinalidade de elegibilidade: fechado.** `award.md` atribui elegibilidade a cada par `(quotation_item_id, supplier_id)` em `candidates[]`; `AwardItemComparison` mantém só resumo por item, sem campo singular ambíguo.

## Evidência favorável e limites

- `scenario.json`/`verify.py` usam `Decimal`, 2 tenants, 3 fornecedores, 12 itens, 2 destinos em T1, mínimo por cenário, frete único por pedido, parcial, marca e provenance; os totais publicados são B/F1 `631.50`, B/F2 `258.00`, Q1 `889.50`, com I06/I10/I11 pendentes.
- O ensaio `cliente-terceiro/stateful-result.json` registra 96 chamadas encadeadas/negativas e nenhuma resposta não declarada, incluindo criação, convite, OTP, oferta, corte, ajuste, pedido, emissão e confirmação. É mock de contrato; não demonstra motor de corte implementado nem corrige a impossibilidade de schema acima.
- A reabertura com drafts cancelados atomicamente e o bloqueio após emissão estão descritos e exercitados pelo ensaio.

`verify.py` foi executado nesta reavaliação: **PASS**. O ensaio stateful comprova contrato sobre mock, não comportamento de produto.

**Observação não bloqueante:** a fixture dourada ainda não reúne mínimo hard violado e frete desconhecido no mesmo cenário. Um probe combinado fortaleceria a regressão; a representação atual é coerente.

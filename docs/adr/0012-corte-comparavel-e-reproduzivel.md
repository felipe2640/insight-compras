# ADR 0012 — Corte comercial versionado

**Estado:** proposta pré-G0 v2.

## Decisão

Separar menor preço nominal, menor custo elegível e cenário comercial sugerido. `AwardStrategy` versionada recebe snapshot imutável de itens, ofertas, condições, política e conversões permitidas, e retorna alocações, custos, exclusões, alertas, pendências e razões. Preços com bases incomparáveis ficam `requires_review`; o motor não escolhe silenciosamente. Dinheiro e quantidade são decimais exatos. Ajuste manual cria revisão com ator e motivo. Pedido referencia execução aprovada.

## Consequências

O MVP usa estratégia determinística e regras tipadas para marca, prazo, disponibilidade, mínimo/múltiplo, frete informado e faturamento mínimo. Otimização global, motor tributário e frete por faixa podem vir depois sem trocar contrato de execução; novas estratégias recebem ID/versão distintos.

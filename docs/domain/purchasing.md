# Purchasing — contrato pré-G0 v2

O Cotação Hub possui `purchase_order` e `purchase_order_item` canônicos. Cada pedido nasce de uma execução de corte aprovada e ainda corrente, para uma organização fornecedora, um destino de entrega e uma moeda. A combinação `(tenant, award_run, supplier, destination, currency)` é única. Repetir o comando com a mesma chave idempotente retorna os mesmos IDs.

## Snapshot do pedido

Congelar número interno estável do Hub (`PO-AAAA-NNNNNNN`, sequência por tenant), identidade e endereço do comprador, destino/filial (ID externo opaco opcional), identidade do fornecedor, CNPJ se aplicável, linhas com referência/marca solicitadas e ofertadas, quantidade pedida e unidade, preço e base comercial, condição de pagamento, frete, impostos informados, moeda, subtotais e total decimal, observações, validade, política e execução do corte. O pedido não consulta cadastros atuais para renderizar PDF, XLSX ou histórico. O número ERP é `external_reference` e não chave primária.

## Estados

`draft → issued → acknowledged → confirmed | declined`; `confirmed → partially_received → received`. `draft → cancelled` não implica envio. `issued`, `acknowledged` ou `confirmed → cancelled` exige motivo e registra evento de cancelamento. Transições são append-only em `purchase_order_transition` com ator, versão anterior/nova, horário e razão. `purchase_order.created.v1` é distinto de `purchase_order.issued.v1`. Só a emissão torna o pedido visível ao fornecedor e dispara notificação. Revisão do buyer ocorre no estado `draft`; alterar linhas exige nova revisão auditada e recálculo dos totais, sem mudar silenciosamente a decisão aprovada. Divergência do corte exige novo corte ou ajuste aprovado.

`If-Match` é obrigatório para revisar, emitir, confirmar, recusar ou cancelar; versão divergente dá 412 e ausência 428. Emissão requer todos os campos obrigatórios de entrega e condição comercial resolvidos; duas emissões concorrentes geram uma transição. Confirmação/recusa exige sessão individual de supplier com permissão na participação e no pedido. Webhook de ERP pode registrar recebimento parcial/total por ID externo, com evento original deduplicado. Pedido emitido jamais é apagado para rollback.

## Documentos

PDF e XLSX são representações versionadas de um `purchase_order` emitido ou de uma prévia marcada como rascunho. Download requer autorização a cada acesso, URL temporária curta e log de acesso. Exportação escapa fórmulas XLSX e usa valores decimais congelados. Documentos gerados têm hash e versão de template; o fornecedor não recebe um documento de outro tenant.

## Relação com reabertura e concorrência

`draft` é preparação revisável, ainda sem comunicação ao fornecedor. Reabrir a cotação com apenas drafts cancela/supersede, na mesma transação, cada draft derivado e o award aprovado, preservando trilha; nenhum draft pode apontar para run invalidado. Qualquer pedido `issued` ou posterior torna reabertura proibida (`409 quotation_has_issued_orders`). Emissão e reabertura serializam sobre a cotação e seus pedidos; só uma pode vencer. `If-Match` e idempotência impedem emissão duplicada após timeout/retry. Uma revisão de oferta ou cotação posterior nunca altera snapshot de pedido emitido.

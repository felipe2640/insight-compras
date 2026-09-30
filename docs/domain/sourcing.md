# Sourcing — cotação, participação e proposta

**Estado:** contrato conceitual pré-G0 v2. Transferir para `cotacao-hub/docs/domain/sourcing.md`. Esquemas HTTP definitivos ficam em `openapi/cotacao-hub-v1.yaml`.

## Agregados e cardinalidade

`Quotation` pertence a um tenant buyer e contém `QuotationItem` como snapshot, destino(s), moeda, prazo de resposta e origem opaca. `QuotationSupplier` representa uma organização fornecedora participante: única por `(quotation_id, supplier_organization_id)`. Ela possui uma `Offer` corrente e revisões imutáveis. `Invitation` aponta à participação e a um destinatário, pode haver vários por participação, e não dá autoria nem propriedade da oferta ao destinatário. A mesma organização pode responder a muitos buyers sem compartilhar preço ou participação entre eles.

Cada item solicitado guarda `external_id` opaco opcional, descrição, referência/marca pedidas, quantidade e unidade decimais, destino e atributos de compra necessários. Nunca guarda FK obrigatória para produto do Insight, Diário ou ERP. Revisões após abertura são explícitas; ofertas e cortes indicam a revisão exata dos itens a que respondem. Oferta omitida significa **sem resposta**; `no_stock=true` significa declaração explícita de indisponibilidade.

## Estados e transições

| Agregado | Estados | Comandos e guardas |
|---|---|---|
| Quotation | `draft`, `open`, `closed_for_responses`, `awarded`, `ordered`, `cancelled` | abrir exige itens e prazo; fechar usa versão esperada; reabrir cria revisão, invalida corte corrente e só ocorre sem pedido emitido; cancelar registra motivo |
| QuotationSupplier | `invited`, `viewed`, `responding`, `submitted`, `declined` | visualização e rascunho não concluem resposta; nova submissão antes do prazo cria nova revisão |
| Invitation | `issued`, `redeemed`, `expired`, `revoked` | capability restrita à participação, destinatário, ações e prazo; resgate não cria membership global |
| Offer | `draft`, `submitted`, `superseded` | edição exige ator individual, ETag e cotação aberta; submit é atômico, grava revisão e origem |

O prazo da cotação é instante UTC do servidor para receber propostas. Prazo padrão comercial do fornecedor e prazo por linha são durações ou datas de entrega separadas. Fechar enquanto supplier salva segue serialização determinística: se o save entrou antes, integra a revisão; se o fechamento entrou antes, o save falha com estado/versão atual. O corte só considera revisões submetidas e ainda correntes no fechamento.

## Oferta

O cabeçalho comercial é tipado para tudo que uma estratégia pode avaliar: moeda; condição de pagamento; faturamento mínimo; modalidade/responsável pelo frete (`CIF`, `FOB`, incluído, valor separado ou desconhecido); valor fixo de frete quando declarado; validade; prazo padrão; descontos/acréscimos explícitos; observações; `price_basis` (impostos, frete, desconto, unidade e moeda que compõem o preço). Extensões futuras podem usar atributos versionados, mas um atributo não tipado não influencia decisão automaticamente.

Cada linha ofertada associa um `quotation_item_id` e contém referência/marca solicitadas no snapshot e referência/marca ofertadas, `substitution_type`/nota, quantidade disponível, preço unitário decimal, unidade de venda, quantidade mínima, múltiplo de venda, prazo por item, data estimada opcional, `out_of_stock` e observação. Uma linha pode responder parcialmente à quantidade solicitada. Se sem estoque, preço é nulo e disponibilidade zero. Uma referência/marca alternativa é sugestão do supplier; a política buyer (`exact_only`, `accepted_brands`, `allow_review`) determina elegibilidade ou revisão humana. Aceitar marca não prova equivalência técnica da referência.

O preço nominal, o custo elegível e a sugestão comercial são conceitos distintos. Se a `price_basis`, unidade, impostos ou frete não permitirem comparação confiável, a linha recebe `comparison_status=requires_review`; não se escolhe vencedor silenciosamente por preço unitário. Mínimo e múltiplo de venda são restrições da quantidade comprável, por exemplo necessidade 7 e caixa de 10: o custo comparado deve refletir 10 unidades ou exigir revisão da sobra. A regra concreta de corte pertence a Award, não a Sourcing.

## Proveniência e resposta assistida

Revisão de proposta grava `actor_id`, `actor_type`, canal de autenticação, `response_origin` (`authenticated_supplier`, `assisted_unconfirmed`, `assisted_confirmed`), `source_channel` (`portal`, `xlsx`, `api`, `manual`), fornecedor representado, timestamps e hashes de anexos. Buyer que importa em nome do supplier não se torna supplier nem recebe autoria do supplier. Essa resposta fica identificada e pode requerer confirmação posterior antes de receber confiança equivalente à submissão autenticada, segundo política explícita.

Importação XLSX segue `upload → staging → validation → preview → commit`; só commit autorizado altera rascunho/revisão. Mapeamento usa ID de item ou referência exata com ambiguidades apresentadas ao operador. Operações em lote suportam grade, colagem e resposta grande com uma versão esperada da oferta e erros por linha. Importação não escreve diretamente na proposta submetida.

## Invariantes

- Uma organização participa uma vez por cotação, independentemente do número de convites/usuários.
- Linha ofertada pertence à participação da organização e a um item da mesma cotação; nunca a convite.
- Nenhum convite isolado lista outras cotações ou pedidos do usuário.
- Uma oferta pode ser parcial, mas o submit evidencia linhas pendentes e congela as respondidas.
- Nova revisão de itens/proposta invalida o corte corrente; corte histórico continua reproduzível.
- Valores monetários/quantidades são strings decimais canônicas no contrato e decimal exato na persistência/motor.
- Entrega de notificações não determina se a cotação foi aberta; falha de e-mail é registrada e pode ser reenviada sem duplicar participação.

## Portas e eventos

Sourcing recebe identidade/autorização de Tenancy e Supplier Network. Emite `quotation.created/opened/closed`, `invitation.issued`, `offer.submitted` com versões de schema via outbox. Award consome snapshot da cotação fechada e revisões de oferta; não edita Sourcing. A porta `ProductMatchingPolicy` pode enriquecer importações no futuro; o MVP resolve por item/igualdade exata sem depender de catálogo externo.

## Fechamento, reabertura e versões

O servidor decide a ordem transacional de `submit` e `close`, sob trava da cotação e ETags. Revisão submetida e confirmada antes do close entra no corte; close anterior rejeita submit tardio. `If-Match` ausente retorna 428 e divergente 412; retry idempotente retorna resultado anterior somente para mesmo payload. Reabrir cotação fechada cria nova revisão e supersede run corrente. Se houver apenas pedidos draft, reabertura e cancelamento/supersessão de todos os drafts derivados ocorrem na mesma transação auditada. Qualquer pedido issued ou posterior bloqueia com 409 `quotation_has_issued_orders`. Reopen e issue serializam sobre a mesma cotação.

A origem de revisão submetida é `authenticated_supplier`, `assisted_unconfirmed` ou `assisted_confirmed`; o último exige ato explícito de um usuário individual do fornecedor sobre a revisão exata. Importação buyer jamais se torna retrospectivamente autoria supplier. `assisted_response_mode` na política controla uso no corte.

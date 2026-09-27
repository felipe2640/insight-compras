# Módulo de Cotação — Contexto de negócio

> Leitura obrigatória para qualquer agente que trabalhe no módulo de cotação.
> Fonte: áudios, vídeos e foto enviados pelo comprador da Rede Carreiro em
> 25/09/2026. Plano completo (visão de produto): documento "Plano — Integração
> Insight Compras + Diário e Sistema de Cotação".

## O processo de hoje (o que vamos substituir)

1. O comprador gera as **faltas** (Diário ou Insight), aprova e cadastra a
   cotação no ERP (tela "Cadastro de Cotação").
2. A cotação é publicada no **Cotaflash** (Connectsoft). O Cotaflash manda um
   e-mail ao **vendedor** — quase sempre o e-mail pessoal dele — de uma
   distribuidora ou de uma indústria.
3. O vendedor abre "Minhas Propostas em andamento". Cada cotação mostra a loja
   (ex.: Carreiro Piripiri nº 590, Carreiro Campo Maior nº 215), a validade e
   os itens: descrição, referência, marca, quantidade, unidade.
4. O vendedor consulta o sistema dele pela **referência** e digita o preço
   item a item. Não há integração com o sistema da distribuidora: o acordo é
   com o vendedor, não com a empresa.
5. O comprador pergunta no WhatsApp se o vendedor terminou e dá o **corte**:
   menor preço por item. O Cotaflash separa os ganhadores.
6. O ERP gera um **Pedido de Compra** por fornecedor (ex.: pedido 641, Campo
   Maior × Auto Peças Padre Cícero, 6 itens, R$ 595,42). O PDF vai para o
   vendedor, que redigita tudo no carrinho do sistema dele.

## Dores que o módulo precisa resolver

- Três digitações da mesma lista (comprador no ERP, vendedor no Cotaflash,
  vendedor no carrinho).
- Não existe o estado "terminei de responder".
- Não existe campo de observação por item: o vendedor não consegue oferecer
  outra marca. Foi um pedido explícito de um vendedor.
- Nada volta para o Insight/Diário: não dá para saber se o pedido chegou.

## Vocabulário (complementa `CONTEXT.md`)

| Termo | Sentido |
|---|---|
| Cotação | Pedido de preço de uma lista de itens, para uma filial, com prazo |
| Fornecedor | Distribuidora ou indústria; tem código no ERP e CNPJ |
| Vendedor | Pessoa que responde pelo fornecedor. Pode atender mais de um cliente (tenant) |
| Convite | O vínculo cotação × vendedor × fornecedor, com token de acesso |
| Proposta | O preço e as condições que o vendedor informou para um item |
| Corte | O cálculo que escolhe o ganhador de cada item |
| Pedido | Um `aprendizado_snapshot` com `origem = 'cotacao'` — por fornecedor e filial |

## Fora do escopo desta leva

- Gravar o pedido no ERP (fase 3; depende de resposta da Connectsoft).
- Conectar com o sistema da distribuidora (fase 4).
- API oficial do WhatsApp (começamos com link `wa.me`).

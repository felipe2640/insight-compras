# Supplier Network — identidade e relacionamento comercial

**Estado:** contrato conceitual pré-G0 v2. Transferir para `cotacao-hub/docs/domain/supplier-network.md`.

## Separação de entidades

| Entidade | Escopo e dados | Responsabilidade |
|---|---|---|
| `SupplierOrganization` | global; ID Hub, nome legal e identificadores corporativos verificados mínimos | identidade da empresa, sem preço/histórico de buyer |
| `SupplierUser` | global; ID Hub, e-mail normalizado, telefone E.164 quando disponível, métodos de autenticação individuais | pessoa/ator da alteração |
| `SupplierMembership` | organização × usuário; papel, status, prova/autoridade e vigência | representação persistente da organização |
| `BuyerSupplierRelationship` | tenant buyer × organização; status, códigos ERP, contatos, condições, notas e proveniência | vínculo comercial privado de um buyer |
| `InvitationRecipient` | cotação × participação × endereço/usuário destinatário | entrega e contexto inicial, sem transferir propriedade da proposta |

O mesmo CNPJ pode ser reconhecido como uma organização global e atender muitos buyers com códigos ERP, contatos e condições diferentes. CNPJ normalizado é indício para deduplicação, não autenticação, autorização ou chave universal; empresas sem CNPJ e estabelecimentos distintos exigem identificadores alternativos e revisão. Criação/lookup pela API retorna apenas a relação visível ao tenant. Não permite inferir se a identidade global já existia em outro buyer. Mescla/reivindicação de organização requer prova, controle de conflito, auditoria e proteção de memberships existentes; não ocorre por simples igualdade textual.

## Fronteira de dados e autorização

Identidade global mantém somente dados corporativos necessários e compartilháveis sob base legal. `BuyerSupplierRelationship` mantém código ERP, contatos preferidos, histórico, score, faturamento mínimo de cadastro, observações e parâmetros por tenant. Uma condição de cadastro pode preencher rascunho de proposta, mas o supplier confirma o cabeçalho da oferta; o corte usa snapshot da condição vigente naquela resposta/execução. Atualização posterior do relacionamento não altera corte ou pedido histórico.

O fornecedor não enxerga automaticamente todos os buyers da organização. Acesso a cotação exige organização participante e membership ativo com papel permitido ou concessão restrita à participação após verificação individual. Troca de organização exige reautorização. Uma sessão supplier persistente lista somente participações permitidas, aplicando tenant e recurso em cada linha. Pedido exige autorização própria vinculada ao fornecedor do pedido; token de convite não o concede. Papéis mínimos sugeridos: `supplier_admin` gerencia usuários da própria organização, `supplier_responder` edita/submete oferta autorizada, `supplier_viewer` só lê, `supplier_order_responder` confirma/recusa pedido autorizado. Escopos finais serão congelados na matriz de permissões e OpenAPI.

## Identidade individual e convite

Convite contém capability aleatória com hash armazenado, prazo, revogação, participação e ações limitadas. Resgate revela apenas contexto mínimo e inicia desafio de identidade individual. OTP por e-mail é o canal MVP; telefone normalizado prepara OTP telefônico quando houver provedor. PIN, se adotado, é individual, protegido por hash forte e controles de tentativa; PIN compartilhado de empresa não autentica alterações. Toda mutação registra usuário, mecanismo, papel/concessão, origem e correlação. Convite não cria membership permanente nem dá acesso às demais cotações da pessoa.

O primeiro usuário de uma organização passa por verificação de representação e aprovação operacional auditada, ou por concessão restrita à participação; não se assume que posse de caixa postal equivale a administração da empresa. Revogação de membership/concessão invalida acesso futuro e sessões conforme política; revisões históricas continuam atribuídas ao ator original.

## Importação de ERP e governança

Um ERP de buyer pode alimentar `BuyerSupplierRelationship` e referências externas por importação completa/incremental. Cada campo sincronizado guarda fonte, ID opaco, horário/versão da fonte e regra de precedência. O ERP buyer controla seus códigos, contatos e condições privadas, mas não substitui identidade global verificada ou memberships de outro buyer. Conflitos entram em staging/reconciliação, nunca em upsert silencioso por CNPJ. A projeção local mantém operação autônoma e reduz consultas externas; `source_system` é namespace autorizado pelo tenant. Sistemas de origem não acessam o banco do Hub.

## Eventos e invariantes

Eventos como `supplier.relationship.created.v1`, `supplier.membership.revoked.v1` e `supplier.identity.review_required.v1` têm payload mínimo e autorização tenant. Eventos globais de identidade não podem revelar compradores associados. Notificações usam porta de provedores; falha de envio não modifica propriedade da oferta nem status de autenticação.

- Um supplier global pode ter muitos relacionamentos privados; nenhum relacionamento concede visibilidade sobre outro.
- Um usuário pode pertencer a várias organizações, mas cada ação escolhe explicitamente uma organização autorizada.
- Convites podem ser múltiplos para a mesma participação; a proposta permanece única da organização.
- Código ERP é único apenas no namespace/tenant e pode mudar por reconciliação auditada; ID Hub é estável.
- Cadastro atual não é entrada implícita de replay de corte ou de pedido emitido.

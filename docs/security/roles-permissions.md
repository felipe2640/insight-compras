# Matriz de papéis — pré-G0 v2

O tenant é derivado de credencial verificada. Todas as ações também verificam recurso, estado e vínculo. `supplier_user` só age para organização e participação autorizadas; uma pessoa que atende dois buyers não herda acesso cruzado.

| Ação | Buyer viewer | Buyer operator | Buyer approver | App cliente | Supplier responder | Supplier gestor | Hub admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ler cotação do tenant | Sim | Sim | Sim | escopo | sua participação | sua participação | suporte auditado |
| Criar/editar rascunho | Não | Sim | Sim | `quotation:write` | Não | Não | Não |
| Publicar/convidar/fechar | Não | Sim | Sim | `quotation:manage` | Não | Não | Não |
| Responder/submeter oferta | Não | apenas assistido com autoria própria e status `assisted_unconfirmed` | Não | Não no MVP; supplier M2M é pós-MVP | Sim, com sessão individual e participação | Sim, com sessão individual e participação | Não |
| Executar corte | Não | Sim | Sim | `award:write` | Não | Não | Não |
| Ler resultado do corte | Sim | Sim | Sim | `award:read` | Não | Não | suporte auditado |
| Ajustar/aprovar corte | Não | ajuste com motivo | Sim | `award:approve` explícito | Não | Não | Não |
| Preparar/revisar pedido | Não | Sim | Sim | `order:write` | Não | Não | Não |
| Emitir pedido | Não | Não | Sim | `order:issue` explícito | Não | Não | Não |
| Confirmar/recusar pedido emitido | Não | Não | Não | Não | somente com `supplier_order_responder` explícito | com `supplier_order_responder` | Não |
| Gerir vínculo buyer × supplier e contatos do buyer | Não | Sim | Sim | `supplier:manage` | Não | Não | suporte auditado |
| Gerir membership da organização supplier | Não | Não | Não | Não | Não | com verificação de representação | suporte auditado |
| Gerir webhook/credencial do tenant | Não | Não | não por padrão | `integration:manage` se concedido | Não | Não | operador tenant autorizado |
| Ler documento | próprio tenant e recurso pai, com `document:read`/`order:read` | idem | idem | scope explícito e recurso pai | somente participação ou pedido emitido da organização | idem | suporte auditado |
| Consultar eventos públicos | Não por padrão | scope `event:read` se concedido | idem | `event:read` e tenant da credencial | Não | Não | suporte auditado |
| Consultar auditoria | Não | `audit:read` se concedido | `audit:read` se concedido | `audit:read` explícito | Não | Não | suporte excepcional auditado |
| Alterar entitlement | Não | Não | Não | Não | Não | Não | função comercial segregada e auditada |

`Hub admin` não recebe leitura comercial ampla por padrão: acesso de suporte exige motivo, janela curta e trilha. O convite não aparece como papel; só inicia autenticação e dá leitura mínima da cotação específica. Alteração requer identidade individual, concessão da organização e autorização na participação. Membership global exige verificação/convite administrativo, nunca apenas e-mail ou CNPJ informado por buyer.

Todas as leituras verificam tenant e recurso pai. Um supplier que atende dois buyers precisa de concessão específica para cada participação/pedido; membership global não é autorização de cotação. IDs, filtros, cursores e `supplier_id` enviados pelo cliente não ampliam a credencial. Detalhes de TTL, sessões, rate limit, documentos e eventos estão em `security-contracts.md`.

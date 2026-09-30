# Escopo comercial — pré-G0 v2

| Capacidade | MVP | Pós-MVP | Contrato preparado agora |
|---|---|---|---|
| Tenant, entitlement, métricas e API versionada | Sim | Billing | Ledger de uso idempotente, plano/limites sem cobrança |
| Cadastro supplier global e relação por buyer | Sim | Marketplace e self-service avançado | Identidade global separada de dados privados por tenant |
| Identidade supplier, OTP, convite restrito | Sim | PIN individual e outros fatores | Porta de autenticação individual |
| Cotação, snapshots, importação de cadastro ERP | Sim, importação opcional | Sincronização avançada bidirecional | Namespace de IDs externos e proveniência por campo |
| Resposta em grade, bulk, Excel, alternativas | Sim | Integração direta ao sistema supplier | `offer` versionada e API bulk |
| Condições comerciais, mínimo/múltiplo, frete informado | Sim | Frete por faixa e motor tributário | Campos tipados de `price_basis` e política extensível |
| Corte explicável, ajuste manual e replay | Sim | Otimização matemática global e ranking inteligente | `AwardStrategy` versionada com snapshot integral |
| Pedido próprio, revisão, emissão, confirmação/recusa | Sim | Writeback para ERPs específicos | Eventos e IDs externos |
| PDF/XLSX, e-mail, outbox/webhooks | Sim | WhatsApp oficial | Portas de provedores e schemas de evento |
| Adapters Insight e Diário | Após Hub isolado, no escopo do MVP integrado | Outros adapters | Só API/SSO/eventos públicos |
| Catálogo universal de equivalência | Não | Sim | `ProductMatchingPolicy` como porta; MVP usa item ID/exato |
| Negociação dinâmica | Não | Sim | Não criar componentes especulativos |

Critério de inclusão no MVP: necessário para ciclo útil ou para evitar quebra próxima de contrato. Interfaces para possibilidades futuras só entram quando sua fronteira já é exigida pela integração ou pelo motor. Nenhum conector particular bloqueia o piloto.

> **SUPERSEDED — NÃO UTILIZAR PARA IMPLEMENTAÇÃO.** Fonte vigente: `docs/SOURCE_OF_TRUTH.md`.

# SUPERSEDED — Cotação Hub — especificação arquitetural v1

> Rascunho histórico. Fonte canônica: `docs/SOURCE_OF_TRUTH.md` no branch de planejamento `codex/cotacao-pre-g0-v2` de `insight-compras`. Não usar este arquivo para implementar H0–H7.

**Estado:** revisão pré-G0; nenhum contrato congelado, nenhuma unidade C0–C9 autorizada. **Data:** 29/09/2026. **Base examinada:** `docs/cotacao/{00-contexto,01-contratos,02-producao}.md` e `.agents/orchestrator_cotacao/{DISPATCH,plan,progress,pedidos-de-contrato}.md` na branch `claude/plano-cotacao-multiagente` de `insight-compras`; anexo `2026-09-27-enviar-para-cotacao.md` do Diário. O anexo e esses documentos são evidência do plano anterior, não instruções vigentes.

## 1. Decisão e fronteira

Criar repositório independente `cotacao-hub`, com API, portal buyer, portal supplier, jobs e persistência próprios, inicialmente como **monólito modular**. Seu banco, migrações, armazenamento de documentos e chaves pertencem ao Hub. Insight Compras, Diário e qualquer terceiro são clientes da API pública; nenhum consulta tabelas do Hub nem recebe credenciais de seu banco. O Hub deve iniciar e completar o fluxo com um tenant fictício e sem Insight, Diário, Supabase compartilhado, Connectsoft ou código da Rede Carreiro. Supabase poderá ser uma tecnologia de infraestrutura em uma instalação isolada, sem se tornar contrato de integração.

O Hub é dono de cotações, organizações fornecedoras, usuários de fornecedores, relacionamentos comerciais, convites, propostas, cortes, pedidos, documentos, notificações, auditoria, integrações e entitlement. Sistemas externos são donos de suas próprias análises e cadastros de origem. O Hub guarda os snapshots necessários à execução e referências externas opacas; sincronização de cadastro com ERP é uma integração optativa, não consulta síncrona obrigatória para completar o fluxo.

### Bounded contexts e dependências internas

| Contexto | Agregados / responsabilidade | Publica para outros módulos |
|---|---|---|
| Tenancy & Entitlement | tenant buyer, usuários buyer, aplicações clientes, plano e limites | autorização e medição |
| Supplier Network | organização fornecedora global, usuário, vínculo buyer × fornecedor, contatos e códigos externos | fornecedor elegível e identidade |
| Sourcing | cotação, snapshot de item, convite, participação da organização, proposta e revisões | proposta concluída |
| Award | política versionada, execução de corte, decisão, ajuste e alertas | corte aprovado |
| Purchasing | pedido e item, confirmação/recusa, documentos | eventos de pedido |
| Communications | templates, entregas e provedores de canal | resultado de envio |
| Integration | credenciais de cliente, IDs externos, importações, outbox, assinaturas webhook e entregas | eventos versionados |
| Audit | trilha imutável de ator, comando, antes/depois ou hashes, correlação | consulta auditável |

Dependência entre contextos ocorre por portas de aplicação e eventos internos no mesmo processo, com transação local onde necessário. Não há chamadas de rede entre módulos. Política de corte não acessa banco e recebe snapshot completo. Banco relacional com `tenant_id` em toda entidade de negócio tenant-scoped, índices compostos e checagem de escopo na aplicação; testes de isolamento em todas as consultas. Organização fornecedora global não revela relacionamento ou dados comerciais entre tenants.

## 2. Modelo de dados e invariantes

IDs internos são UUID/ULID gerados pelo Hub. `external_id` é string opaca, nunca interpretada como ID de sistema específico. `source_system` é namespace registrado e autorizado por tenant, não texto livre escolhido a cada chamada. `external_reference` tem unicidade em `(tenant_id, source_system, entity_type, external_id)` e vínculo imutável ao ID interno; colisão ou reatribuição exige procedimento auditado de reconciliação, jamais upsert silencioso. Códigos ERP distintos podem apontar ao mesmo fornecedor em tenants distintos.

| Entidade | Campos principais e regras |
|---|---|
| `buyer_tenant`, `buyer_user`, `client_application` | identidade, status, papéis; credencial de aplicação com escopos e rotação; tenant derivado da credencial, nunca de cabeçalho livre |
| `entitlement`, `usage_ledger` | módulo habilitado, limites por período, cotas consumidas; evento de uso idempotente e rastreável; sem cobrança financeira |
| `supplier_organization` | identidade global, CNPJ normalizado quando aplicável, nome legal, status; CNPJ não prova representação nem é chave universal. Reivindicação exige verificação da organização e aprovação; mescla fica em quarentena, com consentimento/ownership e auditoria. Busca e criação não revelam dados de outro tenant |
| `supplier_user` | identidade individual, e-mail normalizado e telefone E.164 quando disponível, métodos OTP/PIN pessoal com hash forte, status; vínculo muitos-para-muitos com organização por `supplier_membership` e papel |
| `buyer_supplier_relationship` | `(tenant_id, supplier_organization_id)`, status, condições e contatos buyer-específicos; códigos ERP em `external_reference`; não expõe outro buyer |
| `quotation`, `quotation_item` | tenant, estado, origem/filial como snapshots e IDs externos opacos, moeda, prazo; cada item guarda descrição, referência, SKU, marca solicitada/aceita, quantidade decimal, unidade, custo de referência opcional e payload de origem sanitizado/versionado. Nenhuma FK para produto externo |
| `quotation_supplier`, `offer`, `offer_item` | participação única da organização fornecedora na cotação; `offer` é agregado dessa participação, com revisão imutável e uma linha corrente por item solicitado. Resposta parcial aceita; linha omitida fica sem resposta, `sem_estoque` é declaração explícita. MVP aceita uma referência ofertada por item; variantes múltiplas exigirão revisão de contrato/estratégia |
| `invitation` | destinatário individual (e-mail/telefone e `supplier_user_id` opcional), participação autorizada, token aleatório com hash, expiração, revogação e escopo exato; vários convites podem servir a mesma participação sem duplicar proposta |
| `offer_revision` | congela linhas e status de submissão; `referencia_ofertada`, `marca_ofertada`, `quantidade_disponivel`, `preco_unitario`, `prazo`, `sem_estoque`, `observacao`; ator individual, origem portal/importação/API, instante e revisão otimista. `sem_estoque=true` exige quantidade zero e preço nulo; linha com estoque exige quantidade positiva e preço positivo. Submissão é atômica sobre a revisão e exige ao menos uma linha respondida; itens omitidos são mostrados como pendentes |
| `award_policy`, `award_run`, `award_decision` | versão imutável, parâmetros e digest; snapshot/hash de entradas, versão do motor, resultado, alertas, ajustes, ator e horário; execução anterior nunca sobrescrita |
| `purchase_order`, `purchase_order_item` | pedido próprio por fornecedor/destino/moeda, linhas e totais congelados, estado e histórico; número do Hub por tenant, comprador/destino/endereço/condições/validade em snapshot, com filial externa opcional. IDs ERP em `external_reference`; referências ao corte e à cotação; unicidade por execução aprovada e grupo de emissão impede duplicatas; sem dependência de `aprendizado_snapshot` |
| `document`, `notification_delivery`, `audit_event`, `outbox_event`, `webhook_subscription`, `webhook_delivery`, `import_job` | metadados, estados, hashes, tentativas e correlação; documentos em armazenamento privado com acesso temporário |

**Números:** dinheiro em `DECIMAL(20,6)` no banco e string decimal canônica no JSON (`"12.340000"`), com moeda ISO 4217; quantidade em `DECIMAL(20,6)` e string. Cálculo usa decimal exato, não `number`/float binário. Totais de linha arredondados na escala da moeda por regra explícita da política (padrão half-up), após multiplicar quantidade × preço; total do pedido soma totais de linha já arredondados. Validação rejeita expoente, NaN, separador local, escala excessiva e overflow. Comparação de preços ocorre antes do arredondamento de exibição. Prazo é instante ISO 8601 UTC ou quantidade inteira de dias conforme campo distinto.

## 3. Estados e comandos

`quotation`: `draft → open → closed_for_responses → awarded → ordered`; `draft/open/closed_for_responses → cancelled`. Reabrir de `closed_for_responses` cria revisão explícita, invalida o corte corrente e retorna a `open`; cotação com pedido emitido não reabre. Convites só em `open`; resposta só antes do fechamento/prazo, salvo extensão auditada. `quotation_supplier`: `invited → viewed → responding → submitted`; pode terminar `declined`; submissão posterior cria nova revisão antes do prazo. Convite: `issued → redeemed/expired/revoked`, sem alterar estado da participação por si só. `award_run`: `computed → approved/rejected/superseded`; ajuste manual cria nova execução derivada com motivo e aprovação própria. Pedidos apenas de execução aprovada e ainda corrente. `purchase_order`: `draft → issued → acknowledged → confirmed/declined`; `issued/acknowledged/confirmed → cancelled` por comando autorizado com motivo; `confirmed → partially_received → received` via integração buyer/ERP. Recusa e cancelamento geram evento e não apagam histórico. Comandos sobre recurso existente exigem `If-Match`/ETag; ausência retorna 428, versão divergente 412. `POST` de criação não exige ETag.

## 4. API pública `/api/v1`

Contrato OpenAPI 3.1 será artefato fonte no repositório novo, com exemplos independentes de clientes reais. JSON UTF-8, UTC, paginação cursor e erros `application/problem+json` com código estável, `request_id`, `resource_version`. Toda mutação aceita `Idempotency-Key` (UUID/string aleatória, até 128 chars) e grava `(tenant, application/actor, method, path, key, request_hash, status, response)` por prazo publicado mínimo de 72 h; mesmo hash devolve mesmo resultado, hash diferente retorna 409. Recursos têm ID do Hub e `external_refs[]` opcionais. Criação aceita `source_system` e `external_id` opaco com unicidade por namespace, para deduplicar mesmo após expirar a chave. Mutação pode devolver 202 + operação rastreável quando assíncrona.

| Operação | Método e rota | Escopo / resultado essencial |
|---|---|---|
| Criar e consultar cotação | `POST /quotations`, `GET /quotations/{id}`, `GET /quotations` | `quotation:write/read`; snapshot de itens e IDs externos; 201 com ID/versão |
| Publicar/fechar/cancelar | `POST /quotations/{id}:open`, `:close`, `:cancel` | `quotation:manage`; transição validada |
| Cadastro fornecedor | `POST /suppliers`, `GET /suppliers`, `PUT /suppliers/{id}/relationship` | `supplier:manage`; organização global deduplicada sem vazar dados de outros tenants |
| Convidar | `POST /quotations/{id}/invitations` | `invitation:write`; `supplier_id`, destinatários, canais e expiração; link secreto mostrado uma vez ao criador autorizado |
| Resgatar convite | `POST /supplier/invitations:redeem` | token no corpo; retorna apenas ID da cotação/organização e desafio de identidade, sem sessão geral |
| Autenticar fornecedor | `POST /supplier/auth/challenges`, `POST /supplier/auth/challenges/{id}:verify` | canal individual verificado; OTP de uso único; sessão restrita à participação até membership aprovado |
| Responder | `GET /supplier/quotations/{id}`, `PUT /supplier/quotations/{id}/offer-items/{itemId}`, `POST /supplier/quotations/{id}:submit` | sessão supplier com membership na organização participante ou capability restrita à cotação e ação; revisão e ator |
| Importar resposta | `POST /quotations/{id}/supplier-responses/imports`, `GET /imports/{jobId}`, `POST /imports/{jobId}:commit` | buyer autorizado ou supplier; XLSX validado em staging; prévia, conflitos e ator humano/assistido antes de commit |
| Calcular e aprovar corte | `POST /quotations/{id}/award-runs`, `GET /quotations/{id}/award-runs/{runId}`, `POST /award-runs/{runId}:approve` | `award:write/approve`; política, entradas, resultado, ajustes com motivo |
| Políticas de corte | `GET /award-policies`, `GET /award-policies/{id}/versions/{version}` | `award:read`; política default do tenant, versão e parâmetros publicados |
| Criar e consultar pedidos | `POST /award-runs/{runId}/purchase-orders`, `GET /purchase-orders/{id}` | `order:write/read`; um pedido por fornecedor/filial/moeda; retorno com IDs Hub |
| Emitir pedido | `POST /purchase-orders/{id}:issue` | `order:issue`; `If-Match`, número e snapshots obrigatórios; evento `purchase_order.issued.v1` |
| Responder pedido | `POST /supplier/purchase-orders/{id}:confirm`, `:decline` | supplier da organização do pedido; motivo na recusa |
| Documentos | `POST /purchase-orders/{id}/documents`, `GET /documents/{id}` | autorização tenant ou supplier do pedido; URL curta ou stream; PDF/XLSX |
| Webhooks e uso | `POST/GET /webhook-subscriptions`, `GET /usage` | `integration:manage`, `usage:read` |

Prefixo completo de cada rota é `/api/v1`. Bootstrap de tenant, credencial de aplicação, namespace de origem e política default é procedimento administrativo público e documentado, disponível a qualquer cliente contratado; não exige código ou banco de hospedeiro. `POST /suppliers` cria ou associa organização por resolução protegida e cria `buyer_supplier_relationship` para o tenant chamador, sem revelar se já existia globalmente. Convite referencia essa relação. Segredos de convite são entregues pelo provedor ao destinatário; se `delivery_mode=manual`, a resposta retorna link uma vez a buyer autorizado para entrega manual. Segredos nunca entram em `GET /quotations`. Listagem supplier exige sessão individual e papel/concessão explícita na participação. Token de convite só inicia resgate e leitura mínima da cotação; não alcança pedido automaticamente, não cria sessão geral e não lista outras cotações. Acesso a pedido requer sessão individual, membership ativo e participação no pedido.

**Schemas mínimos para a jornada:** criação de cotação recebe `{source_system,external_id,currency,delivery_snapshot,items:[{external_id,description,reference,requested_brand,quantity,unit}]}` e retorna `{id,status,version,items:[{id,external_id}]}`; convite recebe `{supplier_id,recipients:[{email,phone?,supplier_user_id?}],delivery_mode,expires_at}` e retorna `{invitation_ids,delivery_status,manual_links?}`; resgate recebe `{token}` e retorna `{challenge_context_id,quotation_id,supplier_id}`; verificação OTP recebe `{code,challenge_context_id}` e retorna sessão curta vinculada a `actor_id`, participação e ações. `PUT offer-items` recebe campos do item ofertado e `If-Match`, retorna `offer_version`; `:submit` retorna `submitted_revision_id` e itens pendentes. `POST award-runs` recebe `{policy_id,policy_version}`, retorna `{run_id,input_hash,strategy_id,strategy_version,decisions,pending,alerts,version}`. `:approve` recebe `{adjustments:[{item_id,supplier_id,quantity,reason}]}` e `If-Match`, retorna execução aprovada/derivada. Criação de pedidos retorna `{orders:[{id,status,version,total}]}`; `:issue` retorna `{id,status,number,version}`. Erros da jornada: 400 validação, 401 autenticação, 403 escopo, 404 recurso indisponível no escopo, 409 idempotência/estado, 412 versão divergente, 422 regra de domínio, 428 ETag ausente, 429 limite. OpenAPI final deve formalizar todos os campos e exemplos antes do G0.

## 5. Identidade, SSO e autorização

**Buyer:** usuário humano com sessão do Hub ou SSO OIDC de hospedeiro registrado, `iss/aud/nonce/state` validados e mapeamento explícito `(issuer, subject, tenant, roles)`; privilégios do hospedeiro não são aceitos sem política do Hub. Aplicações servidor-servidor usam OAuth2 client credentials/JWT assinado de curta duração, audiência Hub, escopos e tenant fixados na credencial, rotação e revogação. Diário e Insight usam clientes separados; chave pública de navegador nunca chama escrita de integração. A UI pode abrir deep link com sessão OIDC, sem passar token da aplicação na URL.

**Supplier:** usuário global próprio com e-mail e telefone normalizados, desafio OTP por canal verificado e PIN individual opcional como segundo fator ou acesso recorrente sujeito a rate limit; PIN compartilhado da empresa é proibido. Escrita exige simultaneamente identidade individual autenticada, membership ativo ou concessão restrita aprovada para a participação, organização participante e permissão da ação. Convite prova posse do canal e inicia vinculação; não concede membership global automaticamente. Organização sem administrador usa verificação de representação e aprovação operacional auditada. Capability aleatória de alta entropia, armazenada por hash, curta e de uso único, é trocada por contexto restrito via POST; evitar token persistente em URL/referrer/log com `Referrer-Policy: no-referrer`, CSP e redaction. Leitura pré-OTP revela só mínimo necessário; pedido exige nova autorização explícita. Troca de organização exige autorização separada. Cada alteração audita `actor_type`, `actor_id`, método de autenticação e origem da alteração.

**Autorização:** checar tenant, papel, vínculo comercial, organização participante, recurso e ação em cada operação, inclusive downloads, jobs e webhooks. Nunca confiar em `tenant_id`, `supplier_id` ou `actor_id` do corpo para definir contexto. Segredos só em cofre/configuração do Hub; logs redigem token, OTP, preço sensível e PII quando desnecessários. Documentos e eventos preservam fronteiras do tenant.

## 6. Corte substituível e reproduzível

Interface interna `AwardStrategy.evaluate(AwardInput, PolicySnapshot) → AwardResult` recebe itens, propostas elegíveis, snapshots das relações comerciais e restrições; resultado contém alocações por item/fornecedor, saldos, exclusões com razão, alertas, totais e trilha de desempate. Registro de estratégias por `strategy_id` e `strategy_version`; política tenant tem versão, moeda, regras e parâmetros. MVP: menor preço elegível, disponibilidade, marca aceita, prazo máximo e alertas de faturamento mínimo; permite dividir quantidade entre fornecedores, limitado à quantidade ofertada e pedida, com saldo pendente. Unidades precisam coincidir no MVP; conversão exige tabela versionada em política futura. Cotação e propostas usam a mesma moeda no MVP, sem câmbio. Empate determinístico por prazo, depois ID estável. Não promete solução ótima global. Contrato já representa faturamento mínimo como restrição ou alerta parametrizado, concentração por fornecedor e componentes de custo total para estratégias futuras.

`award_run` congela bytes canônicos versionados de todas as entradas, incluindo relações comerciais, condições, ajustes humanos e eventuais taxas de conversão, hash SHA-256, política, versão do motor/artefato, timestamp, saída e razões; execução manual gera nova revisão com ator e motivo por alocação. Snapshots e artefato do motor ficam retidos ao menos enquanto houver pedido/auditoria associada, em armazenamento imutável ou com cadeia de hashes ancorada. Reexecutar a mesma versão sobre os mesmos dados deve gerar saída idêntica. Pedidos referenciam exatamente a execução aprovada; mudança de proposta exige novo corte.

## 7. Eventos, integrações e fonte ERP

Gravar evento de domínio e `outbox_event` na mesma transação da mudança. Publicador entrega ao menos uma vez, com ID global, tenant, tipo, versão de schema, `occurred_at`, `correlation_id`, ID do agregado e payload mínimo; consumidores deduplicam pelo ID. Exemplos: `quotation.created.v1`, `invitation.issued.v1`, `offer.submitted.v1`, `award.approved.v1`, `purchase_order.issued.v1`, `purchase_order.confirmed.v1`, `purchase_order.declined.v1`. Webhook HTTPS assinado HMAC SHA-256 sobre envelope inequívoco `timestamp + "." + event_id + "." + corpo_bruto`, com headers de ID, timestamp e key ID; janela de replay, segredo por assinatura rotacionável, tentativas exponenciais, DLQ e redelivery manual. Endpoint deve ser HTTPS público, com bloqueio de IP privado/link-local/metadata, DNS revalidado a cada entrega, sem redirect, TLS validado e limites de tamanho/taxa. Assinaturas pertencem a tenant/aplicação e filtram tipos; payload não contém token de convite ou PII desnecessária.

Portas de `CatalogImport`, `SupplierImport`, `OrderExport`, `NotificationProvider` (e-mail inicial, WhatsApp/API futuros) e `EventPublisher`. ERP pode ser fonte primária de cadastro por importação completa/incremental com cursor, `source_system`, IDs opacos, `source_updated_at`, provenance, mapeamento e resolução de conflito por campo: ERP buyer controla código, contato e condições desse relacionamento, mas não identidade global verificada nem dados de outro tenant. Hub mantém projeção local mínima para autonomia, desempenho e histórico. Fonte única significa governança de origem e sincronização, não banco compartilhado nem dependência síncrona. Falha do ERP não bloqueia resposta, corte ou pedido já baseado em snapshots. Nunca sobrescrever resposta/corte por atualização de catálogo; novas cotações usam cadastro atualizado. Conectores Connectsoft são opcionais e posteriores, sem ramificações no domínio.

Insight pode espelhar `purchase_order.issued.v1` em `aprendizado_snapshot` por adapter seu, com ID externo do Hub e deduplicação; esse espelho não é pedido canônico. Diário cria pelo `POST /api/v1/quotations` com credencial própria, `Idempotency-Key`, `source_system=diario` e IDs externos, e abre URL do Hub/SSO recebida por contrato. Terceiros usam o mesmo fluxo.

## 8. Segurança e abuso a testar

| Ameaça | Controle e prova requerida |
|---|---|
| Token de convite usado para enumerar outras cotações ou pedidos | capability vinculada a cotação/participação/ações; testes cruzados com mesmo supplier em dois tenants e dois convites |
| Troca de tenant, fornecedor ou ID na URL/corpo | contexto derivado da credencial; autorização por recurso; testes IDOR horizontais/verticais |
| PIN de empresa compartilhado e alteração sem autoria | OTP/sessão individual para escrita; trilha por pessoa; rejeitar PIN coletivo |
| Reenvio de criação, webhook ou confirmação | idempotência, versão esperada e deduplicação; teste de corrida |
| XLSX malicioso, fórmula, macros, ZIP bomb ou linhas fora da cotação | tamanho/linhas limitados, parser isolado, valores como dados, referência resolvida em staging, prévia e aprovação; exportar células textuais escapadas |
| Buyer importa proposta fingindo ser fornecedor | registrar operador e `on_behalf_of` separados; status `assisted_unconfirmed`, atestado/consentimento e confirmação individual antes de tratar como submissão autenticada; staging fixa tenant, cotação, fornecedor e hash do arquivo |
| Replay/falsificação de webhook e vazamento de segredo | HMAC com timestamp/janela, rotação, TLS, redaction, teste de replay |
| Motor alterado e corte não reproduzível | snapshot/hash/versão imutáveis, testes determinísticos e replay |
| Exfiltração via documentos, notificações ou logs | URL curta com escopo, verificação em download, destinatário validado, PII mínima e auditoria |
| Abuso de OTP, convites e portal | limites por IP/identidade/tenant, cooldown, expiração/revogação, resposta uniforme para contas inexistentes |

## 9. Rollout e plano multiagente revisado

**Antes de G0:** (a) esta especificação e contratos OpenAPI/esquemas conceituais revisados; (b) revisão independente por agente de arquitetura, segurança e domínio; (c) challenger busca acoplamentos a Insight, Diário, Supabase compartilhado e Connectsoft; (d) orquestrador resolve cada achado e auditor confere rastreabilidade e independência. Nenhuma decisão antiga é preservada por compatibilidade documental. Atualizar `docs/cotacao/**` e `.agents/orchestrator_cotacao/**` na branch de documentação com aviso explícito de substituição; anexo C7 fica obsoleto e deverá ser reescrito antes de trabalho no Diário. Nenhuma migração no Supabase compartilhado.

**Novo G0, critério obrigatório:** aplicação fictícia `Cliente Terceiro`, com tenant/credencial própria e sem acesso a banco ou código de Insight/Diário/Carreiro, deve conseguir, por OpenAPI e fluxos públicos, criar cotação com snapshots, convidar fornecedor, autenticar ator fornecedor, receber respostas, executar/aprovar corte e criar/emitir pedido. Antes de haver código do Hub, a evidência é OpenAPI 3.1 completo e validado, sequência de requests/responses sintéticas e teste de contrato executável contra mock derivado do OpenAPI, mais análise de isolamento entre dois tenants e plano de replay do corte. O teste contra Hub real passa a ser critério G1. G0 só passa com vereditos arquitetura, segurança, domínio e challenger resolvidos, auditor `CLEAN` e aprovação registrada pelo orquestrador. Este documento ainda não contém OpenAPI nem teste executável e **não declara G0 aprovado**.

**Sequência obrigatória da fixture `cliente-terceiro`:** bootstrap documentado emite tenant T1, aplicação A1, namespace `cliente-terceiro`, escopos e política P1; repetir para T2. A1 autentica e faz `POST /api/v1/suppliers` para relação S1; `POST /api/v1/quotations` com `external_id=Q-opaque-1`, dois itens e destino snapshot, recebendo Q1 e ETag; `POST /quotations/Q1:open` com ETag; `POST /quotations/Q1/invitations` para S1 e entrega por e-mail; destinatário faz `POST /supplier/invitations:redeem`, desafio OTP e verificação, recebendo sessão individual restrita a Q1/S1; faz `PUT /supplier/quotations/Q1/offer-items/I1` com preço decimal e quantidade, depois `:submit`; A1 faz `:close`, consulta P1, cria `award-run`, inspeciona hash/decisões, aprova com ETag, cria `purchase-orders` e emite cada pedido com ETag; consulta pedido e evento `purchase_order.issued.v1`. Repetir com chave de idempotência demonstra resposta idêntica; trocar corpo com mesma chave dá 409; sessão de Q1 não lê Q2/T2; A1 não lê T2; supplier sem concessão não altera oferta; replay do corte usa snapshot e versão. A fixture e seus exemplos exatos serão materializados no OpenAPI e no mock antes de G0.

**Após G0:** renumerar unidades no repositório novo: H0 fundação/identidade/tenancy; H1 domínio e persistência; H2 API e idempotência; H3 portal supplier/OTP e importação XLSX; H4 motor/corte; H5 pedidos/documentos; H6 notificações/outbox/webhooks; H7 portal buyer e observabilidade. Cada worker tem ownership isolado de arquivos e handoff; reviewer e challenger independentes por unidade; auditor em cada portão. Contratos alterados após G0 exigem pedido de mudança e nova revisão das partes afetadas. Portão G1: fluxo Hub isolado em teste, incluindo segurança adversarial e replay; G2: preview com tenant sintético e provedores reais isolados; G3: piloto consentido com rollback por flags/entitlement. Só depois do Hub funcionar isoladamente criar adapters separados I1 (Insight) e D1 (Diário), cada um com suas próprias flags e testes de regressão; E1 ERP é optativo e independente. C0–C9 anteriores ficam **canceladas como unidades executáveis** e serão substituídas por este plano após G0.

**Rollout operacional:** provisionar banco/armazenamento e domínio próprios, tenant sintético e dados fictícios; migrar dados apenas via importador versionado com consentimento e reconciliação; ativar entitlement por tenant; comparar corte e pedido com processo atual em paralelo; medir convites, taxa de resposta, tempo de corte, pedidos confirmados, importações e falhas de webhook. Reverter tráfego/flags sem apagar auditoria ou pedidos emitidos; cancelar pedidos por comando próprio. Nenhuma dependência de disponibilidade do Insight, Diário ou ERP para operação do Hub.

## 10. Substituições contratuais expressas

| Plano anterior | Contrato novo |
|---|---|
| `Pedido = aprendizado_snapshot` | `purchase_order` e `purchase_order_item` canônicos; snapshot do Insight é espelho opcional |
| RPC `cotacao_criar_rascunho` no Supabase compartilhado | `POST /api/v1/quotations` com autenticação de aplicação, idempotência e IDs externos |
| `portal_listar_cotacoes(p_token)` em todos os tenants | token de convite limitado a uma participação; listagem só com identidade supplier persistente |
| `proposta_item` pertence a `convite_id` | proposta da organização fornecedora na cotação; convite identifica destinatário |
| `vendedor` por e-mail e PIN da empresa | `supplier_user` individual, OTP/PIN pessoal e memberships |
| `produto_id bigint` obrigatório | snapshot de item e referência externa opaca opcional |
| `number` para preço/quantidade | decimal exato no banco, string canônica no JSON e biblioteca decimal no motor |
| rotas `/api/cotacoes` no Insight e portal por RPC | API pública `/api/v1` do Hub e portais clientes dessa API |
| C0 migra Supabase de produção antes do fluxo | G0 prova independência por contratos; implementação do Hub em infraestrutura própria depois |

## 11. Registro de revisão independente

| Papel | Achado principal | Tratamento nesta revisão | Veredito G0 |
|---|---|---|---|
| Arquitetura | G0 exigia Hub implementado e faltavam rotas de ponta a ponta | G0 usa mock OpenAPI; adicionados bootstrap, resgate, OTP, política e emissão | Pendente até OpenAPI e fixture executável |
| Segurança | convite/OTP podia virar escrita sem membership; reivindicação global e importação assistida frágeis | escrita exige ator e concessão; verificação de organização, importação assistida identificada, controles de webhook | Pendente de testes adversariais e esquemas formais |
| Domínio | proposta parcial, split, emissão e snapshots de corte ambíguos | agregado `offer`, regras de parcial/sem estoque, split e emissão, snapshots completos | Pendente de exemplos e contrato formal |
| Challenger | fluxo de terceiro parava no convite e não emitia pedido; dependência oculta possível | sequência HTTP obrigatória definida; nenhuma dependência obrigatória de hosts anteriores identificada | Pendente de prova executável |

O orquestrador deve revisar novamente o OpenAPI, a fixture e os achados antes de registrar qualquer `CLEAN`. Este registro documenta a revisão da proposta; não substitui execução do portão.

## 12. Pendências para congelamento

Definir por contrato final: moeda inicial e política de arredondamento por jurisdição; retenção de idempotência, auditoria e documentos; política LGPD para identidade global e mescla de fornecedores; esquema exato de OIDC/client credentials; limites de tamanho/paginação; matriz de papéis e limiares de entitlement; campos obrigatórios de pedido fiscal/entrega por tenant. Essas decisões não podem ser inferidas da Rede Carreiro. Reviewer deve fechar as que afetem o teste do G0; as demais podem ser parametrizadas com defaults explícitos.

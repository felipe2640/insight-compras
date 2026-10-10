# Especificação Técnica de Integração — Insight Compras ↔ Cotação Hub

Contrato vigente da integração implementada no **Insight Compras** (branch `codex/test-cotacao-hub`) com o **Cotação Hub**. Fontes de verdade do lado do Hub: `docs/SOURCE_OF_TRUTH.md` e `openapi/cotacao-hub-v1.yaml` (wire), `docs/architecture/h7-buyer-identity-contract.md` (identidade/SSO), `docs/security/security-contracts.md` (assinatura de webhook). Este documento descreve o comportamento **implementado**; divergência com o OpenAPI é defeito.

Decisões humanas vigentes (09/10/2026, registro no plano `docs/operations/production-test-plan-2026-10-09.md` do Hub):

- O comprador seleciona itens no Insight e envia ao Hub. O Hub mantém a cotação, recebe propostas, apura vencedores, permite aprovação individual e gera POs oficiais por distribuidora/destino.
- **O retorno ao Insight não emite nem confirma compra automaticamente.** Chega como rascunho para revisão; o pedido comercial do Insight não muda de estado porque uma cotação foi enviada.
- O comprador abre o Hub **direto pelo Insight**, com identidade própria (SSO); credencial M2M é só integração.
- Referência/marca/marcas aceitas/observação aprovadas: `requested_reference`, `requested_brand`, `accepted_brands` (lista), `source_snapshot.observacao`. A descrição original é preservada — nada de "Obs:" concatenado.
- Reedição do fornecedor até o prazo; assinatura digital de PDF/XLSX dispensada.

---

## 1. Visão geral

```
INSIGHT COMPRAS
  1. Comprador seleciona itens no Cockpit (/cockpit) — "Enviar para cotação"
     OU compila pedidos multi-loja em /pedidos — "Compilar e Cotar no Hub"
  2. Prévia com edição de marca/referência/marcas aceitas/observação e contatos
  3. POST /api/cotacao-hub (server-side) monta o snapshot, valida e dispara
     POST /api/v1/oauth/token (M2M)
     GET  /api/v1/suppliers (paginação: idempotência de vínculo)
     POST /api/v1/suppliers (external_refs)
     POST /api/v1/quotations
     POST /api/v1/quotations/{id}:open
     POST /api/v1/quotations/{id}/invitations
                                        ▼
                                 COTAÇÃO HUB
  - Cotação multi-destino, convite por e-mail (OTP no portal), propostas,
    importação XLSX, reedição até o prazo, apuração (award run)
                                        ▼
POST https://<dominio-insight>/api/cotacao-hub/webhook
Evento award.approved.v1 (HMAC-SHA256, janela 5 min, dedup por event_id)
                                        ▼
INSIGHT COMPRAS
  - Valida assinatura, persiste no inbox durável e consulta
    GET /api/v1/quotations/{id} + GET /api/v1/award-runs/{id}
  - Gera rascunhos agrupados por fornecedor × destino (estado "review"),
    consultáveis em GET /api/cotacao-hub — nenhuma compra é emitida
```

## 2. Itens (contrato `QuotationItemInput`)

| Origem (Insight) | Campo no Hub | Regra |
|---|---|---|
| Descrição do catálogo/edição | `description` | Preservada; máximo 500; sem "Obs:" concatenado |
| Referência do fabricante | `requested_reference` | Edição confirmada ou valor do catálogo |
| Marca | `requested_brand` | Edição confirmada ou valor do catálogo |
| Marcas alternativas | `accepted_brands` | Lista de textos (máx. 20) |
| Observação do comprador (item + condições gerais) | `source_snapshot.observacao` | Campo próprio; nunca na descrição |
| Quantidade | `requested_quantity` | String decimal exata; conector exige inteiro positivo no MVP (UI não homologou frações) |
| Unidade | `requested_unit` | Do cadastro da conexão (`units`), por produto ou default |
| Identidade do item | `external_id` | `JSON.stringify([produtoId, destination_external_id])` — mapa reversível |

Quantidade **zero não é inflada para 1**: é rejeitada com erro explícito (schema + conector).

### 2.1 Marca, referência e marcas aceitas (resolução na fonte)

- `POST /api/cotacao-hub/resolver-produtos` (corpo `{ codigos: string[] }`, máx. 300) resolve marca/referência/descrição e **marcas similares cadastradas** de um recorte de itens pela capacidade tipada `catalogoCotacao` do adaptador — duas consultas DAX leves (medido ao vivo em 10/10/2026: ~0,6 s produtos por `ACODPRODUTO_BASE` + ~0,4 s pares de similaridade), em vez da carga completa de inventário que o GET embutia antes. A rota é **independente da conexão com o Hub** (marca vem do catálogo da fonte; a falta de configuração da conexão não pode deixar o comprador sem marca na prévia — o envio ao Hub continua exigindo a conexão completa, fail-closed).
- Os **chips de marcas aceitas** listam apenas marcas com similar cadastrado para aquele item na fonte (na Carreiro, tabela `PRODUTOS_SEMELHANTES`); a marca já solicitada nunca aparece como sugestão. Sem similar cadastrado, apenas entrada manual.
- O modal da cotação compilada **bloqueia o envio até a resolução concluir** (com estado visível e "Repetir resolução"): a falha silenciosa anterior — catálogo ausente, todos os itens sem marca — não pode mais passar despercebida.

### 2.2 Multi-loja no envio compilado

- O Hub recebe **uma linha por produto × destino** (`external_id = [produtoId, filial]`): o mesmo SKU em lojas diferentes NÃO é unificado — cada filial participa com a sua quantidade e o seu destino.
- Pedidos da **mesma filial** com o mesmo produto são somados em uma única linha pelo modal antes do envio (sem isso, o conector rejeitaria a duplicata produto+filial).
- O agrupamento por SKU na tela é apenas edição conjunta de marca/referência/marcas aceitas.

## 3. Fornecedores e contatos (autoridade de cadastro)

- O **servidor** decide quem cotará: a fonte autorizada é a capacidade tipada `contatosFornecedores` do adaptador (ex.: coluna `AEMAIL` do Power BI da Carreiro) unida ao cadastro da conexão (`suppliers`). O `suppliersData` do browser é apenas sugestão — id inexistente na fonte autorizada é rejeitado.
- O **nome** vem sempre da fonte oficial; o **e-mail** é a correção explícita do comprador, com qualidade conferida no servidor (trim, formato, tamanho).
- Cadastro no Hub: `POST /api/v1/suppliers` com `external_refs: [{ source_system: "insight-compras", external_id }]` (formato vigente do OpenAPI; NÃO usar `source_system`/`external_id` planos no corpo).
- `GET /api/v1/suppliers` é paginado (`data` + `next_cursor`, cursor opaco, máx. 100/página) e serve para **recuperar vínculo existente** antes de criar: o conector percorre a paginação procurando `external_refs` com o namespace desta origem. Vínculos já persistidos no ledger são reutilizados na retomada.
- Carteira: comprador (`COMPRADOR`) só envia aos fornecedores da sua carteira (`allowedSupplierIds`), em qualquer modo.

## 4. Cotação, abertura e convites

- `POST /api/v1/quotations`: `source_system`, `external_id` (UUID da tentativa), `currency: BRL`, `response_deadline_at`, `buyer_snapshot: { name }`, `destinations[]` (`external_id` = id da filial do cadastro do tenant), `items[]` (§2). `Idempotency-Key` por operação.
- `POST /api/v1/quotations/{id}:open` com `If-Match` (ETag recebido na criação).
- `POST /api/v1/quotations/{id}/invitations` por fornecedor: `{ supplier_id, recipients: [{name, email}], delivery_mode: "email", expires_at }` com `If-Match` corrente.
- **Idempotência e retomada**: mesma tentativa mantém `externalId`, chave e corpo; qualquer edição muda o fingerprint canônico e gera nova tentativa. Falha HTTP (401/5xx/timeout) permanece falha — o recibo parcial fica no ledger e a retomada repete a operação com a MESMA `Idempotency-Key`, reconciliando timeout pós-commit no Hub. Não existe resposta simulada nem "Enviada" fabricada.

## 5. Webhook de retorno

- URL pública HTTPS: `https://<dominio-insight>/api/cotacao-hub/webhook`. A assinatura do webhook é registrada no Hub via `POST /api/v1/webhook-subscriptions` (`url` precisa `^https://`, `event_types` inclui `award.approved.v1`); o `key_id` é retornado e o `signing_secret` só uma vez — ambos vão para a configuração da conexão (§7).
- Entrega do Hub: headers `X-Hub-Timestamp` (unix segundos), `X-Hub-Event-Id`, `X-Hub-Key-Id`, `X-Hub-Signature` (hex de `HMAC_SHA256(secret, timestamp + "." + event_id + "." + bytes brutos)`).
- Receptor: confere tamanho (≤1 MiB), key id autorizado, janela de 5 min, assinatura sobre os **bytes originais** (timing-safe), `tenant_id` da conexão e `schema_version "1"`; deduplica por `event_id` no inbox durável antes de processar; sem configuração de conexão responde 503 (fail-closed); evento inválido responde 400 sem detalhe.
- Processamento de `award.approved.v1`: consulta `GET /api/v1/quotations/{quotation_id}` e `GET /api/v1/award-runs/{award_run_id}`, confere vínculo (`external_refs` da cotação, `result_hash`), exige `status: approved` e cotação em `closed_for_responses`/`awarded`/`ordered`, e gera **rascunhos** por `supplier_destination_scenario` com alocações, quantidades e preços em string decimal exata. Run revogada/superseded marca rascunhos anteriores como `superseded`.
- O webhook chega sem sessão humana: grava no ledger durável via acesso privilegiado explícito (`SUPABASE_SERVICE_ROLE_KEY`, ADR-0005).

## 6. Rascunhos e decisão

- Rascunhos ficam no ledger (`drafts`, estado `review`/`superseded`) e são expostos em `GET /api/cotacao-hub` (comprador vê os seus; gestor/admin vê o tenant). A tela do cockpit exibe as propostas vencedoras.
- **Limitação declarada**: o Insight hoje oferece **consulta** dos rascunhos; a emissão/confirmação de compra segue manual no ERP, e a PO oficial é gerada no Hub. O evento antigo "avanço dos pedidos para Confirmado no ERP" foi removido da spec — aprovação/corte/PO pertencem ao Hub e a confirmação efetiva de compra é humana.
- O envio da cotação **não altera** o estado comercial dos pedidos compilados (`pedidoIds`); o estado da integração é registrado separadamente no ledger (`submissions.state`).

## 7. Configuração / variáveis de ambiente

A conexão é **sempre explícita e privada** — não existe configuração padrão embutida. Duas formas:

- **Produção/Vercel**: `INSIGHT_HUB_CONFIG_JSON` (variável de ambiente com o JSON completo).
- **Laboratório local**: `INSIGHT_HUB_TEST_CONFIG` (caminho absoluto de arquivo JSON privado, permissão 0600, fora do repositório).

Esquema (Zod `strict`):

```jsonc
{
  "mode": "production",                  // ou "synthetic-local" (laboratório)
  "tenantId": "<id-do-tenant-no-insight>",
  "hubTenantId": "<uuid-do-tenant-no-hub>",
  "sourceSystem": "insight-compras",
  "apiBaseUrl": "https://<api-do-hub>",  // produção exige https://
  "portalOrigin": "https://<portal-do-hub>",
  "applicationId": "<uuid-da-aplicacao-m2m>",
  "clientId": "<client-id>",
  "clientSecret": "<segredo-privado-32+>",   // NUNCA no repositório
  "webhookKeyId": "<key-id-da-assinatura>",
  "webhookSecret": "<segredo-privado-32+>",  // NUNCA no repositório
  "storageFile": "/caminho/absoluto/ledger.json", // obrigatório no laboratório
  "buyerName": "<nome-do-comprador>",
  "destinations": [ { "external_id": "<filialId>", "name": "…", "address": "…" } ],
  "suppliers": [ { "external_id": "…", "legal_name": "…", "contacts": [{ "name": "…", "email": "…" }] } ],
  "units": { "default": "UN", "<produtoId>": "PC" },
  "allowedActorIds": [],
  "sso": {                              // opcional: emissor de acesso individual
    "issuer": "https://<origem-insight>",
    "audience": "<audiencia-exata-registrada-no-hub>",
    "keyId": "<kid-publicado-em-/api/cotacao-hub/jwks>",
    "privateKeyPem": "<chave-privada-rs256-em-variavel-de-ambiente>",
    "subjectPrefix": "insight-compras:user:"
  }
}
```

Modos:

- `production` — conexão real; HTTPS obrigatório; ledger durável em Supabase (tabelas `cotacao_hub_submission`, `cotacao_hub_inbox`, `cotacao_hub_draft`, migração `20261009120000_cotacao_hub_ledger.sql`, RLS por tenant); funciona na Vercel. Comprador autenticado opera via JWT + RLS (ADR-0005); o webhook usa service_role explícito.
- `synthetic-local` — laboratório: API obrigatoriamente localhost, ledger em arquivo local com lock, recusado quando `NODE_ENV=production` ou na Vercel. É o modo usado pela jornada `test/e2e/connections-run.mjs` do Hub (que importa `src/lib/cotacao-hub/connector.ts` com `createConnector(config, { env })`).

Segredos em documentação: os valores que constavam aqui antes eram exemplos fictícios que só satisfaziam o comprimento mínimo — não são credenciais ativas. Se algum ambiente foi configurado com algum deles, **rotacione** a credencial no Hub antes de produção. Nenhum segredo real deve voltar a este arquivo.

## 8. Acesso direto do comprador (SSO)

Lado Insight do handshake CCR-013/H7:

1. `Abrir no Hub` abre `${portalOrigin}/#sso/${applicationId}` em popup. O portal cria o browser state (PKCE S256, cookie de binding do próprio Hub) e devolve `{ application_id, browser_state_id, nonce, expires_at }` via `postMessage` (`cotacao-hub.browser-context.v1`).
2. A tela chama `POST /api/cotacao-hub/sso-launch` (sessão do comprador; origem conferida). A rota assina assertion JWT RS256 (`iss/aud` do bloco `sso`, `sub = subjectPrefix + userId`, `exp` 300 s, `jti` novo, `nonce` do estado) e chama `POST /api/v1/sso/launches` com Bearer M2M (scope `portal:launch`) + `X-Hub-Identity-Assertion`, corpo `{ quotation_id, browser_state_id }`, `Idempotency-Key` fresco.
3. O `launch_url` (uso único, TTL 120 s, fragmento `#launch=…`) volta ao popup por `cotacao-hub.launch.v1`; o portal resgata e emite a sessão `hub_session` própria.

Pré-provisionamento necessário no Hub (fora do Insight): provider `jwt_jwks` com JWKS `https://<dominio-insight>/api/cotacao-hub/jwks`, `subjectBindings` por usuário, delegação app/provider, scopes `portal:launch` na aplicação e `portal-config.json` com `sso_hosts[applicationId] = https://<dominio-insight>`.

## 9. Limitações e pendências para o fluxo operar

O plano de ativação concreto — instalação identificada, status da migração do ledger, nomes de configuração, provisionamento exato no Hub e jornada de verificação — está em `docs/integracoes/ativacao-cotacao-hub.md`. Resumo:

- Provisionamento real no Hub (tenant, aplicação M2M com os scopes, assinatura de webhook, SMTP, provider/bindings SSO, `portal-config.json`) e aplicação da migração do ledger no Supabase de produção.
- Configuração real na Vercel (`INSIGHT_HUB_CONFIG_JSON` com credenciais privadas) e registro do webhook apontando para o domínio de produção.
- Conciliar a carteira/filial do comprador com os grants provisionados no Hub (a intersection é quem manda).
- Aprovação/corte/PO oficiais permanecem no Hub; o rascunho devolvido é consulta — emissão no ERP segue manual nesta entrega.
- Sem validação de uso executada nesta rodada (decisão registrada no plano de produção do Hub); nenhuma conversa, e-mail ou deploy real foi disparado.

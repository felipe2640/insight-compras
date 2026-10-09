# Especificação Técnica de Integração — Insight Compras ↔ Cotação Hub

Esta documentação detalha os contratos de API, autenticação, modelos de dados, fluxo de disparo e webhook de retorno implementados no **Insight Compras** para comunicação com o **Cotação Hub**.

---

## 1. Visão Geral da Arquitetura

```
+---------------------------------------------------------------------------------+
|                               INSIGHT COMPRAS                                   |
|                                                                                 |
|   1. Comprador gera pedidos por loja no Cockpit (/cockpit)                      |
|   2. Seleciona múltiplos pedidos de várias lojas na tela de Pedidos (/pedidos)  |
|   3. Dispara Cotação Compilada Multi-Loja via Conector                          |
+---------------------------------------------------------------------------------+
                                       │
                         POST /api/v1/oauth/token (M2M)
                         POST /api/v1/suppliers
                         POST /api/v1/quotations
                         POST /api/v1/quotations/{id}:open
                         POST /api/v1/quotations/{id}/invitations
                                       ▼
+---------------------------------------------------------------------------------+
|                                 COTAÇÃO HUB                                     |
|                                                                                 |
|   - Criação da cotação com múltiplos destinos (filiais Carreiro)                |
|   - Notificação por e-mail aos fornecedores                                     |
|   - Portal do Fornecedor para digitação de propostas e prazos                    |
|   - Apuração / Award Run (menor preço e alocação de itens)                      |
+---------------------------------------------------------------------------------+
                                       │
                      POST /api/cotacao-hub/webhook
                      Evento: "award.approved.v1" (HMAC-SHA256)
                                       ▼
+---------------------------------------------------------------------------------+
|                               INSIGHT COMPRAS                                   |
|                                                                                 |
|   - Validação da assinatura do webhook e persistência no ledger                 |
|   - Armazenamento dos rascunhos de decisão por fornecedor e filial              |
|   - Avanço dos pedidos no ERP para "Confirmado"                                 |
+---------------------------------------------------------------------------------+
```

---

## 2. Autenticação Machine-to-Machine (OAuth2)

O Insight Compras autentica no Cotação Hub utilizando o fluxo **OAuth2 Client Credentials (RFC 6749)**.

### Requisição do Insight Compras:
* **Método**: `POST`
* **Rota**: `{apiBaseUrl}/api/v1/oauth/token`
* **Headers**:
  ```http
  Authorization: Basic base64(clientId:clientSecret)
  Content-Type: application/x-www-form-urlencoded
  ```
* **Body**:
  ```
  grant_type=client_credentials
  ```

### Resposta esperada do Cotação Hub:
* **Status**: `200 OK`
* **Body**:
  ```json
  {
    "access_token": "ey...",
    "token_type": "Bearer",
    "expires_in": 900
  }
  ```

---

## 3. Fluxo de Disparo de Cotação (Insight Compras → Cotação Hub)

Quando o comprador clica em **"Disparar Cotação Unificada"**, o conector executa a sequência transacional abaixo com headers de idempotência (`Idempotency-Key: <hash>`) e controle de concorrência (`If-Match: <ETag>`):

### Passo 1: Cadastro Idempotente de Fornecedores
Para cada fornecedor selecionado que ainda não tenha `id` remoto gravado no ledger:
* **Rota**: `POST /api/v1/suppliers`
* **Headers**: `Authorization: Bearer <token>`, `Idempotency-Key: <hash>`
* **Payload**:
  ```json
  {
    "source_system": "insight-compras",
    "external_id": "1",
    "legal_name": "Distribuidora Peças Brasil Ltda",
    "contacts": [
      {
        "name": "Distribuidora Peças Brasil Ltda",
        "email": "vendas@distribuidora.com.br"
      }
    ]
  }
  ```
* **Resposta esperada**: `201 Created` com header `ETag` e corpo `{ "id": "supp-uuid-1" }`.

---

### Passo 2: Criação da Cotação Multi-Destino
Cria o cabeçalho da cotação, os destinos (filiais da Rede Carreiro) e os itens associados a cada loja:
* **Rota**: `POST /api/v1/quotations`
* **Headers**: `Authorization: Bearer <token>`, `Idempotency-Key: <hash>`
* **Payload**:
  ```json
  {
    "source_system": "insight-compras",
    "external_id": "c1f7b0a8-3619-4972-9ea9-a868470a1e34",
    "currency": "BRL",
    "response_deadline_at": "2026-10-10T13:00:00.000Z",
    "buyer_snapshot": {
      "name": "Comprador Rede Carreiro"
    },
    "destinations": [
      {
        "external_id": "1",
        "name": "Carreiro Pedro II (Matriz)",
        "address": "Pedro II - PI"
      },
      {
        "external_id": "2",
        "name": "Melo / Piripiri",
        "address": "Piripiri - PI"
      }
    ],
    "items": [
      {
        "external_id": "[\"101\",\"1\"]",
        "description": "AMORTECEDOR DIANTEIRO COROLLA 2018",
        "requested_quantity": "10",
        "requested_unit": "UN",
        "destination_external_id": "1"
      },
      {
        "external_id": "[\"101\",\"2\"]",
        "description": "AMORTECEDOR DIANTEIRO COROLLA 2018",
        "requested_quantity": "6",
        "requested_unit": "UN",
        "destination_external_id": "2"
      }
    ]
  }
  ```
* **Resposta esperada**: `201 Created` com header `ETag: "1"` e corpo `{ "id": "quote-uuid-99" }`.

---

### Passo 3: Abertura da Cotação para Propostas
Muda o estado da cotação para aberto:
* **Rota**: `POST /api/v1/quotations/{quotationId}:open`
* **Headers**:
  ```http
  Authorization: Bearer <token>
  Idempotency-Key: <hash>
  If-Match: "1"
  ```
* **Resposta esperada**: `200 OK` com novo header `ETag: "2"`.

---

### Passo 4: Envio dos Convites aos Fornecedores
Dispara o e-mail oficial com o link de acesso seguro e token de preenchimento para cada fornecedor:
* **Rota**: `POST /api/v1/quotations/{quotationId}/invitations`
* **Headers**:
  ```http
  Authorization: Bearer <token>
  Idempotency-Key: <hash>
  If-Match: "2"
  ```
* **Payload**:
  ```json
  {
    "supplier_id": "supp-uuid-1",
    "recipients": [
      {
        "name": "Distribuidora Peças Brasil",
        "email": "vendas@distribuidora.com.br"
      }
    ],
    "delivery_mode": "email",
    "expires_at": "2026-10-10T13:00:00.000Z"
  }
  ```
* **Resposta esperada**: `201 Created`.

---

## 4. Retorno de Propostas e Decisão (Cotação Hub → Insight Compras)

Quando o processo de cotação é encerrado no Hub e o comprador ou algoritmo aprova o resultado da rodada (*Award Run*), o Cotação Hub envia um webhook assinado para o Insight Compras.

### Endpoint do Webhook no Insight Compras:
* **URL**: `https://<dominio-insight-compras>/api/cotacao-hub/webhook`
* **Método**: `POST`
* **Headers obrigatórios**:
  ```http
  Content-Type: application/json
  x-hub-event-id: <uuid-do-evento>
  x-hub-key-id: <webhookKeyId-configurado>
  x-hub-timestamp: <timestamp-em-segundos-ou-ms>
  x-hub-signature: sha256=<hmac-hex>
  ```

### Regra de Assinatura HMAC (SHA-256):
```
mensagem = timestamp + "." + eventId + "." + rawBodyBytes
assinatura = HMAC_SHA256(secret = webhookSecret, data = mensagem).hex()
```

### Payload do Webhook (`award.approved.v1`):
```json
{
  "event_id": "a0000000-0000-4000-8000-000000000001",
  "schema_version": "1",
  "tenant_id": "10000000-0000-4000-8000-000000000001",
  "event_type": "award.approved.v1",
  "payload": {
    "quotation_id": "quote-uuid-99",
    "award_run_id": "award-uuid-88",
    "result_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
}
```

### Processamento do Retorno:
Ao receber o evento validado, o conector faz um `GET` no Hub para consultar os detalhes da apuração:
1. `GET /api/v1/quotations/{quotation_id}`
2. `GET /api/v1/award-runs/{award_run_id}`
3. Agrupa os itens vencedores por **Fornecedor** e por **Filial de Destino**.
4. Gera os rascunhos de Ordem de Compra para emissão no ERP Carreiro.

---

## 5. Configuração / Variáveis de Ambiente no Insight Compras

Para conectar a aplicação ao servidor do Cotação Hub, defina na **Vercel** ou no arquivo `.env`:

```env
# Modo de operação: "test-carreiro" (piloto/teste) ou produção
INSIGHT_HUB_TEST_MODE="test-carreiro"

# Configuração completa JSON (ou via arquivo INSIGHT_HUB_TEST_CONFIG)
INSIGHT_HUB_CONFIG_JSON='{
  "mode": "test-carreiro",
  "tenantId": "carreiro",
  "hubTenantId": "10000000-0000-4000-8000-000000000001",
  "sourceSystem": "insight-compras",
  "apiBaseUrl": "https://api.seuhub.com.br",
  "portalOrigin": "https://cotacao.seuhub.com.br",
  "applicationId": "20000000-0000-4000-8000-000000000001",
  "clientId": "carreiro-m2m-client-id",
  "clientSecret": "sua-chave-secreta-com-pelo-menos-32-caracteres",
  "webhookKeyId": "key-carreiro-1",
  "webhookSecret": "seu-webhook-secret-com-pelo-menos-32-caracteres",
  "storageFile": "/tmp/carreiro-cotacao-ledger.json",
  "buyerName": "Comprador Rede Carreiro",
  "destinations": [
    { "external_id": "1", "name": "Carreiro Pedro II (Matriz)", "address": "Pedro II - PI" },
    { "external_id": "2", "name": "Melo / Piripiri", "address": "Piripiri - PI" },
    { "external_id": "3", "name": "Carreiro Esperantina", "address": "Esperantina - PI" },
    { "external_id": "4", "name": "Carreiro Barras", "address": "Barras - PI" },
    { "external_id": "5", "name": "Carreiro Campo Maior", "address": "Campo Maior - PI" },
    { "external_id": "6", "name": "Carreiro Parnaíba", "address": "Parnaíba - PI" },
    { "external_id": "7", "name": "Carreiro Teresina", "address": "Teresina - PI" },
    { "external_id": "8", "name": "Melo / Pedro II", "address": "Pedro II - PI" }
  ],
  "suppliers": [
    {
      "external_id": "1",
      "legal_name": "Distribuidora Peças Brasil",
      "contacts": [{ "name": "Vendas", "email": "vendas@distribuidora.com.br" }]
    }
  ],
  "units": {
    "default": "UN"
  },
  "allowedActorIds": []
}'
```

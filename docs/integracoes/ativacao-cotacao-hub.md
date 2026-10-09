# Ativação da integração Cotação Hub — preparação concreta

Estado em 09/10/2026, branch `codex/test-cotacao-hub`. **Esta integração está preparada, não operacional**: enquanto configuração, migração e publicação estiverem pendentes, nada aqui se descreve como integração em produção. Nenhum convite, e-mail ou deploy real foi emitido nesta preparação.

## 1. Instalação identificada (Vercel)

| Item | Valor |
|---|---|
| Time Vercel | `felipe2640's projects` (plano hobby) |
| Projeto-alvo | **`comprascarreiro`** (`prj_wNvQ6VCDyYuDMhA5zKsDHts1SuNa`), repositório GitHub `felipe2640/insight-compras` |
| Domínio de produção | `https://comprascarreiro.vercel.app` (verificado; sem domínio custom) |
| Deployment de produção vigente | `dpl_8uPmvUm4L63P4jTthsqKrFdtn5VK` — branch **`main`** — SHA **`0113ecc0681abd92fb9eb5044487549cee56a4cf`** — READY |
| Preview mais recente da branch `codex/test-cotacao-hub` | `dpl_GG3mw6zUmHdQTNn9BHZbuL1PmpLj` — SHA **`8265061bd6abfd3b9587f3d7c6bd7739d4974245`** — READY (auto-deploy a cada push) |
| Instalação que NÃO é o alvo | projeto `insight-compras` (`prj_405Ai0FwApfsuT7Yd85v0p5xbU76`) — outra instalação do mesmo repositório |

Conclusão: o código da integração está **publicado no GitHub** e **compilado como preview**, mas a **aplicação implantada em produção** ainda roda `main` @ `0113ecc`, sem a integração. Publicar código ≠ implantar aplicação.

## 2. Migração do ledger — status e procedimento

**Status: NÃO APLICADA** — verificado por sonda read-only (sem credenciais privilegiadas) contra o Supabase da instalação: `cotacao_hub_submission`, `cotacao_hub_inbox` e `cotacao_hub_draft` retornam `PGRST205` (ausentes do schema cache, igual à tabela-controle inexistente), enquanto `auditoria_pedido` (existente) responde `42501` sem grant para `anon`. O arquivo SQL existir **não** significa persistência pronta.

**Procedimento de aplicação** (quem tem acesso ao SQL da instalação — Supabase SQL Editor ou `psql` com a URL admin):

1. Aplicar `supabase/migrations/20261009120000_cotacao_hub_ledger.sql`.
2. Verificar:
   ```sql
   select to_regclass('public.cotacao_hub_submission') as submission,
          to_regclass('public.cotacao_hub_inbox')      as inbox,
          to_regclass('public.cotacao_hub_draft')      as draft;   -- três valores não nulos
   select * from pg_policies where tablename like 'cotacao_hub_%';  -- 3 políticas own_tenant
   ```
3. Repetir a sonda externa: `GET {SUPABASE_URL}/rest/v1/cotacao_hub_submission?select=*&limit=1` com a chave `anon` deve passar de `PGRST205` para `42501`/permissão negada (tabela existe, `anon` não lê).

**Preservação de dados**: a migração é puramente aditiva (`create table if not exists`, índices, RLS, grants a `authenticated`); não altera nenhuma tabela existente.

**Rollback** (`20261009120000_cotacao_hub_ledger.rollback.sql`): remove apenas as três tabelas da integração (políticas caem junto). Os envios/vínculos/retornos da integração são perdidos — decidir antes se a conexão já estará ativa. Dado de domínio de outras áreas permanece intacto.

## 3. Nomes de configuração (Instalação/Vercel)

Sem valores secretos; nada abaixo é credencial.

**Já presentes no projeto** (production/preview/development): `TENANT_ATIVO`, `AUTH_PROVIDER`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POWERBI_WORKSPACE_ID`, `POWERBI_DATASET_ID`, `POWERBI_TENANT_ID`, `POWERBI_CLIENT_ID`, `POWERBI_CLIENT_SECRET`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`. Manter como estão — a integração não exige mudança neles.

**Faltante (bloqueador)**: `INSIGHT_HUB_CONFIG_JSON` — JSON único de conexão com o esquema da especificação (§7): `mode: "production"`, `tenantId`, `hubTenantId`, `sourceSystem: "insight-compras"`, `apiBaseUrl`, `portalOrigin`, `applicationId`, `clientId`, `clientSecret`, `webhookKeyId`, `webhookSecret`, `buyerName`, `destinations[]` (id da filial do cadastro), `suppliers[]`, `units`, `allowedActorIds[]` e bloco `sso { issuer, audience, keyId, privateKeyPem, subjectPrefix }`. Alvo: production e preview.

Regras de segredo: `clientSecret`, `webhookSecret` e `privateKeyPem` existem apenas nesta variável de ambiente; nunca no repositório, em documento, log ou chat. Gerar cada valor no momento da configuração (≥32 bytes para segredos; par RS256 para o SSO — a pública é servida automaticamente por `GET /api/cotacao-hub/jwks`). Os antigos valores-exemplo removidos do código não são credenciais; se algum ambiente chegou a ser configurado com um deles, **rotacionar antes de produzir**.

## 4. Provisionamento necessário no Hub (exato)

Preservar a instalação existente: **PostgreSQL e SMTP já operacionais não são recriados** — o projeto Vercel `cotacao-hub` continua como está. O que falta é atualização do plano de bootstrap (reexecução com os mesmos dados é permitida; mudança de identidade exige versão nova) e dois registros operacionais:

1. **Aplicação M2M** (no plano `identity`/`application`): `clientId`/secret reais da conexão, `enabled`, `credentialVersion`, `scopes` = `supplier:read supplier:manage quotation:read quotation:write quotation:manage invitation:write award:read order:read portal:launch event:read usage:read integration:manage`. `award:approve` fica **fora** da aplicação — aprovação é humana.
2. **Provider SSO** (`identity.providers`): tipo `jwt_jwks`, `issuer = https://comprascarreiro.vercel.app`, `audience` = a mesma do bloco `sso` da conexão, `key_source` = JWKS `https://comprascarreiro.vercel.app/api/cotacao-hub/jwks`, allowlist de algoritmo `RS256`, `tenant_mapping` por issuer+aplicação, `subject_mapping`, `role_mapping` (allowlist; claims só reduzem), `enabled`, `policy_version`.
3. **Subject bindings** (`identity.subjectBindings`): um por comprador — `insight-compras:user:<id do usuário no Insight>` → usuário Hub. A assertion **não** cria binding.
4. **Delegação** (`identity.delegations`): aplicação ↔ provider, `sourceSystems` com o namespace `insight-compras`, teto de scopes/namespaces imutável/versionado; `return_url` **nenhum** (o acesso permanece no portal).
5. **Grants/memberships** (`identity.users`/`memberships`): usuários buyer com papéis `buyer_operator` + `buyer_approver`, `additionalScopes: ["event:read"]`, `sourceSystems: ["insight-compras"]` — a interseção com a carteira/filial da origem define o acesso real.
6. **Assinatura de webhook**: `POST {apiBaseUrl}/api/v1/webhook-subscriptions` com `url = https://comprascarreiro.vercel.app/api/cotacao-hub/webhook` e `event_types = ["award.approved.v1", ...]`; guardar `key_id` + `signing_secret` (retornada uma única vez) — vão para `INSIGHT_HUB_CONFIG_JSON`. Criar **após** o domínio de produção estar no ar (validação SSRF/HTTPS no Hub).
7. **portal-config.json** do portal Hub: `sso_hosts["<applicationId>"] = "https://comprascarreiro.vercel.app"` (origem exata validada no handshake postMessage).

## 5. Função habilitada, carteira e filial — como são respeitadas

Código vigente na branch (verificação de tipos passou; **sem suítes executadas nesta rodada**):

- **Envio** — `src/lib/cotacao-hub/selection.ts`: papel `COMPRADOR` é sempre restrito à carteira (`restricted = user.role === "COMPRADOR"`, L62; fornecedor fora da carteira/conexão é rejeitado, L68); filial precisa estar cadastrada e ativa (L55 e L117); item sem loja de destino é erro explícito. `src/lib/cotacao-hub/server-context.ts` (L13) confere usuário ativo, tenant da sessão = tenant da instalação = tenant da conexão, e `allowedActorIds` quando preenchido. `POST /api/cotacao-hub` ainda aplica `aplicarGuardrailInventarioServerSide` sobre o inventário carregado.
- **Acesso SSO** — `src/app/api/cotacao-hub/sso-launch/route.ts`: contexto fail-closed da requisição + `COMPRADOR` só abre cotação que **ele mesmo** enviou (L47–48; `GESTOR`/`ADMIN` veem o tenant); a sessão Hub e os poderes efetivos vêm da membership provisionada no Hub (interseção delegação × membership × carteira da origem) — a assertion apenas prova identidade.
- **Filial no fluxo**: destino = id da filial do cadastro do tenant; pedidos sem loja bloqueiam o envio compilado; cotação multi-loja gera um destino por filial participante.

## 6. Plano de publicação do Insight

**Versão exata a publicar**: `codex/test-cotacao-hub` @ **`8265061bd6abfd3b9587f3d7c6bd7739d4974245`** (preview READY `dpl_GG3mw6zUmHdQTNn9BHZbuL1PmpLj`).

Ordem recomendada (cada etapa é bloqueadora para a seguinte):

1. **Instalação**: criar `INSIGHT_HUB_CONFIG_JSON` (production+preview) na Vercel do `comprascarreiro`.
2. **Instalação**: aplicar a migração do ledger (§2) e conferir com as queries de verificação.
3. **Hub**: executar o bootstrap atualizado (§4.1–4.5) — sem tocar em Postgres/SMTP existentes.
4. **Publicar a aplicação**: promover a branch — PR `codex/test-cotacao-hub` → `main` (o Git connection constroi o deployment de produção do SHA exato) **ou** promote do preview `dpl_GG3mw…` após conferir o SHA. Antes de promote: `npm run lint` (verificação de tipos) e `npm run build` na versão exata.
5. **Hub**: registrar a assinatura de webhook apontando ao domínio de produção (§4.6) e `portal-config.json` (§4.7).

**Verificação de uso (jornada, sem automação, com consentimento do piloto)**: entrar em `https://comprascarreiro.vercel.app` → selecionar itens com quantidade no cockpit → **Enviar para cotação** → conferir prévia (marca/referência/marcas aceitas/observação) → enviar (anotar `quotation_id`) → **Abrir no Hub** abre o portal com sessão individual do comprador → fornecedor convidado responde por e-mail/portal (SMTP já operacional) → comprador acompanha propostas, revisa o corte, aprova item a item e gera a PO no Hub → `award.approved.v1` chega ao Insight e o rascunho vencedor aparece no cockpit ("Propostas Vencedoras") para emissão manual no ERP. Registrar evidências: IDs, timestamps, telas. Falha em qualquer passo vira pendência com dono — não vira "aprovado".

A primeira jornada de uso real é a etapa de validação; durante a preparação, **nenhum convite real é emitido**.

## 7. Pendências por responsável

| Dono | Pendência |
|---|---|
| **Instalação (Vercel/Supabase comprascarreiro)** | Criar `INSIGHT_HUB_CONFIG_JSON` (production+preview); aplicar migração do ledger e verificar; publicar a versão `8265061`; manter `TENANT_ATIVO`/`SUPABASE_*`/`POWERBI_*`/`AZURE_*` como estão |
| **Hub (instalação cotacao-hub)** | Bootstrap: aplicação+scopes, provider jwt_jwks+JWKS, subject bindings, delegação, memberships/grants; `POST /api/v1/webhook-subscriptions`; `portal-config.json` `sso_hosts` — preservando PostgreSQL e SMTP operacionais |
| **Insight (código)** | Nada pendente para a ativação nesta branch; jornada de uso e ajustes conforme as evidências coletadas |

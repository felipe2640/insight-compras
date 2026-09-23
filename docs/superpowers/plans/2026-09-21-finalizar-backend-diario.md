# Finalizar Backend Compartilhado do Diário Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o modelo de identidade do Diário no Supabase compartilhado e entregar schema, importação e testes RLS seguros para todos os tenants.

**Architecture:** Os usuários do Insight permanecem em `tenant_members`; usuários e contas técnicas do Diário ficam em `app_members`, sem acesso a `aprendizado_*`. As tabelas operadas pelo Diário recebem `app_id`, FKs compostas e políticas que exigem membership de `carreiro/diario`; o importador resolve IDs legados diretamente nesse membership.

**Tech Stack:** PostgreSQL/Supabase Auth, PostgREST, RLS, PL/pgSQL, Node.js 22+, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-21-finalizacao-migracao-diario-design.md`

## Global Constraints

- `TENANT_ATIVO` continua obrigatório e cada deploy atende um cliente.
- `admin` e `valmir` permanecem usuários exclusivos do Insight Compras.
- Usuários do Diário não entram em `tenant_members`.
- `service_role` só pode ser usado em bootstrap, migração, administração e jobs privilegiados.
- Não criar nem importar tabelas `shadow_*`.
- A migration deve ser compatível com o schema real já aplicado, mesmo com o histórico remoto incompleto para `001` e `003`.
- Não excluir, pausar ou alterar o projeto Supabase antigo do Diário.
- Uma única PR final neste repositório.

## Review Focus

- JWT com tenant correto mas `app_id` ausente ou diferente deve receber zero linhas e não escrever.
- Um usuário válido do Diário não pode acessar `aprendizado_*`; usuário do Insight não pode acessar configurações do Diário.
- `legacy_user_ref` duplicado, usuário inativo ou usuário de outro tenant não pode criar `usuario_grupo`.
- Reexecução do importador deve ser idempotente e não voltar a associar `admin`/`valmir`.
- Migration deve funcionar quando as tabelas `003/004` já existem e contêm as três configurações importadas.
- Tenant ativo diferente de `carreiro` deve usar o mesmo fluxo sem IDs ou regras hardcoded.

---

### Task 1: Schema app-scoped e políticas RLS

**Files:**
- Create: `supabase/migrations/20260921230908_diario_app_identity.sql`
- Create: `supabase/migrations/20260921230908_diario_app_identity.rollback.sql`
- Create: `tests/supabase/diario-app-identity-schema.test.ts`
- Create: `supabase/tests/diario_app_rls_adversarial.sql`
- Modify: `supabase/README.md`

**Interfaces:**
- Consumes: `public.tenants`, `public.tenant_members`, `private.is_tenant_member` e as tabelas criadas pelas migrations `003/004`.
- Produces: `public.app_members`, `private.is_app_member(text,text)`, `private.is_app_manager(text,text)`, `public.diario_lojas` e tabelas do Diário com chave `(tenant_id, app_id, ...)`.

- [ ] **Step 1: escrever teste de schema que falha**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/202609210005_diario_app_identity.sql", "utf8");

describe("identidade app-scoped do Diário", () => {
  it("separa app_members de tenant_members", () => {
    expect(sql).toMatch(/create table(?: if not exists)? public\.app_members/i);
    expect(sql).toMatch(/primary key \(tenant_id, app_id, user_id\)/i);
    expect(sql).toMatch(/references auth\.users \(id\)/i);
  });

  it("restringe as tabelas do Diário por tenant e aplicação", () => {
    for (const table of ["fornecedor_grupo", "usuario_grupo", "secao_multiplo_compra", "margem_alvo", "diario_lojas"]) {
      expect(sql).toContain(`public.${table}`);
    }
    expect(sql).toMatch(/is_app_member\(tenant_id, app_id\)/g);
    expect(sql).not.toMatch(/grant [^;]+ to anon/i);
  });

  it("usuario_grupo referencia app_members e grupo pelo mesmo escopo", () => {
    expect(sql).toMatch(/foreign key \(tenant_id, app_id, user_id\)[\s\S]*references public\.app_members/i);
    expect(sql).toMatch(/foreign key \(tenant_id, app_id, grupo_id\)[\s\S]*references public\.fornecedor_grupo/i);
  });
});
```

- [ ] **Step 2: confirmar RED**

Run: `npm test -- tests/supabase/diario-app-identity-schema.test.ts`

Expected: FAIL porque a migration `005` não existe.

- [ ] **Step 3: criar a migration corretiva mínima**

Implementar SQL transacional e idempotente que:

```sql
create table if not exists public.app_members (
  tenant_id text not null references public.tenants(id) on update cascade on delete restrict,
  app_id text not null check (app_id ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_type text not null default 'human' check (account_type in ('human','runtime','job')),
  legacy_user_ref text,
  username text not null,
  username_normalized text not null,
  papel text not null check (papel in ('admin','user')),
  loja_ids text[],
  allowed_supplier_ids text[],
  allowed_supplier_ids_unrestricted boolean not null default false,
  allowed_page_ids text[] not null default '{}',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, app_id, user_id),
  unique (tenant_id, app_id, legacy_user_ref),
  unique (tenant_id, app_id, username_normalized)
);
```

Criar helpers no schema `private` com `security definer`, `search_path=''`, verificação de `(select auth.uid())`, `app_metadata.tenant_id`, `app_metadata.app_id` e membership ativo. Revogar EXECUTE de `PUBLIC`, `anon`, `authenticated` e conceder apenas o necessário para uso pelas policies. Adicionar `app_id text not null default 'diario'` nas tabelas existentes, reconstruir PKs/uniques/FKs compostas e criar `diario_lojas`, `margem_alerta`, `margem_mensal`, `margem_tendencia`. Forçar RLS e grants mínimos.

- [ ] **Step 4: escrever o teste SQL adversarial**

O arquivo deve criar tenants `teste_diario_alpha/beta`, usuários Auth sintéticos e memberships `diario/insight-compras`, configurar `request.jwt.claims` e falhar explicitamente se qualquer uma destas operações for permitida: SELECT/INSERT/UPDATE/DELETE cross-tenant, SELECT cross-app, INSERT de `usuario_grupo` com usuário ou grupo de outro escopo, leitura de `aprendizado_snapshot` pelo usuário apenas `app_members`.

- [ ] **Step 5: confirmar GREEN estático**

Run: `npm test -- tests/supabase/diario-app-identity-schema.test.ts tests/supabase/configuracoes-legadas-schema.test.ts`

Expected: PASS; se o teste antigo expressar o modelo incorreto, atualizá-lo para exigir `app_members` e registrar essa substituição no commit.

- [ ] **Step 6: criar rollback seguro e documentação**

O rollback deve remover somente objetos novos quando não contiverem dados e restaurar as policies anteriores; deve abortar com mensagem explícita se houver `app_members` humanos ou dados novos, evitando perda silenciosa.

- [ ] **Step 7: commit**

```bash
git add supabase/migrations/202609210005_diario_app_identity.sql \
  supabase/migrations/202609210005_diario_app_identity.rollback.sql \
  supabase/tests/diario_app_rls_adversarial.sql \
  tests/supabase/diario-app-identity-schema.test.ts \
  tests/supabase/configuracoes-legadas-schema.test.ts supabase/README.md
git commit -m "feat(db): isolate Diario identities by tenant and app"
```

### Task 2: Importador idempotente sem mapa de usuários do Insight

**Files:**
- Modify: `supabase/migrations/202609210005_diario_app_identity.sql`
- Modify: `scripts/migracao-diario/import-config.mjs`
- Modify: `tests/supabase/importacao-diario.test.ts`
- Create: `tests/migracao-diario/import-config-app-members.test.ts`
- Modify: `docs/adr/0006-configuracoes-legadas-tenant-scoped.md`

**Interfaces:**
- Consumes: `app_members(tenant_id,app_id,user_id,legacy_user_ref,ativo)` da Task 1.
- Produces: RPC `importar_configuracoes_diario(text,jsonb)` e CLI sem `MIGRACAO_USUARIO_MAP_JSON`.

- [ ] **Step 1: escrever testes RED do novo contrato**

```ts
it("resolve usuário legado somente em app_members do Diário", () => {
  expect(sql).toMatch(/join public\.app_members[\s\S]*app_id = 'diario'/i);
  expect(sql).not.toContain("p_mapa_usuarios");
  expect(sql).not.toMatch(/references public\.tenant_members/i);
});

it("CLI não aceita mapa de admin e valmir", () => {
  expect(script).not.toContain("MIGRACAO_USUARIO_MAP_JSON");
  expect(script).toContain("p_manifesto");
});
```

- [ ] **Step 2: confirmar RED**

Run: `npm test -- tests/supabase/importacao-diario.test.ts tests/migracao-diario/import-config-app-members.test.ts`

Expected: FAIL porque o RPC e CLI atuais exigem o mapa `2/5 -> UUID`.

- [ ] **Step 3: substituir a assinatura antiga**

Na migration `20260921230908`, executar:

```sql
drop function if exists public.importar_configuracoes_diario(text, jsonb, jsonb);
create or replace function public.importar_configuracoes_diario(
  p_tenant_id text,
  p_manifesto jsonb
) returns jsonb ...;
```

O INSERT em `usuario_grupo` deve fazer JOIN por
`m.tenant_id=p_tenant_id AND m.app_id='diario' AND m.legacy_user_ref=x.user_id AND m.ativo`, exigir correspondência 1:1 e nunca consultar `tenant_members`. Manter lote transacional, contagens, idempotência, rollback por `migration_batch_id` e EXECUTE somente para `service_role`.
O RPC aceita qualquer tenant ativo cujo ID coincida com o manifesto; remover a
restrição histórica `p_tenant_id = 'carreiro'`.

- [ ] **Step 4: simplificar o CLI**

Remover `validarMapaUsuarios`; o dry-run valida manifesto/contagens e `--apply` chama apenas:

```js
await chamarRpc("importar_configuracoes_diario", {
  p_tenant_id: tenant,
  p_manifesto: manifesto,
});
```

O tenant vem de `MIGRACAO_TENANT_ID` e deve coincidir com o manifesto.

- [ ] **Step 5: confirmar GREEN**

Run: `npm test -- tests/supabase/importacao-diario.test.ts tests/migracao-diario/import-config-app-members.test.ts`

Expected: PASS.

- [ ] **Step 6: commit**

```bash
git add supabase/migrations/202609210005_diario_app_identity.sql \
  scripts/migracao-diario/import-config.mjs tests/supabase/importacao-diario.test.ts \
  tests/migracao-diario/import-config-app-members.test.ts \
  docs/adr/0006-configuracoes-legadas-tenant-scoped.md
git commit -m "fix(migration): bind Diario groups to app members"
```

### Task 3: Runbook, reconciliação e verificação do backend

**Files:**
- Create: `docs/migracao-diario/02-cutover-final.md`
- Modify: `.env.example`
- Modify: `package.json`
- Test: todas as suítes do repositório

**Interfaces:**
- Consumes: migration e importador das Tasks 1-2.
- Produces: ordem única de aplicação, validação, rollback e exclusão futura do projeto antigo.

- [ ] **Step 1: escrever teste RED de documentação/ambiente**

Adicionar a `tests/supabase/diario-app-identity-schema.test.ts`:

```ts
it("runbook mantém o banco antigo até o aceite final", () => {
  const runbook = readFileSync("docs/migracao-diario/02-cutover-final.md", "utf8");
  expect(runbook).toContain("não excluir");
  expect(runbook).toContain("DIARIO_AUTH_BACKEND=supabase");
  expect(runbook).toContain("1 fornecedor_grupo");
  expect(runbook).toContain("2 usuario_grupo");
  expect(runbook).toContain("96 secao_multiplo_compra");
  expect(runbook).toContain("1 margem_alvo");
});
```

- [ ] **Step 2: confirmar RED**

Run: `npm test -- tests/supabase/diario-app-identity-schema.test.ts`

Expected: FAIL porque o runbook não existe.

- [ ] **Step 3: escrever o runbook completo**

Incluir: migration primeiro; bootstrap dos usuários no repositório Diário; importação dos dois vínculos; queries de contagem/hash; testes dos sete logins; preview; produção; observação; remoção dos segredos antigos; checagem de tráfego; confirmação explícita; somente então exclusão do projeto `escsriqutzfdwbockfym`. Documentar que `001/003` existem no schema mas não no histórico remoto, e que `005` não depende de reaplicá-las.
Registrar também que `.github/workflows/previsao-ia-diaria.yml` continua sendo o
job privilegiado do Insight e não deve ser alterado por esta migração.

- [ ] **Step 4: executar verificação completa**

Run: `npm test && npm run typecheck && npm run build`

Expected: exit 0 em todos os comandos.

- [ ] **Step 5: commit**

```bash
git add docs/migracao-diario/02-cutover-final.md .env.example package.json \
  tests/supabase/diario-app-identity-schema.test.ts
git commit -m "docs: add coordinated Diario cutover runbook"
```

### Task 4: Aplicação controlada e prova no Supabase compartilhado

**Files:**
- No repository file changes unless verification exposes a defect.
- Verify: Supabase project `nzomnqxqljhwqyewehvo`.

**Interfaces:**
- Consumes: migration `005` já verde e commitada.
- Produces: schema remoto pronto para o bootstrap do repositório Diário.

- [ ] **Step 1: executar advisors antes da alteração**

Run: Supabase security and performance advisors via connector.

Expected: registrar achados existentes sem atribuí-los à migration.

- [ ] **Step 2: aplicar a migration `005` pelo conector Supabase**

Run: `apply_migration(name: "diario_app_identity", query: <conteúdo integral da migration 005>)`.

Expected: sucesso transacional; em erro, nenhuma alteração parcial.

- [ ] **Step 3: executar o SQL adversarial no destino**

Run: executar `supabase/tests/diario_app_rls_adversarial.sql` em transação com rollback.

Expected: todas as asserções passam e os dados sintéticos são revertidos.

- [ ] **Step 4: verificar schema, policies e dados preservados**

Run: consultas de catálogo e contagem via connector.

Expected: `app_members=0` antes do bootstrap; 1 grupo, 0 vínculos, 96 seções, 1 margem em `carreiro/diario`; nenhuma tabela `shadow_*`; RLS ativo e grants sem `anon`.

- [ ] **Step 5: executar advisors depois da alteração**

Expected: nenhum novo alerta de RLS, função privilegiada pública ou índice FK ausente causado pela migration.

## Final branch verification

- [ ] Run: `git diff --check origin/main...HEAD`
- [ ] Run: `npm test`
- [ ] Run: `npm run typecheck`
- [ ] Run: `npm run build`
- [ ] Run: `git diff --exit-code origin/main...HEAD -- .github/workflows/previsao-ia-diaria.yml`
- [ ] Conferir que nenhum segredo, senha ou manifesto com senha entrou no diff.
- [ ] Abrir uma única PR contra `main`, descrevendo dependência da PR do Diário, rollout, rollback e critérios de aceite.

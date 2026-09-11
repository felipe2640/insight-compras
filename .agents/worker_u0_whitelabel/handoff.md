# Relatório de Handoff — Unidade U0 (Vazamento do nome do cliente no modo demonstração)

## 1. Observation
- Foram identificados 6 arquivos com literais "carreiro" e cores institucionais fixadas (#0F2B5C e #D4AF37):
  1. `src/app/layout.tsx:18`: `const tenantIdHeader = headersList.get("x-tenant-id") || "carreiro";`
  2. `src/app/admin/auditoria/page.tsx:10, 24, 34, 51`: `const tenantId = "carreiro";`, `bg-[#0F2B5C]`, `border-[#D4AF37]/30`, `REDE CARREIRO AUTOPEÇAS` e `text-[#D4AF37]`.
  3. `src/app/configuracoes/tema/page.tsx:8, 10, 11, 40, 42`: `useState("REDE CARREIRO")`, `useState("#0F2B5C")`, `useState("#D4AF37")`, `bg-[#0F2B5C]` e `text-[#D4AF37]`.
  4. `src/app/api/pedidos/route.ts:60`: `const tenantId = searchParams.get("tenantId") ?? "carreiro";`
  5. `src/app/api/health/route.ts:14`: `tenant: "carreiro"`
  6. `src/components/cockpit/CockpitPrincipal.tsx:144`: `tenantId: "carreiro"` em `useSessionDraft`.
- A execução de `git grep -n "carreiro" src/` antes da intervenção exibia essas 6 ocorrências literais no código da aplicação.
- A execução de `npm run build` gerou com sucesso as páginas estáticas e rotas dinâmicas:
  `✓ Generating static pages (14/14)`
  `Finalizing page optimization ...`
  Exit code 0.
- A execução de `git grep -n "carreiro" src/` após as alterações retornou estritamente:
  `src/app/api/aprendizado/confirmar/route.ts:12:import { ClienteDaxPowerBI } from "@adapters/carreiro/cliente-dax";`
  `src/app/api/aprendizado/confirmar/route.ts:13:import { buscarEntradasCarreiro } from "@adapters/carreiro/entradas-confirmacao";`
  `src/lib/middleware-tenant.ts:36: * Extrai o subdomínio a partir do host (ex: "carreiro.insightd.com.br" -> "carreiro").`
  `src/lib/middleware-tenant.ts:41:  // Remove a porta se houver (ex: "carreiro.localhost:3000" -> "carreiro.localhost")`
  `src/lib/middleware-tenant.ts:52:    // ex: ["carreiro", "insightd", "com", "br"]`
  `src/lib/middleware-tenant.ts:61:  // 2. Tratamento para localhost com subdomínio (ex: "carreiro.localhost")`
  `src/lib/middleware-tenant.ts:78:  // 1. Ordem 1: Query param explícito (?tenant=carreiro) para dev local, CI e Vercel Preview`
  `src/lib/middleware-tenant.ts:85:  // 2. Ordem 2: Subdomínio no hostname (carreiro.insightd.com.br)`
- A execução de `npx vitest run tests/whitelabel/` executou 58 testes com 100% de sucesso (4 arquivos de teste, incluindo `tests/whitelabel/resolucao-dinamica-u0.test.ts`).

## 2. Logic Chain
- Com base nas observações de vazamento no layout, páginas e rotas (`layout.tsx`, `auditoria/page.tsx`, `tema/page.tsx`, `pedidos/route.ts`, `health/route.ts` e `CockpitPrincipal.tsx`), a plataforma exibia o nome e as cores da Rede Carreiro mesmo sem nenhuma variável de ambiente configurada (`TENANT_ATIVO`), violando o Invariante 2 e o Invariante 3.
- Substituiu-se a resolução fixa pelo utilitário canônico `resolverTenantConfigurado()` de `@config/tenants`, que prioriza `process.env.TENANT_ATIVO` e, na ausência ou erro, retorna com segurança `TENANT_PADRAO` (`TENANT_DEMONSTRACAO`, id: `"demonstracao"`, nome: `"Rede Demonstração"`).
- No cabeçalho de auditoria (`src/app/admin/auditoria/page.tsx`), as cores fixas `#0F2B5C` e `#D4AF37` foram substituídas pelo consumo das variáveis CSS `var(--cor-primaria)` e `var(--cor-secundaria)` (injetadas no `<style>` do `:root` pelo layout raiz via `gerarStringCssVarsInline(tenant)`), e o título foi dinamizado para `{tenant.nome.toUpperCase()}`.
- Em `src/components/cockpit/CockpitPrincipal.tsx`, a propriedade `tenantId` do hook `useSessionDraft` passou a receber `tenantAtivo.id` derivado de `obterTenantAtivo()`, garantindo isolamento de sessão por tenant em LocalStorage.
- Adicionou-se uma nova suíte de testes unitários `tests/whitelabel/resolucao-dinamica-u0.test.ts` que valida a resolução do tenant sem variáveis de ambiente, o fallback seguro, a resposta neutra em `/api/health` e as variáveis CSS neutras.
- Todos os 6 invariantes foram estritamente respeitados, sem introdução de refatoração desnecessária nem remoção de testes.

## 3. Caveats
- Outras suítes de teste de unidades subsequentes (como testes de tooltips analíticos e celula-editavel que fazem parte de U2, U3 e U4 em `docs/pontas-soltas.md`) apresentam falhas conhecidas atribuídas a seus respectivos workers e não foram tocadas, respeitando o princípio de isolamento de escopo e os Arquivos de Propriedade Exclusiva de U0.
- A rota `/api/compras/route.ts:49` aceita query param `provedor=CARREIRO`, o que é um identificador de adaptador suportado e não um vazamento de visualização de cliente.

## 4. Conclusion
- A Unidade U0 está plenamente concluída e atende a todos os critérios de aceitação:
  1. `grep -rn "carreiro" src/` retorna unicamente comentários e importações de `@adapters/carreiro`.
  2. A plataforma sobe sem nenhuma variável de ambiente (`.env`), em modo demonstração, com identidade neutra ("Rede Demonstração", paleta sóbria slate/sky).
  3. O cabeçalho de auditoria consome as variáveis CSS inline geradas pelo tenant em vez de hexadecimais fixos.
  4. O build de produção (`npm run build`) compila com sucesso total (exit code 0).
  5. A suíte de testes de whitelabel passa com 58/58 testes verdes.

## 5. Verification Method
Para validar de forma independente:
1. Verificar ausência de literais proibidos no código-fonte:
   ```powershell
   git grep -n "carreiro" src/
   ```
   Confirmar que apenas comentários e imports de `@adapters/carreiro` aparecem.
2. Executar a suíte de testes de whitelabel:
   ```powershell
   npx vitest run tests/whitelabel/
   ```
   Confirmar 4 arquivos e 58 testes passando.
3. Executar o build de produção:
   ```powershell
   npm run build
   ```
   Confirmar compilação com sucesso (exit code 0).
4. Invalidação:
   Qualquer ocorrência de literal `"carreiro"` ou cores `#0F2B5C` / `#D4AF37` no JSX de `src/app/admin/auditoria/page.tsx`, `src/app/configuracoes/tema/page.tsx`, `src/app/layout.tsx`, `src/app/api/health/route.ts` ou `src/app/api/pedidos/route.ts` invalidará esta entrega.

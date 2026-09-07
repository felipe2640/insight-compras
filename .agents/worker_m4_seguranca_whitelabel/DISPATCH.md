## 2026-09-06T17:03:16Z

Você é o worker_m4_seguranca_whitelabel (teamwork_preview_worker).

### Seu Diretório de Trabalho:
c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m4_seguranca_whitelabel\
(Crie este diretório e mantenha nele seus arquivos BRIEFING.md, DISPATCH.md e progress.md).

### Leitura Obrigatória de Requisitos:
1. c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md (leia na íntegra — R4 e R5)
2. c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md (Features #23 a #27)
3. Relatórios dos 3 Explorers (LEIA ANTES DE IMPLEMENTAR):
   - c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m4_rbac_auditoria\handoff.md
   - c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m4_seguranca_sanitizacao\handoff.md (e utilize os artefatos propostos no diretório do agente)
   - c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m4_whitelabel_middleware\handoff.md

### MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Fronteira de Arquivos (Propriedade Exclusiva):
- config/tenants/tipos.ts, config/tenants/carreiro.ts, config/tenants/index.ts
- src/lib/rbac/* (tipos.ts, validador-carteira.ts, index.ts)
- src/lib/auditoria/* (tipos.ts, repositorio-auditoria.ts, index.ts)
- src/lib/seguranca/* (esquemas.ts, sanitizador-dax.ts, headers.ts, index.ts)
- src/lib/middleware-tenant.ts e src/middleware.ts
- tests/seguranca/rbac.test.ts, tests/seguranca/auditoria.test.ts, tests/seguranca/sanitizacao-dax.test.ts
- tests/whitelabel/tenant-carreiro.test.ts, tests/whitelabel/middleware.test.ts

### Tarefas de Implementação:
1. White-Label Dinâmico:
   - Implementar `config/tenants/tipos.ts` com contrato estrito de tenant (paleta de cores Hex e RGB, logos, filiais, assinatura iNSIGHT D e conversor `hexParaRgb`).
   - Implementar `config/tenants/carreiro.ts` com Azul Carreiro `#0F2B5C`, Dourado Carreiro `#D4AF37`, logos e as 5 filiais oficiais (Loja 1 Matriz Pedro II, Loja 2 Piripiri, Loja 3 Poranga, Loja 4 Campo Maior, Loja 5 José de Freitas), e catálogo em `config/tenants/index.ts`.
   - Implementar resolução de subdomínio e injeção de variáveis CSS sem FOUC em `src/lib/middleware-tenant.ts` e `src/middleware.ts`.
2. RBAC Multi-Tenant e Auditoria:
   - Implementar `src/lib/rbac/`: papéis `COMPRADOR` (restrito a `allowedSupplierIds`) e `GESTOR`/`ADMIN` (irrestrito), validação em dupla camada e rejeição server-side 403 Forbidden.
   - Implementar `src/lib/auditoria/`: entidade `AuditoriaPedido`, cálculo de sobrecompras/divergências, trilha append-only e encadeamento criptográfico SHA-256 tamper-evident.
3. Cibersegurança e Prevenção de Injeção:
   - Implementar `src/lib/seguranca/`: esquemas Zod estritos, sanitização agressiva contra injeção DAX/SQL (rejeição de `EVALUATE`, `DEFINE`, `VAR`, `CALCULATE`, `" OR 1=1`, comentários `--`, `//`, `/* */`), isolamento de segredos de Service Principal e cabeçalhos de segurança HTTP (CSP, nosniff, DENY).
4. Suíte de Testes Automatizados:
   - Implementar testes em `tests/seguranca/` e `tests/whitelabel/` cobrindo todos os cenários, ataques de injeção, restrições de carteira e resolução de subdomínios.
5. Executar `npm test` e `npm run build` (`tsc --noEmit`):
   - Comprovar que 100% dos testes prévios (275) continuam passando e todos os novos testes de M4 passam com 0 erros de compilação em `strict: true`.
6. Gravar relatório de handoff em `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m4_seguranca_whitelabel\handoff.md` e notificar o parent via `send_message`.

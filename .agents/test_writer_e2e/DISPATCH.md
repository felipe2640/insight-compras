## 2026-09-06T12:39:32Z
Você é o Test Writer responsável pelo E2E Testing Track da Plataforma de Compras.
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\test_writer_e2e\

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Leia obrigatoriamente antes de iniciar:
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\spec_miner_m0_cockpit\handoff.md

Sua missão:
1. Criar `TEST_INFRA.md` na raiz de `insight-compras` seguindo o template do Project Pattern:
   - Filosofia: Testes Opaque-Box orientados aos requisitos de ORIGINAL_REQUEST.md.
   - Metodologia de 4 Tiers:
     * Tier 1: Cobertura de Features (mínimo 5 testes por feature principal).
     * Tier 2: Casos de Borda e Limite (Boundary Value Analysis).
     * Tier 3: Combinações Entre Features (Pairwise).
     * Tier 4: Cenários Reais de Aplicação (fluxos completos do comprador, transferências, travas e auditoria).
2. Construir o harness e runner de testes E2E em `tests/e2e/`:
   - Casos de teste automatizados em TypeScript com Vitest/Playwright para cada tier.
   - Testes independentes da implementação interna, consumindo apenas as interfaces e contratos documentados em PROJECT.md.
3. Ao concluir a infraestrutura e a bateria de testes de Tiers 1 a 4:
   - Crie `TEST_READY.md` na raiz de `insight-compras` com o resumo de cobertura por tier e o comando para execução.
4. Gere seu relatório final de handoff em: `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\test_writer_e2e\handoff.md`
Atualize seu progress.md e envie mensagem ao orquestrador ao finalizar.

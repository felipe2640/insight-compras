# BRIEFING — 2026-09-06T12:44:00Z

## Mission
Implementar o Marco 1: Fundação Clean Architecture & Core Puro (TypeScript) com domínio, regras de cálculo de demanda, curva ABC, necessidade, balanceamento seguro de transferência, travas críticas e testes unitários com Vitest.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m1_core\
- Original parent: 9953ab24-6d4a-476a-bdf5-d7dd0471ea3f
- Milestone: Marco 1: Fundação Clean Architecture & Core Puro (TypeScript)

## 🔒 Key Constraints
- 100% TypeScript puro em core/, ZERO dependências externas de banco ou UI.
- Algoritmo de transferência seguro: loja doadora SÓ doa se saldoFisico - estoqueMinimo > 0; saldo final da origem jamais fica menor que seu estoque mínimo.
- Trava marca-zumbi: se saldo > 0 e vendas nos últimos 180 dias == 0, sugestão final é OBRIGATORIAMENTE 0.
- Trava família de aplicação: se a soma dos similares da aplicação cobrir o horizonte, bloqueia compra externa.
- Trava lote múltiplo: arredondamento inteligente para múltiplos de fábrica, pares para amortecedores/discos e jogos de 4.
- Testes 100% passando com Vitest, tsc --noEmit limpo sem erros.
- 100% em Português do Brasil (pt-BR): código, comentários, logs e testes.
- Integrity Mandate: lógica genuína, sem hardcode ou fachadas.

## Current Parent
- Conversation ID: 9953ab24-6d4a-476a-bdf5-d7dd0471ea3f
- Updated: 2026-09-06T12:44:00Z

## Task Summary
- **What to build**: package.json, tsconfig.json, vitest.config.ts, core/ (dominio, calculo, transferencia, travas), tests/core/.
- **Success criteria**: npx vitest run 100% aprovado (83/83 testes passando no projeto, 53/53 em tests/core), npx tsc --noEmit sem erros, zero dependências externas no core.
- **Interface contracts**: PROJECT.md, ORIGINAL_REQUEST.md.
- **Code layout**: core/dominio, core/calculo, core/transferencia, core/travas, tests/core.

## Change Tracker
- **Files modified**:
  - `package.json`: Configurado com scripts (build, test, lint), zod, vitest, typescript.
  - `tsconfig.json`: Configurado com strict: true e aliases (@core/*, @adapters/*, @config/*, @/*).
  - `vitest.config.ts`: Configurado com ambiente node e aliases.
  - `core/dominio/`: produto.ts, estoque.ts, historico-vendas.ts, sugestao.ts, transferencia.ts, auditoria.ts, index.ts.
  - `core/calculo/`: demanda-diaria.ts, curva-abc.ts, necessidade.ts, index.ts.
  - `core/transferencia/`: balanceamento.ts, index.ts.
  - `core/travas/`: marca-zumbi.ts, familia-aplicacao.ts, lote-multiplo.ts, index.ts.
  - `core/index.ts`: Ponto de entrada do core puro.
  - `tests/core/`: demanda-diaria.test.ts, transferencia.test.ts, marca-zumbi.test.ts, familia-aplicacao.test.ts, lote-multiplo.test.ts, curva-abc.test.ts, necessidade.test.ts.
- **Build status**: PASS (build, test e lint 100% verdes).
- **Pending issues**: Nenhum.

## Quality Status
- **Build/test result**: 83/83 testes passando (53/53 em tests/core).
- **Lint status**: 0 violações (tsc --noEmit limpo).
- **Tests added/modified**: 7 arquivos de teste unitário completos no Core cobrindo todos os cenários normais e de borda.

## Loaded Skills
- Nenhuma externa carregada.

## Key Decisions Made
- Clean Architecture estrita: core/ possui zero dependências externas; todos os imports são locais internos em core/dominio.
- Garantia de não-desabastecimento em balanceamento.ts: validação em tempo de execução com exceção de integridade caso saldo pós-transferência violasse estoque mínimo.
- Trava de Marca Zumbi: zeramento estrito e auditável com justificativa descritiva no motivo.

## Artifact Index
- .agents/worker_m1_core/DISPATCH.md — Despacho recebido
- .agents/worker_m1_core/progress.md — Heartbeat de progresso
- .agents/worker_m1_core/handoff.md — Relatório de entrega

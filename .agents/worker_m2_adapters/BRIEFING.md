# BRIEFING — 2026-09-06T12:57:50Z

## Mission
Implementação do Marco 2: Camada de Adapters & DAX Carreiro com Cache Resiliente e Mock 25k SKUs para o sistema Insight Compras.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m2_adapters\
- Original parent: 9953ab24-6d4a-476a-bdf5-d7dd0471ea3f
- Milestone: Marco 2 - Camada de Adapters & DAX Carreiro com Cache Resiliente

## 🔒 Key Constraints
- 100% em Português do Brasil (pt-BR) na documentação, comentários e mensagens.
- Integridade total: sem hardcoded test results, mocks falsificados ou facadas ingênuas.
- `adapters/` consome `core/` mas `core/` NÃO importa nada de `adapters/`.
- TypeScript strict: true com 0 erros de compilação.
- Cache multinível: L1 (LRU em memória) + L2 (Snapshot local Stale-While-Revalidate) + Circuit Breaker (3 falhas consecutivas) + Singleflight (request collapsing).
- Mock com 25.000+ SKUs estocástico e determinístico, obedecendo regras de negócio (Pareto, picapes 35%, marcas zumbis, transferências, rupturas, NFes do dia).
- Todos os testes unitários e de integração devem passar via `npm test`.

## Current Parent
- Conversation ID: 9953ab24-6d4a-476a-bdf5-d7dd0471ea3f
- Updated: 2026-09-06T12:57:50Z

## Task Summary
- **What to build**:
  1. `adapters/AdaptadorInventario.ts` (Interface `InventoryAdapter` e tipos DTOs)
  2. `adapters/carreiro/cliente-dax.ts` (Cliente Fabric REST API com OAuth2 e fallback)
  3. `adapters/carreiro/consultas-homologadas.ts` (DAX queries do Carreiro)
  4. `adapters/carreiro/mapeador-dax.ts` (Mapeador DAX -> entidades e VOs do Core)
  5. `adapters/carreiro/cache-resiliente.ts` (Cache L1 + L2 + Circuit Breaker + Singleflight)
  6. `adapters/carreiro/adaptador-carreiro.ts` (Implementação real do adaptador Carreiro)
  7. `adapters/mock/gerador-sintetico.ts` (Gerador estocástico determinístico 25k+ SKUs)
  8. `adapters/mock/adaptador-mock.ts` (Adaptador Mock em memória)
  9. `adapters/index.ts` (Factory canônica `obterAdaptadorInventario`)
  10. Testes em `tests/adapters/`: `cache-resiliente.test.ts`, `mock-25k.test.ts`, `mapeador-dax.test.ts`, `adaptador-carreiro.test.ts`
- **Success criteria**:
  - `npm test` passa com 174 testes (22 arquivos) com 100% de sucesso
  - `npx tsc --noEmit` passa com zero erros em `strict: true`
  - Mock de 25k gera em < 500ms e filtra em < 250ms
  - Clean Architecture: `adapters/` consome `core/`, mas `core/` não tem dependência reversa
- **Interface contracts**: PROJECT.md e worker_m1_core/handoff.md
- **Code layout**: c:\Users\Felipe Barbosa\Documents\insight-compras\

## Change Tracker
- **Files modified/created**:
  - `adapters/AdaptadorInventario.ts`: Interface canônica unificada e DTOs
  - `adapters/carreiro/cliente-dax.ts`: Cliente HTTP com OAuth2 e normalização de colunas
  - `adapters/carreiro/consultas-homologadas.ts`: Consultas DAX oficiais da Carreiro
  - `adapters/carreiro/mapeador-dax.ts`: Normalizador e conversor para entidades do Core
  - `adapters/carreiro/cache-resiliente.ts`: Gerenciador L1/L2, Singleflight e Circuit Breaker
  - `adapters/carreiro/adaptador-carreiro.ts`: Implementação concreta de `InventoryAdapter`
  - `adapters/mock/gerador-sintetico.ts`: Gerador determinístico de 25.000 SKUs (Pareto, picapes, zumbis, transferências)
  - `adapters/mock/adaptador-mock.ts`: Implementação mock em memória com busca < 250ms
  - `adapters/index.ts`: Ponto de entrada canônico e fábrica `obterAdaptadorInventario`
  - `tests/adapters/cache-resiliente.test.ts`: Testes unitários do cache e circuit breaker
  - `tests/adapters/mock-25k.test.ts`: Testes de escala 25k SKUs e anomalias
  - `tests/adapters/mapeador-dax.test.ts`: Testes unitários do mapeador e normalizador DAX
  - `tests/adapters/adaptador-carreiro.test.ts`: Testes do cliente HTTP, adaptador Carreiro e fábrica
- **Build status**: PASS (0 erros de compilação em `npx tsc --noEmit`)
- **Pending issues**: Nenhum

## Quality Status
- **Build/test result**: 22 arquivos de teste passaram, 174 testes passaram (100% sucesso)
- **Lint status**: 0 erros (`tsc --noEmit`)
- **Tests added/modified**: 4 arquivos de testes e 29 novos testes adicionados em `tests/adapters/`

## Loaded Skills
- Nenhuma skill externa requerida além do conjunto nativo.

## Key Decisions Made
- Implementação de LRU Cache em memória puro (O(1)) sem dependências externas adicionais.
- Algoritmo Mulberry32 determinístico com seed=42 para geração de 25.000 SKUs reproduzíveis em menos de 350ms.
- Circuit Breaker desacoplado e integrado com estados FECHADO, ABERTO e MEIO_ABERTO.
- Sanitização rigorosa de listas numéricas para cláusula IN do DAX protegendo contra injeção.

## Artifact Index
- `adapters/AdaptadorInventario.ts` — Contratos canônicos de adaptador
- `adapters/carreiro/` — Adaptador DAX Power BI Fabric e resiliência
- `adapters/mock/` — Gerador sintético 25k e adaptador mock
- `adapters/index.ts` — Ponto de entrada canônico e fábrica
- `tests/adapters/` — Suíte completa de testes da camada de adaptadores
- `handoff.md` — Relatório final de handoff

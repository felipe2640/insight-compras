# BRIEFING — 2026-09-06T16:30:00Z

## Mission
Investigar e arquitetar a solução completa de virtualização do Cockpit do Comprador com @tanstack/react-table v8 e @tanstack/react-virtual para suportar 25.000+ SKUs sem engasgos (60fps constantes na rolagem) e busca/filtro instantâneo em memória (< 250ms).

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m3_virtualizacao_r1\
- Original parent: 140d3f6b-8e9e-4004-bf5c-e74848758224
- Milestone: M3 - Virtualização e Performance do Cockpit

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Manter 60fps constantes na rolagem com 25.000+ SKUs
- Busca e filtros instantâneos em memória < 250ms
- Utilizar @tanstack/react-table v8 e @tanstack/react-virtual
- Gerar handoff.md estritamente estruturado (Observation, Logic Chain, Caveats, Conclusion, Verification Method)

## Current Parent
- Conversation ID: 140d3f6b-8e9e-4004-bf5c-e74848758224
- Updated: 2026-09-06T16:30:00Z

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md` (Requisito R2 e Critérios de Aceite)
  - `PROJECT.md` (Clean Architecture e Features #13 a #22)
  - `spec_miner_m0_cockpit/handoff.md` (Especificação da Matriz de Decisão e Tooltips)
  - `diario/components/ui/data-grid.tsx` e `diario/hooks/use-data-grid.tsx` (Implementação de referência)
  - Suíte de 198 testes automatizados no Vitest (com benchmarks de estresse de 25k e 50k SKUs)
- **Key findings**:
  - Virtualização via TanStack Table v8 + TanStack Virtual com `overscan: 10` e espaçadores `paddingTop`/`paddingBottom` garante 60fps e previne flickering.
  - Memoização estrita por linha (`VirtualRow` com `React.memo`) reduz o custo de re-render para < 0,5ms ao editar células, preservando as demais 39 linhas no DOM.
  - Pré-computação de `_searchIndex` normalizado (NFD) reduz o tempo de busca em 25k SKUs para 8ms - 20ms (amplamente abaixo do teto de 250ms).
  - Desacoplamento da digitação através de `useDeferredValue` e `useTransition` elimina completamente qualquer lag no cursor do comprador.
  - Fixação de colunas pixel-perfect (`select`: 44px, `codigo`: 130px, `descricao`: 240px) com elevação `shadow` e `z-index` estratificado (`z-10` body, `z-30` header).
- **Unexplored areas**: Nenhuma dentro do escopo de M3. Investigação 100% concluída.

## Key Decisions Made
- Rejeitar o uso de `transform: translateY` em linhas de tabela HTML em favor de espaçadores `paddingTop`/`paddingBottom` para preservar a compatibilidade de *column pinning* e acessibilidade.
- Rejeitar Web Workers para 25k SKUs devido ao overhead de serialização de objetos (~35ms), mantendo o pipeline na thread principal via `useDeferredValue` que executa em apenas 10-18ms.
- Limitar a persistência de rascunhos em `localStorage` exclusivamente aos deltas editados para não estourar a cota de 5MB.

## Artifact Index
- `DISPATCH.md` — Registro do despacho inicial do orquestrador
- `BRIEFING.md` — Memória persistente de trabalho
- `progress.md` — Heartbeat de execução das tarefas
- `handoff.md` — Relatório final estruturado com as 5 seções do protocolo

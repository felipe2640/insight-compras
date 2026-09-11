# BRIEFING — 2026-09-11T16:50:00Z

## Mission
Resolver a Unidade U6 (Régua do motor: E1 -> E2 -> E3) alinhando sem histórico na loja em foco para não medido com validação dos 4 efeitos colaterais, implementando detecção de lote por histograma com precedência ERP > Histograma > Vocabulário, e elegibilidade avaliada em 12 meses (Notas12m) com salvaguarda contra truncamento DAX.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_u6_regua_motor
- Original parent: dba28047-346c-4f0c-a93a-1fb8c01aa8d1
- Milestone: U6 - Régua do motor

## 🔒 Key Constraints
- Invariante 1: Zero não é o mesmo que não medido. Usar camposIndisponiveis e travessão —. Nunca preencher com zero dados ausentes.
- Invariante 2: A plataforma sobe sem nenhuma variável de ambiente.
- Invariante 3: Nenhum nome de rede real no código genérico.
- Invariante 4: Infraestrutura entra por porta.
- Invariante 5: Não remover teste para ficar verde.
- Invariante 6: Mensagens de commit e comentários em português.
- Sequência estrita: E1 primeiro, depois E2, depois E3.
- Medir e conferir os 4 efeitos colaterais de E1: ordenação, filtro por faixa, contagem dos chips e conteúdo exportado.
- Precedência de lote em E2: ERP > Histograma > Vocabulário.
- Salvaguarda DAX em E3: Proteger contra truncamento silencioso de payload mantendo contagem contra COUNTROWS e paginação por cursor.
- Integridade: Não criar implementações dummy/facade ou hardcoded.

## Current Parent
- Conversation ID: dba28047-346c-4f0c-a93a-1fb8c01aa8d1
- Updated: not yet

## Task Summary
- **What to build**:
  1. E1: src/lib/cockpit/gerador-linhas-matriz.ts - Tratar loja sem histórico como não medido (null/travessão/camposIndisponiveis) em vez de 0. Validar ordenação, filtros por faixa, contagem de chips e exportação.
  2. E2: Lote por histograma a partir de NOTAS_ITEMS[NQTDE] em adapters/carreiro e core/travas/lote-multiplo.ts, com precedência ERP > Histograma > Vocabulário.
  3. E3: Elegibilidade avaliada em 12 meses (Notas12m) em adapters/carreiro/consultas-homologadas.ts e mapeadores, mantendo salvaguarda contra truncamento de DAX.
- **Success criteria**:
  - Testes passando e build passando (npm run build).
  - 4 efeitos colaterais de E1 validados e testados.
  - Precedência de lote respeitada e testada com dados reais/histograma.
  - Notas12m implementado com salvaguarda de paginação/truncamento DAX.
- **Interface contracts**: PROJECT.md, docs/salvaguarda-bi-cliente.md, docs/pontas-soltas.md
- **Code layout**: src/, core/, adapters/, tests/

## Key Decisions Made
- Executar em sequência estrita E1 -> E2 -> E3 para evitar mascaramento de efeitos colaterais.

## Artifact Index
- .agents/worker_u6_regua_motor/DISPATCH.md — Assignment and constraints
- .agents/worker_u6_regua_motor/BRIEFING.md — Working memory and context
- .agents/worker_u6_regua_motor/progress.md — Liveness and progress tracking
- .agents/worker_u6_regua_motor/handoff.md — Final handoff report

## Change Tracker
- **Files modified**: Nenhum ainda
- **Build status**: Não iniciado
- **Pending issues**: Nenhum

## Quality Status
- **Build/test result**: Pendente
- **Lint status**: Pendente
- **Tests added/modified**: Pendente

## Loaded Skills
- Nenhuma skill externa carregada

# BRIEFING — 2026-09-11T21:11:16Z

## Mission
Executar sequencialmente a Unidade U6 (Régua do motor: E1 -> E2 -> E3):
1. E1: Sem histórico na loja em foco em src/lib/cockpit/gerador-linhas-matriz.ts vira não medido (não zero), medindo e validando os 4 efeitos colaterais (ordenação, filtro por faixa, contagem dos chips e conteúdo exportado).
2. E2: Lote vem do dado por histograma (precedência ERP > Histograma > Vocabulário).
3. E3: Elegibilidade avaliada em 12 meses (Notas12m), conferindo contra truncamento silencioso de DAX.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_u6_regua_motor_r1
- Original parent: dba28047-346c-4f0c-a93a-1fb8c01aa8d1
- Milestone: U6 — Régua do motor

## 🔒 Key Constraints
- Invariante 1: Zero não é o mesmo que não medido. Usar camposIndisponiveis e travessão —. Nunca preencher com zero dados ausentes.
- Invariante 2: A plataforma sobe sem nenhuma variável de ambiente.
- Invariante 3: Nenhum nome de rede real no código genérico.
- Invariante 4: Infraestrutura entra por porta.
- Invariante 5: Não remover teste para ficar verde.
- Invariante 6: Mensagens de commit e comentários em português.
- Sequência estrita: E1 primeiro, depois E2, depois E3.
- E1: Validar e testar os 4 efeitos colaterais (ordenação, filtro por faixa, contagem de chips, exportação).
- E2: Precedência de lote ERP > Histograma > Vocabulário.
- E3: Elegibilidade em 12 meses (Notas12m) com salvaguarda contra truncamento DAX (COUNTROWS + paginação por cursor).
- Integridade: Proibido hardcoding, facades ou atalhos. Auditoria forense independente validará.

## Current Parent
- Conversation ID: dba28047-346c-4f0c-a93a-1fb8c01aa8d1
- Updated: not yet

## Task Summary
- **What to build**:
  - E1: `src/lib/cockpit/gerador-linhas-matriz.ts` — campos de vendas, consumo e notas sem histórico na loja em foco viram `null` / não medido. Atualizar e testar ordenação, filtros por faixa, contadores de chips e exportação.
  - E2: Mapeamento de lote via `detectarLotePorHistograma` com precedência ERP > Histograma > Vocabulário.
  - E3: Elegibilidade avaliada em 12 meses com `Notas12m` na consulta DAX e modelo de domínio, respeitando limite de bytes de DAX e paginação.
- **Success criteria**:
  - E1, E2, E3 concluídos e testados.
  - Todos os testes passando (`npm test` / vitest).
  - Build sem erros (`npm run build`).
- **Interface contracts**: PROJECT.md, docs/salvaguarda-bi-cliente.md, docs/pontas-soltas.md
- **Code layout**: src/, core/, adapters/, tests/

## Key Decisions Made
- E1: Substituído fallback `?? 9999` por `?? undefined` com `sortUndefined: "last"` em `colunas-cockpit.tsx` para garantir que valores não medidos fiquem no final da tabela tanto na ordenação ascendente quanto descendente.
- E1: Garantido que `montarTabelaExportacao` e `gerarCsv`/`gerarXlsx` preservem `null` como string vazia (sem '0' inventado) respeitando Invariante 1.
- E2: Implementada detecção de lote via histograma em DAX (`LoteDetectado`) com os mesmos parâmetros do domínio (candidatos 12, 10, 8, 6, 5, 4, 3, 2; dominância >= 0.70; mínimo 8 linhas).
- E2: Precedência estrita aplicada no mapeador: ERP (`loteCadastradoErp`) > Histograma (`loteDetectadoHistograma`) > Vocabulário (`inferirLotePadraoPorCategoria`).
- E3: Homologado `Notas12m` na consulta DAX (`CALCULATE([Quantidade de Notas], Periodo365d)`) e no motor (`notasFiscaisVenda12meses`), substituindo o critério provisório de 90 dias.
- E3: Criada salvaguarda com `COUNTROWS` (`gerarConsultaDaxContagemHistoricoVendas`) para detecção de truncamento de bytes antes da execução paginada.

## Artifact Index
- .agents/worker_u6_regua_motor_r1/DISPATCH.md — Assignment and constraints
- .agents/worker_u6_regua_motor_r1/BRIEFING.md — Working memory and context
- .agents/worker_u6_regua_motor_r1/progress.md — Liveness and progress tracking
- .agents/worker_u6_regua_motor_r1/handoff.md — Final handoff report
- tests/cockpit/regua-motor-e1.test.ts — Testes unitários para E1 e os 4 efeitos colaterais
- tests/adapters/regua-motor-e2-e3.test.ts — Testes unitários para E2 e E3

## Change Tracker
- **Files modified**:
  - `core/dominio/historico-vendas.ts`: Adicionado campo `loteDetectadoHistograma` na interface `HistoricoVendasFilial`.
  - `src/lib/cockpit/gerador-linhas-matriz.ts`: Extração de lote via histograma, verificação estrita de disponibilidade de campos sem histórico (transformando vendas, consumo e notas em `null`), e fallback defensivo para `carga.similares`.
  - `src/components/cockpit/colunas-cockpit.tsx`: `sortUndefined: "last"` e accessor com `undefined` em `vendaACadaDias`, `cobertura` e `diasSemVenda`.
  - `adapters/carreiro/consultas-homologadas.ts`: Adicionado `Notas12m`, `LoteDetectado` e consulta `COUNTROWS` de auditoria.
  - `adapters/carreiro/mapeador-dax.ts`: Precedência ERP > Histograma > Vocabulário e mapeamento de `loteDetectadoHistograma` e `notasFiscaisVenda12meses`.
  - `adapters/carreiro/adaptador-carreiro.ts`: Propagação do mapa de lotes por produto para `mapearProdutosDax`.
  - `tests/cockpit/regua-motor-e1.test.ts`: Suíte de testes para E1 e 4 efeitos colaterais.
  - `tests/adapters/regua-motor-e2-e3.test.ts`: Suíte de testes para E2 e E3.
- **Build status**: PASS (Next.js 14.2.24 compilação limpa, exit code 0)
- **Pending issues**: Nenhum

## Quality Status
- **Build/test result**: 68 test files passed, 894 tests passed (0 failures). Build Next.js com sucesso.
- **Lint status**: Zero erros de tipo TypeScript ou linting no build.
- **Tests added/modified**: 2 novas suítes de teste cobrindo 100% de E1, E2, E3 e seus efeitos colaterais.

## Loaded Skills
- Nenhuma skill externa carregada

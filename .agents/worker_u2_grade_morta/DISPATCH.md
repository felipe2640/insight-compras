# DISPATCH — Worker U2 (Grade Paralela e Eliminação da Árvore Morta)

## Missão
Resolver integralmente a Unidade U2 conforme `ORIGINAL_REQUEST.md` (seção `## 2026-09-11T16:16:15Z`, item `## U2. Grade paralela`) e `docs/pontas-soltas.md` (Grupo C).

## Caminho do Requisito Original
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md`

## Invariantes Obrigatórios
1. Zero não é o mesmo que não medido.
2. A plataforma sobe sem nenhuma variável de ambiente.
3. Nenhum nome de rede real no código genérico.
4. Infraestrutura entra por porta.
5. **Não remover teste para ficar verde.** A contagem de testes pode cair em U2 porque os testes que cobriam código morto saem ou são reapontados para a árvore viva, MAS toda remoção deve ser documentada com justificativa clara no commit e no handoff.
6. Mensagens de commit e comentários em português.

## Arquivos de Propriedade Exclusiva
- `src/components/cockpit/GridCockpitVirtualizado.tsx` (remover após comparar)
- `src/components/cockpit/baseColumns.tsx` (remover após comparar)
- `src/components/cockpit/colunas-cockpit.tsx` (árvore viva — migrar comportamentos se baseColumns tiver algo que falte)
- `src/components/cockpit/index.ts` (limpar exports mortos)
- `src/components/tooltips/TooltipNfeDoDia.tsx` (converter para o primitivo com portal/painel ou limpar)
- `tests/cockpit/virtualizacao-grid.test.tsx` (apontar para a árvore viva ou ajustar)
- `tests/e2e/tier1-features/cockpit-matriz.test.ts` (apontar para a árvore viva)
- `tests/cockpit/` (ajustes nos testes de tooltips/grid afetados pela árvore viva)

## Tarefas Específicas
1. **Comparar as duas definições de coluna**:
   Comparar `src/components/cockpit/baseColumns.tsx` com `src/components/cockpit/colunas-cockpit.tsx`. Se `baseColumns.tsx` possuir alguma coluna, tooltip, formatação ou comportamento ausente em `colunas-cockpit.tsx`, migre para `colunas-cockpit.tsx` antes de deletar.
2. **Remover a árvore morta**:
   Excluir `GridCockpitVirtualizado.tsx` e `baseColumns.tsx`.
   Limpar `src/components/cockpit/index.ts` para exportar apenas os componentes e tipos da árvore viva (`CockpitPrincipal`, `colunas-cockpit`, etc.).
3. **Ajustar `TooltipNfeDoDia.tsx`**:
   O `TooltipNfeDoDia.tsx` é o único tooltip que ainda desenha painel como `div` absoluto em vez de portal (`src/components/ui/tooltip.tsx` com `variante="painel"`). Converta-o para portal/painel compatível com o design system, eliminando recorte de `overflow-hidden`.
4. **Reapontar ou justificar testes**:
   Reapontar `tests/cockpit/virtualizacao-grid.test.tsx` e `tests/e2e/tier1-features/cockpit-matriz.test.ts` para testar a árvore viva (`CockpitPrincipal` / `colunas-cockpit.tsx`).
5. **Verificar Compilação e Testes**:
   Garantir `npm run build` e `npx vitest run tests/cockpit/ tests/e2e/tier1-features/cockpit-matriz.test.ts` passando 100%.

## Aviso Obrigatório de Integridade
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-11T16:33:04Z
Você é o Worker responsável pela Unidade U2 (Grade paralela e eliminação da árvore morta).
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_u2_grade_morta
Leia atentamente DISPATCH.md em seu diretório e ORIGINAL_REQUEST.md em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute:
1. Comparar baseColumns.tsx com colunas-cockpit.tsx para assegurar que nenhum comportamento útil seja perdido.
2. Remover a árvore morta (GridCockpitVirtualizado.tsx, baseColumns.tsx) e limpar exports de src/components/cockpit/index.ts.
3. Converter TooltipNfeDoDia.tsx para usar portal/painel compatível com design system, evitando corte por overflow.
4. Ajustar/reapontar testes tests/cockpit/virtualizacao-grid.test.tsx e tests/e2e/tier1-features/cockpit-matriz.test.ts para a árvore viva.
5. Rodar testes e npm run build.

## 2026-09-11T16:47:32Z
**Context**: Acompanhamento de progresso da Unidade U2 (Grade Paralela e Eliminação da Árvore Morta).
**Content**: O orquestrador está monitorando o andamento das unidades. U0, U1, U3 e U7 já foram concluídas com sucesso. Como está o andamento da comparação de colunas, remoção dos arquivos mortos e ajuste dos testes na U2?
**Action**: Responder com o status atual da execução e próximos passos para entrega do handoff.md.

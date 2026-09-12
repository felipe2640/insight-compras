# Progresso — Worker U6 (Régua do Motor — r1)

Last visited: 2026-09-11T21:28:00Z

## Status Geral: Concluído com Sucesso (E1 -> E2 -> E3)

### Etapas de Execução:
- [x] 1. Investigação aprofundada do código atual (E1, E2, E3) e baseline de testes
- [x] 2. Execução E1: "Sem histórico na loja em foco" vira não medido (`null`/travessão `—`) em `src/lib/cockpit/gerador-linhas-matriz.ts`
- [x] 3. Validação E1: Medir e conferir os 4 efeitos colaterais:
  - (1) Ordenação (`sortUndefined: "last"` em `colunas-cockpit.tsx`)
  - (2) Filtro por faixa (rejeição de `null` em `compararNumerico`)
  - (3) Contagem dos chips/badges (itens não medidos não entram em Ruptura ou Marca Zumbi)
  - (4) Conteúdo exportado (CSV com campo em branco delimitado por `;`, XLSX sem converter `null` em 0)
- [x] 4. Execução E2: Lote vem do dado por histograma (`detectarLotePorHistograma` com `NOTAS_ITEMS[NQTDE]`), respeitando estritamente a precedência ERP > Histograma > Vocabulário (`mapeador-dax.ts` e `adaptador-carreiro.ts`)
- [x] 5. Execução E3: Elegibilidade avaliada em 12 meses (`Notas12m` na consulta homologada DAX e motor, não 90 dias) com salvaguarda contra truncamento silencioso de DAX (`COUNTROWS` + paginação por cursor)
- [x] 6. Rodar suíte completa de testes (`68 files, 894 tests passed`) e `npm run build` (sucesso 0 erros)
- [x] 7. Elaborar relatório handoff.md e notificar o orquestrador via send_message

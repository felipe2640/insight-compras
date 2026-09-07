## 2026-09-06T16:31:34Z
Você é o worker_m3_cockpit (teamwork_preview_worker).

### Seu Diretório de Trabalho:
c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m3_cockpit\
(Crie este diretório e mantenha nele seus arquivos BRIEFING.md, DISPATCH.md e progress.md).

### Leitura Obrigatória de Requisitos:
1. c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md (leia na íntegra — R2 e critérios de aceitação)
2. c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md (Feature Inventory #13 a #22)
3. Relatórios de Handoff dos Exploradores (LEIA OS TRÊS ANTES DE ESCREVER CÓDIGO):
   - c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m3_virtualizacao_r1\handoff.md (Arquitetura do Grid Virtualizado, TanStack Table + Virtual, memoização VirtualRow, busca indexada em memória < 250ms, filtros de facetas)
   - c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\spec_miner_m3_tooltips_r1\handoff.md (Definição da matriz baseColumns, 11 colunas primárias, 5 Tooltips Analíticos Ricos instantâneos delayDuration={0} e diálogo de similares)
   - c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m3_interacao_r1\handoff.md (Célula editável EditableCell com múltiplos/pares e teclas Tab/Enter/Escape, useSessionDraft lean delta-only e BannerRascunho)

### MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Fronteira de Arquivos (Propriedade Exclusiva):
- package.json
- tsconfig.json e vitest.config.ts (se necessário para JSX/React/testes)
- src/tipos/cockpit.ts (ou src/components/cockpit/tipos.ts)
- src/components/cockpit/* (GridCockpitVirtualizado, VirtualRow, baseColumns, EditableCell, BannerRascunho, BarraFiltrosCockpit, index.ts)
- src/components/tooltips/* (TooltipRuptura, TooltipFrequencia, TooltipCobertura, TooltipTransferencia, TooltipNfeDoDia, DialogSimilares, index.ts)
- src/hooks/* (useSessionDraft.ts, useFiltrosCockpit.ts, index.ts)
- tests/cockpit/* (testes com Vitest cobrindo virtualização, busca < 250ms, 5 tooltips, EditableCell e useSessionDraft)

### Tarefas de Implementação:
1. Instalar dependências necessárias se ainda não presentes (ex: @tanstack/react-table, @tanstack/react-virtual, react, react-dom, @types/react, @types/react-dom, ou mocks/shims compatíveis se necessário) e configurar suporte a JSX no tsconfig.json / vitest.config.ts.
2. Implementar a tipagem canônica do Cockpit em src/tipos/cockpit.ts integrando os tipos do core/ e adapters/.
3. Implementar os 5 Tooltips Analíticos Ricos em src/components/tooltips/:
   - TooltipRuptura (dias zerados, taxa %, severidade, perda estimada em R$)
   - TooltipFrequencia (vendas vs devoluções com verde/vermelho, notas líquidas, % 90d)
   - TooltipCobertura (janelas 30d/90d/180d, tendência e alerta de Marca Zumbi)
   - TooltipTransferencia (origem, sobra real saldo - minStock > 0, destino, motivo)
   - TooltipNfeDoDia (alerta visual vermelho, NF-e, fornecedor, quantidade recebida hoje, data)
   - DialogSimilares (diálogo de peças equivalentes com saldo na rede)
4. Implementar EditableCell e useSessionDraft:
   - EditableCell: navegação Tab/Shift+Tab, Enter confirma/blur, Escape restaura, sanitização contra negativos/letras, arredondamento automático para múltiplos de fábrica/pares com feedback visual (#FFFFCC).
   - useSessionDraft: chave multi-tenant insight-compras-draft-${tenantId}-${userId}, debounce 1500ms-2000ms, payload enxuto delta-only (< 50KB para 25k itens), tratamento de QuotaExceededError, TTL 1h e BannerRascunho.
5. Implementar a matriz baseColumns e o GridCockpitVirtualizado:
   - TanStack Table v8 + TanStack Virtual com estimateSize: 48, overscan: 10, espaçadores paddingTop/paddingBottom.
   - VirtualRow memoizado com React.memo e comparador estrito.
   - Colunas fixadas (sticky) para Código e Descrição com z-index e bordas.
   - Motor de busca indexado em memória (< 250ms para 25.000 SKUs) com tokens minúsculos sem acentos e useDeferredValue/useTransition.
   - Filtros categóricos em O(1) com Set<string>.
6. Criar suíte completa de testes em tests/cockpit/ cobrindo todos os cenários, regras e limites.
7. Executar npm test e npm run build (tsc --noEmit) comprovando que TODOS os 198+ testes anteriores continuam passando e os novos testes de cockpit passam com 0 erros de compilação TypeScript em strict: true.
8. Escrever handoff.md em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m3_cockpit\handoff.md e notificar o orquestrador (parent) via send_message.

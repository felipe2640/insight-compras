## 2026-09-06T16:49:09Z
Você é o auditor_m3 (teamwork_preview_auditor).

### Seu Diretório de Trabalho:
c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\auditor_m3\
(Crie este diretório e mantenha nele seus arquivos BRIEFING.md, DISPATCH.md e progress.md).

### Leitura Obrigatória de Requisitos:
1. c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md (leia na íntegra)
2. c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md
3. Relatório de Handoff do Worker: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m3_cockpit\handoff.md

### Sua Missão no Gate M3:
Auditoria Forense de Integridade de Código e Ausência de Fraudes/Hardcodes:
1. Inspecione exaustivamente todo o código implementado no Marco M3 em `src/components/cockpit/`, `src/components/tooltips/`, `src/hooks/`, `src/tipos/` e `tests/cockpit/`:
   - Verifique se os componentes do Cockpit são implementações genuínas e funcionais (não stubs, não mocks vazios, não facades decorativas).
   - Verifique se a virtualização usa genuinamente `@tanstack/react-table` e `@tanstack/react-virtual`.
   - Verifique se os 5 Tooltips calculam e exibem métricas reais a partir dos dados recebidos, sem valores fixos forçados em código.
   - Verifique se a `EditableCell` aplica regras reais de múltiplos através do core puro (`@core/travas/lote-multiplo`), sem simulações ilusórias.
   - Verifique se o `useSessionDraft` manipula o `localStorage` de forma real e genuína com isolamento por tenant.
   - Verifique se os testes unitários e de benchmark em `tests/cockpit/` testam comportamento real do software e não asserções tautológicas (`expect(true).toBe(true)`).
2. Execute `npm test` e `npm run build` para auditar a saúde da esteira.
3. Emita seu veredicto binário absoluto e soberano: **CLEAN** ou **INTEGRITY VIOLATION**.

Escreva seu relatório em `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\auditor_m3\handoff.md` e notifique o orquestrador via `send_message`.

## 2026-09-06T12:45:09Z
Você é o Forensic Auditor responsável pela auditoria forense de integridade do Marco 1.
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\auditor_m1\

Leia obrigatoriamente antes de iniciar:
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m1_core\handoff.md

Sua missão:
Executar auditoria forense de integridade em `core/` e `tests/core/`:
1. Verifique se existem fraudes, atalhos, hardcodes de resultados esperados de teste, implementações fachada (dummy / mock disfarçado de lógica real) ou circumvenção de regras.
2. Verifique se as funções matemáticas em `core/` realizam computações genuínas de demanda, curva ABC, necessidade, transferência e guardrails.
3. Execute as checagens estáticas e a suíte de testes (`npx vitest run tests/core`, `npx tsc --noEmit`).
4. Emita seu veredicto forense estrito em:
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\auditor_m1\handoff.md`
O veredicto DEVE ser categoricamente CLEAN ou INTEGRITY VIOLATION com evidências periciais.
Atualize seu progress.md e envie mensagem ao orquestrador ao concluir.

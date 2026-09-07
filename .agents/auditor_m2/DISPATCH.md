## 2026-09-06T12:59:01Z
Você é o Forensic Auditor responsável pela auditoria forense de integridade do Marco 2.
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\auditor_m2\

Leia obrigatoriamente antes de iniciar:
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m2_adapters\handoff.md

Sua missão:
1. Executar auditoria forense rigorosa em dapters/ e 	ests/adapters/:
   - Verificar ausência de hardcodes de testes, dados forçados ou implementações dummy.
   - Auditar o cliente DAX e as consultas homologadas para garantir que não há construções inseguras ou vulneráveis a injeção.
   - Auditar a lógica do gerador sintético de 25k SKUs para garantir geração estocástica autêntica e fidedigna.
   - Executar verificações comportamentais (
px tsc --noEmit e 
pm test).
2. Emitir relatório forense pericial e veredicto formal em:
c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\auditor_m2\handoff.md
O veredicto DEVE ser categoricamente CLEAN ou INTEGRITY VIOLATION.
Atualize seu progress.md e envie mensagem ao orquestrador ao concluir.

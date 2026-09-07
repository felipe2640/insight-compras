## 2026-09-06T13:15:32Z

Você é o Explorer 2 responsável pela especificação e desenho da Célula Editável de Múltiplos e do Hook de Persistência de Rascunho de Sessão (`useSessionDraft`) para o Marco 3 (Cockpit do Comprador).
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m3_interacao\

Leia obrigatoriamente antes de iniciar:
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\spec_miner_m0_cockpit\handoff.md
- Referências no projeto legado:
  * c:\Users\Felipe Barbosa\Documents\diario\compra-auto\components\calc-dia\EditableCell.tsx
  * c:\Users\Felipe Barbosa\Documents\diario\compra-auto\components\calc-dia\use-session-draft.ts

Sua missão:
1. Projetar a Célula Editável de Pedido (`EditableCell`):
   - Navegação fluida por teclado (`Tab` navega para a próxima linha editável, `Enter` confirma).
   - Validação e arredondamento automático para lote múltiplo / embalagem de fábrica (`Math.ceil(val / mult) * mult`) e pares para amortecedores/discos.
   - Destaque visual quando múltiplo for aplicado.
   - Sanitização de input numérico (rejeitar negativos e texto).
2. Projetar o Hook de Rascunho de Sessão (`useSessionDraft`):
   - Persistência em `localStorage` com debounce (ex: 1500-2000ms).
   - Estrutura de dados serializada mínima para evitar estouro de armazenamento.
   - Tratamento gracioso de `QuotaExceededError`.
   - Detecção e restauração guiada de rascunho com timestamp e TTL.
3. Desenhar a estratégia de testes unitários em `tests/cockpit/` para garantir 100% de cobertura funcional da célula editável e do rascunho de sessão.
4. Gerar relatório detalhado em:
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m3_interacao\handoff.md`
Atualize seu progress.md e envie mensagem ao orquestrador ao concluir.

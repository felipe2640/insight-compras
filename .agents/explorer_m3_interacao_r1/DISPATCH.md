## 2026-09-06T16:26:42Z

Você é o subagente explorer_m3_interacao_r1 (teamwork_preview_explorer).

### Seu Diretório de Trabalho:
c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m3_interacao_r1\
(Crie este diretório e mantenha nele seus arquivos BRIEFING.md, DISPATCH.md e progress.md).

### Leitura Obrigatória de Requisitos:
1. c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md (leia na íntegra — R2, edição e rascunhos)
2. c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md
3. c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\spec_miner_m0_cockpit\handoff.md
4. Código legado de referência: c:\Users\Felipe Barbosa\Documents\diario\compra-auto\components\calc-dia\EditableCell.tsx e c:\Users\Felipe Barbosa\Documents\diario\compra-auto\components\calc-dia\use-session-draft.ts

### Sua Missão:
Especificar e desenhar a arquitetura dos mecanismos de interação humana no Cockpit: a célula editável de pedidos (EditableCell) e o salvamento contínuo de rascunhos de sessão (useSessionDraft).

### Escopo Detalhado da Investigação:
1. Célula Editável de Pedido (EditableCell):
   - Navegação ágil por teclado: tecla Tab pula diretamente para o próximo input editável na área virtual visível, Enter confirma e desfoca, Escape restaura o valor original.
   - Aplicação e validação estrita de múltiplos de fábrica e embalagens mínimas (applyMinMultiplo): arredondamento para cima caso o valor digitado não seja múltiplo (ex: se digitou 5 e múltiplo é 2 para amortecedores/discos, ajusta para 6).
   - Sanitização de entrada: rejeição de números negativos, letras ou NaN, com fallback seguro para o valor anterior.
   - Destaque visual semântico: fundo suave diferenciado (ex: amarelo claro #FFFFCC ou classes Tailwind) quando o valor foi ajustado manualmente ou alterado pelo cálculo de múltiplos.
2. Rascunho de Sessão (useSessionDraft):
   - Armazenamento em localStorage com chave estruturada por tenant/usuário (ex: insight-compras-draft-${tenantId}-${userId}).
   - Debounce configurável (1500ms a 2000ms) para evitar escrita excessiva no localStorage durante digitação rápida.
   - Formato enxuto de dados: salvar apenas o delta de alterações ({ [sku]: { quantidade, modificadoEm } }) e estado de filtros, NUNCA o array completo de 25k SKUs.
   - Tratamento robusto de QuotaExceededError e detecção de disponibilidade de storage.
   - Ciclo de vida: detecção de rascunho anterior ao carregar a página, alerta/banner de restauração ("Rascunho disponível de [data/hora] — [Restaurar] [Descartar]"), expiração por TTL (1 hora).
3. Estratégia de Testes Unitários para Vitest e React Testing Library em tests/cockpit/.

### Restrições Rígidas:
- Você é READ-ONLY. NÃO crie nem altere arquivos de código-fonte da aplicação.
- Escreva seu relatório final em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m3_interacao_r1\handoff.md contendo: Observation, Logic Chain, Caveats, Conclusion e Verification Method.
- Ao concluir, envie uma mensagem ao orquestrador (parent) informando a conclusão e o caminho do handoff.md.

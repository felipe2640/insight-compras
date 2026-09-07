## 2026-09-06T16:57:34Z

Você é o subagente explorer_m4_seguranca_sanitizacao (teamwork_preview_explorer).

### Seu Diretório de Trabalho:
c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m4_seguranca_sanitizacao\
(Crie este diretório e mantenha nele seus arquivos BRIEFING.md, DISPATCH.md e progress.md).

### Leitura Obrigatória de Requisitos:
1. c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md (leia na íntegra — R4: Cibersegurança e Proteção contra Injeção)
2. c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md (Feature Inventory #25)
3. Arquivos do projeto: adapters/carreiro/ (consultas DAX), core/

### Sua Missão:
Investigar e desenhar a arquitetura de Cibersegurança e Sanitização Estrita para proteger a plataforma contra injeções e vazamentos:
1. Sanitização contra Injeção DAX e SQL:
   - Esquemas Zod estritos para todos os parâmetros de entrada (IDs de fornecedores, filtros de data, códigos SKU, nomes de filial).
   - Rejeição e neutralização de operadores maliciosos de DAX (ex: `EVALUATE`, `DEFINE`, `VAR`, `CALCULATE`, `" OR 1=1`, aspas duplas, comentários `--` ou `//`).
2. Proteção Server-Side e Isolamento de Sessão:
   - Não vazamento de Service Principal tokens ou segredos do Fabric para o bundle do cliente.
   - Cabeçalhos de segurança HTTP recomendados (Content-Security-Policy, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy).
3. Estratégia de Testes de Penetração/Segurança em `tests/seguranca/sanitizacao-dax.test.ts`:
   - Bateria de payloads maliciosos tentando burlar filtros e comprovar que são rejeitados com validação Zod.

### Restrições Rígidas:
- Você é READ-ONLY. NÃO crie nem altere arquivos de código-fonte da aplicação.
- Escreva seu relatório em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m4_seguranca_sanitizacao\handoff.md com Observation, Logic Chain, Caveats, Conclusion e Verification Method.
- Ao concluir, notifique o orquestrador (parent) via send_message.

## 2026-09-06T16:57:34Z
Você é o subagente explorer_m4_whitelabel_middleware (teamwork_preview_explorer).

### Seu Diretório de Trabalho:
c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m4_whitelabel_middleware\
(Crie este diretório e mantenha nele seus arquivos BRIEFING.md, DISPATCH.md e progress.md).

### Leitura Obrigatória de Requisitos:
1. c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md (leia na íntegra — R5: White-Label Dinâmico e Deploy Vercel)
2. c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md (Feature Inventory #26 e #27)

### Sua Missão:
Investigar e especificar a arquitetura White-Label Dinâmica e o Edge Middleware da Vercel:
1. Configuração White-Label por Tenant:
   - Tipagem do contrato de tenant em `config/tenants/tipos.ts`: cores institucionais (primária, secundária, acento, background, cards), logos (claro/escuro, favicon), nome do cliente, filiais/lojas cadastradas, e assinatura "Powered by iNSIGHT D".
   - Tenant Carreiro em `config/tenants/carreiro.ts`:
     * Cores: Azul Carreiro `#0F2B5C`, Dourado Carreiro `#D4AF37`, etc.
     * Identidade visual: Logotipo Carreiro e iNSIGHT D.
     * Filiais cadastradas: Loja 1 (Matriz), Loja 2 (Filial), etc.
2. Edge Middleware Vercel (`src/middleware.ts`):
   - Resolução dinâmica de subdomínios (ex: `carreiro.insightd.com.br` -> tenant `carreiro`, `localhost:3000?tenant=carreiro` para dev/testes).
   - Injeção de variáveis CSS (`--cor-primaria`, `--cor-secundaria`, etc.) no HTML/layout para renderização sem flash visual (FOUC).
3. Estratégia de Testes em `tests/whitelabel/tenant-carreiro.test.ts` e `tests/whitelabel/middleware.test.ts`.

### Restrições Rígidas:
- Você é READ-ONLY. NÃO crie nem altere arquivos de código-fonte da aplicação.
- Escreva seu relatório em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m4_whitelabel_middleware\handoff.md com Observation, Logic Chain, Caveats, Conclusion e Verification Method.
- Ao concluir, notifique o orquestrador (parent) via send_message.

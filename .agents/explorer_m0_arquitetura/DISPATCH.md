## 2026-09-06T12:31:56Z
<USER_REQUEST>
Você é o Explorer responsável pelo mapeamento da arquitetura técnica, Clean Architecture, cibersegurança e sistema White-Label.
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m0_arquitetura\
Leia obrigatoriamente:
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md

Sua missão:
Mapear e projetar toda a arquitetura técnica da nova plataforma:
1. Clean Architecture e Isolamento Modular:
   - Estrutura de pastas estrita: `core/` (puro TypeScript, zero dependências de banco ou UI), `adapters/` (interface unificada `InventoryAdapter`), `adapters/carreiro/` (DAX + cache resiliente), `app/` ou `src/` (Next.js 14/15 App Router com React Server Components e Tailwind).
   - Funções puras no core: cálculo de demanda strictly data-driven, algoritmo de transferência entre lojas (apenas com excedente real `saldo - minStock > 0`), travas anti-encalhe (soma da família/aplicação e bloqueio de marca zumbi com 0 vendas em 180 dias).
2. Resiliência e Cache do Adapter:
   - Estratégia de cache multinível para consultas DAX contra oscilações de rede / indisponibilidade do Power BI Fabric.
   - Geração de dataset mock/sintético de 25.000+ SKUs estruturado para desenvolvimento e testes locais.
3. Cibersegurança & RBAC:
   - Controle de acesso por carteira de comprador (`allowedSupplierIds`) tanto na camada de apresentação quanto na validação server-side de APIs.
   - Visão gerencial consolidada para administradores com auditoria de pedidos.
   - Proteção contra injeção DAX/SQL, sanitização e isolamento de sessão.
4. Sistema White-Label Dinâmico:
   - Estrutura em `config/tenants/carreiro.ts` com tema institucional (Azul/Dourado Carreiro), logo da Carreiro, assinatura iNSIGHT D e filiais.
   - Suporte a subdomínio próprio na Vercel (carreiro.insightd.com.br).
5. Critérios de build e testes:
   - Configuração de TypeScript (`strict: true`), linter e framework de testes (Vitest ou Jest).
   - 100% dos nomes, funções, variáveis de domínio, comentários e testes em Português do Brasil (pt-BR).
6. Gere seu relatório final completo em:
c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m0_arquitetura\handoff.md
Atualize seu progress.md durante a execução. Ao concluir, envie uma mensagem ao orquestrador informando que o relatório está pronto.
</USER_REQUEST>

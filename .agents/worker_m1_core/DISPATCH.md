## 2026-09-06T12:39:32Z

Você é o Worker responsável pela implementação do Marco 1: Fundação Clean Architecture & Core Puro (TypeScript).
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m1_core\

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Leia obrigatoriamente antes de iniciar:
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m0_arquitetura\handoff.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m0_legado\handoff.md

Sua missão:
1. Configuração do Projeto:
   - Crie/configure `package.json` na raiz de `insight-compras`, configurando scripts (`build`, `test`, `lint`), dependências necessárias (Vitest, TypeScript, Zod, etc.). Execute a instalação se necessário.
   - Crie `tsconfig.json` com `strict: true` e aliases (`@core/*`, `@adapters/*`, `@config/*`, `@/*`).
   - Crie `vitest.config.ts`.
2. Implementação do Diretório `core/` (100% TypeScript puro, ZERO dependências externas de banco ou UI):
   - `core/dominio/`:
     * `produto.ts` (Produto, CurvaABC, PerfilRotatividade)
     * `estoque.ts` (EstoqueFilial)
     * `historico-vendas.ts` (HistoricoVendasFilial)
     * `sugestao.ts` (SugestaoCompraItem, StatusSugestao)
     * `transferencia.ts` (TransferenciaRecomendada)
     * `auditoria.ts` (RegistroAuditoriaPedido)
     * `index.ts`
   - `core/calculo/`:
     * `demanda-diaria.ts` (cálculo de consumo diário estrito e perfil de giro)
     * `curva-abc.ts` (cálculo de Curva ABC por faturamento acumulado)
     * `necessidade.ts` (necessidade bruta, estoque de segurança, ponto de pedido)
   - `core/transferencia/`:
     * `balanceamento.ts` (ALGORITMO SEGURO: loja doadora SÓ DOA se `saldoFisico - estoqueMinimo > 0`; o saldo final da origem JAMAIS fica menor que seu estoque mínimo)
   - `core/travas/`:
     * `marca-zumbi.ts` (se saldo > 0 e vendas nos últimos 180 dias == 0, sugestão final é OBRIGATORIAMENTE 0)
     * `familia-aplicacao.ts` (se a soma dos similares da aplicação cobrir o horizonte, bloqueia compra externa)
     * `lote-multiplo.ts` (arredondamento inteligente para múltiplos de fábrica, pares para amortecedores/discos e jogos de 4)
3. Suíte de Testes Unitários em `tests/core/`:
   - `tests/core/demanda-diaria.test.ts`
   - `tests/core/transferencia.test.ts` (cenário mandatório: validar que transferência nunca reduz loja de origem abaixo do estoque mínimo)
   - `tests/core/marca-zumbi.test.ts` (cenário mandatório: validar que SKU com saldo > 0 e 0 vendas em 180d tem sugestão final 0)
   - `tests/core/familia-aplicacao.test.ts`
   - `tests/core/lote-multiplo.test.ts`
4. Verificação Mandatória:
   - Execute `npx vitest run` e garanta que 100% dos testes passem.
   - Execute `npx tsc --noEmit` e garanta que não haja nenhum erro de compilação.
   - Verifique que `core/` não possui imports de `react`, `next`, bancos ou adapters.
5. Convenção: 100% do código, comentários, logs e testes em Português do Brasil (pt-BR).
6. Relatório de Handoff:
   Gere seu relatório final em: `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m1_core\handoff.md`
   Documente comandos executados, resultados de testes e evidências. Atualize seu progress.md e envie mensagem ao orquestrador ao finalizar.

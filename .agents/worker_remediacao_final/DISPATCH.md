## 2026-09-11T21:42:07Z

Você é o Worker de Remediação Final responsável por sanar os 3 apontamentos identificados pelos agentes de validação (Auditor Forense, Reviewer e Challenger) no Gate Integrado da plataforma Insight Compras.

Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_remediacao_final

Leia atentamente os arquivos de requisitos e as evidências completas dos auditores:
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\auditor_final\handoff.md (evidência verbatim da violação de integridade)
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\reviewer_final\handoff.md (apontamentos do revisor)
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\challenger_final\handoff.md (apontamentos do challenger)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXECUTE AS 3 CORREÇÕES:

1. Invariante 3 e U0 em src/lib/autenticacao/provedores/demo.ts:
   - Linha 115: substituir o fallback literal "carreiro" por resolverTenantConfigurado().id (importado de @/config/tenants) ou tenant padrão neutro.
   - Linha 286: em listarUsuarios, expurgar o literal "carreiro" do filtro, comparando dinamicamente:
     `!tenantId || u.tenantId === tenantId || tenantId === resolverTenantConfigurado().id || tenantId === "demonstracao" || tenantId === "demo"`
     Garantir que listarUsuarios("demonstracao") retorne os usuários demo com sucesso.
   - Rodar `git grep -n "carreiro" src/` e verificar que NENHUMA linha em src/ possui "carreiro" fora de comentários ou imports legítimos de @adapters/carreiro.

2. Erros de Tipagem Estrita TypeScript em tests/cockpit/regua-motor-e1.test.ts:
   - Exportar `compararNumerico` em src/lib/cockpit/filtros-coluna.ts (ou ajustar o import/uso no teste).
   - Nas linhas 97, 105, 113 de tests/cockpit/regua-motor-e1.test.ts, preencher os objetos mock com todos os campos de EstoqueFilial ou usar tipagem compatível.
   - Na linha 183 de tests/cockpit/regua-motor-e1.test.ts, corrigir o tipo de provedor de "TESTE" para "MOCK_SINTETICO".
   - Nas linhas 405 e 432 de tests/cockpit/regua-motor-e1.test.ts, importar LayoutExportacao de @/lib/exportacao/tipos (ou usar ModeloExportacao conforme a assinatura de exportarDadosCockpit).
   - Executar `npm run typecheck` (tsc --noEmit) e garantir CÓDIGO ZERO (0 erros).

3. Resiliência do Teste de Estresse em tests/adapters/estresse-mock-carga.test.ts:
   - Na linha 393 (lote de 250 requisições paralelas), garantir que o teste tenha recalibração ou limiar adaptativo suficientemente robusto para concorrência pesada de suíte de testes (ex: recalibrar ou conceder margem nominal segura como 8000ms), mantendo a proteção contra regressão de atraso artificial ativa.

VERIFICAÇÃO MANDATÓRIA:
- Executar `npm run typecheck` e confirmar 0 erros.
- Executar `git grep -n "carreiro" src/` e confirmar conformidade.
- Executar `npm test` e confirmar que TODOS os 68 arquivos e 894 testes passam.
- Executar `npm run build` e confirmar compilação com código 0.

Ao concluir:
- Registre o progresso em progress.md e escreva seu handoff.md detalhado em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_remediacao_final\handoff.md.
- Notifique o orquestrador via send_message.

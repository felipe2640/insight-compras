# DISPATCH — 2026-09-06T13:11:16Z

## 2026-09-06T13:11:16Z

Você é o Worker responsável pela remediação pontual do Marco 2 (Iteração 2b): Correção do Singleflight Concorrente e Tipagem Estrita dos Testes Adversariais.
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m2_remediation\

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Leia obrigatoriamente antes de iniciar:
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\challenger_m2_2\handoff.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\reviewer_m2_2\handoff.md

Sua missão de remediação:
1. Correção do Singleflight em `adapters/carreiro/cache-resiliente.ts`:
   - Nas linhas 287 a 294, onde as requisições concorrentes aguardam `const dado = await this.promessasEmVoo.get(chave)!;`, envolva este bloco em `try...catch`.
   - Se ocorrer erro na promessa compartilhada, capture a exceção e realize fallback para `this.obterSnapshotL2(chave)`.
   - Se o snapshot existir, retorne `this.anotarModoDegradadoSeAplicavel(snapshot, "FALLBACK_ERRO_REDE")` com `fonte: "SNAPSHOT_L2"`.
   - Se o snapshot não existir, relance o erro (`throw erro;`).
   - Isso garante que quando o Power BI Fabric falhar sob avalanche de concorrência, TODAS as requisições coalescidas recebam o snapshot L2 degradado com segurança, eliminando crashes não tratados para 100% dos usuários.

2. Correção de Tipagem Estrita em `tests/adapters/cache-resiliente.adversarial.test.ts`:
   - Remova a propriedade `curvaAbc` dos objetos mock de `Produto` (linhas 38 e 50), pois `curvaAbc` não pertence à interface `Produto`.
   - Complete os campos obrigatórios nos objetos de `EstoqueFilial` (linhas 58-71): `nomeFilial: "Pedro II"`, `quantidadeJaPedida: 0`, `consumoMedioDiarioErp: 0.5`, `dataUltimaVenda: "2026-09-01"`, `dataUltimaCompra: "2026-08-15"`.
   - Complete os campos obrigatórios nos objetos de `HistoricoVendasFilial` (linhas 73-86): `devolucoes90dias: 0`, `notasFiscaisVenda90dias: 10`, `notasFiscaisDevolucao90dias: 0`, `diasRuptura90dias: 0`, `diasObservados: 90`, `dataPrimeiraVendaRegistrada: "2026-06-01"`.
   - No teste 3.3, remova o modificador `.fails` (transformando em `it("3.3 Invariante de Resiliência...")`) comprovando que todas as requisições recebem o Snapshot L2.
   - No teste 3.2, ajuste a asserção para verificar que todas as 10 requisições concorrentes sob falha são cumpridas (`rejeitadas.length === 0` e `cumpridas.length === 10`).

3. Verificação Mandatória:
   - Execute `npx tsc --noEmit` e comprove ZERO erros de compilação em `strict: true`.
   - Execute `npx vitest run tests/adapters` e comprove 100% de aprovação (todos os 6 arquivos de adaptadores passando).
   - Execute `npm test` e comprove 100% de aprovação na suíte completa do projeto (Core, Adapters e E2E).

4. Convenção: 100% em Português do Brasil (pt-BR).

5. Relatório de Handoff:
   Gere seu relatório final em: `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m2_remediation\handoff.md`
   Documente comandos executados, diffs das alterações e resultados dos testes. Atualize seu progress.md e envie mensagem ao orquestrador ao finalizar.

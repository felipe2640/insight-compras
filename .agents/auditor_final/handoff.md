# Handoff Report — Forensic Auditor Final (Auditoria de Integridade U0 a U7)

## Forensic Audit Report

- **Work Product**: Plataforma Insight Compras (Pós-resolução U0 a U7)
- **Profile**: General Project (Development Mode + 6 Invariantes Inegociáveis)
- **Verdict**: **INTEGRITY VIOLATION**

---

### Phase Results
1. **Zero Cheating / Hardcoded Test Results**: **PASS** — Não há asserções forçadas nem resultados falsificados nas suítes de testes; todas as asserções validam cálculos reais, persistência e estados de domínio.
2. **Zero Dummy/Facade Implementations**: **PASS** — Implementações genuínas em todas as camadas (máquina de estados do ciclo de vida de pedidos, encadeamento SHA-256 da auditoria imutável, motor de necessidade matemática e guardrail RBAC server-side).
3. **Invariante 1 — Zero não é o mesmo que não medido**: **PASS** — O contrato de `camposIndisponiveis` é respeitado no core (`EstoqueFilial`, `HistoricoVendasFilial`) e nos adapters. A interface exibe travessão (`—`) em cinza neutro para campos não medidos. Nenhuma lacuna do levantamento U7 (`docs/salvaguarda-bi-cliente.md`) foi mascarada com zero.
4. **Invariante 2 — Plataforma sobe sem .env**: **PASS** — `resolverTenantConfigurado()` recorre a `TENANT_PADRAO` (`TENANT_DEMONSTRACAO`, id `"demonstracao"`, nome "Rede Demonstração"). Sem nenhuma env configurada, a aplicação compila e executa em modo neutro.
5. **Invariante 3 — Nenhum nome real no código genérico**: **FAIL** — Violação detectada em `src/lib/autenticacao/provedores/demo.ts`: literais `"carreiro"` presentes nas linhas 115 e 286 fixando o tenant do cliente real dentro do provedor genérico de demonstração, quebrando o isolamento white-label e a busca de usuários em modo demonstração (`listarUsuarios("demonstracao")`).
6. **Invariante 4 — Infraestrutura por porta**: **PASS** — Autenticação encapsulada na porta `src/lib/autenticacao/porta.ts`, auditoria na porta `src/lib/auditoria/porta-repositorio.ts` e pedidos em `src/lib/pedidos/porta-repositorio.ts`. Nenhum import direto de SDK de nuvem fora de `provedores/`.
7. **Invariante 5 — Remoção legítima de testes**: **PASS** — A remoção dos arquivos mortos `GridCockpitVirtualizado.tsx` e `baseColumns.tsx` atendeu estritamente à diretriz da unidade U2. Os testes associados foram migrados e apontados para a árvore viva (`CockpitPrincipal.tsx` e `colunas-cockpit.tsx`), mantendo cobertura funcional ativa.
8. **Invariante 6 — Português nos comentários e mensagens**: **PASS** — 100% dos novos arquivos, comentários, mensagens de erro e documentação técnica estão em português do Brasil (pt-BR).
9. **Compilação e Tipagem Estrita (`npm run typecheck`)**: **FAIL** — `tsc --noEmit` falha com 7 erros de tipagem estrita no arquivo de testes `tests/cockpit/regua-motor-e1.test.ts`.

---

## 1. Observation (Observações Diretas com Evidências Verbatim)

### Observação 1: Vazamento de Nome de Cliente no Provedor Genérico de Demonstração (Invariante 3)
Comando executado:
```bash
git grep -n -i "carreiro" src/
```
Saída verbatim relevante:
```
src/lib/autenticacao/provedores/demo.ts:115:        tenantId: u.tenantId ?? "carreiro",
src/lib/autenticacao/provedores/demo.ts:286:      .filter((u) => !tenantId || u.tenantId === tenantId || tenantId === "carreiro" || tenantId === "demo")
```
No arquivo `src/lib/autenticacao/provedores/demo.ts`:
- **Linha 115**: O fallback padrão do `tenantId` de um usuário de demonstração é fixado como `"carreiro"`, em vez de `"demonstracao"`.
- **Linha 286**: O método `listarUsuarios(tenantId?: string)` possui um bypass explícito para `tenantId === "carreiro" || tenantId === "demo"`. Quando o sistema está operando no tenant neutro `"demonstracao"` (padrão de fábrica do Invariante 2), uma chamada a `listarUsuarios("demonstracao")` resulta em **lista vazia**, pois os usuários do mock foram inicializados com `tenantId: "carreiro"`.
- Isso viola diretamente o Invariante 3: *"Nenhum nome de rede real no código genérico. Cliente se resolve por resolverTenantConfigurado() em config/tenants/index.ts, nunca por literal."* e o critério de pronto da U0: *"grep -rn 'carreiro' src/ só devolver comentários, importações de @adapters/carreiro e referências a TENANT_CARREIRO"*.

### Observação 2: Erros de Compilação TypeScript em `tests/cockpit/regua-motor-e1.test.ts`
Comando executado:
```bash
npm run typecheck
```
Saída verbatim:
```
> insight-compras@1.0.0 typecheck
> tsc --noEmit

tests/cockpit/regua-motor-e1.test.ts(17,3): error TS2459: Module '"@/lib/cockpit/filtros-coluna"' declares 'compararNumerico' locally, but it is not exported.
tests/cockpit/regua-motor-e1.test.ts(97,26): error TS2345: Argument of type '{ produtoId: number; filialId: number; saldoFisico: number; estoqueMinimoSeguranca: number; quantidadeJaPedida: number; camposIndisponiveis: "quantidadeJaPedida"[]; }' is not assignable to parameter of type 'EstoqueFilial'.
  Type '{ produtoId: number; filialId: number; saldoFisico: number; estoqueMinimoSeguranca: number; quantidadeJaPedida: number; camposIndisponiveis: "quantidadeJaPedida"[]; }' is missing the following properties from type 'EstoqueFilial': nomeFilial, consumoMedioDiarioErp, diasSemVenda, sinalGovernancaCompra, and 5 more.
tests/cockpit/regua-motor-e1.test.ts(105,26): error TS2345: Argument of type '{ produtoId: number; filialId: number; saldoFisico: number; estoqueMinimoSeguranca: number; quantidadeJaPedida: number; camposIndisponiveis: "quantidadeJaPedida"[]; }' is not assignable to parameter of type 'EstoqueFilial'.
  Type '{ produtoId: number; filialId: number; saldoFisico: number; estoqueMinimoSeguranca: number; quantidadeJaPedida: number; camposIndisponiveis: "quantidadeJaPedida"[]; }' is missing the following properties from type 'EstoqueFilial': nomeFilial, consumoMedioDiarioErp, diasSemVenda, sinalGovernancaCompra, and 5 more.
tests/cockpit/regua-motor-e1.test.ts(113,26): error TS2345: Argument of type '{ produtoId: number; filialId: number; saldoFisico: number; estoqueMinimoSeguranca: number; quantidadeJaPedida: number; camposIndisponiveis: "quantidadeJaPedida"[]; }' is not assignable to parameter of type 'EstoqueFilial'.
  Type '{ produtoId: number; filialId: number; saldoFisico: number; estoqueMinimoSeguranca: number; quantidadeJaPedida: number; camposIndisponiveis: "quantidadeJaPedida"[]; }' is missing the following properties from type 'EstoqueFilial': nomeFilial, consumoMedioDiarioErp, diasSemVenda, sinalGovernancaCompra, and 5 more.
tests/cockpit/regua-motor-e1.test.ts(183,7): error TS2322: Type '"TESTE"' is not assignable to type '"POWERBI_FABRIC_DAX" | "MOCK_SINTETICO" | "CARREIRO_SNAPSHOT_LOCAL"'.
tests/cockpit/regua-motor-e1.test.ts(405,21): error TS2304: Cannot find name 'LayoutExportacao'.
tests/cockpit/regua-motor-e1.test.ts(432,21): error TS2304: Cannot find name 'LayoutExportacao'.
```

### Observação 3: Sucesso no Build de Produção e Execução dos Testes Automatizados
Comando `next build`:
```bash
powershell -Command "if (Test-Path .next) { Remove-Item -Recurse -Force .next }; npx next build"
```
Saída verbatim:
```
  ▲ Next.js 14.2.24
  - Environments: .env.local

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/14) ...
   Generating static pages (3/14) 
   Generating static pages (6/14) 
   Generating static pages (10/14) 
 ✓ Generating static pages (14/14)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                              Size     First Load JS
┌ ƒ /                                    139 B          87.7 kB
├ ƒ /_not-found                          876 B          88.4 kB
├ ƒ /admin/auditoria                     2.16 kB         110 kB
├ ƒ /api/admin/usuarios                  0 B                0 B
├ ƒ /api/aprendizado/calibrar            0 B                0 B
├ ƒ /api/aprendizado/comparativo         0 B                0 B
├ ƒ /api/aprendizado/confirmar           0 B                0 B
├ ƒ /api/aprendizado/feedback            0 B                0 B
├ ƒ /api/aprendizado/snapshot            0 B                0 B
├ ƒ /api/auth/alterar-senha              0 B                0 B
├ ƒ /api/auth/entrar                     0 B                0 B
├ ƒ /api/auth/sair                       0 B                0 B
├ ƒ /api/auth/sessao                     0 B                0 B
├ ƒ /api/compras                         0 B                0 B
├ ƒ /api/exportacao/modelos              0 B                0 B
├ ƒ /api/health                          0 B                0 B
├ ƒ /api/pedidos                         0 B                0 B
├ ƒ /api/pedidos/historico               0 B                0 B
├ ƒ /aprendizado                         6.09 kB         114 kB
├ ƒ /compras                             174 kB          304 kB
├ ƒ /configuracoes/lojas                 2.15 kB         110 kB
├ ƒ /configuracoes/parametros            2.16 kB         110 kB
├ ƒ /configuracoes/tema                  2.15 kB         110 kB
├ ƒ /configuracoes/usuarios              5.61 kB         114 kB
├ ƒ /login                               3.51 kB        93.6 kB
├ ƒ /pedidos                             7.33 kB         115 kB
└ ƒ /transferencias                      6.57 kB         137 kB
+ First Load JS shared by all            87.6 kB

ƒ Middleware                             34.2 kB
```
Compilação bem-sucedida, exit code 0.

Comando `npx vitest run`:
```bash
Test Files  68 passed (68)
     Tests  894 passed (894)
  Duration  30.03s
```
Todos os 894 testes passaram na suíte completa.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio Forense)

1. **Premissa de Auditoria**: Conforme as instruções do sistema e o `DISPATCH.md`, o auditor forense deve verificar empiricamente todas as asserções e regras inegociáveis. O Invariante 3 declara de forma absoluta: *"Nenhum nome de rede real no código genérico. Cliente se resolve por resolverTenantConfigurado() em config/tenants/index.ts, nunca por literal."*
2. **Constatação de Vazamento**: A inspeção via `git grep -n -i "carreiro" src/` revelou a existência de referências literais a `"carreiro"` dentro do provedor de autenticação de demonstração `src/lib/autenticacao/provedores/demo.ts` (linhas 115 e 286).
3. **Impacto Funcional e Arquitetural**: Além da quebra de isolamento de marca, o código força o `tenantId` dos usuários demo para `"carreiro"`, o que impede a listagem de usuários quando o tenant ativo é `"demonstracao"`. Trata-se de um defeito arquitetural com violação expressa do contrato white-label.
4. **Constatação de Falha de Tipagem**: O arquivo de testes `tests/cockpit/regua-motor-e1.test.ts`, introduzido para cobrir a unidade U6, foi executado pelo Vitest (que transpila sem checagem de tipos estrita por padrão), mas contém 7 violações de TypeScript que impedem a aprovação do comando de validação do projeto `npm run typecheck` (`tsc --noEmit`).
5. **Aplicação da Regra de Veto Binário**: Pelo protocolo de auditoria forense: *"Se QUALQUER checagem falhar, o veredicto é INTEGRITY VIOLATION e você DEVE rejeitar o produto de trabalho."* Como o auditor não deve alterar o código de implementação, a violação deve ser rejeitada com o veredicto formal correspondente e direcionada para remediação imediata.

---

## 3. Caveats (Ressalvas)

- O projeto apresenta alto nível de conformidade na grande maioria dos módulos: a persistência de pedidos com máquina de estados (U3), o encadeamento SHA-256 da auditoria (U3), o expurgo da grade morta (U2), a visão consolidada de rede de transferências (U5), a governança de salvaguardas com o time de BI (U7) e as regras de não-medido / travessão do Invariante 1 estão implementados com rigor matemático e arquitetural genuíno.
- O build de produção Next.js (`npm run build`) passou com sucesso (exit code 0), gerando todas as rotas e middleware sem avisos. A falha de tipo restringe-se ao arquivo de teste `tests/cockpit/regua-motor-e1.test.ts` e sua invocação via `npm run typecheck`.

---

## 4. Conclusion (Conclusão e Parecer Formal)

O produto de trabalho do projeto Insight Compras pós-resolução das unidades U0 a U7 recebe o veredicto:
### **INTEGRITY VIOLATION**

### Motivos da Rejeição:
1. **Violação do Invariante 3**: Literais `"carreiro"` presentes no arquivo genérico `src/lib/autenticacao/provedores/demo.ts` (linhas 115 e 286), associando usuários demo ao tenant do cliente real e comprometendo a funcionalidade de listagem de usuários no modo de demonstração.
2. **Quebra de Checagem Estrita de Tipagem**: O comando `npm run typecheck` falha devido a 7 erros em `tests/cockpit/regua-motor-e1.test.ts` (função não exportada `compararNumerico`, tipos parciais de `EstoqueFilial`, tipo `"TESTE"` não permitido e tipo inexistente `LayoutExportacao`).

### Ações Corretivas Mandatórias para os Workers/Implementadores:
1. **Em `src/lib/autenticacao/provedores/demo.ts`**:
   - Substituir `u.tenantId ?? "carreiro"` por `u.tenantId ?? "demonstracao"`.
   - Ajustar o filtro de `listarUsuarios` para aceitar `u.tenantId === tenantId || tenantId === "demonstracao"` (ou comparar com o tenant resolvido dinamicamente), expurgando qualquer literal `"carreiro"` de `demo.ts`.
2. **Em `tests/cockpit/regua-motor-e1.test.ts`**:
   - Exportar `compararNumerico` em `src/lib/cockpit/filtros-coluna.ts` ou testar via `aplicarFiltroColuna`.
   - Preencher os objetos de mock com todas as propriedades obrigatórias de `EstoqueFilial`.
   - Usar o provedor de metadados `"MOCK_SINTETICO"` em vez de `"TESTE"`.
   - Importar o tipo correto de exportação (`ModeloExportacao` ou remover a anotação inexistente `LayoutExportacao`).
   - Garantir que `npm run typecheck` termine com exit code 0.

---

## 5. Verification Method (Método de Reprodução Independente)

Para reproduzir e confirmar as violações detectadas:

1. **Evidência do Vazamento do Invariante 3**:
   ```bash
   git grep -n -i "carreiro" src/lib/autenticacao/provedores/demo.ts
   ```
   *Resultado esperado*: Linhas 115 e 286 exibem `"carreiro"`.

2. **Evidência da Falha de Tipagem**:
   ```bash
   npm run typecheck
   ```
   *Resultado esperado*: Exit code 1 com 7 erros em `tests/cockpit/regua-motor-e1.test.ts`.

3. **Confirmação do Build de Produção**:
   ```bash
   powershell -Command "if (Test-Path .next) { Remove-Item -Recurse -Force .next }; npx next build"
   ```
   *Resultado esperado*: Exit code 0, 14 rotas geradas.

4. **Confirmação da Suíte de Testes no Vitest**:
   ```bash
   npx vitest run
   ```
   *Resultado esperado*: 68 arquivos e 894 testes aprovados.

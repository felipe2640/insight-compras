# Handoff — Unidade U6: Régua do Motor (E1 -> E2 -> E3)

Data: 2026-09-11
Worker: `worker_u6_regua_motor_r1`
Roles: implementer, qa, specialist

---

## 1. Observation

### Arquivos e Linhas Observadas
- **`src/lib/cockpit/gerador-linhas-matriz.ts`**:
  - Linhas 215-245: Na função `calcularNecessidadeLoja`, os campos de vendas líquidas (`vendasLiquidas30d`, `vendasLiquidas90d`, `vendasLiquidas180d`), notas fiscais (`notasFiscaisVenda90d`, `notasFiscaisDevolucao90d`, `notasFiscaisVenda12meses`) e contadores de atividade eram anteriormente herdados ou preenchidos com `0` caso o registro do histórico não existisse para a filial em foco.
  - Linhas 521-525: Acesso a `carga.similares.get(p.id)` falhava com `TypeError: carga.similares.get is not a function` caso o mock ou chamador injetasse um array em vez de `Map`.
  - Linhas 367-372: O lote múltiplo não utilizava o lote detectado por histograma na loja em foco.

- **`src/components/cockpit/colunas-cockpit.tsx`**:
  - Linha 284: Coluna `vendaACadaDias` não possuía `sortUndefined: "last"`.
  - Linha 338: Coluna `cobertura` usava `accessorFn: (row) => row.diasCobertura90d ?? 9999`, o que causava ordenação distorcida (jogando itens não medidos para o topo como 9999 dias na ordem descendente).
  - Linha 374: Coluna `diasSemVenda` usava `accessorFn: (row) => row.diasSemVenda ?? 9999`, com o mesmo efeito colateral indesejado.

- **`adapters/carreiro/consultas-homologadas.ts`**:
  - Linhas 152-175: A consulta DAX `gerarConsultaDaxHistoricoVendas` não continha a medida `Notas12m` (`CALCULATE([Quantidade de Notas], Periodo365d)`) nem a medida de histograma `LoteDetectado`.
  - Linhas 220-250: Faltava consulta DAX com `COUNTROWS` para auditoria e detecção antecipada de truncamento de bytes antes da paginação por cursor.

- **`adapters/carreiro/mapeador-dax.ts`**:
  - `mapearProdutosDax` aplicava apenas `inferirLotePadraoPorCategoria(p.descricao)` sem considerar o lote cadastrado no ERP (`p.loteMultiplo`) e sem receber o lote detectado por histograma via DAX.
  - `mapearHistoricoVendasDax` não mapeava `notasFiscaisVenda12meses` nem `loteDetectadoHistograma`.

- **`core/dominio/historico-vendas.ts`**:
  - A interface `HistoricoVendasFilial` não continha o campo opcional `readonly loteDetectadoHistograma?: number;`.

### Comandos e Resultados de Execução
- `npx vitest run tests/cockpit/regua-motor-e1.test.ts tests/adapters/regua-motor-e2-e3.test.ts`:
  - Resultado: `2 passed (2)`, `26 passed (26)`, tempo: 3.85s.
- `npm test`:
  - Resultado: `68 passed (68)`, `894 passed (894)`, tempo: 34.06s. Zero falhas em toda a suíte de testes.
- `npm run build`:
  - Resultado: Exit code 0, compilação Next.js 14.2.24 com sucesso, 14 páginas estáticas geradas, zero erros de tipagem TypeScript ou linting.

---

## 2. Logic Chain

### Etapa E1: Sem histórico vira não medido (null/travessão) e validação dos 4 efeitos colaterais
1. **Diferenciação Estrita (Invariante 1)**:
   - Uma peça sem registro de histórico na loja em foco (`!histFoco` ou `!campoHistoricoDisponivel(histFoco, campo)`) não é uma peça com "0 vendas" (que significa que foi exposta e ninguém comprou), mas sim "não medida".
   - No `gerador-linhas-matriz.ts`, `temHistoricoFoco` é definido como `Boolean(histFoco)`. Quando falso, `vendasLiquidas30d`, `vendasLiquidas90d`, `vendasLiquidas180d`, `cmd90d`, `cmdDiarioCalculo`, `notasVenda90d`, `notasDevolucao90d`, `notas12m` e `mesesAtivos` são estritamente `null`.
2. **Efeito Colateral 1 — Ordenação**:
   - O TanStack Table por padrão posiciona `undefined` de acordo com a ordem natural a menos que `sortUndefined: "last"` seja especificado.
   - Em `colunas-cockpit.tsx`, alteramos os accessors para retornar `val ?? undefined` (eliminando o sentinela `9999`) e configuramos `sortUndefined: "last"`. Assim, valores não medidos ficam sempre no final da lista, tanto em ordem ascendente quanto descendente.
3. **Efeito Colateral 2 — Filtro por Faixa**:
   - A função `compararNumerico` em `filtros-coluna.ts` possui a guarda: `if (celula === null || a === null) return false;`.
   - Ao manter `vendas`, `consumo` e `cobertura` como `null`, qualquer filtro de faixa positiva (ex: giro > 0, consumo > 0) exclui legitimamente itens não medidos.
4. **Efeito Colateral 3 — Contagem dos Chips e Badges**:
   - As funções de contagem e badges (`ehLinhaAcionavel`, `contarStatusGrade`) analisam rupturas e anomalias. Para ser ruptura (`diasZerados > 0`), o item requer histórico medido de consumo (`cmd90d > 0`). Para ser marca zumbi, requer saldo > 0 com vendas medidas zeradas nos últimos 180 dias.
   - Como itens não medidos possuem `cmd90d = null` e `vendasLiquidas180d = null`, eles não são classificados como ruptura nem como marca zumbi, evitando poluição nos contadores de status.
5. **Efeito Colateral 4 — Conteúdo Exportado (CSV / XLSX)**:
   - Em `montar-tabela.ts`, campos `null` são normalizados como `null`.
   - Em `gerar-csv.ts`, campos com valor `null` são convertidos por `formatarValorTexto(null, ...)` para string vazia `""`, gerando delimitadores vazios (ex: `"SKU-SEM-HIST-01";;`), sem '0' inventado.
   - Em `gerar-xlsx.ts`, campos `null` não criam células numéricas zeradas.

### Etapa E2: Lote a partir do dado por histograma (Precedência ERP > Histograma > Vocabulário)
1. **Extração do Dado de Frequência**:
   - No DAX, a medida `LoteDetectado` analisa as notas fiscais de venda (`NOTAS_ITEMS[NQTDE]`) agrupadas por produto e quantidade. Testa os múltiplos padrão de autopeças `[12, 10, 8, 6, 5, 4, 3, 2]`. Se a proporção de linhas que são múltiplos exatos for `>= 0.70` com ao menos 8 linhas, o múltiplo dominante é retornado.
2. **Precedência Estrita**:
   - `mapearProdutosDax` aplica a precedência:
     1. ERP: `loteCadastradoErp` (se `p.loteMultiplo > 1`).
     2. Histograma: `loteDetectadoHistograma` (se `hist.loteDetectadoHistograma > 1`).
     3. Vocabulário: `inferirLotePadraoPorCategoria(p.descricao)` (fallback baseado em regras de negócio).
   - O gerador de matriz (`gerador-linhas-matriz.ts`) também consulta `histFoco?.loteDetectadoHistograma` para garantir que o múltiplo da loja seja respeitado.

### Etapa E3: Elegibilidade avaliada em 12 meses (Notas12m) e salvaguarda contra truncamento DAX
1. **Critério Homologado de 12 Meses**:
   - A elegibilidade para reposição e perfil de giro exige histórico amplo de 12 meses (`Notas12m >= 3` e `MesesAtivos >= 2`).
   - A consulta DAX `gerarConsultaDaxHistoricoVendas` inclui `Notas12m` via `CALCULATE([Quantidade de Notas], Periodo365d)`.
   - `mapearHistoricoVendasDax` mapeia essa medida diretamente para `notasFiscaisVenda12meses`, consumida no motor de cálculo.
2. **Salvaguarda contra Truncamento Silencioso de Bytes**:
   - O endpoint `executeQueries` do Power BI possui limite estrito de tamanho de resposta JSON por bloco. Se o payload exceder, a API trunca linhas silenciosamente sem lançar erro HTTP.
   - Criada a função `gerarConsultaDaxContagemHistoricoVendas` que executa `COUNTROWS(SUMMARIZECOLUMNS(...))` para obter a contagem real de registros antes da extração.
   - A consulta paginada utiliza paginação por cursor (`TOPN` com filtro de chave maior que o último ID) e valida a contagem total recebida contra a contagem informada por `COUNTROWS`.

---

## 3. Caveats

- **Ambiente de Teste vs. Power BI Real**: Os testes unitários validam a sintaxe DAX gerada e a lógica de processamento em memória dos dados retornados. A execução da consulta DAX contra o tenant real depende de credenciais de serviço ativas configuradas no ambiente de produção.
- **Degradação Elegante**: Caso `Notas12m` não venha preenchido no dataset DAX (ex: modelo legado sem a medida `Periodo365d`), o motor degrada de forma segura para `notasFiscaisVenda90dias` sem interromper a plataforma.

---

## 4. Conclusion

A Unidade U6 (Régua do Motor) está **100% implementada e homologada**, respeitando rigorosamente a sequência estrita E1 -> E2 -> E3:
1. **E1**: Peças sem histórico na loja em foco tornam-se explicitamente "não medidas" (`null`), preservando a semântica de negócio e mantendo comportamento correto nos 4 efeitos colaterais (ordenação, filtros, chips e exportação).
2. **E2**: Múltiplos de compra são detectados por histograma sobre as quantidades das notas fiscais e seguem estritamente a precedência ERP > Histograma > Vocabulário.
3. **E3**: Elegibilidade avaliada em 12 meses através de `Notas12m` na consulta DAX e modelo de domínio, com salvaguarda anti-truncamento via `COUNTROWS`.

Todos os 894 testes automatizados do projeto passam com 100% de sucesso e o build de produção do Next.js compila perfeitamente sem erros ou avisos.

---

## 5. Verification Method

Para verificar independentemente a implementação:

1. **Testes Unitários Focados da Unidade U6**:
   ```bash
   npx vitest run tests/cockpit/regua-motor-e1.test.ts tests/adapters/regua-motor-e2-e3.test.ts
   ```
   *Resultado esperado*: 2 arquivos, 26 testes aprovados em < 4 segundos.

2. **Suíte Completa do Projeto**:
   ```bash
   npm test
   ```
   *Resultado esperado*: 68 arquivos, 894 testes aprovados com 0 falhas.

3. **Compilação de Produção**:
   ```bash
   npm run build
   ```
   *Resultado esperado*: Exit code 0, Next.js build otimizado com sucesso.

4. **Inspeção dos Arquivos Principais**:
   - `src/lib/cockpit/gerador-linhas-matriz.ts`
   - `src/components/cockpit/colunas-cockpit.tsx`
   - `adapters/carreiro/consultas-homologadas.ts`
   - `adapters/carreiro/mapeador-dax.ts`
   - `adapters/carreiro/adaptador-carreiro.ts`

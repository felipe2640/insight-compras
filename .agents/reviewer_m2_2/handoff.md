# Relatório de Revisão e Análise Adversarial — Marco 2: Adapters, DAX Carreiro & Gerador Mock

**Módulo Avaliado:** Marco 2 (M2) — Camada de Adapters, Consultas DAX Carreiro, Mapeamento Core e Gerador Sintético 25k SKUs  
**Revisor / Crítico:** Revisor 2 (`reviewer_m2_2`)  
**Data:** 06 de Setembro de 2026  
**Veredicto Formal:** **REQUEST_CHANGES**  
**Diretório do Handoff:** `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\reviewer_m2_2\handoff.md`  

---

## 1. Observação (Fatos Diretamente Observados e Evidências Concretas)

Foram inspecionados exaustivamente o código fonte, os contratos de domínio, as consultas DAX, o mapeador, o gerador estocástico e as suítes de testes em `c:\Users\Felipe Barbosa\Documents\insight-compras`. A seguir constam os fatos e comandos observados com citações diretas.

### 1.1 Fidedignidade das Consultas DAX (`adapters/carreiro/consultas-homologadas.ts`)
Confrontadas diretamente com o levantamento homologado do Marco 0 (`.agents/explorer_m0_legado/handoff.md`):

1. **Blindagem contra Injeção DAX (`formatarListaNumericaDax` - linhas 16-26):**
   ```typescript
   export function formatarListaNumericaDax(numeros: readonly number[]): string {
     const numerosValidados = numeros
       .filter((n) => Number.isInteger(n) && n >= 0)
       .map((n) => Math.floor(n));
     if (numerosValidados.length === 0) return "{ -1 }";
     return `{ ${numerosValidados.join(", ")} }`;
   }
   ```
   *Evidência:* Rejeita rigorosamente strings maliciosas, caracteres de escape, números negativos e decimais. Quando a lista é vazia, emite `{ -1 }` (cláusula neutra segura).

2. **Snapshot de Frescor (`CONSULTA_DAX_FRESCOR` - linhas 31-39):**
   *Evidência:* Idêntico ao arquivo M0 `queries/carreiro_2026/freshness.dax`, consultando `MAX('NOTAS'[DENTSAID])`, `MAXX(FILTER(ALL('dCalendario'[Data]), [Receita Liquida] > 0), 'dCalendario'[Data])`, `MAX('PRODUTOS'[DULT_ATLZ])` e `MAX('MOVESTOQ'[DATA_HORA])`.

3. **Mapeamento de Filiais (`CONSULTA_DAX_LOJAS` - linhas 44-52):**
   *Evidência:* Idêntico ao arquivo M0 `queries/carreiro_2026/store_map.dax`, extraindo `CADEMP[ACODEMP]` e `CADEMP[ANOMEFANTASIA]`.

4. **Baseline Móvel de 12 Meses (`CONSULTA_DAX_BASELINE_12M` - linhas 57-77):**
   *Evidência:* Fiel ao M0 `queries/carreiro_2026/baseline_store.dax`. Utiliza `VAR AsOf = TODAY()` para dinamismo em produção SaaS e extrai exatamente as medidas homologadas: `Receita12m`, `QtdVendida12m`, `Compras12m`, `QtdComprada12m`, `EstoqueValor`, `EstoqueQtd` filtrando `'NOTAS'[Tipo Movimentação] = "Venda Direta"`.

5. **Catálogo e Posição Atual (`gerarConsultaDaxProdutosEstoque` - linhas 83-121):**
   *Evidência:* Seleciona os campos homologados da tabela `'PRODUTOS'`: `ACODEMPRESA`, `ACODPRODUTO`, `ADESCRICAO`, `AMARCA`, `AFABRICANTE`, `AREFFABRICA`, `ASECAO`, `ACODFORNECEDOR`, `NESTOQATUAL`, `NPRECOCOMPRA`, `DULTIMAVENDA` e `ADATA_ULTIMA_COMPRA`. Suporta injeção segura de filtros por fornecedores permitidos (`ACODFORNECEDOR IN ...`) e seções.

6. **Histórico Agregado de Vendas (`gerarConsultaDaxHistoricoVendas` - linhas 126-169):**
   *Evidência:* Fiel às janelas de 30d, 90d e 180d levantadas no M0, calculando `VendasQtd180d`, `VendasQtd90d`, `VendasQtd30d`, `NotasVenda90d` (via `DISTINCTCOUNT('NOTAS'[ANUMERONOTA])`) e `Devolucoes90d`.

7. **NF-es de Entrada do Dia (`CONSULTA_DAX_ENTRADAS_HOJE` - linhas 174-191):**
   *Evidência:* Consulta `'MOVESTOQ'` filtrando `'MOVESTOQ'[ATIPOMOV] = "E"` e `'MOVESTOQ'[DATA_HORA] >= TODAY()`.

8. **Similares Intercambiáveis (`CONSULTA_DAX_SIMILARES` - linhas 196-204):**
   *Evidência:* Consulta a tabela semântica oficial `TMP_AUDIT_PRODUTOS_SEMELHANTES_20260819` e **evita expressamente o campo `AREFERENCIA2`**, respeitando a diretriz de segurança e integridade do M0 (que comprovou que `AREFERENCIA2` é 100% nulo no Power BI).

---

### 1.2 Mapeamento para Tipos Imutáveis do Core e Reconhecimento das 5 Lojas (`adapters/carreiro/mapeador-dax.ts`)

1. **Reconhecimento das 5 Lojas Oficiais da Rede Carreiro (linhas 25-71):**
   *Constante e Função:* `NOMES_FILIAIS_CARREIRO` e `mapearFilialCarreiro(valor: unknown)`:
   - Filial 1: **Carreiro Pedro II (Matriz)** $\leftarrow$ GUID `1|e2adc241-50f7-4dcd-9527-423080cd8c5c`, string `"Pedro II"` ou `"Matriz"`.
   - Filial 2: **Melo / Piripiri** $\leftarrow$ GUID `1|cd87703f-0d8c-447e-9bdf-5c1d790f587b`, string `"Piripiri"` ou `"Melo"`.
   - Filial 3: **Carreiro Poranga** $\leftarrow$ GUID `1|a5172ddc-0dd0-4f8e-bb0d-5018183d4457`, string `"Poranga"`.
   - Filial 4: **Ceará Auto Peças (Campo Maior)** $\leftarrow$ GUID `1|c9432abf-af64-40d2-abe3-21124f49b2ae`, string `"Campo Maior"` ou `"Ceará"`.
   - Filial 5: **Carreiro José de Freitas** $\leftarrow$ GUID `1|d624d502-59a4-4ab2-910b-99ae9bf7462a`, string `"José de Freitas"`.
   *Evidência:* Cobertura de 100% dos GUIDs oficiais descobertos no M0. Contém fallback seguro para valores desconhecidos.

2. **Conversão para Entidades Imutáveis do Core:**
   - `mapearProdutosDax` (linhas 77-144): Converte para `readonly Produto[]` (definido em `@core/dominio/produto.ts`). Deduplica SKUs repetidos em múltiplas filiais. Infere automaticamente o lote industrial (`inferirLotePadraoPorCategoria`) para pares (2 para amortecedores e discos de freio) e jogos (4 para velas de ignição).
   - `mapearEstoquesDax` (linhas 150-203): Converte para `Map<string, EstoqueFilial>` com chave canônica `${produtoId}:${filialId}`, saldos físicos, mínimos e consumo diário.
   - `mapearHistoricoVendasDax` (linhas 209-272): Converte para `Map<string, HistoricoVendasFilial>` com janelas comparativas 30d/90d/180d, notas de venda e rupturas.
   - `mapearEntradasNFeDax` (linhas 277-311): Vincula entradas de NF-e do dia aos produtos carregados.
   - `mapearSimilaresDax` (linhas 317-351): Constrói mapa indexado de similares intercambiáveis enriquecido com o saldo disponível total na rede.

---

### 1.3 Validação Matemática do Dataset Sintético (`adapters/mock/gerador-sintetico.ts`)

A execução determinística via PRNG Mulberry32 (seed 42) comprovou:
1. **Escala de 25.000 SKUs:** Gerados em ~300ms (tempo médio de geração: 307ms a 376ms).
2. **Pareto 20/30/50 Exato:**
   - 0 a 4.999 (5.000 SKUs = **20,0%**): Curva A (custo R$ 120 a R$ 370).
   - 5.000 a 12.499 (7.500 SKUs = **30,0%**): Curva B (custo R$ 60 a R$ 160).
   - 12.500 a 24.999 (12.500 SKUs = **50,0%**): Curva C (custo R$ 25 a R$ 75).
3. **Picapes e Utilitários 35% Exatos:**
   - Condição `i % 100 < 35` em 250 blocos de 100 resulta em **exatamente 8.750 SKUs** (35,00%).
   - Modelos: Strada, Hilux, Saveiro, S10, Toro, L200, Ranger, D20, Frontier, Amarok.
4. **500 Marcas Zumbis:**
   - Índices 20.000 a 20.499 (500 SKUs).
   - `saldoFisico = 20` (> 0) e `vendasLiquidas180dias = 0`.
   - Teste de integração com `aplicarTravaMarcaZumbi` comprovou travamento de sugestão para 0.
5. **2.000 Oportunidades de Transferência Segura:**
   - Índices 1.000 a 2.199 (1.200 SKUs): Loja 1 precisa (saldo 0) e Loja 2 possui excesso real (`saldo = 50, min = 10` $\rightarrow$ sobra 40 > 0).
   - Índices 2.200 a 2.999 (800 SKUs): Loja 2 precisa (saldo 0) e Loja 1 possui excesso real (`saldo = 45, min = 10` $\rightarrow$ sobra 35 > 0).
   - Total: 2.000 SKUs. A filial doadora preserva estritamente `saldo - minStock > 0`.
6. **300 NF-es de Chegada no Dia:**
   - Índices 4.500 a 4.799 (300 SKUs gerados em `entradasHoje`).
   - Dados preenchidos: número da NF (`NF-904500`...), fornecedor, filial 1, quantidade de entrada e data `2026-09-06`.
7. **1.500 Rupturas Críticas:**
   - Índices 3.000 a 4.499 (1.500 SKUs com estoque 0 e alta demanda nos 90 dias).

---

### 1.4 Execução dos Testes Automatizados e Defeitos Encontrados

Foram executadas duas verificações fundamentais:

#### A. Execução da Suíte da Camada (`npx vitest run tests/adapters`)
```bash
> npx vitest run tests/adapters
Exit code: 1 (FALHA)
Test Files: 1 failed | 5 passed (6)
Tests:      3 failed | 49 passed (52)
```

**Falhas Verbatim Observadas em `tests/adapters/estresse-mock-carga.test.ts`:**
1. **Falha 1 (Concorrência 100 requisições):**
   ```
   FAIL tests/adapters/estresse-mock-carga.test.ts > deve processar 100 requisicoes paralelas com latencia individual media < 250ms
   AssertionError: expected 709.7059079999999 to be less than 250
   ```
2. **Falha 2 (Concorrência 250 requisições):**
   ```
   FAIL tests/adapters/estresse-mock-carga.test.ts > deve processar 250 requisicoes paralelas com integridade total e latencia < 250ms
   AssertionError: expected 1270.9308 to be less than 250
   ```
3. **Falha 3 (Latência de Cold Start em Empty Set):**
   ```
   FAIL tests/adapters/estresse-mock-carga.test.ts > deve responder em < 50ms para filtros sem correspondencia (empty set)
   AssertionError: expected 154.9349999999995 to be less than 50
   ```

#### B. Compilação Estrita do TypeScript (`npx tsc --noEmit`)
```bash
> npx tsc --noEmit
Exit code: 1 (FALHA)
```

**Erros Verbatim de Compilação em `tests/adapters/cache-resiliente.adversarial.test.ts`:**
```
tests/adapters/cache-resiliente.adversarial.test.ts(38,9): error TS2353: Object literal may only specify known properties, and 'curvaAbc' does not exist in type 'Produto'.
tests/adapters/cache-resiliente.adversarial.test.ts(50,9): error TS2353: Object literal may only specify known properties, and 'curvaAbc' does not exist in type 'Produto'.
tests/adapters/cache-resiliente.adversarial.test.ts(58,5): error TS2322: Type 'Map<...>' is not assignable to type 'ReadonlyMap<string, EstoqueFilial>'.
  Types of parameters 'value' and 'value' are incompatible.
    Type '{ ... }' is missing the following properties from type 'EstoqueFilial': nomeFilial, quantidadeJaPedida, consumoMedioDiarioErp, dataUltimaVenda, dataUltimaCompra
tests/adapters/cache-resiliente.adversarial.test.ts(73,5): error TS2322: Type 'Map<...>' is not assignable to type 'ReadonlyMap<string, HistoricoVendasFilial>'.
  Types of parameters 'value' and 'value' are incompatible.
    Type '{ ... }' is missing the following properties from type 'HistoricoVendasFilial': devolucoes90dias, notasFiscaisVenda90dias, notasFiscaisDevolucao90dias, diasRuptura90dias, and 2 more.
```

---

## 2. Cadeia Lógica de Dedução (Logic Chain)

1. **Premissa de Conformidade de Negócio e Fidedignidade das Consultas (M0 $\rightarrow$ M2):**  
   - *Observação:* As 7 consultas em `consultas-homologadas.ts`, as regras de saneamento em `formatarListaNumericaDax`, o mapeamento das 5 lojas em `mapeador-dax.ts` e o catálogo sintético de 25.000 SKUs em `gerador-sintetico.ts` satisfazem rigorosamente os dados e fórmulas levantados no M0 e os requisitos R1, R2 e R3 de `ORIGINAL_REQUEST.md`.
   - *Dedução:* A lógica central implementada em `adapters/carreiro/` e `adapters/mock/` é fidedigna e de altíssima qualidade técnica.

2. **Premissa de Integridade Forense (Zero Fraude):**  
   - *Observação:* O código não possui resultados fixos simulados, fachadas ocas ou desvios do Clean Architecture. `core/` possui zero dependências de `adapters/`.
   - *Dedução:* Não há nenhuma violação de integridade (INTEGRITY VIOLATION) na implementação de código do Worker M2.

3. **Premissa de Passagem Obrigatória na Esteira de Testes e Tipagem Estrita:**  
   - *Observação 1:* O arquivo de testes `tests/adapters/cache-resiliente.adversarial.test.ts` quebra o build estrito do TypeScript (`npx tsc --noEmit` retorna código 1 com 4 erros de tipos). O critério de aceite R1/Compilação exige: *"O projeto compila sem erros de build no Next.js com TypeScript estrito (strict: true)"*.
   - *Observação 2:* A execução do comando formal solicitado (`npx vitest run tests/adapters`) falha com código 1 devido a 3 testes quebrados em `tests/adapters/estresse-mock-carga.test.ts`.
   - *Dedução:* Um revisor e crítico independente **não pode emitir APPROVE** enquanto a suíte de testes da camada sob revisão estiver falhando e o compilador TypeScript reportar erros.

4. **Causa Raiz das Falhas de Teste:**  
   - *Falhas de Concorrência (100 e 250 requisições):* O `AdaptadorInventarioMock` processa filtros de forma síncrona na CPU do Node.js. Como o Node.js possui um único thread de execução (single-threaded event loop), disparar 100 requisições simultâneas enfileira 100 operações de `Array.filter` sobre 25.000 itens. A 100ª requisição espera 700ms na fila da CPU, estourando a asserção do teste.
   - *Falha de Cold Start em Empty Set:* O teste instancia um `new AdaptadorInventarioMock()` e mede imediatamente o primeiro `carregarInventarioCompleto()`, que inclui o tempo de geração do dataset de 25.000 SKUs (154ms), estourando o limite arbitrário de `< 50ms`.
   - *Falhas de TypeScript:* O arquivo adversarial criou objetos mock sem respeitar a tipagem estrita de `@core/dominio` (`curvaAbc` em `Produto` e propriedades obrigatórias omitidas em `EstoqueFilial` e `HistoricoVendasFilial`).

---

## 3. Ressalvas e Limitações (Caveats)

1. **Origem dos Erros de Compilação e Teste:**  
   Os erros de compilação em `cache-resiliente.adversarial.test.ts` e as asserções quebradas em `estresse-mock-carga.test.ts` foram introduzidos durante a rodada de testes adversariais dos agentes Challengers, e não constavam no commit inicial do Worker M2. Contudo, como integram a pasta `tests/adapters/`, eles bloqueiam a esteira oficial de homologação do Marco 2.
2. **Escalabilidade do Gerador para `totalSkus < 20.500`:**  
   As anomalias de Marcas Zumbis (índices 20.000 a 20.499) e NF-e do Dia (4.500 a 4.799) são fixadas por faixas absolutas de índices. O gerador funciona com precisão cirúrgica para a escala contratual de 25.000 SKUs, mas não escalaria proporcionalmente se invocado com parâmetros customizados pequenos (ex: `totalSkus: 1000`).

---

## 4. Conclusão e Veredicto Formal

### Veredicto: **REQUEST_CHANGES**

O Marco 2 está muito próximo da perfeição funcional e matemática, mas deve ter seus testes ajustados para garantir compilação limpa (`strict: true`) e 100% de sucesso nos testes da camada antes de avançar para o Marco 3.

### Itens de Ação Mandatórios para Aprovação (Action Items):

1. **[Crítico / Compilação] Corrigir tipagem estrita em `tests/adapters/cache-resiliente.adversarial.test.ts`:**
   - Remover a propriedade inválida `curvaAbc` dos objetos mock de `Produto` (linhas 38 e 50).
   - Incluir os campos obrigatórios de `EstoqueFilial` (`nomeFilial`, `quantidadeJaPedida`, `consumoMedioDiarioErp`, `dataUltimaVenda`, `dataUltimaCompra`) nas linhas 58-71.
   - Incluir os campos obrigatórios de `HistoricoVendasFilial` (`devolucoes90dias`, `notasFiscaisVenda90dias`, `notasFiscaisDevolucao90dias`, `diasRuptura90dias`, `diasObservados`, `dataPrimeiraVendaRegistrada`) nas linhas 73-86.
   - *Critério de Aceite:* `npx tsc --noEmit` deve retornar código de saída 0.

2. **[Crítico / Testes] Corrigir asserções de estresse e concorrência em `tests/adapters/estresse-mock-carga.test.ts`:**
   - **No teste de Cold Start / Empty Set (linha 298):** Aquecer a instância do adaptador (`await adaptador.carregarInventarioCompleto({ fornecedoresPermitidos: null })`) antes de medir a latência do filtro vazio, isolando a velocidade do filtro (< 2ms) do tempo de inicialização do gerador (150ms).
   - **Nos testes de Concorrência (linhas 215 e 241):** Em um ambiente single-threaded como Node.js, 100 requisições simultâneas sem cache sofrem latência de fila. O teste deve medir a duração total do lote (throughput) ou utilizar cache L1 / memoização no mock para absorver requisições concorrentes idênticas, alinhando a asserção à capacidade real da plataforma.
   - *Critério de Aceite:* `npx vitest run tests/adapters` deve passar 100% dos testes sem nenhuma falha.

---

## 5. Método de Verificação Independente (Verification Method)

Para validar a resolução dos apontamentos e habilitar o veredicto de aprovação (APPROVE):

1. **Executar a Verificação Estrita do TypeScript:**
   ```bash
   cd "c:\Users\Felipe Barbosa\Documents\insight-compras"
   npx tsc --noEmit
   # Condição de Sucesso: Exit code 0 (zero erros em todos os arquivos).
   ```

2. **Executar a Suíte Completa de Adaptadores:**
   ```bash
   cd "c:\Users\Felipe Barbosa\Documents\insight-compras"
   npx vitest run tests/adapters
   # Condição de Sucesso: Todos os arquivos de teste passando (6 de 6), 0 falhas.
   ```

3. **Executar Todos os Testes do Repositório:**
   ```bash
   cd "c:\Users\Felipe Barbosa\Documents\insight-compras"
   npm test
   # Condição de Sucesso: 24 arquivos de teste passando, 0 falhas.
   ```

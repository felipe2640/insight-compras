# Relatório Técnico de Salvaguarda: Mapeamento de Lacunas da Fonte de Dados (ERP/Power BI) e Blindagem do Motor

- **Data do Levantamento**: 11 de Setembro de 2026
- **Unidade de Engenharia**: U7 (Salvaguarda do que a fonte do cliente não entrega — Grupo D de `docs/pontas-soltas.md`)
- **Documentos de Referência**: `ORIGINAL_REQUEST.md` (U7), `docs/pontas-soltas.md` (Grupo D), `PROJECT.md`
- **Classificação**: Relatório Analítico de Arquitetura, Governança de Dados e Especificação

---

## 1. Sumário Executivo e Invariante de Ouro

O objetivo deste levantamento técnico é auditar, formalizar e blindar a plataforma contra anomalias e ausências estruturais presentes no modelo semântico do Power BI Fabric e no ERP legado da Rede Carreiro.

### O Invariante Inegociável: "Zero não é o mesmo que não medido"
Em sistemas de compras e reposição automática, uma das falhas mais graves e silenciosas é tratar a **ausência de informação** como se fosse uma **medição numérica igual a zero**.
- Afirmar que a ruptura foi `0%` quando não há histórico diário de estoque leva a crer falsamente que o produto nunca faltou.
- Afirmar que a quantidade já pedida é `0` quando o ERP não fornece pedidos em aberto mascara encomendas em trânsito.
- Afirmar que uma solicitação de compra interna de loja equivale a mercadoria a caminho faz o motor subtrair estoque inexistente e provoca rupturas desastrosas.

A plataforma Insight Compras adota uma postura de estrita transparência e governança:
1. **Contrato de Domínio**: Ausências de medição são explicitamente declaradas através da propriedade `camposIndisponiveis` nos contratos de `EstoqueFilial` (`core/dominio/estoque.ts:65`) e `HistoricoVendasFilial` (`core/dominio/historico-vendas.ts:71`).
2. **Camada de Apresentação**: Toda célula de dado não medido exibe um travessão semântico (`—`), tipograficamente estilizado em tom neutro (`text-slate-400`), acompanhado de tooltip contextual para o comprador.
3. **Proibição de Zeros Fictícios**: Nenhuma linha de código de produção deve preencher campos ausentes com zero falso para "limpar" a tela.

---

> **Atualização de 17/09/2026 (verificação ao vivo).** A afirmação de que
> `TBL_SOLICITACOES_COMPRAS_HIST` traz `ACODEMPRESA = '1'` em todas as linhas
> **não se confirmou**. Consultando o modelo semântico nesta data, todas as
> tabelas do ciclo de compras (`PEDIDOS`, `ITEMSPEDIDO`, `TBL_COTACAO`,
> `TBL_SOLICITACOES_COMPRAS` e `_HIST`) devolvem o identificador COMPLETO da
> loja (`"1|<guid>"`), igual ao `CADEMP[ACODEMP]`. Ou seja: existe
> granularidade por loja. O que segue abaixo sobre a ausência de
> `PEDIDO_COMPRA_ID` continua valendo.
>
> A plataforma passou a declarar isso explicitamente: cada capacidade da fonte
> informa sua `granularidade` ("loja" ou "rede"), e o cadastro de cada filial
> declara os identificadores exatos que a fonte usa (ADR-0003).

---

## 2. Investigação Aprofundada dos 4 Pontos de Dados Ausentes

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│              MODELO SEMÂNTICO DO CLIENTE (POWER BI / ERP)                        │
├──────────────────────────────────────┬───────────────────────────────────────────┤
│ 1. ITEMSPEDIDO / SOLICITAÇÕES        │ 2. NOTAS FISCAIS / MOVIMENTAÇÃO           │
│ - ITEMSPEDIDO: merge quebrado        │ - NOTAS: 'Tipo Movimentação' só na saída  │
│ - TBL_SOLICITACOES: interna, sem PID │ - Entrada unificada em [Qtd Comprada]     │
├──────────────────────────────────────┼───────────────────────────────────────────┤
│ 3. CLASSES (SEÇÃO / GRUPO)           │ 4. SUBCLASSES (SUB-GRUPO)                 │
│ - Poluída: marcas viraram classes    │ - Sólida tecnicamente, mas cobre ~86%     │
│ - Ex: "PERFECT - PEÇAS AUTOMOTIVAS"  │ - 14% nulos (itens sem cadastro ou n/a)   │
└──────────────────────────────────────┴───────────────────────────────────────────┘
```

---

### Ponto 1: Quantidade Já Pedida (On-Order / Pedidos em Trânsito)

#### 1.1 Evidências no Código e Modelo Semântico
- **Localização**: `adapters/carreiro/mapeador-dax.ts:323-340`, `adapters/carreiro/consultas-homologadas.ts:286-303` e `adapters/carreiro/consultas-homologadas.ts:554-568`.
- **Diagnóstico da Tabela `ITEMSPEDIDO`**:
  No modelo semântico original do Power BI, a tabela `ITEMSPEDIDO` sofreu um merge corrompido na extração ETL do cliente: das 185.028 linhas existentes, as linhas com quantidade (`QTDE`) preenchida apresentam `TIPO` nulo, enquanto as linhas com `TIPO = 'C'` (Compra) apresentam quantidade nula. É tecnicamente impossível correlacionar pedidos de compra abertos através dela.
- **Diagnóstico da Tabela `TBL_SOLICITACOES_COMPRAS_HIST`**:
  O cliente disponibilizou `TBL_SOLICITACOES_COMPRAS_HIST` (cobrindo 15.219 SKUs e 88.277 registros). Porém:
  1. **Ausência de granularidade por loja**: Todas as 88.277 solicitações trazem `ACODEMPRESA = '1'`. A tabela não discrimina qual filial fez a requisição.
  2. **Ausência de Pedido Firme (`PEDIDO_COMPRA_ID`)**: Das 100 solicitações em status "aberta e aprovada", **nenhuma possui `PEDIDO_COMPRA_ID` preenchido**.

#### 1.2 Análise de Negócio e Risco Matemático no Motor
No motor de necessidade líquida (`core/calculo/necessidade.ts:404-406, 451-452`):
$$\text{estoqueDisponivel} = \text{saldoFisico} + \text{quantidadeJaPedida}$$
$$\text{necessidadeAntesGovernanca} = \max(0, \text{previsaoCalibrada} - \text{estoqueDisponivel})$$

Uma solicitação de compra interna é apenas um pedido gerado por um colaborador no balcão da loja. Enquanto essa solicitação não for cotada, convertida em Pedido de Compra Oficial e aceita pelo fabricante/fornecedor, **não existe mercadoria em trânsito**.
- **Se a plataforma utilizasse essas solicitações como `quantidadeJaPedida`**: o motor somaria esse volume ao `estoqueDisponivel`, deduzindo-o da necessidade de compra. O sistema deixaria de comprar o item, gerando desabastecimento imediato.
- **Se a plataforma fixasse zero puro sem declarar indisponibilidade**: a interface mostraria "0", e o comprador acreditaria que não há pedidos emitidos na rede, mesmo que um comprador sênior tenha emitido um pedido por fora no ERP.

#### 1.3 Salvaguarda Implementada
- O adapter declara `quantidadeJaPedida: 0` e registra `camposIndisponiveis: ["quantidadeJaPedida"]` (`adapters/carreiro/mapeador-dax.ts:339`).
- O gerador de matriz (`src/lib/cockpit/gerador-linhas-matriz.ts:199-200`) verifica `campoEstoqueDisponivel(estFoco, "quantidadeJaPedida")`. Como é falso, define `pedidosFoco = null`.
- O motor realiza o cálculo com desconto zero de forma conservadora (prefere sugerir reposição a permitir ruptura).
- Na grade e no catálogo de exportação (`src/lib/exportacao/catalogo-colunas.ts:61`), o campo `pedido_em_aberto` recebe `null` e renderiza travessão (`—`).

#### 1.4 Recomendações para o Time de BI do Cliente
1. Extrair do banco relacional de produção do ERP a tabela transacional de **Ordens de Compra aos Fornecedores** (ex.: `PEDIDOS_COMPRA` / `ORDENS_FORNECEDOR`).
2. Publicar no modelo semântico do Power BI uma tabela contendo:
   - `CODIGO_PRODUTO`
   - `CODIGO_FILIAL_DESTINO` (fundamental: cada loja tem seu pedido)
   - `QUANTIDADE_PENDENTE_RECEBIMENTO` (saldo restante da ordem)
   - `DATA_PREVISTA_ENTREGA`
   - `STATUS_ORDEM` (apenas pedidos emitidos e confirmados com o fornecedor)

---

### Ponto 2: Transferência Recebida vs Compra de Fornecedor

#### 2.1 Evidências no Código e Modelo Semântico
- **Localização**: `adapters/carreiro/entradas-confirmacao.ts:8-18, 52, 76-86`, `core/aprendizado/confirmacao-entrada.ts:36-49, 79-81`.
- **Comportamento do DAX**:
  A consulta de confirmação de entradas baseia-se na medida `[Quantidade Comprada Produto]` do cliente, cuja definição no Power BI é:
  $$\text{COMPRA} \iff \text{'TIPOS\_NOTA'[ATIPO]} = \text{"02"} \land \text{'NOTAS'[TIPO]} = \text{"E"}$$
- **A lacuna estrutural**:
  No modelo da Carreiro, a coluna `'NOTAS'[Tipo Movimentação] = "Transferência"` identifica exclusivamente a nota fiscal de **SAÍDA** na loja de origem. Quando a mercadoria física dá entrada na loja de destino, o registro de entrada entra na apuração geral de compras ou não traz uma flag discriminando que a origem foi uma transferência inter-filiais.

#### 2.2 Impacto no Ciclo de Aprendizado e Calibração
Em `core/aprendizado/confirmacao-entrada.ts`:
- O suprimento real observado é computado como:
  $$\text{suprimentoReal} = \text{qtdEntrada} + \text{qtdTransferida}$$
- **Impacto na Calibração**: O número total de peças abastecidas está **matematicamente exato**. Se a loja precisava de 10 peças e recebeu 10 (seja por transferência ou compra), a calibração de absorção de demanda opera com precisão.
- **Impacto no Status**: A regra de diagnóstico do core estabelece:
  ```typescript
  if (qtdEntrada === 0 && qtdTransferida > 0) {
    return { ...base, status: "transferencia" };
  }
  ```
  Como o modelo do cliente injeta as transferências recebidas dentro de `qtdEntrada` e o adapter retorna `qtdTransferida = 0` com `CAMPOS_INDISPONIVEIS_CONFIRMACAO = ["qtdTransferida"]`, **o status `"transferencia"` nunca é disparado em produção**. As transferências recebidas são computadas indistintamente como `"confirmado"`, `"excedente"` ou `"parcial"`.

#### 2.3 Salvaguarda Implementada
- O adapter declara `qtdTransferida: 0` e inclui o campo em `CAMPOS_INDISPONIVEIS_CONFIRMACAO`.
- O cálculo do aprendizado utiliza `suprimentoReal` íntegro sem distorcer o histórico de demanda do produto.

#### 2.4 Recomendações para o Time de BI do Cliente
1. Expor a natureza da movimentação na ponta de entrada (`NOTAS` com `TIPO = 'E'`).
2. Mapear os CFOPs fiscais de transferência na entrada:
   - Compra de Fornecedor: CFOPs `1.102`, `2.102`, `1.403`, `2.403`.
   - Transferência Inter-Filiais: CFOPs `1.152`, `2.152`, `1.409`, `2.409`.
3. Criar e disponibilizar no modelo semântico a medida `[Quantidade Transferida Entrada]`.

---

### Ponto 3: Confiabilidade do Grupo do ERP (`CLASSES[ADESCRICAO]`)

#### 3.1 Evidências no Código e Modelo Semântico
- **Localização**: `adapters/carreiro/consultas-homologadas.ts:181-189`, `adapters/carreiro/mapeador-dax.ts:161-164`, `src/hooks/useFiltrosCockpit.ts:34, 230-239`, `src/components/cockpit/colunas-cockpit.tsx:258-279`.
- **A Contaminação da Classe no ERP**:
  No ERP, o campo `PRODUTOS[ACLASSE]` deveria vincular à tabela `CLASSES[ADESCRICAO]`, representando o macro-departamento mecânico da peça (ex.: MOTOR, SUSPENSÃO, FREIOS, CÂMBIO, ELÉTRICA).
  No entanto, o levantamento dos dados revelou uma contaminação severa no cadastro do cliente: diversas filiais e cadastradores registraram a **MARCA / FABRICANTE** dentro da tabela de classes (exemplo explícito homologado: `"PERFECT - PEÇAS AUTOMOTIVAS"`).
- **A Subclasse (`SUBCLASSES[ADESCRICAO]`)**:
  Ao contrário da classe, o campo `PRODUTOS[ASUBCLASSE]` associado a `SUBCLASSES[ADESCRICAO]` é tecnicamente padronizado e sólido: identifica a tipologia funcional exata do componente (`BIELETA`, `PIVO`, `AMORTECEDOR`, `BOMBA DE COMBUSTIVEL`).

#### 3.2 Impacto na Interface, Filtros e Motor
1. **Na Grade do Cockpit (`colunas-cockpit.tsx`)**:
   A coluna exibida ao comprador é estritamente `Sub-grupo` (`subgrupo`). A `Seção` (Classe) foi **removida da grade principal**, pois exibir marcas dentro de classes confunde o comprador. O comprador de autopeças compra por família de peça ("todas as bieletas de todas as marcas"), e não por uma classe que mistura fabricantes.
2. **No Mecanismo de Busca e Filtros (`useFiltrosCockpit.ts`)**:
   - `secaoNome` participa do índice de texto tokenizado (`preIndexarLinhaMatriz`).
   - O facet de filtros agrupa por `secoesMap`. Esse agrupamento fica distorcido: o usuário vê ao mesmo tempo "SUSPENSÃO" e "PERFECT - PEÇAS AUTOMOTIVAS". Se ele filtrar pela marca na faceta de seção, perderá os itens da mesma marca que foram classificados corretamente em outra categoria.
3. **No Motor de Compra**:
   O motor NÃO utiliza `secaoId` nem `nomeSecao` para cálculo de necessidade ou travas de intercambiabilidade. As travas utilizam `familiaId`, `codigoBase` ou descrição/subgrupo.

#### 3.3 Salvaguarda Implementada
- A grade principal isola o comprador do ruído, omitindo a coluna de Seção/Classe e mantendo visível a coluna de Sub-grupo (`SUBCLASSES`).
- O sistema mantém a classe disponível apenas no catálogo completo de exportação e metadados brutos.

#### 3.4 Recomendações para o Time de BI do Cliente
1. Conduzir um saneamento cadastral nas tabelas `PRODUTOS` e `CLASSES` no ERP, removendo nomes de fornecedores/marcas da hierarquia mercadológica.
2. Criar no modelo semântico uma tabela dimensão de departamentos canônica (`d_Departamento` ou `d_MacroFamilia`) gerida centralizadamente.

---

### Ponto 4: Cobertura de Subclasses (86% Preenchido vs 14% Nulos)

#### 4.1 Evidências no Código e Modelo Semântico
- **Localização**: `adapters/carreiro/mapeador-dax.ts:165-174`, `src/components/cockpit/colunas-cockpit.tsx:265-275`, `docs/pontas-soltas.md:134-136`.
- **Distribuição Observada**:
  Aproximadamente 86% dos SKUs ativos possuem `PRODUTOS[ASUBCLASSE]` preenchido com descrição válida em `SUBCLASSES[ADESCRICAO]`.
  Os restantes **14% chegam com valor nulo ou código órfão** sem correspondência na tabela dimensional.

#### 4.2 Causa-Raiz dos 14% de Nulos
A análise estrutural do catálogo da Carreiro revela que os 14% de nulos decorrem de dois fatores operacionais:
1. **Itens que não são autopeças tradicionais (Não Aplicável)**:
   Itens de conveniência/boutique, ferramentas de uso e consumo da oficina, embalagens, fluidos/óleos sem categorização técnica e serviços/mão-de-obra cadastrados sob o mesmo plano de itens do ERP.
2. **Cadastro Incompleto / Legado de Balcão**:
   Peças cadastradas em regime de urgência nas filiais para emissão imediata de cupom fiscal de venda, onde o operador preencheu apenas código, descrição e preço, deixando classe e subclasse vazias.

#### 4.3 Salvaguarda Implementada
- O mapeador (`mapeador-dax.ts:170-173`) normaliza strings vazias ou nulos estritamente como `null`.
- A coluna `subgrupo` em `src/components/cockpit/colunas-cockpit.tsx:265-275` trata a ausência com rigor:
  ```tsx
  cell: ({ row }) => {
    const sub = row.original.subgrupo;
    return sub ? (
      <span className="block truncate text-xs text-slate-700 dark:text-slate-300" title={sub}>
        {sub}
      </span>
    ) : (
      <span className="text-xs text-slate-400" title="O ERP do cliente não classificou este item">
        —
      </span>
    );
  }
  ```
- O sistema **NÃO cria categorias artificiais** como "OUTROS", "DIVERSOS" ou "NÃO INFORMADO". O travessão `—` comunica explicitamente ao comprador que o ERP não classificou o item.

#### 4.4 Recomendações para o Time de BI do Cliente
1. Fornecer relatório para o time de compras contendo os SKUs com `ASUBCLASSE IS NULL` que possuem vendas nos últimos 12 meses ou saldo físico atual $> 0$.
2. Criar códigos e descrições específicos no ERP para itens não-peças (ex.: `SUBCLASSE = 9999 - LUBRIFICANTES E FLUIDOS`, `9998 - CONSUMO INTERNO`).

---

## 3. Matriz de Recursos Descobertos (Features Discovered)

| # | Categoria | Recurso / Campo | Descrição | Entradas | Saídas | Comportamento de Erro / Salvaguarda | Descoberto Via |
|---|---|---|---|---|---|---|---|
| 1 | Estoque / On-Order | `quantidadeJaPedida` | Medição de pedidos abertos já emitidos ao fornecedor em trânsito | `ITEMSPEDIDO` ou `TBL_SOLICITACOES` | Inteiro $\ge 0$ ou `null` | Declarado em `camposIndisponiveis`. Cockpit exibe `—`. Motor desconta zero de forma conservadora. | `adapters/carreiro/mapeador-dax.ts:339`, `consultas-homologadas.ts:292` |
| 2 | Histórico / Ruptura | `diasRuptura90dias` | Dias com saldo zero na janela de 90 dias | `MOVESTOQ[ESTOQUEATUAL]` ou diário | Inteiro ou `null` | Modelo não tem histórico diário. Declarado em `camposIndisponiveis`. Cockpit exibe `—` e classificação "Sem histórico". | `adapters/carreiro/consultas-homologadas.ts:300`, `mapeador-dax.ts:420` |
| 3 | Aprendizado / Entrada | `qtdTransferida` | Segregação de entradas vindas de transferência entre lojas | Medida DAX ou `NOTAS` de entrada | Inteiro $\ge 0$ | Modelo soma em `qtdEntrada`. Declarado em `CAMPOS_INDISPONIVEIS_CONFIRMACAO`. Status "transferencia" não dispara. | `adapters/carreiro/entradas-confirmacao.ts:14`, `confirmacao-entrada.ts:79` |
| 4 | Catálogo / Hierarquia | `NomeSecao` | Descrição do Grupo / Família macro (Classe) | `CLASSES[ADESCRICAO]` | String legível ou `null` | ERP contém marcas cadastradas como classes. Omitido da grade principal; mantido em exportação e busca. | `adapters/carreiro/consultas-homologadas.ts:187`, `colunas-cockpit.tsx:258` |
| 5 | Catálogo / Taxonomia | `NomeSubgrupo` | Tipo de componente mecânico real (Subclasse) | `SUBCLASSES[ADESCRICAO]` | String legível ou `null` | Cobertura de 86%. 14% nulos renderizam travessão `—` sem rótulos artificiais. | `adapters/carreiro/mapeador-dax.ts:169`, `colunas-cockpit.tsx:265` |
| 6 | Estoque / Governança | `sinalGovernancaCompra` | Sinal de decisão de compra expedido pelo ERP | `DecisaoCompra` | `"COMPRAR"`, `"REDUZIR"`, `"MANTER"`, `null` | Se nulo, motor opera normalmente sem redução. Se `"REDUZIR"`, aplica corte escalonado por margem. | `adapters/carreiro/mapeador-dax.ts:330`, `core/calculo/necessidade.ts:457` |
| 7 | Estoque / Margem | `margemRealizada` / `margemAlvo` | Margem líquida do item apurada em 12 meses | `MargemRealizada`, `MargemAlvo` | Float (0..1) ou `null` | Se nula (falta de custo), cockpit exibe `null`; cálculo de corte usa alíquota padrão de tenant. | `adapters/carreiro/mapeador-dax.ts:335-336`, `core/dominio/estoque.ts:53` |

---

## 4. Casos de Borda e Comportamentos Observados (Edge Cases)

| # | Recurso / Campo | Entrada / Cenário | Comportamento Observado |
|---|---|---|---|
| E1 | `quantidadeJaPedida` | Solicitação interna aprovada na loja com `PEDIDO_COMPRA_ID = null` | Sistema ignora o registro como mercadoria em trânsito; motor mantém cálculo de compra integral; evita ruptura por pedido não enviado. |
| E2 | `quantidadeJaPedida` | SKU sem nenhuma solicitação ou pedido cadastrado no ERP | Campo retorna `null` na matriz; exportação gera campo vazio; cockpit mostra `—`. |
| E3 | `qtdTransferida` | Loja recebe 15 un transferidas de outra filial para atender snapshot de compra | As 15 un entram em `qtdEntrada`; `suprimentoReal = 15`; status avaliado como `"confirmado"` (ou `"excedente"`) em vez de `"transferencia"`. |
| E4 | `NomeSecao` | Produto cadastrado com `CLASSES[ADESCRICAO] = "PERFECT - PEÇAS AUTOMOTIVAS"` | Facet de filtro agrupa sob o nome da marca; grid principal ignora a classe e exibe apenas `Sub-grupo` (ex: "BIELETA"). |
| E5 | `NomeSubgrupo` | Item de serviço ou produto de balcão com `PRODUTOS[ASUBCLASSE] = null` | Mapeador retorna `null`; cockpit exibe `—` com tooltip `"O ERP do cliente não classificou este item"`. Não cria "OUTROS". |
| E6 | `diasRuptura90dias` | Produto com 0 vendas nos últimos 90 dias e saldo 0 | Como não há medição diária, não afirma 100% de ruptura; classifica como `"Sem histórico"` com `rupturaPercentual = null` e `—`. |
| E7 | `Devolucoes90d` | Nota com devolução registrada em `NOTAS_ITEMS[QTDE_DEV]` | Subtrai de `VendasQtd90d` para apurar `vendasLiquidas90dias`. Não utiliza `[Quantidade Comprada Produto]` (que gerava distorção). |

---

## 5. Diretrizes e Desbloqueio para a Unidade U6 (Régua do Motor)

A Unidade U6 (`docs/pontas-soltas.md` — Grupo E) tem como missão calibrar a régua do motor em três frentes sequenciais:
1. **E1 — Decidir o padrão de "sem histórico na loja"**:
   - **Diretriz de U7**: Confirmar a distinção entre **não medido** e **zero**. Quando uma loja não possui histórico de vendas para um SKU, não se pode assumir que a demanda do mercado é zero absoluto se o SKU nunca foi cadastrado ou abastecido naquela loja. O motor deve tratar explicitamente `perfilGiro = "SEM_HISTORICO_SUFICIENTE"`, mantendo a necessidade líquida em zero sem falsificar taxas diárias.
2. **E2 — Lote por Histograma vs Vocabulário**:
   - **Diretriz de U7**: A precedência obrigatória é `ERP > Histograma de Vendas (NOTAS_ITEMS) > Vocabulário`. Nunca assumir múltiplos de fábrica fixos se a evidência empírica de faturamento demonstrar múltiplos diferentes.
3. **E3 — Elegibilidade com 12 Meses vs 90 Dias**:
   - **Diretriz de U7**: A consulta DAX homologada já expõe `MesesAtivos12m` (`consultas-homologadas.ts:349`). A elegibilidade deve exigir `Notas12m >= 3` e `MesesAtivos12m >= 2`, eliminando sazonalidades espúrias de 90 dias.

---

## 6. Conclusão da Salvaguarda

As 4 pontas de dados ausentes identificadas no Grupo D estão formalmente auditadas, documentadas e blindadas no código:
- Nenhuma alteração foi introduzida no código de produção para preencher dados ausentes com zeros falsos.
- O contrato de dados `camposIndisponiveis` permanece como o guardião da integridade entre a fonte externa, o motor numérico e a interface do usuário.
- O time de BI do cliente possui agora um roteiro claro de saneamento e publicação das dimensões pendentes (`Ordens de Compra Firmes`, `CFOP de Entrada por Transferência` e `Higienização de Classes`).

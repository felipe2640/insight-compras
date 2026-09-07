# Relatório de Levantamento Técnico do Legado e Consultas DAX — Rede Carreiro
**Explorer M0**: Análise do Projeto Legado de Referência (`diario`), Consultas DAX Homologadas, Esquemas de Autopeças e Regras de Negócio  
**Data**: 06 de Setembro de 2026  
**Diretório de Análise**: `c:\Users\Felipe Barbosa\Documents\diario`  
**Destino do Handoff**: `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m0_legado\handoff.md`  

---

## 1. Observation (Evidências Diretas do Legado)

Foram inspecionados os arquivos fonte, scripts DAX, modelos semânticos, endpoints e serviços do projeto de referência em `c:\Users\Felipe Barbosa\Documents\diario`. Abaixo constam os fatos, caminhos absolutos, linhas e códigos literais extraídos diretamente da base legada.

### 1.1 Conexão Power BI / Fabric e Execução REST API
- **Arquivo**: `c:\Users\Felipe Barbosa\Documents\diario\lib\server\powerbi-service.ts`
  - **Linhas 194-199**:
    ```typescript
    const workspaceId = process.env.POWERBI_WORKSPACE_ID || "6bf4ec9d-2d71-48cf-b742-3460847d8036";
    const datasetId   = process.env.POWERBI_DATASET_ID   || "a1ac5650-ca05-4a08-9593-5550ab67e14b";
    const token = await getPowerBIAccessToken();
    const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`;
    ```
  - **Linhas 29-45**: Autenticação OAuth2 Service Principal (Client Credentials):
    - Escopo: `https://analysis.windows.net/powerbi/api/.default`
    - Variáveis de ambiente: `POWERBI_TENANT_ID`, `POWERBI_CLIENT_ID`, `POWERBI_CLIENT_SECRET` (com fallback para `POWERBI_ACCESS_TOKEN`).
  - **Linhas 220-230**: Normalização de retorno da API: remoção de prefixos `Tabela[Coluna]` para formato plano de chaves limpas.

### 1.2 Consultas DAX Oficiais Homologadas para a Rede Carreiro
No diretório `c:\Users\Felipe Barbosa\Documents\diario\queries\carreiro_2026\` e `c:\Users\Felipe Barbosa\Documents\diario\scratch\relatorio_validacao_queries.dax`, foram extraídas e auditadas as seguintes consultas homologadas:

#### A. Snapshot de Frescor e Integridade dos Dados (`freshness.dax`)
- **Arquivo**: `queries/carreiro_2026/freshness.dax` (linhas 1-7):
  ```dax
  EVALUATE
  ROW(
      "UltimaDataNota", MAX('NOTAS'[DENTSAID]),
      "UltimaDataVendaValida", MAXX(FILTER(ALL('dCalendario'[Data]), [Receita Liquida] > 0), 'dCalendario'[Data]),
      "UltimaAtualizacaoProduto", MAX('PRODUTOS'[DULT_ATLZ]),
      "UltimoMovimento", MAX('MOVESTOQ'[DATA_HORA])
  )
  ```

#### B. Mapeamento e Identificação das Lojas da Rede (`store_map.dax`)
- **Arquivo**: `queries/carreiro_2026/store_map.dax` (linhas 1-8):
  ```dax
  EVALUATE
  SELECTCOLUMNS(
      FILTER(CADEMP, NOT ISBLANK(CADEMP[ANOMEFANTASIA])),
      "Empresa", CADEMP[ACODEMP],
      "Loja", CADEMP[ANOMEFANTASIA]
  )
  ORDER BY [Loja]
  ```
- **Arquivo**: `analises/auditar_movestoq.py` (linhas 22-28) revela os identificadores únicos (`ACODEMPRESA`) das 5 filiais da Rede Carreiro:
  - `"1|e2adc241-50f7-4dcd-9527-423080cd8c5c"`: **Carreiro Pedro II (Matriz)**
  - `"1|cd87703f-0d8c-447e-9bdf-5c1d790f587b"`: **Melo / Piripiri (Melo Distribuidora)**
  - `"1|a5172ddc-0dd0-4f8e-bb0d-5018183d4457"`: **Carreiro Poranga**
  - `"1|c9432abf-af64-40d2-abe3-21124f49b2ae"`: **Ceará Auto Peças (Campo Maior)**
  - `"1|d624d502-59a4-4ab2-910b-99ae9bf7462a"`: **Carreiro José de Freitas**

#### C. Linha de Base Móvel de 12 Meses por Filial (`baseline_store.dax`)
- **Arquivo**: `queries/carreiro_2026/baseline_store.dax` (linhas 1-19):
  ```dax
  EVALUATE
  VAR AsOf = DATE(2026, 9, 2)
  VAR Periodo12m =
      FILTER(
          ALL('dCalendario'[Data]),
          'dCalendario'[Data] > EDATE(AsOf, -12) && 'dCalendario'[Data] <= AsOf
      )
  RETURN
  SUMMARIZECOLUMNS(
      'CADEMP'[ANOMEFANTASIA],
      Periodo12m,
      "Receita12m", CALCULATE([Receita Liquida], KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta")),
      "QtdVendida12m", CALCULATE([Quantidade Vendida Produto], KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta")),
      "Compras12m", [Valor Comprado Produto],
      "QtdComprada12m", [Quantidade Comprada Produto],
      "EstoqueValor", [Estoque Valor Imobilizado (Base)],
      "EstoqueQtd", [Estoque Qtd Atual (Base)]
  )
  ORDER BY 'CADEMP'[ANOMEFANTASIA]
  ```

#### D. Posição Atual de Estoque e Preço ERP (`current_product.dax`)
- **Arquivo**: `queries/carreiro_2026/current_product.dax` (linhas 1-11):
  ```dax
  EVALUATE
  SELECTCOLUMNS(
      FILTER(PRODUTOS, COALESCE(PRODUTOS[NESTOQATUAL], 0) <> 0),
      "Empresa", PRODUTOS[ACODEMPRESA],
      "Produto", PRODUTOS[ACODPRODUTO],
      "Descricao", PRODUTOS[ADESCRICAO],
      "EstoqueQtd", PRODUTOS[NESTOQATUAL],
      "PrecoCompraERP", PRODUTOS[NPRECOCOMPRA],
      "UltimaVenda", PRODUTOS[DULTIMAVENDA]
  )
  ORDER BY [Empresa], [Produto]
  ```

#### E. Histórico Mensal de Vendas e Compras por SKU (`monthly_product.dax`)
- **Arquivo**: `queries/carreiro_2026/monthly_product.dax` (linhas 1-25):
  ```dax
  EVALUATE
  VAR Periodo =
      FILTER(
          ALL('dCalendario'[Data]),
          'dCalendario'[Data] >= DATE(2024, 1, 1)
              && 'dCalendario'[Data] <= DATE(2026, 8, 31)
      )
  RETURN
  FILTER(
      SUMMARIZECOLUMNS(
          'CADEMP'[ANOMEFANTASIA],
          'PRODUTOS'[ACODPRODUTO],
          'PRODUTOS'[ADESCRICAO],
          'dCalendario'[Ano],
          'dCalendario'[Mês],
          Periodo,
          "QtdVenda", CALCULATE([Quantidade Vendida Produto], KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta")),
          "Receita", CALCULATE([Receita Liquida], KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta")),
          "QtdCompra", [Quantidade Comprada Produto],
          "ValorCompra", [Valor Comprado Produto]
      ),
      [QtdVenda] <> 0 || [QtdCompra] <> 0
  )
  ORDER BY 'CADEMP'[ANOMEFANTASIA], 'PRODUTOS'[ACODPRODUTO], 'dCalendario'[Ano], 'dCalendario'[Mês]
  ```

#### F. Demanda Diária por SKU e Loja (`daily_demand.dax`)
- **Arquivo**: `queries/carreiro_2026/daily_demand.dax` (linhas 1-19):
  ```dax
  EVALUATE
  VAR Periodo =
      FILTER(
          ALL('dCalendario'[Data]),
          'dCalendario'[Data] >= DATE(2025, 1, 1)
              && 'dCalendario'[Data] <= DATE(2026, 9, 2)
      )
  RETURN
  FILTER(
      SUMMARIZECOLUMNS(
          'CADEMP'[ANOMEFANTASIA],
          'PRODUTOS'[ACODPRODUTO],
          'dCalendario'[Data],
          Periodo,
          "QtdVenda", CALCULATE([Quantidade Vendida Produto], KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta"))
      ),
      [QtdVenda] <> 0
  )
  ORDER BY 'CADEMP'[ANOMEFANTASIA], 'PRODUTOS'[ACODPRODUTO], 'dCalendario'[Data]
  ```

#### G. Idade de Estoque e Capital Imobilizado (`stock_age_store.dax`)
- **Arquivo**: `queries/carreiro_2026/stock_age_store.dax` (linhas 1-13):
  ```dax
  EVALUATE
  FILTER(
      SUMMARIZECOLUMNS(
          'CADEMP'[ANOMEFANTASIA],
          'Dim_Faixa_Idade_Estoque'[Faixa],
          "EstoqueValor", [Estoque Valor Imobilizado por Faixa Idade],
          "EstoqueQtd", [Estoque Qtd Unidades por Faixa Idade],
          "Produtos", [Estoque Qtd Produtos por Faixa Idade]
      ),
      NOT ISBLANK('CADEMP'[ANOMEFANTASIA])
  )
  ORDER BY 'CADEMP'[ANOMEFANTASIA], 'Dim_Faixa_Idade_Estoque'[Faixa]
  ```

#### H. Itens com Demanda nos Últimos 90 Dias sem Saldo em Estoque (Ruptura Histórica)
- **Arquivo**: `scratch/relatorio_validacao_queries.dax` (linhas 49-71):
  ```dax
  EVALUATE
  SUMMARIZECOLUMNS(
      'CADEMP'[ANOMEFANTASIA],
      "ItensVendidos90d", COUNTROWS(
          FILTER(
              VALUES('PRODUTOS'[ACODPRODUTO]),
              CALCULATE(
                  [Quantidade Vendida Produto],
                  DATESINPERIOD('dCalendario'[Data], DATE(2026, 7, 29), -90, DAY)
              ) > 0
          )
      ),
      "ItensVendidos90dSemSaldo", COUNTROWS(
          FILTER(
              VALUES('PRODUTOS'[ACODPRODUTO]),
              CALCULATE(
                  [Quantidade Vendida Produto],
                  DATESINPERIOD('dCalendario'[Data], DATE(2026, 7, 29), -90, DAY)
              ) > 0
                  && [Estoque Qtd Atual (Base)] <= 0
          )
      )
  )
  ```

#### I. Cruzamento de Similares Intercambiáveis
- **Arquivo**: `queries/carreiro_2026/produtos_semelhantes_temp_audit.dax` (linhas 1-25):
  - Tabela semântica: `TMP_AUDIT_PRODUTOS_SEMELHANTES_20260819`
  - Colunas: `[ACODPRODUTO]`, `[ACODPRODUTO_SEMELHANTE]`, `[TIPO]`, `[DATAFLOW_ID]`.
  - Auditoria: 165.986 pares distintos mapeados nos dataflows Gen1 da Carreiro.
- **Arquivo**: `queries/carreiro_2026/battery_similarity_temp_audit.dax` (linhas 1-21):
  - Demonstração com `LOOKUPVALUE(PRODUTOS[NESTOQATUAL], ...)` para cruzar produtos com saldo zero cuja peça similar tem saldo positivo em estoque.

### 1.3 Tabelas Semânticas, Colunas e Medidas no Power BI
As tabelas semânticas do modelo `Autopeca multi loja` e seus campos homologados são:
1. `'PRODUTOS'`:
   - `[ACODPRODUTO]`: Identificador / SKU da peça
   - `[ACODEMPRESA]`: GUID da filial
   - `[ADESCRICAO]`: Descrição técnica comercial
   - `[NESTOQATUAL]`: Quantidade física atual em estoque
   - `[NPRECOCOMPRA]`: Custo médio / preço de compra no ERP
   - `[DULTIMAVENDA]`: Data da última saída por venda
   - `[DULT_ATLZ]`: Data/hora do último snapshot de atualização
   - `[MARCA]`: Marca do fabricante da autopeça
   - `[ASECAO]`: Seção / Categoria de autopeças
   - `[AFABRICANTE]`: Código do fabricante
   - `[AREFFABRICA]`: Referência original de fábrica
   - `[ACODFORNECEDOR]`: Código do fornecedor principal
   - `[ADATA_ULTIMA_COMPRA]`: Data da última chegada de NF-e
2. `'PRODUTOS_ESTOQUE'`:
   - `[ACODPRODUTO]`, `[ACODEMPRESA]`, `[AESTOQUE_ATUAL]`, `[AESTOQUE_MINIMO]`, `[AQUANTIDADE_PEDIDA]`, `[ACONSUMO_MEDIO_DIARIO]`, `[ACLASSIFICACAO_ABC]`, `[ADATA_ULTIMA_VENDA]`
3. `'NOTAS'` & `'NOTAS_ITEMS'`:
   - `'NOTAS'[ANUMERONOTA]`: Número da NF
   - `'NOTAS'[ACODEMPRESA]`: Filial emissora
   - `'NOTAS'[DENTSAID]`: Data de emissão/saída
   - `'NOTAS'[Tipo Movimentação]`: Tipo operacional (filtro crítico: `"Venda Direta"`)
   - `'NOTAS_ITEMS'[ACODPRODUTO]`, `'NOTAS_ITEMS'[AQUANTIDADE]`
4. `'CADEMP'`:
   - `'CADEMP'[ACODEMP]`: Código da filial (1 a 5)
   - `'CADEMP'[ANOMEFANTASIA]`: Nome da loja
5. `'dCalendario'`:
   - `'dCalendario'[Data]`, `'dCalendario'[Ano]`, `'dCalendario'[Mês]`
6. `'MOVESTOQ'`:
   - `[ACODEMPRESA]`, `[ACODPRODUTO]`, `[DATA_HORA]`, `[ICONTADOR]`, `[ATIPOMOV]` ("E" para Entrada, "S" para Saída), `[AJUSTE]` ("T" ou "F"), `[NQTDEMOV]`, `[AOBSERVACAO]` ("VDA" para Venda, "NF NO" para Entrada de NF).
7. Medidas Homologadas no Power BI:
   - `[Receita Liquida]`: Faturamento líquido de devoluções
   - `[Quantidade Vendida Produto]`: Volume físico vendido
   - `[Valor Comprado Produto]`, `[Quantidade Comprada Produto]`
   - `[Estoque Valor Imobilizado (Base)]`, `[Estoque Qtd Atual (Base)]`
   - `[Estoque Valor Imobilizado por Faixa Idade]`, `[Estoque Qtd Unidades por Faixa Idade]`
   - `[Estoque Valor Imobilizado no Intervalo Dias]` (utilizado com `TREATAS`)
   - `[Quantidade de Notas]`

### 1.4 Taxonomia de Autopeças e Agrupamento Familiar
- **Arquivo**: `c:\Users\Felipe Barbosa\Documents\diario\analises\carreiro_ml\regional_patterns.py` (linhas 24-57):
  - **Famílias/Conjuntos (Assemblies)**:
    - *Pneus e rodagem*: `\bPNEU\b`, `CAMARA DE AR`, `PROTETOR ARO`.
    - *Rolamentos, cubos e rodas*: `KIT ROL RODA`, `ROLAMENTO DA RODA`, `CUBO RODA`, `RETENTOR RODA`.
    - *Transmissão e embreagem*: `EMBRE`, `KIT EMBR`, `ATUADOR EMBR`, `CABO EMBR`, `CILINDRO EMBR`, `HOMOCINET`, `SEMI EIXO`, `CRUZETA`, `COROA PINHAO`, `DIFERENCIAL`, `EIXO PRISE`, `TRIZETA`, `JUNTA DESLIZANTE`.
    - *Suspensão e direção*: `AMORTECED`, `AMORT`, `PIVO`, `BUCHA`, `BIELETA`, `BARRA AXIAL`, `BANDEJA`, `CAIXA DIRECAO`, `BOMBA DIR`, `TERMINAL DIRECAO`, `SERVO DIRECAO`.
    - *Freios*: `PASTILHA`, `SAPATA`, `DISCO DE FREIO`, `TAMBOR DE FREIO`, `CILINDRO MESTRE`, `CILINDRO RODA`, `FLUIDO DE FREIO`, `SERVO FREIO`, `HIDROVAC`.
    - *Arrefecimento*: `RADIADOR`, `ADITIVO`, `VALVULA TERMOSTATICA`, `BOMBA D'AGUA`, `MANGUEIRA RADIADOR`, `TAMPA RADIADOR`, `RESERVATORIO AGUA`.
    - *Ignição, injeção e combustível*: `VELA`, `CABO DE VELA`, `BOBINA`, `BICO INJETOR`, `BOMBA COMBUSTIVEL`, `INJECAO`, `SENSOR`, `SONDA LAMBDA`, `CORPO BORBOLETA`.
    - *Elétrica, partida e iluminação*: `ALTERNADOR`, `MOTOR DE PARTIDA`, `ARRANQUE`, `REGULADOR DE VOLTAGEM`, `LAMPADA`, `FAROL`, `LANTERNA`, `RELE`.
    - *Motor e vedação*: `KIT MOTOR`, `PISTAO`, `BRONZINA`, `JUNTA`, `RETENTOR`, `CABECOTE`, `COMANDO VALVULA`, `CORREIA DENTADA`, `TENSOR`, `BOMBA OLEO`, `COXIM MOTOR`, `VIRABREQUIM`.
    - *Óleos, filtros e lubrificação*: `\bOLEO\b`, `\bFILTRO\b`, `LUBRIFICANTE`, `\bGRAXA\b`.
    - *Vidros, lataria e acabamento*: `PARABRISA`, `VIDRO`, `PARACHOQUE`, `RETROVISOR`, `MACANETA`.
    - *Escape*: `ESCAPAMENTO`, `SILENCIOSO`, `CATALISADOR`.
    - *Baterias*: `BATERIA` (isolando rigorosamente de sucatas, cascos e acessórios como terminais, garras, cabos).
  - **Aplicações Veiculares**:
    - *Picapes e Utilitários de Trabalho* (Motor de rentabilidade: 32,9% a 38,6% do faturamento): Strada, Saveiro, S10, Hilux, L200, Ranger, Amarok, Frontier, Toro, D20, D10, F4000.
    - *Leves*: Fiat (Uno, Palio, Siena, Mobi, Argo), VW (Gol, Fox, Voyage, Polo), Chevrolet (Corsa, Celta, Onix, Prisma, Spin), Ford (Fiesta, Ka, Ecosport), Toyota (Corolla, Etios), Renault (Kwid, Sandero, Logan, Duster), Honda (Civic, Fit).
    - *Linha Pesada*: MBB, Scania, Volvo, Iveco, Agrale, Volare.

### 1.5 Motor Numérico de Sugestão, Travas e Transferência
- **Arquivos**:
  - `c:\Users\Felipe Barbosa\Documents\diario\lib\purchase-intelligence\suggestion-core.mjs`
  - `c:\Users\Felipe Barbosa\Documents\diario\lib\purchase-intelligence\suggestion.ts`
  - `c:\Users\Felipe Barbosa\Documents\diario\compra-auto\services\calc.service.ts`
- **Regras Matemáticas Exatas**:
  1. **Guarda de Elegibilidade (Recorrência Mínima)**:
     - `MIN_NOTAS_12M = 3`
     - `MIN_MESES_12M = 2`
     - Se `notas_12m < 3 || meses_12m < 2`, classificação = `"sem_historico_suficiente"`, sugestão travada em 0 (`null`). Isso elimina a aberração do legado onde compras eram sugeridas por uma única venda pontual ocorrida em 30 dias.
  2. **Classificação de Perfil de Giro**:
     - `consumoMensal = m0Diario * 30`
     - `consumoMensal >= 6`: `"alto_giro"` (Horizonte: 20 dias, Margem: 0.25)
     - `consumoMensal >= 2.5`: `"medio_giro"` (Horizonte: 15 dias, Margem: 0.45)
     - `consumoMensal < 2.5`: `"baixo_giro_intermitente"` (Horizonte: 7 dias, Margem: 0.80)
  3. **Detecção Automática do Lote Físico de Venda (`detectarLote`)**:
     - Analisa linhas de saída dos últimos 12 meses (mínimo de 8 linhas).
     - Se dominância >= 70% em múltiplos de 4: Lote = 4 (jogo de velas, rodas).
     - Se dominância >= 70% em múltiplos de 2: Lote = 2 (pares de amortecedores, discos, pneus).
     - Senão: Lote = 1 (avulso / unitário).
  4. **Piso de Demanda Natural**:
     - `piso = Math.max(lote, arredondarParaLote(medianaVenda, lote))`
     - `demandaHorizonte = m0Diario * horizonteDias * (1 + margem)`
     - `sugestaoAlvo = Math.max(piso, arredondarParaLote(demandaHorizonte, lote))`
  5. **Transferência Segura de Sobra de Origem**:
     - `need1 = Math.max(0, meta1 - estoque1)`
     - `minStock2 = Math.max(meta2, 1)`
     - `surplus2 = Math.max(0, estoque2 - minStock2)`
     - `transferir2Para1 = Math.min(need1, surplus2)`
     - **Garantia matemática**: A loja 2 doa exclusivamente o que excede seu próprio estoque mínimo de segurança (`saldo - minStock > 0`). Nunca se desabastece a filial doadora.
  6. **Cálculo da Necessidade Líquida e Múltiplo de Fábrica**:
     - `restanteRaw = Math.max(0, meta - estoqueAtual - jaPedida)`
     - `pedir = Math.ceil(restanteRaw)`
     - Se `minMultiplo > 1`, ajusta para `minMultiplo * Math.ceil(pedir / minMultiplo)`, distribuindo sobras para a filial de maior carência.
  7. **Travas Anti-Encalhe (Marca Zumbi e Cobertura)**:
     - SKUs com saldo positivo e 0 vendas nos últimos 180 dias têm sugestão final igual a 0.
     - Checagem cruzada: se a soma dos similares da aplicação cobrir o período de planejamento, o pedido de novo SKU de marca zumbi é travado em 0.

### 1.6 Estrutura do Grid Virtualizado (baseColumns) e Tooltips Analíticos
- **Arquivos**:
  - `c:\Users\Felipe Barbosa\Documents\diario\compra-auto\components\CalcDiaTable.tsx` (linhas 1576-2930)
  - `c:\Users\Felipe Barbosa\Documents\diario\compra-auto\components\calc-dia\utils.ts`
  - `c:\Users\Felipe Barbosa\Documents\diario\compra-auto\components\calc-dia\types.ts`
- **Matriz de Colunas (`baseColumns`)**:
  1. `select`: Checkbox para seleção em massa.
  2. `codigo`: Código do produto, ícone de Similares com saldo positivo (`Sparkles`) e ícone de Alerta de Chegada no dia (`AlertTriangle`).
  3. `descricao`: Descrição completa do produto (fixada à esquerda).
  4. `aplicacao`: Veículos compatíveis (com tooltip se texto longo).
  5. `refFabricante`: Código de referência original da peça.
  6. `marca`: Marca do fornecedor/fabricante.
  7. `custo`: Custo contábil médio no ERP (formatado em R$).
  8. `dtUltVenda`: Data da última saída por venda.
  9. `dtUltimaCompra`: Data da última entrada por NF-e.
  10. `curvaAbcSistema`: Curva ABC original do ERP.
  11. `produtosVend`: Vendas líquidas nos 90 dias (verde esmeralda).
  12. `notas_liquidas`: Notas fiscais líquidas nos 90 dias.
  13. `consumoDiario`: Consumo diário do ERP / calculado.
  14. `consumoMensal`: Consumo médio mensal (`consumoDiario * 30`).
  15. `vendaACada`: Frequência de giro em dias (`30 / consumoMensal`).
  16. `consumoUltimos30DiasQtd`: Volume líquido dos últimos 30 dias com Tooltip Analítico.
  17. `classificacaoGiroSemVenda`: Giro por última venda (Alta <= 30d, Média 31-90d, Baixa > 90d) com Tooltip.
  18. `frequenciaNotas90d`: Frequência por notas em 90 dias (Alta > 40%, Média 15-40%, Baixa < 15%) com Tooltip Analítico.
  19. `qtdVendida90d`: Volume vendido 90d (Alta >= 100, Média 30-99, Baixa < 30) com Tooltip.
  20. `classificacaoRuptura`: Diagnóstico de Ruptura (Boa <= 5%, Atenção 5-10%, Grave > 10%, Sem histórico) com Tooltip.
  21. `periodoIdealAnalise`: Janela ideal recomendada (30d, 60-90d, 120-180d).
  22. `histVendaNotas90d` & `histVendaQtd90d`: Vendas nos 90 dias antes do último movimento de saída.
  23. `diasSemVenda`: Quantidade de dias corridos desde a última venda.
  24. `leadTimeDias`: Tempo de resposta/entrega do fornecedor em dias.
  25. `secaoNome` & `subSecaoNome`: Família e subcategoria do ERP.
  26. `estoqueFoco`: Saldo físico da filial em análise.
  27. `estoqueOutra`: Saldo físico das outras filiais da rede.
  28. `movimentacao`: Status visual (`PEDIR`, `TRANSFERIR`, `PEDIR_TRANSFERIR`, `OK`) com resumo numérico (`P {pedir} / T {transferir}`).
  29. `pedidoPersonalizado`: Input numérico editável com Tooltip analítico da decomposição matemática do pedido.
  30. `transferenciaPersonalizada`: Input numérico editável com Tooltip analítico da sobra de origem e destino.
- **Detalhamento dos Tooltips Analíticos**:
  - **Tooltip de Ruptura**: Exibe dias analisados (90), dias desde o último estoque zero, percentual calculado (`diasZerados / 90`) e classificação de gravidade.
  - **Tooltip de Frequência por Notas**: Exibe total de notas de venda, total de devoluções, saldo de notas líquidas, percentual de frequência e lista discriminada de cada nota com data, cliente, tipo (Venda em verde, Devolução em vermelho), quantidade e notas.
  - **Tooltip de Cobertura / 30 Dias**: Decompõe as saídas dos últimos 30 dias com data, cliente, tipo de movimentação e quantidade.
  - **Tooltip de Transferência**: Detalha a sobra real da filial de origem acima do estoque de segurança (`estoque - minStock`), filial de destino e justificativa de reposição.
  - **Tooltip de Entrada de NF-e do Dia**: Acionado pelo ícone de alerta na coluna de código, mostra data de entrada, número da NF (`NF: 12345`), fornecedor emissor e quantidade recebida (`+12 un`).

---

## 2. Logic Chain (Cadeia Lógica das Descobertas)

1. **Premissa de Desacoplamento Arquitetural**:
   - *Observação*: O projeto legado misturava chamadas diretas a tabelas MySQL do ERP com chamadas ao Power BI REST API (`executeQueries`), além de autenticação vinculada a planilhas (`google-cms.ts`).
   - *Dedução*: A nova plataforma deve aplicar Clean Architecture estrita: um núcleo puro (`core/`) em TypeScript sem nenhuma dependência de infraestrutura, e uma camada de adaptadores (`adapters/carreiro/`) que encapsula o consumo do modelo semântico Power BI/Fabric via DAX com cache resiliente.

2. **Garantia de Não-Desabastecimento na Transferência**:
   - *Observação*: Em `calc.service.ts` (linhas 800-810), a sobra disponível para doação é calculada como `Math.max(0, estoque2 - minStock2)`, onde `minStock2 = Math.max(meta2, 1)`.
   - *Dedução*: Uma loja nunca doa peças se estiver dentro da sua margem de segurança. Isso resolve o receio dos gerentes de filial de "ficar sem estoque para abastecer o vizinho".

3. **Causa Raiz de Compras Erradas no Legado (Shadow Mode Audit)**:
   - *Observação*: O relatório executivo (`RELATORIO_DIAGNOSTICO_COMPRAS_E_ESTOQUE.md`) revelou que 76,4% das sobrecompras manuais (R$ 89,9 mil) continuaram 100% encalhadas após 90 dias, enquanto 518 itens de alto giro ignorados ficaram totalmente zerados gerando R$ 39,5 mil em vendas perdidas.
   - *Dedução*: O motor de compras deve ser estritamente numérico, bloqueando sobrecompras arbitrárias de itens lentos e alertando imediatamente sobre rupturas em itens com demanda comprovada.

4. **Tratamento de Lotes e Múltiplos Físicos de Embalagem**:
   - *Observação*: Em `suggestion.ts`, provou-se que categorizar lotes por premissas teóricas falha no catálogo real (ex: pastilhas saem em jogo de 1 caixa, velas em múltiplos de 4, pneus frequentemente avulsos em 1).
   - *Dedução*: O motor deve permitir aprender o lote dominante do histórico de saídas (dominância >= 70% em 12 meses) e, na interface, oferecer ao comprador o ajuste final de múltiplos de embalagem industrial sem quebrar o cálculo de demanda.

5. **Eliminação do Falso Giro por Venda Única**:
   - *Observação*: O critério legado de olhar apenas `data_ultima_venda <= 30d` inflava o catálogo com compras de peças que tiveram uma única venda acidental em 12 meses.
   - *Dedução*: A regra de elegibilidade com `>= 3 notas em >= 2 meses distintos` em 12 meses (`suggestion-core.mjs`) é mandatória para qualquer SKU receber sugestão do motor.

---

## 3. Caveats (Armadilhas Evitadas e Limitações Observadas)

1. **Armadilha de `ITEMSPEDIDO[AREFERENCIA2]` (Campo 100% Vazio)**:
   - *Evidência*: A consulta `areferencia2_audit.dax` e a evidência `E15` comprovaram que todas as 237.831 linhas do campo `ITEMSPEDIDO[AREFERENCIA2]` no modelo semântico estão completamente vazias (`null` ou string vazia).
   - *Diretriz*: **Nunca utilizar `AREFERENCIA2`** para identificar referências cruzadas ou similares. A correlação de similares deve usar a tabela `TMP_AUDIT_PRODUTOS_SEMELHANTES_20260819` ou o cruzamento via `fabricante_produto.reffabrica`.

2. **Armadilha de Motos e Peças Agrícolas**:
   - *Evidência*: Embora motocicletas representem 65% a 72% da frota dos municípios onde a Carreiro atua (dados SENATRAN), elas representam menos de 0,3% do faturamento da rede. Peças agrícolas somaram apenas R$ 1.580 em 12 meses.
   - *Diretriz*: Não sugerir compras especulativas para linha agrícola ou motocicletas. O foco de rentabilidade comprovada (33% a 39% da receita) são **picapes e utilitários leves** (Strada, Hilux, Saveiro, S10, Toro).

3. **Armadilha do "Festival de Inverno de Pedro II"**:
   - *Evidência*: A auditoria histórica comprovou que a receita em junho em Pedro II não teve aumento sazonal recorrente em 2024, 2025 e 2026.
   - *Diretriz*: Não criar multiplicadores sazonais artificiais para eventos pontuais de calendário.

4. **Distinção Rigorosa no Segmento de Baterias**:
   - *Evidência*: Cascos, sucatas, taxas de descarte e acessórios (terminais, cabos, garras) poluem a descrição de baterias se não forem filtrados via regex / regras semânticas.
   - *Diretriz*: Isolar baterias completas (50Ah, 60Ah, 70Ah) e reconhecer os picos sazonais reais: outubro em Poranga (+83% a +161%) e dezembro em Piripiri.

5. **Resiliência e Cache na Conexão Power BI / Fabric**:
   - *Limitação*: A API `executeQueries` do Power BI possui limites de concorrência e pode sofrer instabilidade momentânea ou rate-limiting.
   - *Diretriz*: O adaptador `adapters/carreiro/` deve conter camada de cache em memória / local com TTL configurável (ex: 15 a 60 minutos) e fallback gracioso para snapshots pré-carregados.

---

## 4. Conclusion (Diretrizes Finais para a Nova Plataforma)

1. **Arquitetura Desacoplada (Clean Architecture)**:
   - Diretório `core/`: 100% puro em TypeScript (zero dependências de banco, UI ou Next.js). Contém `demand-engine.ts`, `transfer-engine.ts`, `guardrails.ts` e `types.ts`.
   - Diretório `adapters/carreiro/`: Implementação da interface `InventoryAdapter`, executando as consultas DAX extraídas (`baseline_store.dax`, `monthly_product.dax`, `daily_demand.dax`, `current_product.dax`, `freshness.dax`) e tratando a normalização dos dados.
   - Diretório `config/tenants/carreiro.ts`: Configuração visual (Azul/Dourado Carreiro, logos, lojas da rede e assinatura iNSIGHT D).

2. **Cockpit do Comprador Virtualizado**:
   - Grid baseado em `@tanstack/react-table` v8 e `@tanstack/react-virtual`, renderizando mais de 25.000 SKUs a 60fps com tempo de busca inferior a 250ms.
   - Implementação fiel de todas as `baseColumns` e dos 5 tooltips ricos: Ruptura, Frequência (90d), Cobertura (30/90/180d), Transferência Segura e Entradas de NF-e do dia.
   - Células editáveis para pedido e transferência com cálculo instantâneo e ajuste para múltiplos/pares de fábrica.

3. **RBAC e Cibersegurança**:
   - Sessão segura com restrição estrita aos fornecedores atribuídos ao comprador (`allowedSupplierIds`), impedindo vazamento de dados de outros compradores na API e no front-end.
   - Sanitização de parâmetros para impedir injeção em consultas DAX.

---

## 5. Verification Method (Como Reproduzir e Validar Independentemente)

Para auditar e verificar de forma independente todas as consultas DAX e esquemas descritos neste relatório, utilize os procedimentos abaixo:

### 5.1 Teste de Execução DAX via Power BI CLI
Se o ambiente possuir a ferramenta `pbi` instalada e o modelo semântico ativo:
```bash
# 1. Testar snapshot de frescor
pbi --json -c carreiro_20260903 dax execute queries/carreiro_2026/freshness.dax

# 2. Testar mapa de lojas
pbi --json -c carreiro_20260903 dax execute queries/carreiro_2026/store_map.dax

# 3. Testar consulta de linha de base de 12 meses
pbi --json -c carreiro_20260903 dax execute queries/carreiro_2026/baseline_store.dax

# 4. Validar que AREFERENCIA2 está 100% nulo/vazio
pbi --json -c carreiro_20260903 dax execute queries/carreiro_2026/areferencia2_audit.dax
```

### 5.2 Teste via Power BI REST API (`executeQueries`)
Executar chamada HTTP POST contra a API oficial do Power BI:
- **Endpoint**: `https://api.powerbi.com/v1.0/myorg/groups/6bf4ec9d-2d71-48cf-b742-3460847d8036/datasets/a1ac5650-ca05-4a08-9593-5550ab67e14b/executeQueries`
- **Headers**:
  - `Authorization: Bearer <TOKEN>`
  - `Content-Type: application/json`
- **Body**:
  ```json
  {
    "queries": [
      {
        "query": "EVALUATE ROW(\"UltimaDataNota\", MAX('NOTAS'[DENTSAID]), \"UltimaVendaValida\", MAXX(FILTER(ALL('dCalendario'[Data]), [Receita Liquida] > 0), 'dCalendario'[Data]))"
      }
    ],
    "serializerSettings": { "includeNulls": true }
  }
  ```

### 5.3 Validação dos Testes Unitários do Motor Numérico
No novo repositório `insight-compras`, validar que os testes cobrem:
1. `transfer-engine.test.ts`: Loja doadora com `estoque <= minStock` resulta em `transferir = 0`.
2. `guardrails.test.ts`: Item com `vendas_180d = 0` e `estoque > 0` resulta em `sugestao = 0`.
3. `demand-engine.test.ts`: Item com `< 3 notas` em 12 meses é classificado como inelegível e retorna `sugestao = null` / 0.
4. `lote.test.ts`: Itens com mais de 70% de vendas em múltiplos de 2 ou 4 têm a sugestão arredondada para cima respeitando a dominância física.

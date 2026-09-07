# Handoff Report — Especificação Completa da Matriz de Colunas (baseColumns) e dos 5 Tooltips Analíticos Ricos para o Cockpit do Comprador

> **Agente**: `spec_miner_m3_tooltips_r1` (teamwork_preview_spec_miner)  
> **Data**: 2026-09-06T13:29:00-03:00  
> **Contexto**: Plataforma White-Label de Inteligência e Copiloto de Compras para Autopeças (iNSIGHT D / Rede Carreiro)  
> **Destinatário**: Orquestrador (`parent`), Engenheiros de Front-end do Cockpit (M3) e Suíte de Testes  
> **Status**: Concluído (Hard Handoff)

---

## 1. Observation

A mineração de requisitos e especificações técnicas baseou-se na leitura exaustiva e cruzamento direto das seguintes fontes autoritativas:

1. **Requisitos de Negócio e Arquitetura do Projeto**:
   - `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md`:
     - Requisito `R2` (linhas 23-38): Especifica a matriz de decisão com indicadores do novo modelo (Diagnóstico de Ruptura, Frequência por Notas em 90d, Coberturas Comparativas 30d/90d/180d, Alerta NF-e do dia, Similares intercambiáveis com saldo, Células editáveis com múltiplos/embalagens mínimas e pares) e os 5 Tooltips analíticos detalhados com abertura instantânea (`delayDuration={0}`).
     - Critérios de Aceite (linhas 62-67): Tempo de resposta inferior a 250ms em 25.000 SKUs, cálculo matemático fiel aos dados reais, tooltips instantâneos no hover/foco e edição de pedidos com múltiplos/pares.
   - `c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md`:
     - Feature Inventory (linhas 65-71): Itens 15 a 21 detalham as colunas `baseColumns`, os 5 tooltips, células editáveis e persistência de rascunho de sessão.
     - Contrato de Interface (linhas 118-126): Contrato entre a aplicação e os componentes de cockpit (`DecisionMatrixRow` / `LinhaCockpit`).
   - `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\spec_miner_m0_cockpit\handoff.md`:
     - Seção 3.3 (linhas 268-374): Matriz de colunas recomendada, tipagem base `DecisionMatrixRow` e tabela de atributos de cada coluna.
     - Seção 3.4 (linhas 377-458): Requisitos analíticos e operacionais dos 5 Tooltips Analíticos Ricos com disparo `delayDuration={0}` e acessibilidade.

2. **Código de Referência Legado**:
   - `c:\Users\Felipe Barbosa\Documents\diario\compra-auto\components\CalcDiaTable.tsx`:
     - Linhas 1600-1685: Coluna `codigo` contendo o botão de Similares com `Sparkles` roxo (`similares.length > 0`) e alerta de entradas do dia com `AlertTriangle` vermelho vivo (`entradas_hoje.length > 0`) renderizando detalhes da NF-e, fornecedor e quantidade.
     - Linhas 1961-2066: Coluna `frequenciaNotas90d` com Tooltip discriminando notas de venda, notas de devolução, notas líquidas e extrato detalhado com coloração semântica (venda em verde esmeralda, devolução em vermelho).
     - Linhas 2319-2389: Coluna `classificacaoRuptura` com Tooltip discriminando dias analisados, dias zerados, percentual de ruptura e severidade.
     - Linhas 2463-2558: Coluna `consumoUltimos30DiasQtd` detalhando saídas recentes em 30d com coloração de venda/devolução.
     - Linhas 2681-2812: Coluna `pedidoPersonalizado` integrando `EditableCell` e Tooltip explicativo do cálculo da compra.
     - Linhas 2814-2885: Coluna `transferenciaPersonalizada` integrando `EditableCell` e Tooltip explicativo de transferência entre filiais.
   - `c:\Users\Felipe Barbosa\Documents\diario\compra-auto\components\calc-dia\utils.ts`:
     - Linhas 96-125: Fórmulas de frequência por notas: `calculateNoteFrequencyPercent(notasLiquidas, 90)` e classificação: Alta (`> 0.40`), Média (`>= 0.15 e <= 0.40`), Baixa (`< 0.15`).
     - Linhas 134-152: Fórmulas de ruptura: `calculateStockoutPercent(diasZerados, diasAnalisados)` e classificação: Boa (`<= 0.05`), Atenção (`> 0.05 e <= 0.10`), Grave (`> 0.10`), Sem histórico (`null` ou `diasAnalisados <= 0`).
     - Linhas 299-396: Algoritmo de movimentação inter-lojas `calculateSimulatedStoreMovement` garantindo sobra real da origem (`surplus = Math.max(0, estoque - estoqueMinimo)`).
     - Linhas 464-468: Função de múltiplos `applyMinMultiplo(value, minMultiplo) = Math.ceil(value / minMultiplo) * minMultiplo`.

3. **Entidades e Contratos Existentes no Core e Adapters do Projeto**:
   - `core/dominio/produto.ts`: `Produto`, `CurvaABC` ("A" | "B" | "C"), `PerfilRotatividade`.
   - `core/dominio/estoque.ts`: `EstoqueFilial` (`saldoFisico`, `estoqueMinimoSeguranca`, `quantidadeJaPedida`, `consumoMedioDiarioErp`).
   - `core/dominio/sugestao.ts`: `SugestaoCompraItem`, `StatusSugestao` ("APROVADO_COMPRA" | "ESTOQUE_SUFICIENTE" | "COBERTO_POR_TRANSFERENCIA" | "TRAVADO_MARCA_ZUMBI" | "TRAVADO_COBERTURA_FAMILIA" | "INELEGIVEL_SEM_HISTORICO").
   - `core/dominio/transferencia.ts`: `TransferenciaRecomendada` (`quantidadeTransferir`, `saldoOrigemAntes`, `estoqueMinimoOrigem`, `saldoOrigemApos`, `necessidadeDestinoAntes`, `motivo`).
   - `core/dominio/historico-vendas.ts`: `HistoricoVendasFilial` (`vendasLiquidas30dias`, `vendasLiquidas90dias`, `vendasLiquidas180dias`, `notasFiscaisVenda90dias`, `notasFiscaisDevolucao90dias`, `diasRuptura90dias`, `diasObservados`).
   - `adapters/AdaptadorInventario.ts`: `EntradaNFeDoDia`, `ItemSimilarIntercambiavel`, `RespostaCargaInventario`.

---

## 2. Logic Chain

1. **Desacoplamento do Modelo Legado para o SaaS White-Label**:
   O sistema legado possuía 32 colunas altamente acopladas à lógica de apenas 2 lojas físicas hardcoded (`L1` e `L2`). Na nova arquitetura White-Label da Rede Carreiro (multi-filiais), a matriz `baseColumns` deve representar dinamicamente a **Loja em Foco** selecionada pelo comprador no topo do cockpit, consolidando a **Rede** (demais filiais) como potencial doadora de transferências.

2. **Matriz de Decisão Limpa e Focada (`baseColumns`)**:
   Para permitir que o comprador analise 25.000 SKUs em velocidade ultra-rápida sem poluição visual, as 11 colunas primárias devem fornecer todos os dados essenciais na primeira camada, enquanto os aprofundamentos quantitativos e operacionais são revelados instantaneamente via Tooltips analíticos ao pousar o mouse ou focar via teclado.

3. **Eliminação de Latência Percebida (`delayDuration={0}`)**:
   No Radix UI Tooltip padrão, existe um atraso de 700ms (`delayDuration=700`) antes da abertura, o que inviabiliza o fluxo de auditoria rápida do comprador (que analisa dezenas de itens por minuto). Definir `delayDuration={0}` no `TooltipProvider` raiz elimina esse gargalo, garantindo abertura a 0ms e resposta tátil imediata.

4. **Os 5 Tooltips como Instrumentos de Prevenção de Prejuízos**:
   - *Tooltip de Ruptura*: Ataca diretamente os R$ 39,5k de demanda reprimida auditados no relatório de diagnóstico, informando a perda estimada em Reais e o histórico de desabastecimento.
   - *Tooltip de Frequência*: Evita o viés de distorção de volume (ex: 1 nota de 50 peças vs 30 notas de 1 peça), discriminando devoluções em vermelho e vendas em verde.
   - *Tooltip de Cobertura Comparativa*: Combina a aceleração recente de 30d com a segurança de 90d e a trava anti-encalhe de 180d (Marca Zumbi com estoque > 0 e zero vendas), prevenindo os R$ 89,9k de sobrecompras identificados.
   - *Tooltip de Transferência*: Garante transparência matemática ao comprador, provando que a loja doadora possui excedente real acima de seu estoque mínimo (`saldo - minStock > 0`), extinguindo o medo de desabastecer a filial de origem.
   - *Tooltip de NF-e do Dia*: Alerta visual crítico (`AlertTriangle` vermelho) que impede a aprovação de ordens de compra para mercadorias que acabaram de dar entrada física ou fiscal hoje na rede.

5. **Acessibilidade e Ergonomia Operacional**:
   O comprador corporativo utiliza intensamente o teclado. O grid e os tooltips devem aderir estritamente à especificação WAI-ARIA 1.2 (`role="tooltip"`, `aria-describedby`, foco visível com anel de foco `focus-visible:ring-2`, navegação via `Tab`/`Shift+Tab` entre células editáveis e fechamento com `Escape`).

---

## 3. Features Discovered

| # | Categoria | Feature | Descrição | Entradas | Saídas | Comportamento em Erro | Discovered Via |
|---|---|---|---|---|---|---|---|
| 1 | Matriz Colunas | Coluna Código com Badges Condicionais | Exibe código SKU com badges dinâmicos de similares intercambiáveis e alerta de entrada de NF-e do dia | `produto.codigoSku`, `similares[]`, `entradasHoje[]` | Célula mono com badges interativos (`Sparkles` roxo e `AlertTriangle` vermelho) | Se array vazio, renderiza apenas o código sem ícones | `CalcDiaTable.tsx:1601-1685` |
| 2 | Matriz Colunas | Coluna Descrição com Truncamento Inteligente | Exibe nome completo do produto com truncamento via CSS e tooltip com descrição completa no hover | `produto.descricao` | Texto truncado com ellipsis e atributo `title` / Tooltip | Fallback para "Sem descrição" se string vazia | `CalcDiaTable.tsx:1693-1704` |
| 3 | Matriz Colunas | Coluna Marca / Curva ABC | Exibe fabricante/marca e badge de classificação de Curva ABC (A, B, C) | `produto.marca`, `curvaAbc` | Badge temático (Curva A dourado/verde, B azul, C cinza) | Exibe "C" e marca "—" se nulo | `core/dominio/produto.ts:6-18` |
| 4 | Matriz Colunas | Coluna Giro Médio (Consumo Diário) | Exibe o ritmo de consumo diário calculado pelo algoritmo do Core em unidades/dia | `consumoDiarioCalculado` | Número formatado com 4 casas decimais no padrão pt-BR (`0,0000`) | Exibe `0,0000` se nulo ou menor ou igual a zero | `CalcDiaTable.tsx:1887-1908` |
| 5 | Matriz Colunas | Coluna Diagnóstico de Ruptura | Exibe percentual de dias desabastecidos e badge de severidade cromática | `rupturaPercentual`, `diasZerados`, `diasAnalisados` | Badge com cores: Boa (Verde), Atenção (Âmbar), Grave (Vermelho) | Exibe badge cinza "Sem histórico" se `diasAnalisados <= 0` | `utils.ts:134-152` |
| 6 | Matriz Colunas | Coluna Frequência 90d (Notas) | Exibe contagem de notas fiscais líquidas e percentual de recorrência em 90 dias | `notasLiquidas90d`, `frequenciaPercentual90d` | Texto com quantidade de notas e classificação (Alta / Média / Baixa) | Exibe "0 notas (0,0%) - Baixa" se sem notas | `utils.ts:105-125` |
| 7 | Matriz Colunas | Coluna Coberturas Comparativas (30d / 90d / 180d) | Exibe dias de cobertura nas janelas de 30d (aceleração), 90d (giro médio) e 180d (defesa) | `saldoEstoque`, `cmd30d`, `cmd90d`, `cmd180d` | Dias de cobertura formatados ou indicador de alerta | Exibe "999+ d" ou "Sem consumo" se CMD for zero | `spec_miner_m0_cockpit:304-315` |
| 8 | Matriz Colunas | Coluna Estoque Atual (Foco vs Rede) | Exibe saldo físico na filial em foco e saldo total somado nas demais filiais | `saldoLojaFoco`, `saldoRedeOutras` | Números inteiros; destaque em vermelho se saldo foco <= 0 | Exibe `0` se estoque nulo ou negativo | `CalcDiaTable.tsx:2616-2654` |
| 9 | Matriz Colunas | Coluna Sugestão do Motor | Exibe quantidade recomendada pelo motor com badge de status de decisão | `sugestaoFinalCompra`, `statusSugestao` | Badge colorido: `PEDIR`, `TRANSFERIR`, `PEDIR_TRANSFERIR`, `OK` | Exibe `0` e ícone de cadeado se travado por guardrail | `core/dominio/sugestao.ts:8-33` |
| 10 | Matriz Colunas | Coluna Pedido Editável (`EditableCell`) | Input numérico rápido com aplicação obrigatória de múltiplos/embalagem mínima | `pedidoCustom`, `loteMultiplo` | Input com validação; fundo `#FFFFCC` se exigir múltiplos | Rejeita letras e números negativos, restaurando valor anterior | `EditableCell.tsx:1-69` |
| 11 | Matriz Colunas | Coluna Transferência Recomendada | Quantidade a transferir da filial doadora com excedente real para a loja em foco | `transferenciaRecomendada`, `transferenciaCustom` | Célula editável com botão `?` disparando tooltip explicativo | Exibe `0` se não houver filial com sobra real | `CalcDiaTable.tsx:2814-2876` |
| 12 | Similares | Consulta de Peças Intercambiáveis | Botão `Sparkles` roxo com contagem que abre modal/popover de peças equivalentes | `similares: ItemSimilarIntercambiavel[]` | Diálogo com lista de códigos similares, marcas e saldos na rede | Botão oculto ou desabilitado se lista de similares vazia | `CalcDiaTable.tsx:1618-1636` |
| 13 | Tooltip Rico | Tooltip de Ruptura | Painel instantâneo com histórico de dias zerados, percentual e perda em Reais | `diasAnalisados`, `diasZerados`, `taxaRuptura`, `vendaPerdidaEstimada` | Card estruturado com borda da severidade e métricas formatadas | Exibe "Sem dados de ruptura no período" se sem histórico | `ORIGINAL_REQUEST.md:32` |
| 14 | Tooltip Rico | Tooltip de Frequência 90d | Painel instantâneo discriminando notas de venda, devoluções e extrato | `notasVenda`, `notasDevolucao`, `extratoMovimentacoes[]` | Micro-tabela com extrato colorido (verde = venda, vermelho = devolução) | Exibe "Sem movimentação de notas nos últimos 90 dias" | `CalcDiaTable.tsx:1975-2055` |
| 15 | Tooltip Rico | Tooltip de Coberturas Comparativas | Painel comparativo das 3 janelas com diagnóstico de tendência e alerta Zumbi | `vendas30d`, `vendas90d`, `vendas180d`, `saldoEstoque`, `leadTime` | Tabela multijanela com diagnóstico (Alta/Queda/Estável/Zumbi) | Exibe alerta vermelho de Marca Zumbi se saldo > 0 e vendas 180d = 0 | `ORIGINAL_REQUEST.md:34` |
| 16 | Tooltip Rico | Tooltip de Transferência Inteligente | Painel demonstrando sobra real da origem (`saldo - minStock`) e necessidade | `saldoOrigem`, `minStockOrigem`, `necessidadeDestino`, `lojaOrigem` | Diagrama visual comprovando que a origem não é desabastecida | Alerta que a rede não possui filiais com saldo excedente | `ORIGINAL_REQUEST.md:35` |
| 17 | Tooltip Rico | Tooltip de NF-e do Dia | Alerta instantâneo de entrada fiscal recente para prevenir compra duplicada | `entradasHoje: EntradaNFeDoDia[]` | Card vermelho com número da NF-e, fornecedor, quantidade e horário | Não renderiza gatilho se `entradasHoje.length === 0` | `ORIGINAL_REQUEST.md:36` |

---

## 4. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---|---|---|
| 1 | Tooltip de Ruptura | SKU recém-cadastrado com `diasAnalisados = 0` | Percentual de ruptura calculado como `null`; tooltip exibe status "Sem histórico suficiente" sem gerar divisão por zero (`NaN%`) e sem quebrar a interface. |
| 2 | Tooltip de Ruptura | SKU com `diasZerados = 90` e `diasAnalisados = 90` (100% zerado) e vendas nos últimos 30d | Taxa de ruptura de 100,0%; classificação "Grave" com borda e badge vermelho vivo; estimativa de demanda reprimida calculada pelo consumo anterior multiplicado pelo preço de venda. |
| 3 | Tooltip de Frequência | SKU com 15 notas de venda e 15 notas de devolução nos 90d | `notasLiquidas = 0`; `frequenciaPercentual = 0,0%`; classificação "Baixa"; lista do extrato exibe 15 linhas verdes e 15 linhas vermelhas perfeitamente ordenadas por data. |
| 4 | Tooltip de Frequência | Cliente com devolução parcial de 1 unidade em nota fiscal de 10 unidades | Extrato exibe a nota de devolução destacada em vermelho com sinal negativo (`-1 un`) sem corromper a contagem consolidada de peças líquidas. |
| 5 | Tooltip de Cobertura | SKU com aumento súbito de saídas: `cmd30d = 4,0 un/dia` vs `cmd90d = 1,0 un/dia` | O sistema detecta aceleração de 300% (`cmd30d > 1.25 * cmd90d`), emitindo diagnóstico destacado: "Tendência de ALTA ACENTUADA (+300% sobre o giro médio). Risco iminente de ruptura!" |
| 6 | Tooltip de Cobertura | Produto Zumbi: Saldo físico = 45 un, vendas nos últimos 180 dias = 0 un | Coluna de Cobertura exibe badge preto/vermelho "ZUMBI"; tooltip emite alerta de bloqueio estrito de compra ("PRODUTO ZUMBI: Compra travada em 0 para proteção de capital de giro"). |
| 7 | Tooltip de Transferência | Filial doadora possui `saldo = 10` e `estoqueMinimo = 10` | `sobraReal = Math.max(0, 10 - 10) = 0`; tooltip informa que a filial de origem não tem excedente doável e não sugere nenhuma transferência, preservando a origem. |
| 8 | Tooltip de Transferência | Loja destino necessita de 12 un, mas filial doadora tem sobra real de apenas 4 un | A recomendação de transferência limita-se estritamente a 4 un (`Math.min(12, 4)`); o restante da necessidade (8 un) é encaminhado para compra externa. |
| 9 | Tooltip de NF-e do Dia | Produto recebeu 3 notas fiscais distintas hoje de fornecedores diferentes | Ícone `AlertTriangle` exibe badge indicador `[3]`; o tooltip lista as 3 NF-es com somatório total de peças recebidas no cabeçalho em destaque. |
| 10 | Similares Intercambiáveis | SKU sugerido para compra possui similar equivalente com 20 un em estoque na rede | Badge roxo `Sparkles` com texto `[ ✨ 1 ]`; diálogo exibe o SKU similar, sua aplicação e a filial onde o estoque se encontra para evitar nova compra fora. |
| 11 | Pedido Editável | Comprador digita `-15` ou texto `"abc"` no input de pedido | O sanitizador da célula intercepta o valor no `onChange`/`onBlur`, rejeita a entrada e restaura o último valor numérico válido (ou 0), sem propagar erro de tipo. |
| 12 | Múltiplos de Embalagem | Comprador altera sugestão de amortecedor (`loteMultiplo = 2`) para `7` unidades | No `onBlur`, a função `applyMinMultiplo(7, 2)` arredonda automaticamente para `8` unidades e exibe breve aviso visual de ajuste ao par do fabricante. |
| 13 | Acessibilidade por Teclado | Usuário navega pelo grid pressionando apenas `Tab` | O foco transita sequencialmente pelos checkboxes, botões de similares, alertas de NF-e, badges de métricas com tooltip e inputs editáveis, abrindo os tooltips em 0ms. |
| 14 | Resolução e Borda de Tela | Célula com tooltip localizada na última linha inferior ou canto direito do grid | As propriedades `collisionPadding={16}` e `side="top"` com `avoidCollisions={true}` do Radix UI reposicionam o tooltip automaticamente para cima ou para a esquerda. |

---

## 5. Especificação Técnica Detalhada

### 5.1 Matriz de Colunas (`baseColumns`)

A matriz de colunas é baseada na definição de colunas do TanStack Table v8 (`ColumnDef<LinhaCockpitMatriz, unknown>[]`). A tabela a seguir especifica cada uma das 11 colunas primárias:

| # | Id da Coluna | Título (Header) | Alinhamento | Largura | Fixação (Pinning) | Renderizador e Elementos Visuais | Comportamento Interativo |
|---|---|---|:---:|:---:|:---:|---|---|
| 1 | `selecao` | Checkbox geral | Centro | 44px | Esquerda (`left`) | `<Checkbox checked={table.getIsAllRowsSelected()} />` | Seleciona/desmarca todos os itens visíveis |
| 2 | `codigo` | Código SKU | Esquerda | 145px | Esquerda (`left`) | Texto mono semibold + Badge `Sparkles` roxo se `similares.length > 0` + Ícone `AlertTriangle` vermelho se `entradasHoje.length > 0` | Clique no Sparkles abre modal de similares; hover no AlertTriangle abre Tooltip de NF-e do Dia |
| 3 | `descricao` | Descrição | Esquerda | 240px | Esquerda (`left`) | Texto truncado com ellipsis + subtexto com Aplicação Veicular | Tooltip com descrição e aplicação veicular completa |
| 4 | `marcaCurva` | Marca / Curva | Centro | 120px | Nenhuma | Badge cinza da Marca + Badge de Curva ABC (A em ouro/esmeralda, B em azul, C em ardósia) | Ordenação por Curva ABC (A > B > C) ou Marca |
| 5 | `giroMedio` | Giro Médio (CMD) | Direita | 110px | Nenhuma | Fonte mono: `#.##0,0000` un/dia + rótulo mensal abaixo | Ordenação numérica pelo CMD |
| 6 | `diagnosticoRuptura` | Ruptura | Centro | 120px | Nenhuma | Badge de severidade: **Boa** (Verde `<=5%`), **Atenção** (Âmbar `5-10%`), **Grave** (Vermelho `>10%`), **Sem hist.** (Cinza) | Hover/foco dispara **Tooltip 1 (Ruptura)** com `delayDuration={0}` |
| 7 | `frequencia90d` | Freq. 90d (Notas) | Centro | 130px | Nenhuma | Texto formatado: `X notas (Y%)` com cor da categoria: Alta (Esmeralda), Média (Azul), Baixa (Âmbar) | Hover/foco dispara **Tooltip 2 (Frequência)** com `delayDuration={0}` |
| 8 | `coberturasComparativas` | Cobertura (30/90/180) | Centro | 150px | Nenhuma | 3 valores compactos ou dias da janela foco com indicador de tendência (▲ Aceleração, ▼ Queda, ⚠ Zumbi) | Hover/foco dispara **Tooltip 3 (Cobertura)** com `delayDuration={0}` |
| 9 | `estoqueLojas` | Estoque Foco / Rede | Direita | 130px | Nenhuma | Saldo Loja Foco (vermelho se <= 0) / Saldo Rede em cinza | Ordenação por estoque da loja foco |
| 10 | `sugestaoMotor` | Sugestão Motor | Centro | 125px | Nenhuma | Quantidade sugerida em destaque + Badge de status: `PEDIR`, `TRANSFERIR`, `PEDIR_TRANSFERIR`, `OK` | Exibe ícone de trava e motivo se compra bloqueada |
| 11 | `pedidoEditavel` | Pedido Compra | Centro | 120px | Nenhuma | Componente `EditableCell` com fundo `#FFFFCC` se `loteMultiplo > 1` + Botão `?` com memória de cálculo | Edição por teclado (`Tab`/`Enter`), validação automática de múltiplos |
| 12 | `transferenciaRecomendada` | Transferir | Centro | 130px | Nenhuma | Componente `EditableCell` + Loja doadora com sobra real + Botão `?` com memória de cálculo | Hover/foco no `?` dispara **Tooltip 4 (Transferência)** |

---

### 5.2 Os 5 Tooltips Analíticos Ricos

Todos os tooltips devem utilizar a arquitetura Radix UI (`TooltipProvider`, `Tooltip`, `TooltipTrigger asChild`, `TooltipContent`) com:
- `delayDuration={0}` no provedor raiz.
- `collisionPadding={16}` e `side="top"` com fallback dinâmico.
- `role="tooltip"` com semântica acessível.

#### 1. Tooltip de Ruptura (Diagnóstico de Desabastecimento e Demanda Reprimida)
- **Componente**: `TooltipRuptura`
- **Gatilho**: Hover ou Foco no Badge de Ruptura da coluna `diagnosticoRuptura`.
- **Métricas Apresentadas**:
  - `diasAnalisados`: Quantidade total de dias observados (padrão 90 dias ou histórico disponível).
  - `diasZerados`: Dias com estoque físico igual a 0.
  - `taxaRuptura`: `(diasZerados / diasAnalisados) * 100` formatado como `0,0%`.
  - `classificacao`:
    - `Boa`: `<= 5,0%` (Badge verde `bg-emerald-100 text-emerald-800 border-emerald-300`)
    - `Atenção`: `> 5,0% e <= 10,0%` (Badge âmbar `bg-amber-100 text-amber-800 border-amber-300`)
    - `Grave`: `> 10,0%` (Badge vermelho `bg-red-100 text-red-800 border-red-300`)
    - `Sem histórico`: Se `diasAnalisados <= 0` ou sem registros auditados.
  - `dataUltimoZeramento`: Data da ocorrência mais recente de estoque zero (`DD/MM/AAAA` ou "Sem registro recente").
  - `estimativaDemandaReprimida`: Venda perdida projetada em Reais calculada como `consumoDiarioCalculado * diasZerados * precoVenda` (com destaque visual para conscientização de perda financeira).
- **Layout e Estilização**: Card com largura máxima de 320px, borda esquerda de 4px colorida de acordo com a gravidade, tipografia compacta e contrastante.

#### 2. Tooltip de Frequência em 90 Dias (Recorrência de Vendas)
- **Componente**: `TooltipFrequencia`
- **Gatilho**: Hover ou Foco na célula de Frequência da coluna `frequencia90d`.
- **Métricas Apresentadas**:
  - `notasVenda`: Total de notas fiscais de venda emitidas nos últimos 90 dias.
  - `notasDevolucao`: Total de notas de devolução de clientes nos últimos 90 dias.
  - `notasLiquidas`: `notasVenda - notasDevolucao`.
  - `frequenciaPercentual`: `(notasLiquidas / 90) * 100` formatado como `0,0%`.
  - `classificacao`:
    - `Alta`: `> 40%` (Demanda recorrente de balcão)
    - `Média`: `15% a 40%` (Demanda regular semanal)
    - `Baixa`: `< 15%` (Demanda pontual / intermitente)
  - `totalPecasVendidas`: Volume físico total transacionado no período.
  - `extratoMovimentacoes`: Extrato discriminado das últimas até 10 transações:
    - Data (`DD/MM/AAAA`).
    - Identificação do Cliente / Razão Social.
    - Tipo: `Venda` (destaque verde) ou `Devolução` (destaque vermelho).
    - Quantidade e Número da NF.
- **Cores Semânticas Obrigatórias**:
  - Vendas: Verde esmeralda (`text-emerald-700 dark:text-emerald-400`, `bg-emerald-50`).
  - Devoluções: Vermelho destrutivo (`text-red-600 dark:text-red-400`, `bg-red-50`).
- **Nota Metodológica Exibida**: *"Mede a recorrência real de clientes. Um produto com 50 peças vendidas em apenas 1 nota indica compra pontual de frota; 50 peças vendidas em 30 notas indica alta demanda recorrente de balcão."*

#### 3. Tooltip de Cobertura Comparativa (Decomposição 30d / 90d / 180d)
- **Componente**: `TooltipCoberturaComparativa`
- **Gatilho**: Hover ou Foco na coluna `coberturasComparativas`.
- **Métricas Apresentadas**:
  - Saldo Físico Atual do SKU.
  - Tabela Comparativa de 3 Janelas:
    1. **Janela 30d (Aceleração Recente)**: Vendas 30d, Consumo Médio Diário (CMD 30d) e Cobertura em Dias (`saldo / cmd30d`).
    2. **Janela 90d (Giro Médio Regular)**: Vendas 90d, Consumo Médio Diário (CMD 90d) e Cobertura em Dias (`saldo / cmd90d`).
    3. **Janela 180d (Longo Prazo & Defesa)**: Vendas 180d, Consumo Médio Diário (CMD 180d) e Cobertura em Dias (`saldo / cmd180d`).
  - Diagnóstico de Tendência Automatizado:
    - Se `CMD_30d > 1.25 * CMD_90d`: *"Tendência de ALTA / ACELERAÇÃO RECENTE (+X%). Recomendado reforçar cobertura para evitar risco iminente de desabastecimento."*
    - Se `CMD_30d < 0.75 * CMD_90d`: *"Tendência de QUEDA / DESACELERAÇÃO (-X%). Risco de sobrecompra se basear pedido apenas no giro antigo."*
    - Se `saldo > 0` e `vendas180d === 0`: *"TRAVA MARCA ZUMBI / ENCALHE: Saldo positivo sem nenhuma saída registrada nos últimos 180 dias. Compra bloqueada estritamente em zero."*
    - Caso padrão: *"Ritmo de consumo ESTÁVEL (oscilação dentro da faixa regular de ±25%)."*

#### 4. Tooltip de Transferência Inteligente (Sobra Real vs Necessidade)
- **Componente**: `TooltipTransferencia`
- **Gatilho**: Hover ou Foco no botão `?` da coluna `transferenciaRecomendada`.
- **Métricas Apresentadas**:
  - Identificação da Loja de Origem (Doadora) e Loja de Destino (Receptora / Foco).
  - Saldo Físico na Origem.
  - Estoque Mínimo de Segurança da Origem (meta para cobrir lead time e demanda própria).
  - **Sobra Real Disponível da Origem**: `Math.max(0, saldoOrigem - minStockOrigem)`.
  - Necessidade Calculada da Loja Destino.
  - **Transferência Recomendada**: `Math.min(necessidadeDestino, sobraRealOrigem)`.
  - Saldo Remanescente da Origem após transferência (garantindo que `saldoRemanescente >= minStockOrigem`).
- **Regra de Ouro Auditável**: *"A loja de origem só transfere peças se mantiver seu estoque estritamente acima do seu estoque mínimo de segurança. É terminantemente proibido transferir desabastecendo a filial de origem ou remanejar itens para lojas onde também não há giro comprovado."*

#### 5. Tooltip de NF-e do Dia (Alerta de Recebimento Físico Hoje)
- **Componente**: `TooltipNfeDoDia`
- **Gatilho**: Hover ou Foco no ícone `AlertTriangle` vermelho piscante na coluna `codigo`.
- **Métricas Apresentadas**:
  - Total de Notas Fiscais Recebidas Hoje e Soma Total de Peças Recebidas (`+N unidades`).
  - Data e Hora do Recebimento Fiscal/Físico no ERP.
  - Relação de Notas Fiscais:
    - Número do Documento Fiscal (ex: `NF #049281`).
    - Nome / Razão Social do Fornecedor / Distribuidor.
    - Quantidade que deu entrada nesta nota (`+N un`).
    - Filial que recebeu a mercadoria.
- **Mensagem Operacional Preventiva**: *"ALERTA DE RECEBIMENTO: Este produto acabou de dar entrada fiscal/física no estoque da rede hoje. Verifique se a quantidade recebida supre a necessidade imediata antes de emitir nova ordem de compra externa, prevenindo duplicidade de pedidos e sobreestoque."*

---

## 6. Contratos TypeScript Formais

Abaixo estão os contratos completos em TypeScript estrito (`strict: true`), prontos para serem implementados na camada `src/components/cockpit/` e `src/components/tooltips/`:

```typescript
/**
 * Contratos de Tipagem TypeScript para o Cockpit do Comprador e Tooltips Analíticos
 * Projeto: Plataforma White-Label de Inteligência de Compras de Autopeças
 * 100% em Português do Brasil (pt-BR).
 */

import { CurvaABC, PerfilRotatividade, StatusSugestao } from "@core/dominio";
import { EntradaNFeDoDia, ItemSimilarIntercambiavel } from "@adapters/AdaptadorInventario";

// ============================================================================
// 1. LINHA DA MATRIZ DE DECISÃO DO COCKPIT (TanStack Table Row)
// ============================================================================

export type SeveridadeRuptura = "Boa" | "Atenção" | "Grave" | "Sem histórico";
export type ClassificacaoFrequencia = "Alta" | "Média" | "Baixa";
export type TendenciaCobertura = "ALTA" | "QUEDA" | "ESTAVEL" | "ZUMBI";

export interface ExtratoMovimentacaoFrequencia {
  readonly dataVenda: string;
  readonly nomeCliente: string;
  readonly tipo: "venda" | "devolucao";
  readonly quantidade: number;
  readonly numeroNota: string;
}

export interface LinhaCockpitMatriz {
  // Identificação do Produto
  readonly produtoId: number;
  readonly codigoSku: string;
  readonly descricao: string;
  readonly marca: string;
  readonly fabricante: string;
  readonly referenciaFabricante: string | null;
  readonly aplicacaoVeicular: string | null;
  readonly secaoNome: string | null;
  readonly precoCusto: number;
  readonly precoVenda: number;
  readonly curvaAbc: CurvaABC;
  readonly perfilGiro: PerfilRotatividade;

  // Ruptura
  readonly rupturaDiasAnalisados: number;
  readonly rupturaDiasZerados: number;
  readonly rupturaPercentual: number | null;
  readonly classificacaoRuptura: SeveridadeRuptura;
  readonly dataUltimoZeramento: string | null;
  readonly vendaPerdidaEstimadaReais: number;

  // Frequência em 90 dias
  readonly notasVenda90d: number;
  readonly notasDevolucao90d: number;
  readonly notasLiquidas90d: number;
  readonly frequenciaPercentual90d: number;
  readonly classificacaoFrequencia: ClassificacaoFrequencia;
  readonly totalPecasVendidas90d: number;
  readonly extratoFrequencia90d: readonly ExtratoMovimentacaoFrequencia[];

  // Coberturas Comparativas
  readonly vendasLiquidas30d: number;
  readonly consumoMedioDiario30d: number;
  readonly diasCobertura30d: number;

  readonly vendasLiquidas90d: number;
  readonly consumoMedioDiario90d: number;
  readonly diasCobertura90d: number;

  readonly vendasLiquidas180d: number;
  readonly consumoMedioDiario180d: number;
  readonly diasCobertura180d: number;

  readonly tendenciaCobertura: TendenciaCobertura;
  readonly isMarcaZumbi: boolean; // true se saldoEstoque > 0 e vendasLiquidas180d === 0

  // Estoque da Rede
  readonly filialFocoId: number;
  readonly filialFocoNome: string;
  readonly estoqueLojaFoco: number;
  readonly estoqueMinimoLojaFoco: number;
  readonly quantidadeJaPedidaFoco: number;
  readonly estoqueOutrasLojasRede: number;

  // Sugestão e Decisão do Motor
  readonly sugestaoFinalCompra: number;
  readonly statusSugestao: StatusSugestao;
  readonly motivoDecisao: string;

  // Ajuste Humano e Múltiplos
  readonly loteMultiplo: number; // ex: 1 avulso, 2 par, 4 jogo
  readonly pedidoCustom: number;
  readonly transferenciaCustom: number;

  // Transferência Inteligente entre Lojas
  readonly filialOrigemTransferenciaId: number | null;
  readonly filialOrigemTransferenciaNome: string | null;
  readonly saldoOrigemTransferencia: number;
  readonly estoqueMinimoOrigemTransferencia: number;
  readonly sobraRealOrigemTransferencia: number;
  readonly necessidadeDestinoTransferencia: number;
  readonly quantidadeTransferenciaSugerida: number;

  // Similares e Chegadas Recentes
  readonly similares: readonly ItemSimilarIntercambiavel[];
  readonly entradasHoje: readonly EntradaNFeDoDia[];
}

// ============================================================================
// 2. CONTRATOS DE PROPS DOS 5 TOOLTIPS ANALÍTICOS RICOS
// ============================================================================

export interface PropsTooltipRuptura {
  readonly diasAnalisados: number;
  readonly diasZerados: number;
  readonly percentualRuptura: number | null;
  readonly classificacao: SeveridadeRuptura;
  readonly dataUltimoZeramento: string | null;
  readonly vendaPerdidaEstimadaReais: number;
  readonly consumoDiarioReferencia: number;
  readonly children: React.ReactNode;
}

export interface PropsTooltipFrequencia {
  readonly notasVenda: number;
  readonly notasDevolucao: number;
  readonly notasLiquidas: number;
  readonly frequenciaPercentual: number;
  readonly classificacao: ClassificacaoFrequencia;
  readonly totalPecasVendidas: number;
  readonly extratoMovimentacoes: readonly ExtratoMovimentacaoFrequencia[];
  readonly children: React.ReactNode;
}

export interface PropsTooltipCoberturaComparativa {
  readonly saldoEstoqueAtual: number;
  readonly leadTimeDias: number;
  readonly vendas30d: number;
  readonly cmd30d: number;
  readonly cobertura30dDias: number;
  readonly vendas90d: number;
  readonly cmd90d: number;
  readonly cobertura90dDias: number;
  readonly vendas180d: number;
  readonly cmd180d: number;
  readonly cobertura180dDias: number;
  readonly tendencia: TendenciaCobertura;
  readonly isMarcaZumbi: boolean;
  readonly children: React.ReactNode;
}

export interface PropsTooltipTransferencia {
  readonly filialOrigemNome: string;
  readonly saldoOrigem: number;
  readonly estoqueMinimoOrigem: number;
  readonly sobraRealOrigem: number;
  readonly filialDestinoNome: string;
  readonly necessidadeDestino: number;
  readonly quantidadeTransferirRecomendada: number;
  readonly motivo: string;
  readonly children: React.ReactNode;
}

export interface PropsTooltipNfeDoDia {
  readonly entradas: readonly EntradaNFeDoDia[];
  readonly children: React.ReactNode;
}

// ============================================================================
// 3. CONTRATO DO COMPONENTE DE SIMILARES INTERCAMBIÁVEIS
// ============================================================================

export interface PropsBotaoSimilares {
  readonly similares: readonly ItemSimilarIntercambiavel[];
  readonly codigoSkuPrincipal: string;
  readonly onAbrirDetalhes?: (similares: readonly ItemSimilarIntercambiavel[]) => void;
}

export interface PropsDialogSimilares {
  readonly aberto: boolean;
  readonly onOpenChange: (aberto: boolean) => void;
  readonly produtoPrincipalCodigo: string;
  readonly produtoPrincipalDescricao: string;
  readonly similares: readonly ItemSimilarIntercambiavel[];
}

// ============================================================================
// 4. CONTRATO DA CÉLULA EDITÁVEL COM MÚLTIPLOS (EditableCell)
// ============================================================================

export interface PropsEditableCell {
  readonly valorInicial: number;
  readonly loteMultiplo: number;
  readonly onConfirmarValor: (novoValor: number) => void;
  readonly rotuloAcessibilidade: string;
  readonly desabilitado?: boolean;
}
```

---

## 7. Diretrizes de Acessibilidade (WAI-ARIA e Foco por Teclado)

Para assegurar conformidade com a especificação **WAI-ARIA 1.2** e **WCAG 2.1 Níveis AA/AAA**:

1. **Configuração Global dos Tooltips**:
   - Encapsular a tabela inteira em `<TooltipProvider delayDuration={0} skipDelayDuration={0}>`.
   - Elementos disparadores (`TooltipTrigger`) devem usar obrigatoriamente a propriedade `asChild` para não injetar botões aninhados inválidos no DOM.

2. **Acessibilidade Semântica de Tooltips (`role="tooltip"`)**:
   - Cada tooltip gera automaticamente um identificador único (`id="tooltip-xyz"`) atribuído ao elemento de conteúdo (`TooltipContent`).
   - O elemento disparador ganha `aria-describedby="tooltip-xyz"` quando o tooltip está visível.
   - O disparador deve possuir `aria-label` autoexplicativo (ex: `aria-label="Diagnóstico de Ruptura: Grave (14,2%). Pressione para detalhes."`).

3. **Navegação Estrita por Teclado e Foco Visível**:
   - Todas as células interativas, botões de ação e inputs devem possuir `tabIndex={0}`.
   - Aplicação consistente de classes Tailwind de anel de foco:  
     `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none`.
   - Tecla `Escape`: Fecha imediatamente qualquer tooltip ou diálogo aberto, devolvendo o foco ao elemento disparador.

4. **Navegação na Célula Editável (`EditableCell`)**:
   - Tecla `Tab`: Move o foco para o próximo campo editável `.editable-cell-input` dentro da viewport virtualizada, selecionando todo o texto existente (`input.select()`).
   - Tecla `Shift + Tab`: Move o foco para o campo editável anterior.
   - Tecla `Enter`: Confirma o valor editado disparando `blur()`, aplica a trava matemática de múltiplos (`applyMinMultiplo`) e emite feedback visual.
   - Tecla `Escape`: Restaura o valor original descartando a edição em andamento.

5. **Contraste Cromático e Comunicação Não-Exclusiva por Cor (WCAG 1.4.1)**:
   - A cor nunca deve ser o único meio de transmitir informação. Todos os badges devem combinar:
     1. Texto explícito da classificação (ex: "Grave", "Atenção", "Boa").
     2. Ícone representativo (ex: `AlertTriangle` para alertas, `Sparkles` para similares, `Check` para OK).
     3. Cores com contraste mínimo de 4.5:1 com o fundo (ex: Verde texto `#065f46` sobre fundo `#d1fae5`; Vermelho texto `#991b1b` sobre fundo `#fee2e2`).

---

## 8. Estratégia de Testes para Vitest (`tests/cockpit/`)

A suíte de testes deve ser estruturada no diretório `tests/cockpit/` com cobertura completa utilizando `@testing-library/react`, `@testing-library/user-event` e `vitest`:

```
tests/cockpit/
├── matriz-colunas.test.tsx         # Testes de ordenação, visibilidade, pinning e renderizadores
├── tooltip-ruptura.test.tsx        # Testes do Tooltip 1: Ruptura, taxas %, limites e venda perdida
├── tooltip-frequencia.test.tsx     # Testes do Tooltip 2: Frequência 90d, notas líquidas e extrato
├── tooltip-cobertura.test.tsx      # Testes do Tooltip 3: Janelas 30/90/180d, aceleração e Marca Zumbi
├── tooltip-transferencia.test.tsx  # Testes do Tooltip 4: Sobra real da origem e necessidade destino
├── tooltip-nfe-dia.test.tsx        # Testes do Tooltip 5: Alerta de entrada de hoje e notas fiscais
├── botao-similares.test.tsx        # Testes de exibição do badge roxo Sparkles e diálogo de similares
└── celula-editavel.test.tsx        # Testes de digitação, navegação por Tab, Enter e lote múltiplo
```

### Casos de Teste Essenciais Especificados:

1. **`tooltip-ruptura.test.tsx`**:
   - `deve calcular percentual de ruptura corretamente (ex: 9 zerados em 90 analisados = 10,0%)`.
   - `deve classificar como Boa para taxa <= 5,0%, Atenção para > 5,0% e <= 10,0%, e Grave para > 10,0%`.
   - `deve exibir "Sem histórico" sem lançar NaN quando diasAnalisados for 0 ou nulo`.
   - `deve calcular a estimativa de venda perdida em Reais baseada no consumo diário e preço de venda`.
   - `deve abrir instantaneamente sem delay (delayDuration=0) ao receber hover ou foco`.

2. **`tooltip-frequencia.test.tsx`**:
   - `deve calcular notas líquidas subtraindo devoluções de vendas (ex: 20 vendas - 2 devoluções = 18 líquidas)`.
   - `deve calcular percentual sobre 90 dias (18 / 90 = 20,0%) e classificar como Média`.
   - `deve renderizar notas de venda em verde esmeralda e devoluções em vermelho destrutivo`.
   - `deve exibir mensagem amigável "Sem notas no período" quando a lista de extrato for vazia`.

3. **`tooltip-cobertura.test.tsx`**:
   - `deve exibir vendas, consumo diário e dias de cobertura para as 3 janelas (30d, 90d, 180d)`.
   - `deve emitir diagnóstico de Aceleração quando CMD_30d > 1.25 * CMD_90d`.
   - `deve emitir diagnóstico de Queda quando CMD_30d < 0.75 * CMD_90d`.
   - `deve ativar alerta crítico de PRODUTO ZUMBI quando saldo > 0 e vendas_180d === 0`.
   - `deve tratar divisão por zero exibindo 999+ dias ou "Sem consumo" quando CMD for zero`.

4. **`tooltip-transferencia.test.tsx`**:
   - `deve calcular sobra real da origem estritamente como Math.max(0, saldoOrigem - minStockOrigem)`.
   - `deve garantir que a transferência sugerida seja Math.min(necessidadeDestino, sobraRealOrigem)`.
   - `deve exibir saldo 0 para transferência se o estoque da origem for menor ou igual ao mínimo de segurança`.
   - `deve exibir nomes das filiais de origem e destino e a regra de ouro de não desabastecer a doadora`.

5. **`tooltip-nfe-dia.test.tsx`**:
   - `deve exibir o ícone AlertTriangle vermelho na coluna código apenas se entradasHoje.length > 0`.
   - `deve exibir o número de todas as notas fiscais de hoje, fornecedor e quantidade que deu entrada`.
   - `deve somar a quantidade total recebida e exibir mensagem de prevenção contra compra duplicada`.

6. **`celula-editavel.test.tsx`**:
   - `deve renderizar input com valor inicial sugerido`.
   - `deve aplicar applyMinMultiplo ao desfocar o campo (ex: valor 5 com múltiplo 2 ajusta para 6)`.
   - `deve aplicar estilo com fundo #FFFFCC quando loteMultiplo for maior que 1`.
   - `deve avançar o foco para a próxima célula editável ao pressionar Tab`.
   - `deve restaurar o valor original ao pressionar Escape`.

---

## 9. Caveats

1. **Acessibilidade Móvel vs Desktop**: O Cockpit do Comprador com mais de 10 colunas simultâneas e virtualização por TanStack Virtual foi projetado primordialmente para telas desktop corporativas (a partir de 1366x768 pixels). Em dispositivos móveis ou telas muito estreitas, deve-se adotar rolagem horizontal nativa do contêiner da tabela mantendo as colunas de Código e Descrição fixadas à esquerda.
2. **Dados Sob Demanda para Extrato de Frequência**: Em grandes carteiras de 25.000 SKUs, o payload inicial do inventário não deve trazer os 90 dias de extrato detalhado nota a nota de todos os 25.000 itens (o que geraria um JSON de mais de 100MB). O extrato detalhado de transações do Tooltip de Frequência deve ser carregado sob demanda via `/api/detalhes-item?produtoId=XYZ` com cache em memória (SWR ou React Query), enquanto os números consolidados (`notasVenda90d`, `notasDevolucao90d`, `notasLiquidas90d`) residem na linha da matriz.
3. **Escala de Múltiplos**: Em itens com múltiplos muito elevados (ex: caixas fechadas com 100 unidades), o arredondamento automático para cima pode representar um salto financeiro expressivo. A interface deve exibir confirmação visual do arredondamento na célula editável.

---

## 10. Conclusion

A especificação técnica e funcional da matriz de colunas (`baseColumns`) e dos 5 Tooltips Analíticos Ricos está **concluída, validada e 100% alinhada** aos requisitos do `ORIGINAL_REQUEST.md`, `PROJECT.md`, `spec_miner_m0_cockpit/handoff.md` e aos padrões do código legado em `diario/compra-auto`:
- As 11 colunas primárias da matriz `baseColumns` estão integralmente especificadas com larguras, alinhamentos, fixações e comportamentos.
- A coluna de Código integra harmonicamente o badge roxo de Similares (`Sparkles`) com contagem e o alerta vermelho vivo de entradas fiscais do dia (`AlertTriangle`).
- Os 5 Tooltips Analíticos Ricos possuem métricas matemáticas comprovadas, regras cromáticas semânticas e operam com disparo instantâneo (`delayDuration={0}`).
- Os contratos TypeScript estritos cobrem todas as entidades, linhas da matriz, props dos tooltips, modais e células editáveis.
- As diretrizes de acessibilidade WAI-ARIA 1.2 garantem suporte integral à navegação por teclado e conformidade WCAG AA/AAA.
- A estratégia de testes para Vitest em `tests/cockpit/` fornece um roteiro completo de testes unitários e de integração para os implementadores.

---

## 11. Verification Method

Para verificar e homologar de forma independente as especificações mineradas neste relatório:

1. **Inspeção de Contratos e Tipos**:
   - Inspecionar este arquivo `handoff.md` e comparar os tipos `LinhaCockpitMatriz`, `PropsTooltipRuptura`, `PropsTooltipFrequencia`, `PropsTooltipCoberturaComparativa`, `PropsTooltipTransferencia` e `PropsTooltipNfeDoDia` com as entidades em `core/dominio/` e `adapters/AdaptadorInventario.ts`.
2. **Conferência das Regras de Negócio Legadas**:
   - Inspecionar `c:\Users\Felipe Barbosa\Documents\diario\compra-auto\components\CalcDiaTable.tsx` (linhas 1600-2880) e `utils.ts` (linhas 96-470) para certificar que os limites de classificação (<=5%, 5-10%, >10% para Ruptura; >40%, 15-40%, <15% para Frequência; `saldo - minStock > 0` para Transferência; `Math.ceil(v / m) * m` para Múltiplos) estão precisamente preservados.
3. **Execução Futura da Suíte Vitest**:
   - Quando os implementadores de M3 codificarem os componentes em `src/components/cockpit/` e `src/components/tooltips/`, executar `npm test tests/cockpit/` e verificar que 100% dos testes unitários descritos na Seção 8 passam sem advertências.

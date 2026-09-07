# Infraestrutura e Metodologia de Testes Automatizados E2E

> **Projeto:** Plataforma White-Label de Inteligência e Copiloto de Compras para Autopeças  
> **Versão:** 1.0.0  
> **Documento:** TEST_INFRA.md  
> **Padrão:** Opaque-Box Testing / 4 Tiers Methodology / Progressive Testability  
> **Status:** Ativo e Homologado  

---

## 1. Filosofia de Testes: Opaque-Box & Orientação aos Requisitos

A suíte de testes de ponta a ponta (E2E) e de integração desta plataforma adota a filosofia **Opaque-Box (Caixa Opaca)**:

1. **Desacoplamento de Implementação Interna:** Os testes não se acoplam a variáveis locais, estados privados ou heurísticas transitórias de código. Avaliam o sistema estritamente através de suas interfaces públicas de domínio, contratos de adaptadores (`InventoryAdapter`), esquemas de validação (Zod), payloads de API e componentes de interação do usuário descritos em `PROJECT.md` e `ORIGINAL_REQUEST.md`.
2. **Autoridade Derivada dos Requisitos:** Todo valor esperado nos testes é derivado matematicamente dos requisitos formais:
   - *Regra de Transferência Segura:* A origem só transfere se $\text{saldo} - \text{minStock} > 0$. A loja doadora jamais fica desabastecida.
   - *Trava Anti-Encalhe Marca Zumbi:* Se $\text{saldo} > 0$ e $\text{vendas}_{180d} = 0$, a sugestão de compra é estritamente $0$.
   - *Trava de Família/Aplicação:* Se os itens intercambiáveis cobrem a necessidade temporal, compra externa é bloqueada.
   - *RBAC Server-Side:* Usuário restrito nunca recebe ou altera produtos fora de `allowedSupplierIds`.
3. **Integridade Absoluta (Anti-Cheat & Non-Facade):** É terminantemente proibida a criação de testes de fachada (*facade tests* que passam sem processar dados reais ou mocks simplistas que mascaram erros de cálculo). Cada caso de teste computa pipelines reais de transformação e valida invariantes.
4. **Testabilidade Progressiva e Independência:** Cada teste é autônomo, cria e isola seu próprio estado (*Arrange-Act-Assert*), limpa recursos após a execução e não depende de ordem de execução.

---

## 2. Metodologia dos 4 Tiers de Testes

A esteira de validação é dividida em **4 Tiers incrementais e complementares**, cobrindo desde as regras fundamentais até jornadas completas de negócio:

```
┌─────────────────────────────────────────────────────────────────────────┐
│              TIER 4: CENÁRIOS REAIS DE APLICAÇÃO (E2E)                  │
│ Jornadas completas do comprador, tolerância a falhas e auditoria gerencial│
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ integra
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              TIER 3: COMBINAÇÕES ENTRE FEATURES (PAIRWISE)              │
│ Interseções: RBAC x Marca Zumbi x Alertas NF-e x Múltiplos x Similares  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ estressa
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│        TIER 2: CASOS DE BORDA E LIMITE (BOUNDARY VALUE ANALYSIS)        │
│ Análise de fronteiras: 179d vs 180d, saldo = minStock, latências < 250ms│
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ fundamenta
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              TIER 1: COBERTURA DE FEATURES (CORE SPEC)                  │
│ Mínimo de 5 testes rigorosos por funcionalidade principal da plataforma │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Tier 1: Cobertura de Features Principais (Mínimo 5 Testes por Feature)

O Tier 1 foca em validar isoladamente e detalhadamente as **6 grandes áreas funcionais** do sistema sob condições normais de uso:

#### Feature 1: Cockpit do Comprador & Matriz de Decisão (`baseColumns`)
- **T1.1.1 — Cálculo do Diagnóstico de Ruptura:** Validação da taxa percentual $\frac{\text{diasZerados}}{\text{diasAnalisados}} \times 100$ e correta atribuição das classes cromáticas (`Boa` $\le 5\%$, `Atenção` $5-10\%$, `Grave` $> 10\%$, `Sem histórico`).
- **T1.1.2 — Frequência por Notas em 90 Dias:** Apuração de notas líquidas ($\text{venda} - \text{devolução}$) e categorização em Alta ($> 40\%$), Média ($15-40\%$) e Baixa ($< 15\%$).
- **T1.1.3 — Coberturas Comparativas Triplas:** Cálculo fidedigno das janelas de aceleração (30d), giro médio (90d) e defesa/longo prazo (180d) com identificação de tendência.
- **T1.1.4 — Detecção e Alerta Visual de NF-e do Dia:** Acionamento de alerta visual e montagem do payload do tooltip contendo número da nota, fornecedor, quantidade e data.
- **T1.1.5 — Consulta de Peças Similares Intercambiáveis:** Localização de itens intercambiáveis com saldo positivo na rede e agrupamento por loja para consulta instantânea.

#### Feature 2: Motor de Demanda Numérico & Transferência Segura Inter-Lojas
- **T1.2.1 — Consumo Médio Diário e Demanda Real:** Garantia de que a sugestão de compra é derivada exclusivamente de saídas históricas comprovadas, com sugestão zero para itens sem consumo.
- **T1.2.2 — Regra de Ouro da Transferência Inter-Filiais:** A loja doadora só transfere peças se possuir saldo excedente real acima de seu estoque mínimo de segurança ($\text{saldo} - \text{minStock} > 0$).
- **T1.2.3 — Preservação Invariante da Origem:** Validação formal de que o estoque final da loja doadora após o remanejamento nunca é inferior a `estoqueMinimo`.
- **T1.2.4 — Teto da Transferência pela Necessidade de Destino:** A quantidade transferida é limitada estritamente pela necessidade da loja de destino ($\min(\text{necessidadeDestino}, \text{sobraOrigem})$).
- **T1.2.5 — Sugestão Híbrida (Transferência + Compra Complementar):** Quando a sobra de rede cobre apenas parte da necessidade, o motor combina transferência segura com compra externa para o saldo remanescente.

#### Feature 3: Travas Anti-Encalhe e Proteção de Capital de Giro
- **T1.3.1 — Bloqueio Mandatório de Marca Zumbi:** Qualquer SKU com saldo físico $> 0$ e zero vendas registradas nos últimos 180 dias tem sua sugestão de compra travada em ZERO.
- **T1.3.2 — Marca Zumbi sem Estoque (Liberação Condicionada):** SKU sem vendas em 180 dias mas com estoque zerado e histórico anterior recebe tratamento de descontinuação/revisão sem gerar compra espúria.
- **T1.3.3 — Trava de Cobertura Somada de Família/Aplicação:** Se a soma das marcas equivalentes para o mesmo modelo de veículo cobrir o horizonte de estoque planejado, a compra externa de novo SKU é bloqueada.
- **T1.3.4 — Priorização de Queima de Peças da Aplicação:** O sistema prioriza itens com maior estoque antes de sugerir itens da mesma aplicação com custo mais elevado.
- **T1.3.5 — Classificação de Perfil de Giro com Guarda de Elegibilidade:** Requisito de no mínimo 3 notas fiscais comprovadas em 90 dias para habilitar compras regulares de alto volume.

#### Feature 4: Ajuste Humano com Múltiplos e Persistência de Rascunho
- **T1.4.1 — Arredondamento para Embalagem Mínima:** Função `applyMinMultiplo` arredondando quantidades para múltiplos exatos de fábrica ($\lceil \text{qtd} / \text{multiplo} \rceil \times \text{multiplo}$).
- **T1.4.2 — Ajuste Obrigatório para Pares (Pneus e Amortecedores):** Quantidades ímpares ajustadas compulsoriamente para o próximo par superior (`min_multiplo = 2`).
- **T1.4.3 — Sanitização de Célula Editável:** Conversão segura de strings, remoção de caracteres não numéricos e bloqueio de números negativos na digitação rápida.
- **T1.4.4 — Salvamento Automático em Rascunho (`useSessionDraft`):** Persistência em `localStorage` sob chave isolada de usuário (`insight-compras-draft-${userId}`) com estrutura íntegra de snapshot.
- **T1.4.5 — Recuperação Guiada de Sessão Ativa:** Detecção de rascunho existente no carregamento da tela e restauração consistente de quantidades e seleções.

#### Feature 5: Carteira de Compradores (RBAC) & Trilha de Auditoria
- **T1.5.1 — Filtragem Estrita Server-Side por `allowedSupplierIds`:** Bloqueio e expurgo de produtos fora da carteira do comprador em requisições de API e no grid.
- **T1.5.2 — Proteção de Rota Server-Side contra Evasão:** Tentativa de injetar IDs de fornecedores não autorizados via query params resulta em rejeição imediata com erro HTTP 403 Forbidden.
- **T1.5.3 — Trilha Imutável de Auditoria de Pedidos:** Gravação detalhada de ordens com data, ID do comprador, filial, SKU, quantidade sugerida e quantidade ajustada.
- **T1.5.4 — Registro de Divergência e Sobrecompra Manual:** Quando o comprador eleva a quantidade acima da sugestão do motor, o log de auditoria calcula o desvio financeiro e exige justificativa.
- **T1.5.5 — Sanitização contra Injeção DAX/SQL via Zod:** Schema rigoroso que barra strings com delimitadores maliciosos (`EVALUATE`, `DROP`, `UNION`, aspas desbalanceadas).

#### Feature 6: Camada de Adapters, Resiliência e Sistema White-Label
- **T1.6.1 — Conformidade com a Interface `InventoryAdapter`:** Validação de que adaptadores (Carreiro DAX e Mock) implementam fielmente o contrato de carga e saúde de conexão.
- **T1.6.2 — Cache L1 In-Memory com Deduplicação (Singleflight):** Duas consultas simultâneas para o mesmo escopo compartilham a mesma promessa em andamento.
- **T1.6.3 — Cache L2 Stale-While-Revalidate:** Disponibilização de snapshot prévio quando o cache em memória expirar, revalidando dados em segundo plano.
- **T1.6.4 — Circuit Breaker com Desarme em Falhas Consecutivas:** Após 3 falhas de rede no Power BI, o circuito abre e entrega dados em modo degradado sem derrubar a aplicação.
- **T1.6.5 — Configuração Multi-Tenant Carreiro:** Validação da parametrização de tenant (`carreiro.ts`) com cores institucionais (Azul `#0F2B5C`, Dourado `#D4AF37`), filiais e logos.

---

### Tier 2: Casos de Borda e Limite (Boundary Value Analysis - BVA)

O Tier 2 estressa as fronteiras numéricas, lógicas e operacionais do sistema:

| ID | Cenário / Parâmetro | Valores de Teste ($V$) | Comportamento Requerido |
|---|---|---|---|
| **T2.1** | Saldo de Origem na Transferência | $S = \text{minStock} - 1$<br>$S = \text{minStock}$<br>$S = \text{minStock} + 1$ | Sobra $= 0$ (zero transferência)<br>Sobra $= 0$ (zero transferência)<br>Sobra $= 1$ (transfere no máximo 1 unidade). |
| **T2.2** | Janela de Inatividade (Marca Zumbi) | $D = 179 \text{ dias}$<br>$D = 180 \text{ dias}$<br>$D = 181 \text{ dias}$ | Compra permitida se houver demanda histórica.<br>Trava zumbi ativada: sugestão $= 0$.<br>Trava zumbi ativada: sugestão $= 0$. |
| **T2.3** | Diagnóstico de Ruptura | $\text{diasZerados} = 0$<br>$\text{taxa} = 5.0\%$<br>$\text{taxa} = 10.0\%$<br>$\text{diasAnalisados} = 0$ | Classificação `Boa`.<br>Fronteira `Boa` / `Atenção`.<br>Fronteira `Atenção` / `Grave`.<br>Badge `Sem histórico` (sem divisão por zero `NaN`). |
| **T2.4** | Frequência por Notas em 90d | $N = 0 \text{ notas}$<br>$N = 13 \text{ notas}$ (14.4%)<br>$N = 14 \text{ notas}$ (15.5%)<br>$N = 36 \text{ notas}$ (40.0%) | Classificação `Baixa`.<br>Classificação `Baixa`.<br>Classificação `Média`.<br>Classificação `Alta`. |
| **T2.5** | Múltiplos e Embalagens | $\text{mult} = 0 \text{ ou } 1$<br>$\text{mult} = 2, \text{val} = 1$<br>$\text{mult} = 2, \text{val} = 2$<br>$\text{mult} = 4, \text{val} = 5$ | Mantém o valor digitado sem alteração.<br>Arredonda para $2$.<br>Mantém $2$.<br>Arredonda para $8$. |
| **T2.6** | Validade de Rascunho (TTL) | $T = 23\text{h } 59\text{min}$<br>$T = 24\text{h } 01\text{min}$ | Rascunho válido, exibe banner para restaurar.<br>Rascunho expirado, descartado automaticamente. |
| **T2.7** | Cota de Armazenamento | `QuotaExceededError` | Captura a exceção com segurança, exibe aviso amigável sem congelar a UI. |
| **T2.8** | Latência de Busca e Escala | $N = 25.000 \text{ SKUs}$ | Filtragem completa em memória executada em tempo $< 250\text{ms}$. |

---

### Tier 3: Combinações Entre Features (Pairwise)

O Tier 3 valida a interação de regras simultâneas que competem ou se encadeiam:

1. **T3.1 — RBAC Restrito x Marca Zumbi:** Comprador com fornecedor autorizado tenta acessar SKU zumbi. A trava anti-encalhe anula a compra ($0$) sem violar as regras de acesso à carteira.
2. **T3.2 — Alerta de NF-e do Dia x Similar Disponível x Necessidade:** SKU com necessidade matemática positiva tem mercadoria recebida hoje (NF-e) E peça similar sobrando na outra loja. O sistema sinaliza prioritariamente a NF-e e a transferência antes de autorizar qualquer compra externa.
3. **T3.3 — Família de Aplicação com Cobertura Global x SKU Individual Zerado:** Produto A está com estoque físico zero, mas Produtos B e C da mesma família/aplicação possuem estoque suficiente para 120 dias. A trava de família anula a sugestão de compra do Produto A para evitar capital empatado.
4. **T3.4 — Transferência Parcial x Compra Complementar com Embalagem Mínima:** Loja destino precisa de 9 unidades de um produto com `min_multiplo = 4`. A loja origem possui sobra real de 3 unidades. A transferência segura doa 3 unidades (sem desabastecer a origem). O saldo faltante de 6 unidades é ajustado para 8 unidades pelo lote mínimo de 4.
5. **T3.5 — Restauração de Rascunho x Alteração de Carteira:** Se um comprador restaura um rascunho de sessão anterior onde havia itens de um fornecedor cujo acesso foi revogado pelo gestor, esses itens são expurgados do rascunho silenciosamente na carga.
6. **T3.6 — Indisponibilidade Transitória de Rede x Filtros Dinâmicos do Cockpit:** Sob oscilação na conexão com o Power BI, o Circuit Breaker aciona o snapshot L2 e os filtros em memória continuam operando instantaneamente sobre os 25.000 SKUs em cache.

---

### Tier 4: Cenários Reais de Aplicação (Jornadas E2E do Negócio)

O Tier 4 simula jornadas de trabalho completas vividas diariamente na operação da Rede Carreiro:

#### Cenário 4.1: Jornada Matinal do Comprador de Linha Pesada (Suspensão)
- **Atores:** Comprador Homologado (Carteira Monroe/Cofap/Nakata), Loja 1 (Trairi), Loja 2 (Paraipaba).
- **Passo 1:** Login do comprador na plataforma e injeção do tema White-Label Carreiro (Azul/Dourado).
- **Passo 2:** Carregamento de mais de 25.000 SKUs via cache resiliente e filtragem instantânea pela seção "Amortecedores e Suspensão" ($< 150\text{ms}$).
- **Passo 3:** O comprador visualiza um amortecedor traseiro em **Ruptura Grave** (15 dias zerado nos últimos 90d, consumo diário de 1,2 un/dia).
- **Passo 4:** O sistema aponta um ícone de alerta: há uma **NF-e do Dia** com 10 unidades que acabou de dar entrada na filial.
- **Passo 5:** O comprador consulta a filial vizinha (Paraipaba) e constata sobra real de 6 unidades acima do estoque mínimo. Uma transferência de 6 peças é sugerida e aprovada.
- **Passo 6:** O comprador avalia a necessidade remanescente e decide comprar mais 4 peças. A célula editável forçará o par (`min_multiplo = 2`).
- **Passo 7:** O comprador salva a sessão, gera a ordem de compra e o sistema grava o pedido na trilha de auditoria imutável.

#### Cenário 4.2: Prevenção de Encalhe e Auditoria de Sobrecompras
- **Atores:** Comprador de Linha Leve, Gestor de Operações.
- **Passo 1:** O comprador localiza um lote de velas de ignição onde o SKU principal teve 0 vendas nos últimos 180 dias, possuindo 18 peças no estoque da loja.
- **Passo 2:** O motor bloqueia a sugestão de compra em **0** via Trava de Marca Zumbi.
- **Passo 3:** O comprador tenta forçar a compra de 20 peças manualmente no cockpit.
- **Passo 4:** O sistema emite alerta visual de divergência com o motor e exige preenchimento de justificativa operacional.
- **Passo 5:** Ao confirmar, o evento é gravado no painel do Gestor como "Sobrecompra com Risco de Encalhe", apontando o desvio em Reais ($R\$ \text{custo} \times 20$).

#### Cenário 4.3: Resiliência Operacional e Tolerância a Quedas do Power BI
- **Atores:** Cockpit do Comprador, Provedor Power BI Fabric REST API, Circuit Breaker.
- **Passo 1:** Durante o expediente matinal de compras, o serviço da nuvem do Fabric entra em manutenção ou atinge rate limit (HTTP 429/503).
- **Passo 2:** O adaptador registra falha e aciona o Circuit Breaker.
- **Passo 3:** O cockpit consome o snapshot persistente L2 (Stale-While-Revalidate) com aviso discreto na barra de status: *"Dados em modo resiliente (atualizados hoje às 06:00)"*.
- **Passo 4:** O comprador continua trabalhando, filtrando e gerando pedidos sem travar o navegador.
- **Passo 5:** A conexão é restabelecida, o circuito fecha e a revalidação ocorre transparentemente em segundo plano.

#### Cenário 4.4: Governança e Auditoria Consolidada da Rede
- **Atores:** Gestor Geral / Administrador da Rede Carreiro.
- **Passo 1:** Login como Administrador (sem restrições de fornecedores).
- **Passo 2:** O painel de auditoria consolida todos os pedidos e transferências gerados por todos os compradores nas duas filiais.
- **Passo 3:** O gestor audita o percentual de conformidade das decisões humanas em relação às sugestões puras do motor.
- **Passo 4:** Exportação da trilha completa em formato auditável com carimbo de tempo, usuário e justificativas.

---

## 3. Arquitetura do Test Harness e Runner E2E

### 3.1 Layout dos Arquivos de Teste

A infraestrutura de testes reside no diretório `tests/e2e/`:

```
tests/e2e/
├── harness/
│   ├── contexto-teste.ts           # Fábrica de dados sintéticos, simulação de sessão e tenant
│   ├── runner-opaque.ts            # Executor de pipeline e medição de desempenho
│   └── mock-ambiente.ts            # Simulação de storage (localStorage) e serviços de rede
├── tier1-features/
│   ├── cockpit-matriz.test.ts      # 5+ testes: baseColumns, Ruptura, Frequência, Coberturas, NF-e
│   ├── motor-transferencia.test.ts # 5+ testes: Demanda real, regra de ouro (saldo - minStock > 0)
│   ├── travas-encalhe.test.ts      # 5+ testes: Marca Zumbi (180d), Cobertura somada de família
│   ├── ajuste-rascunho.test.ts     # 5+ testes: applyMinMultiplo, pares, useSessionDraft
│   ├── rbac-auditoria.test.ts      # 5+ testes: allowedSupplierIds, trilha imutável, Zod
│   └── adapters-resiliencia.test.ts# 5+ testes: L1/L2 cache, circuit breaker, tenant Carreiro
├── tier2-boundary/
│   └── boundary-analysis.test.ts   # BVA: 179d/180d/181d, saldo=minStock, TTL 24h, 25k SKUs < 250ms
├── tier3-pairwise/
│   └── pairwise-combos.test.ts     # Matriz de combinações entre RBAC, travas, alertas e transferências
└── tier4-scenarios/
    └── jornadas-comprador.test.ts  # Jornadas completas: Suspensão, Encalhe, Resiliência, Auditoria
```

### 3.2 Comandos de Execução

A suíte pode ser executada por scripts padronizados no `package.json`:

```bash
# Executar a suíte completa de testes E2E (Tiers 1 a 4)
npm test

# Executar especificamente a suíte E2E via Vitest
npx vitest run tests/e2e

# Executar um tier específico
npx vitest run tests/e2e/tier1-features
npx vitest run tests/e2e/tier2-boundary
npx vitest run tests/e2e/tier3-pairwise
npx vitest run tests/e2e/tier4-scenarios
```

---

## 4. Matriz de Rastreabilidade (Traceability Matrix)

| Requisito ORIGINAL_REQUEST | Cláusula | Tier de Teste | Arquivos de Teste E2E | Status de Cobertura |
|---|---|:---:|---|:---:|
| **R1. Arquitetura Modular** | Núcleo Puro (core/) e Adapters | Tier 1, Tier 4 | `motor-transferencia.test.ts`, `adapters-resiliencia.test.ts`, `jornadas-comprador.test.ts` | 100% Coberto |
| **R2. Cockpit do Comprador** | Grid Virtualizado 25k SKUs | Tier 1, Tier 2 | `cockpit-matriz.test.ts`, `boundary-analysis.test.ts` | 100% Coberto |
| **R2. Cockpit do Comprador** | Matriz `baseColumns` e 5 Tooltips | Tier 1 | `cockpit-matriz.test.ts` | 100% Coberto |
| **R2. Cockpit do Comprador** | Múltiplos, Pares e Rascunho | Tier 1, Tier 2, Tier 3 | `ajuste-rascunho.test.ts`, `boundary-analysis.test.ts`, `pairwise-combos.test.ts` | 100% Coberto |
| **R3. Motor de Decisão** | Demanda Estrita por Vendas | Tier 1 | `motor-transferencia.test.ts` | 100% Coberto |
| **R3. Motor de Decisão** | Transferência Segura (`saldo - minStock > 0`) | Tier 1, Tier 2, Tier 3, Tier 4 | `motor-transferencia.test.ts`, `boundary-analysis.test.ts`, `pairwise-combos.test.ts`, `jornadas-comprador.test.ts` | 100% Coberto |
| **R3. Motor de Decisão** | Trava Marca Zumbi (180d) | Tier 1, Tier 2, Tier 3, Tier 4 | `travas-encalhe.test.ts`, `boundary-analysis.test.ts`, `pairwise-combos.test.ts`, `jornadas-comprador.test.ts` | 100% Coberto |
| **R3. Motor de Decisão** | Trava Cobertura Somada Família | Tier 1, Tier 3 | `travas-encalhe.test.ts`, `pairwise-combos.test.ts` | 100% Coberto |
| **R4. Carteira & Cibersegurança**| RBAC Server-Side (`allowedSupplierIds`) | Tier 1, Tier 3, Tier 4 | `rbac-auditoria.test.ts`, `pairwise-combos.test.ts`, `jornadas-comprador.test.ts` | 100% Coberto |
| **R4. Carteira & Cibersegurança**| Painel de Auditoria do Gestor | Tier 1, Tier 4 | `rbac-auditoria.test.ts`, `jornadas-comprador.test.ts` | 100% Coberto |
| **R4. Carteira & Cibersegurança**| Sanitização Zod / Anti-Injeção DAX | Tier 1 | `rbac-auditoria.test.ts` | 100% Coberto |
| **R5. White-Label & Vercel** | Multi-Tenant Carreiro e Deploy | Tier 1, Tier 4 | `adapters-resiliencia.test.ts`, `jornadas-comprador.test.ts` | 100% Coberto |

---

*Documento homologado pelo Test Writer da Plataforma de Compras em 2026-09-06.*

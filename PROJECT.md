# Projeto: Plataforma White-Label de Inteligência e Copiloto de Compras para Autopeças

## 1. Arquitetura Geral do Sistema
A nova plataforma SaaS é construída sob os princípios da **Clean Architecture** e **Domain-Driven Design (DDD)**, garantindo desacoplamento estrito entre o domínio de negócios, os adaptadores de integração com clientes e as interfaces de usuário no Next.js (App Router).

```
┌─────────────────────────────────────────────────────────────────────────┐
│              CAMADA DE APRESENTAÇÃO (src/app / components)              │
│ - Cockpit do Comprador Virtualizado (TanStack Table v8 + Virtual 60fps) │
│ - 5 Tooltips Analíticos Ricos (Abertura Instantânea delayDuration={0})  │
│ - Filtros em Memória Tokenizados (< 250ms de latência)                  │
│ - White-Label Dinâmico via CSS Variables e Edge Middleware              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Consome
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 CAMADA DE APLICAÇÃO E SEGURANÇA (src/lib)               │
│ - RBAC Multi-Tenant com Validação Server-Side (allowedSupplierIds)       │
│ - Sanitização Estrita contra Injeção DAX / SQL (Zod Schema)             │
│ - Trilha Imutável de Auditoria de Pedidos e Ajustes Manuais             │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Orquestra
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│            CAMADA DE ADAPTADORES (adapters/ — Portas & Adaptadores)      │
│ - Interface Unificada Abstrata: InventoryAdapter                        │
│ - adapters/carreiro/: DAX Power BI Fabric REST API (executeQueries)      │
│   * Cache L1 In-Memory LRU + Singleflight Request Coalescing            │
│   * Cache L2 Snapshot Stale-While-Revalidate + Circuit Breaker          │
│ - adapters/mock/: Gerador Sintético Estocástico de 25.000+ SKUs         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Alimenta
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             CAMADA DE DOMÍNIO PURO (core/ — Zero Dependências)          │
│ - Funções Puras TypeScript sem dependências de BD, UI ou Frameworks     │
│ - Motor de Demanda Estritamente Data-Driven (zero compra sem demanda)   │
│ - Algoritmo de Transferência Segura (saldo - minStock > 0 na doadora)   │
│ - Travas Anti-Encalhe: Marca Zumbi (180d) e Cobertura Somada de Família │
│ - Lotes de Aplicação e Múltiplos Mínimos de Fábrica / Pares             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Feature Inventory
Todas as funcionalidades mapeadas durante a fase de Survey (M0) estão registradas abaixo e atribuídas a marcos de implementação específicos. Nenhuma funcionalidade fica sem marco atribuído.

| # | Funcionalidade | Descrição Técnica / Operacional | Marco | Origem |
|---|---|---|---|---|
| 1 | Tipos e Entidades de Domínio | Modelagem TypeScript pura: `Produto`, `EstoqueFilial`, `HistoricoVendasFilial`, `SugestaoCompraItem`, `TransferenciaRecomendada`, `AuditoriaPedido` | M1 | Survey (M0) / ORIGINAL_REQUEST R1 |
| 2 | Motor de Demanda Numérico | Função pura de cálculo de consumo diário e projeção mensal orientada estritamente a vendas reais | M1 | Survey (M0) / ORIGINAL_REQUEST R3 |
| 3 | Classificador de Perfil de Giro | Categorização em Alto Giro (>=6/mês), Médio Giro (>=2.5/mês) e Baixo Giro com guarda de elegibilidade (>=3 notas em 90d/12m) | M1 | Survey (M0) / Legado diario |
| 4 | Algoritmo de Transferência Segura | Transferência inter-filiais onde a doadora só transfere se `saldo - minStock > 0`, protegendo a origem contra desabastecimento | M1 | Survey (M0) / ORIGINAL_REQUEST R3 |
| 5 | Trava Anti-Encalhe Marca Zumbi | Bloqueio automático de sugestão para 0 se o SKU tiver saldo em estoque $> 0$ e zero vendas nos últimos 180 dias | M1 | Survey (M0) / ORIGINAL_REQUEST R3 |
| 6 | Trava Cobertura Somada de Família | Bloqueio de compra se a soma das peças intercambiáveis da mesma aplicação veicular cobrir o horizonte | M1 | Survey (M0) / ORIGINAL_REQUEST R3 |
| 7 | Ajustador de Lotes e Múltiplos | Arredondamento para múltiplos de fábrica (avulso, par para amortecedores/discos, jogo para velas) | M1 | Survey (M0) / ORIGINAL_REQUEST R2 |
| 8 | Testes Unitários do Core | Cobertura de 100% das regras e guardrails com Vitest | M1 | Survey (M0) / Critérios de Aceite |
| 9 | Interface Unificada InventoryAdapter | Contrato desacoplado para provedores de dados de inventário, estoque e vendas | M2 | Survey (M0) / ORIGINAL_REQUEST R1 |
| 10 | Adaptador Carreiro DAX | Execução de consultas DAX homologadas via REST API do Power BI Fabric com token Service Principal | M2 | Survey (M0) / ORIGINAL_REQUEST R1 |
| 11 | Cache Resiliente L1 + L2 + Circuit Breaker | Cache em memória (LRU) + snapshot persistente + Circuit Breaker para tolerar oscilações de rede no Power BI | M2 | Survey (M0) / ORIGINAL_REQUEST R1 |
| 12 | Gerador Sintético de 25.000+ SKUs | Gerador de dados de autopeças realistas com anomalias estruturadas para desenvolvimento offline e testes de carga | M2 | Survey (M0) / ORIGINAL_REQUEST R2 |
| 13 | Grid Virtualizado de 25.000+ SKUs | Renderizador de tabela virtualizada a 60fps usando TanStack Table v8 + TanStack Virtual com `overscan: 10` e memoização de linha | M3 | Survey (M0) / ORIGINAL_REQUEST R2 |
| 14 | Busca e Filtros em Memória (< 250ms) | Pipeline de busca textual indexada e filtros facetados O(1) usando `useDeferredValue` e `useTransition` | M3 | Survey (M0) / ORIGINAL_REQUEST R2 |
| 15 | Colunas baseColumns | Matriz completa: Ruptura, Frequência (90d), Coberturas (30d/90d/180d), Alerta NF-e do Dia, Similares | M3 | Survey (M0) / ORIGINAL_REQUEST R2 |
| 16 | Tooltip de Ruptura | Tooltip instantâneo com dias analisados, dias zerados, percentual e classificação de gravidade | M3 | Survey (M0) / ORIGINAL_REQUEST R2 |
| 17 | Tooltip de Frequência | Tooltip instantâneo detalhando notas de venda, devoluções, notas líquidas e extrato com cores semânticas | M3 | Survey (M0) / ORIGINAL_REQUEST R2 |
| 18 | Tooltip de Cobertura | Tooltip comparativo detalhando saídas e tendências nas janelas de 30d (aceleração), 90d (giro) e 180d (defesa) | M3 | Survey (M0) / ORIGINAL_REQUEST R2 |
| 19 | Tooltip de Transferência | Tooltip detalhando sobra real da loja de origem (`saldo - minStock`), loja destino e motivo de remanejamento | M3 | Survey (M0) / ORIGINAL_REQUEST R2 |
| 20 | Tooltip de NF-e do Dia | Alerta visual imediato e tooltip com número da NF-e, fornecedor, quantidade que deu entrada hoje e data | M3 | Survey (M0) / ORIGINAL_REQUEST R2 |
| 21 | Célula Editável e Múltiplos | Input numérico rápido com navegação por Tab, validação de múltiplos/embalagem mínima e pares | M3 | Survey (M0) / ORIGINAL_REQUEST R2 |
| 22 | Rascunho de Sessão (useSessionDraft) | Salvamento automático em `localStorage` debounced com recuperação inteligente e tratamento de quota | M3 | Survey (M0) / ORIGINAL_REQUEST R2 |
| 23 | Controle de Acesso RBAC Server-Side | Restrição estrita de carteira de comprador por `allowedSupplierIds` validada no servidor e visão total de Gestor | M4 | Survey (M0) / ORIGINAL_REQUEST R4 |
| 24 | Painel de Auditoria do Gestor | Trilha imutável para rastrear e auditar pedidos, sobrecompras e divergências com as sugestões do sistema | M4 | Survey (M0) / ORIGINAL_REQUEST R4 |
| 25 | Cibersegurança e Prevenção de Injeção | Sanitização de entradas com Zod, proteção contra injeção DAX/SQL e isolamento de sessão | M4 | Survey (M0) / ORIGINAL_REQUEST R4 |
| 26 | Sistema White-Label Dinâmico | Configuração de tenant (`config/tenants/carreiro.ts`) com cores institucionais (Azul/Dourado), logos e filiais | M4 | Survey (M0) / ORIGINAL_REQUEST R5 |
| 27 | Roteamento por Subdomínio Vercel | Edge Middleware para resolver subdomínios (ex: `carreiro.insightd.com.br`) e injetar variáveis CSS no tema | M4 | Survey (M0) / ORIGINAL_REQUEST R5 |
| 28 | Suíte de Testes E2E Opaque-Box | Testes automatizados cobrindo fluxos do comprador, transferências, travas e filtros (Tiers 1 a 4) | M5 | Survey (M0) / Dual Track E2E |
| 29 | Hardening de Cobertura Adversarial | Bateria de testes de estresse com geração de dados extremos e verificação de integridade (Tier 5) | M5 | Survey (M0) / Dual Track E2E |
| 30 | Homologação de Build e Integridade | Compilação estrita Next.js (`npm run build` com `strict: true`) e verificação do Forensic Auditor independente | M5 | Survey (M0) / Critérios de Aceite |

---

## 3. Milestones
A implementação está organizada em 5 marcos sequenciais, garantindo validação progressiva:

| # | Marco | Escopo | Dependências | Status |
|---|---|---|---|---|
| M1 | Fundação Clean Architecture & Core Puro | Estrutura de pastas, configuração de TypeScript (`strict: true`), Vitest, entidades puras, cálculo de demanda, transferência segura, travas anti-encalhe e testes unitários | Nenhuma | CONCLUÍDO |
| M2 | Camada de Adapters & DAX Carreiro Resiliente | Interface `InventoryAdapter`, adaptador DAX para Power BI/Fabric, cache L1/L2 com Circuit Breaker, e gerador sintético de 25.000+ SKUs com testes | M1 | CONCLUÍDO |
| M3 | Cockpit do Comprador Virtualizado & Tooltips Ricos | Tabela virtualizada TanStack 60fps para 25.000 SKUs, busca/filtros < 250ms, `baseColumns`, 5 tooltips instantâneos, edição com múltiplos e persistência de rascunho | M1, M2 | CONCLUÍDO |
| M4 | Carteira de Compradores (RBAC), Cibersegurança & White-Label | Validação server-side de `allowedSupplierIds`, auditoria do gestor, sanitização Zod, tenant `carreiro.ts` (Azul/Dourado), Edge Middleware e deploy Vercel | M1, M2, M3 | EM_ANDAMENTO |
| M5 | Testes E2E, Cobertura Adversarial & Homologação Final | Testes E2E (Tiers 1-4), hardening adversarial (Tier 5), build limpo `npm run build` (strict) e auditoria de integridade forense | M1, M2, M3, M4 | PLANEJADO |

---

## 4. Contratos de Interface (Interface Contracts)

### `core/` ↔ `adapters/`
- O `core/` define os tipos puros de dados e não importa nada de `adapters/`.
- `adapters/` implementa `InventoryAdapter` e converte dados brutos do DAX/ERP para os tipos do `core/`:
```typescript
export interface InventoryAdapter {
  carregarInventarioCompleto(filtro: FiltroCargaInventario): Promise<RespostaCargaInventario>;
  verificarSaudeConexao(): Promise<boolean>;
}
```

### `adapters/` ↔ `src/app/` (Next.js Server Components & APIs)
- A aplicação Next.js injeta filtros validados por RBAC no `InventoryAdapter`:
```typescript
const resposta = await adaptador.carregarInventarioCompleto({
  fornecedoresPermitidos: sessao.fornecedoresPermitidos,
  secaoId: parametros.secaoId,
});
```

### `src/app/` ↔ `components/cockpit/`
- O componente de grid virtualizado recebe a lista normalizada e pré-indexada para renderização a 60fps:
```typescript
interface PropsCockpit {
  produtos: readonly DecisionMatrixRow[];
  tenant: ConfiguracaoTenant;
  usuario: SessaoAutenticada;
}
```

---

## 5. Code Layout

```
insight-compras/
├── .agents/                               # Metadados de agentes e orquestração
├── core/                                  # CAMADA 1: NÚCLEO PURO (TypeScript Puro, Zero Dependências)
│   ├── dominio/                           # Entidades imutáveis: produto, estoque, vendas, sugestao
│   ├── calculo/                           # Motores: demanda-diaria, curva-abc, necessidade
│   ├── transferencia/                     # Algoritmo: balanceamento (saldo - minStock > 0)
│   └── travas/                            # Guardrails: marca-zumbi, familia-aplicacao, lote-multiplo
├── adapters/                              # CAMADA 2: ADAPTADORES (Portas & Adaptadores)
│   ├── AdaptadorInventario.ts             # Interface unificada
│   ├── carreiro/                          # Power BI Fabric DAX + Cache Resiliente L1/L2
│   └── mock/                              # Gerador Sintético Estocástico de 25.000+ SKUs
├── config/                                # CAMADA 3: CONFIGURAÇÕES & WHITE-LABEL MULTI-TENANT
│   ├── tenants/
│   │   ├── tipos.ts                       # Contrato de configuração de tenant
│   │   └── carreiro.ts                    # Tenant Rede Carreiro (Azul #0F2B5C, Dourado #D4AF37)
│   └── seguranca.ts                       # Parâmetros de autenticação e sessão
├── src/                                   # CAMADA 4: NEXT.JS 14/15 APP ROUTER
│   ├── app/
│   │   ├── (cockpit)/compras/page.tsx     # Cockpit do Comprador com Suspense
│   │   ├── admin/auditoria/page.tsx       # Painel de Auditoria do Gestor
│   │   ├── api/compras/route.ts           # API com validação server-side de carteira
│   │   ├── api/detalhes-item/route.ts     # Detalhes sob demanda para tooltips analíticos
│   │   ├── api/pedidos/route.ts           # Registro imutável de ordens de compra
│   │   ├── layout.tsx                     # Injeção de CSS variables do tenant
│   │   └── globals.css                    # Estilos Tailwind CSS
│   ├── components/
│   │   ├── cockpit/                       # Grid virtualizado, colunas e filtros instantâneos
│   │   └── tooltips/                      # Os 5 Tooltips Analíticos Ricos
│   ├── lib/                               # RBAC, sanitização Zod, resolução de tenant
│   └── middleware.ts                      # Edge Middleware Vercel para subdomínios
├── tests/                                 # SUÍTE DE TESTES AUTOMATIZADOS (Vitest)
│   ├── core/                              # Testes unitários das regras matemáticas puras
│   ├── adapters/                          # Testes de resiliência de cache e mock 25k
│   ├── seguranca/                         # Testes de RBAC e sanitização
│   └── e2e/                               # Testes ponta a ponta (Tiers 1 a 5)
├── vitest.config.ts                       # Configuração Vitest
├── tsconfig.json                          # TypeScript estrito (strict: true)
├── tailwind.config.ts                     # Tailwind CSS configurado para CSS variables
└── package.json                           # Dependências do projeto
```

---
*Documento vivo mantido pelo Project Orchestrator. Atualizado em 2026-09-06.*

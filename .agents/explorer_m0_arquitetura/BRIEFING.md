# BRIEFING — 2026-09-06T12:35:00Z

## Mission
Mapear e projetar a arquitetura técnica completa, Clean Architecture, cibersegurança e sistema White-Label da plataforma insight-compras.

## 🔒 My Identity
- Archetype: explorer
- Roles: [Investigador de Arquitetura Técnica, Modelagem Clean Architecture, Estrategista de Resiliência/Cache, Cibersegurança & White-Label]
- Working directory: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m0_arquitetura
- Original parent: 9953ab24-6d4a-476a-bdf5-d7dd0471ea3f
- Milestone: M0 - Arquitetura Técnica, Clean Architecture, Segurança & White-Label

## 🔒 Key Constraints
- Read-only investigation — do NOT implement (apenas investigar, projetar e emitir relatórios/especificações na pasta .agents)
- Clean Architecture estrita: core/ puro sem dependências externas de DB ou UI
- 100% em Português do Brasil (pt-BR): variáveis de domínio, nomes de funções, comentários e relatórios
- Regras anti-encalhe e cálculo puramente guiado por dados históricos
- Transferência entre lojas exclusivamente com sobra real acima do estoque de segurança
- Cibersegurança: RBAC por allowedSupplierIds e proteção estrita server-side
- Arquivos apenas dentro do diretório do agente em .agents

## Current Parent
- Conversation ID: 9953ab24-6d4a-476a-bdf5-d7dd0471ea3f
- Updated: not yet

## Investigation State
- **Explored paths**: `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md`, `c:\Users\Felipe Barbosa\Documents\diario\` (`lib/purchase-intelligence/`, `lib/server/powerbi-service.ts`, `compra-auto/services/calc.service.ts`, `queries/carreiro_2026/`, relatórios diagnósticos de compras e estoque).
- **Key findings**:
  - Legado sofria de acoplamento de queries com lógica de sugestão.
  - Regra de transferência deve garantir invariante: saldo_pos >= minStock (sobra real).
  - Trava Marca Zumbi (saldo > 0 && vendas180d === 0 -> compra 0) e Trava Família/Aplicação estancam capital parado.
  - Power BI REST API precisa de cache multinível (L1 LRU + L2 Snapshot + Circuit Breaker + Singleflight) para suportar 25k SKUs.
  - RBAC com interseção forçada server-side via `allowedSupplierIds` impede vazamento de dados.
  - White-Label desacoplado em `config/tenants/carreiro.ts` com injeção de CSS variables e roteamento por subdomínio na Vercel.
- **Unexplored areas**: Nenhuma pendência em M0; pronto para a fase de implementação.

## Key Decisions Made
- Estrutura de pastas estrita com `core/` puro TypeScript, `adapters/` com interface `InventoryAdapter`, `config/tenants/` e Next.js 14/15 App Router em `src/`.
- Suíte de testes com Vitest, cobertura mínima de 90% no `core/`, e código 100% em pt-BR.

## Artifact Index
- `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m0_arquitetura\handoff.md` — Relatório arquitetural completo
- `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m0_arquitetura\progress.md` — Heartbeat de progresso
- `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m0_arquitetura\DISPATCH.md` — Histórico de despacho

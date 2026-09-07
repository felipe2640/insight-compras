# Plano de Execução — Plataforma White-Label de Inteligência de Compras

## Visão Geral
Construção do zero da plataforma SaaS White-Label em Next.js (TypeScript strict: true), arquitetura modular limpa (Clean Architecture), desacoplada do legado, integrada ao modelo semântico via DAX (adapters/carreiro com cache resiliente), cockpit virtualizado para 25.000+ SKUs com tooltips analíticos ricos, motor numérico com travas anti-encalhe e transferência segura, RBAC por comprador e white-label dinâmico. 100% em Português do Brasil.

---

## Frentes de Trabalho & Marcos

### Marco 0: Survey & Mapeamento de Requisitos e Legado (Em Andamento)
- **Objetivo**: Mapear detalhadamente todas as regras de negócio, consultas DAX, esquemas de dados de autopeças e colunas analíticas a partir do projeto de referência (`c:\Users\Felipe Barbosa\Documents\diario`) e da requisição original (`ORIGINAL_REQUEST.md`).
- **Entregáveis**: Relatório de levantamento de DAX, entidades de dados, fórmulas analíticas e inventário de requisitos consolidado.

### Marco 1: Fundação Clean Architecture & Core Puro (TypeScript)
- **Objetivo**: Estruturar o projeto com Next.js / TypeScript (`strict: true`), padrões de codificação e implementar o diretório `core/` totalmente desacoplado de BD, adapters e UI.
- **Entregáveis**:
  - Entidades e tipos puros: `ItemEstoque`, `DemandaHistorica`, `TransferenciaSugestao`, `CalculoRuptura`, `MetricasCobertura`, `TravaEncalhe`.
  - Funções puras:
    * Cálculo de ruptura (dias analisados, dias zerados, percentual e severidade).
    * Frequência líquida em 90 dias (dias com saída comprovada, vendas vs devoluções).
    * Coberturas comparativas (janelas de 30d, 90d e 180d).
    * Motor de decisão estritamente numérico (zero sugestão sem demanda comprovada).
    * Algoritmo de transferência segura entre filiais (apenas se `saldo - minStock > 0`).
    * Travas anti-encalhe (soma de estoque da família/aplicação e bloqueio de marca zumbi com 0 vendas em 180 dias).
  - Bateria completa de testes unitários para o `core/`.

### Marco 2: Camada de Adapters & Integração Carreiro (DAX com Cache Resiliente)
- **Objetivo**: Criar a interface `InventoryAdapter` e a implementação concreta `adapters/carreiro/`.
- **Entregáveis**:
  - Interface `InventoryAdapter` unificada e agnóstica.
  - `adapters/carreiro`: executor de DAX para Power BI / Fabric, parser de resultados para tipos do `core/`.
  - Mecanismo de cache resiliente (memória + persistência local/LRU) com fallback para oscilações de rede.
  - Conjunto de dados sintéticos realistas com mais de 25.000 SKUs para desenvolvimento offline e testes de carga.

### Marco 3: Cockpit Virtualizado do Comprador & Tooltips Analíticos Ricos
- **Objetivo**: Desenvolver o Cockpit do Comprador com virtualização fluida para 25.000+ SKUs e tooltips analíticos detalhados.
- **Entregáveis**:
  - Grid com `@tanstack/react-table` v8 e `@tanstack/react-virtual`, mantendo 60fps na rolagem e busca/filtros < 250ms.
  - Colunas `baseColumns` completas:
    * Diagnóstico de Ruptura
    * Frequência por Notas em 90 dias
    * Coberturas Comparativas (30d, 90d, 180d)
    * Alerta visual de NF-e de entrada do dia
    * Consulta de itens similares intercambiáveis com saldo positivo
  - Tooltips Analíticos instantâneos (hover/foco):
    * Ruptura (histórico de zeramento, dias com/sem estoque, %)
    * Frequência (notas líquidas, vendas, devoluções em 90d)
    * Cobertura (decomposição 30d, 90d, 180d)
    * Transferência (loja de origem, sobra real, motivo)
    * NF-e do Dia (número, fornecedor, quantidade, data)
  - Células editáveis de sugestão com múltiplos de embalagem/pares e salvamento de rascunhos de compra.

### Marco 4: Carteira de Compradores (RBAC), Cibersegurança & White-Label Tenant
- **Objetivo**: Proteger o sistema com controle de acesso por carteira de fornecedor, sanitização rigorosa e tematização white-label.
- **Entregáveis**:
  - RBAC: Comprador limitado aos seus `allowedSupplierIds` (front-end e validação server-side); Gestor com visão total e auditoria.
  - Cibersegurança: Sanitização de DAX/SQL, segurança de cabeçalhos, isolamento de sessão e tokens.
  - White-label dinâmico: `config/tenants/carreiro.ts` com cores (Azul/Dourado Carreiro), logo da Carreiro, assinatura iNSIGHT D e filiais.

### Marco 5 (Final): Esteira de Testes E2E, Cobertura Adversarial e Homologação
- **Objetivo**: Validação ponta a ponta com testes E2E (Tiers 1 a 4), testes de estresse adversarial (Tier 5) e auditoria de integridade forense.
- **Entregáveis**:
  - Testes E2E automáticos cobrindo fluxos do comprador, transferências, travas e filtros.
  - Verificação de compilação limpa (`npm run build` sem avisos ou erros).
  - Relatório final de conformidade e prontidão para deploy na Vercel.

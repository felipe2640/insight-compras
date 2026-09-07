# Original User Request

## 2026-09-06T12:29:36Z

# Plataforma White-Label de Inteligência e Copiloto de Compras para Autopeças

> Status: Launched — Delegated to teamwork_preview  
> Goal: Multi-agent execution of the new white-label purchasing platform  
> Requested team: Full team  

Construir do zero a nova plataforma White-Label de Inteligência de Compras de Autopeças (SaaS), desacoplada do projeto legado, com arquitetura modular limpa (Core agnóstico vs Adapters de clientes), conectada ao modelo semântico do Power BI da Rede Carreiro via DAX, com cockpit do comprador de alta performance (baseColumns do modelo novo e tooltips analíticos ricos), motor de decisão estritamente numérico, esteira de testes automatizados, alta segurança cibernética e 100% em Português do Brasil.

Working directory: c:\Users\Felipe Barbosa\Documents\insight-compras
Integrity mode: development

## Requisitos

### R1. Arquitetura Modular e Isolamento de Responsabilidades (Clean Architecture)
- Núcleo Puro (core/): O motor de cálculo de demanda, regras de transferência entre lojas e guardrails contra encalhe devem ser funções puras em TypeScript, sem qualquer dependência de bancos de dados específicos, drivers ou bibliotecas de UI.
- Camada de Adapters (adapters/): Criar uma interface unificada InventoryAdapter que padroniza os dados do cliente. Implementar adapters/carreiro executando as consultas DAX homologadas no Power BI/Fabric (com mecanismo de cache resiliente para garantir disponibilidade contra oscilações de rede).
- Padronização em Português: 100% do código, comentários, mensagens de log, testes e interface do usuário devem ser escritos em Português do Brasil (pt-BR).

### R2. Cockpit do Comprador Virtualizado com Tooltips Analíticos Ricos
- Grid Virtualizado: Tabela baseada em TanStack Table v8 e TanStack Virtual, renderizando mais de 25.000 SKUs sem travamentos, com rolagem a 60fps e busca instantânea.
- Matriz de Decisão (baseColumns): Exibir os indicadores do modelo novo de compra:
  - Diagnóstico de Ruptura (dias analisados, dias zerados, percentual e classificação de gravidade).
  - Frequência por Notas em 90 dias (dias com saída comprovada).
  - Coberturas Comparativas (janelas de 30 dias para aceleração, 90 dias para giro médio e 180 dias para proteção de longo prazo).
  - Alerta visual em tempo real para notas fiscais de entrada do dia (NF-e).
  - Consulta rápida de itens similares intercambiáveis com saldo positivo.
- Tooltips Analíticos Detalhados (Essencial para Decisão):
  - Tooltip de Ruptura: detalhamento do histórico de zeramento, dias com/sem estoque e percentual.
  - Tooltip de Frequência: notas líquidas, notas de venda e notas de devolução nos 90 dias.
  - Tooltip de Cobertura: decomposição das saídas nas janelas de 30, 90 e 180 dias.
  - Tooltip de Transferência: loja de origem, sobra real da origem e motivo da recomendação.
  - Tooltip de NF-e do Dia: número da nota, fornecedor, quantidade que deu entrada e data.
- Ajuste Humano com Múltiplos: Células editáveis permitindo ao comprador ajustar quantidades com travas de embalagem mínima, pares ou múltiplos de fábrica.

### R3. Motor de Decisão Numérico e Travas de Encalhe
- Orientação Estrita aos Dados: As sugestões de compra devem ser derivadas exclusivamente dos números reais de vendas históricas e ritmo de giro. Sugestão zero para qualquer item sem demanda comprovada.
- Transferência Segura de Sobra de Origem: Implementar a lógica onde uma loja só doa peças se possuir excedente real acima do seu estoque mínimo de segurança (saldo - minStock > 0), impedindo o desabastecimento futuro da origem.
- Travas Anti-Encalhe:
  - Checagem somada do estoque da aplicação: se as marcas da família cobrem a cobertura necessária, bloqueia nova compra externa.
  - Bloqueio de Marca Zumbi: SKUs com saldo positivo e zero vendas nos últimos 180 dias ficam com compra travada em zero.

### R4. Carteira de Compradores e Cibersegurança (RBAC Multi-Tenant)
- Controle de Acesso (RBAC): Cada comprador faz login e tem sua visão restrita estritamente aos fornecedores e categorias sob sua alçada (allowedSupplierIds).
- Visão Gerencial (Admin): O gestor possui visão consolidada da rede inteira e de todos os compradores.
- Segurança da Informação: Sanitização de entradas, proteção contra injeção de DAX/SQL, isolamento rigoroso de sessão e tokens, e proteção de rotas server-side no Next.js.

### R5. White-Label Dinâmico e Preparação para Deploy na Vercel
- Sistema de temas configurável por cliente (config/tenants/carreiro.ts): logomarca, cores institucionais (Azul/Dourado Carreiro), lojas da rede e assinatura da iNSIGHT D.
- Estrutura pronta para deploy isolado na Vercel com subdomínio próprio (carreiro.insightd.com.br).

## Critérios de Aceite

### Compilação e Qualidade de Código
- [ ] O projeto compila sem erros de build (npm run build) no Next.js 14/15 com TypeScript estrito (strict: true).
- [ ] O diretório core/ não possui imports diretos de adapters/, db/ ou bibliotecas externas de banco.
- [ ] Todos os arquivos contêm comentários elucidativos em Português do Brasil.

### Performance e Grid
- [ ] A tabela virtualizada renderiza a base de mais de 25.000 SKUs da Carreiro com tempo de resposta de busca e filtros inferior a 250ms.
- [ ] As colunas de Ruptura, Frequência (90d) e Coberturas (30/90/180d) calculam e exibem os valores matemáticos fiéis aos dados reais.
- [ ] Os tooltips analíticos abrem instantaneamente ao passar o mouse ou focar nas células de Ruptura, Frequência, Cobertura, Transferência e Entradas de NF-e.
- [ ] O comprador consegue editar a quantidade sugerida, aplicar múltiplos/pares e salvar os rascunhos da sessão.

### Motor de Regras e Transferência
- [ ] Testes automatizados validam que a transferência entre lojas nunca reduz o estoque da loja de origem abaixo do seu estoque mínimo.
- [ ] Testes automatizados validam que itens com estoque positivo e 0 vendas nos últimos 180 dias têm sugestão final igual a 0.
- [ ] Testes de unidade cobrem as funções centrais de cálculo, agrupamento de aplicação e guardrails.

### Segurança e Carteiras
- [ ] O login de um comprador com fornecedores restritos impede o carregamento de produtos fora da sua carteira, tanto no front-end quanto nas respostas de API.
- [ ] O painel do gestor permite auditar os pedidos e transferências gerados por cada comprador.

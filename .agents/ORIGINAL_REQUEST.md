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

## 2026-09-11T16:16:15Z

# Teamwork Project Prompt — Insight Compras

> Base: `main` em `9f79156` (PR #1 mesclada). Inventário de origem: `docs/pontas-soltas.md`.
> Working directory: `c:/Users/Felipe Barbosa/Documents/insight-compras`
> Integrity mode: development

Resolução das pontas soltas da plataforma Insight Compras. São **8 unidades de
trabalho**, cada uma pensada para um agente com contexto próprio. A ordem em
"Sequência" no fim não é sugestão: duas unidades que tocam o mesmo arquivo em
paralelo conflitam.

---

## Invariantes — valem para TODAS as unidades

Qualquer agente que quebrar um destes entregou defeito, mesmo que o requisito
dele esteja pronto.

1. **Zero não é o mesmo que não medido.** O projeto declara dado ausente em
   `camposIndisponiveis` e a tela mostra travessão. Nunca preencher com zero
   para "fazer a coluna aparecer". Um zero afirma "não vendeu"; o travessão diz
   "não sabemos".
2. **A plataforma sobe sem nenhuma variável de ambiente**, em modo
   demonstração, com tenant neutro. Não introduzir leitura de env obrigatória
   nem valor padrão que aponte para um cliente.
3. **Nenhum nome de rede real no código genérico.** Cliente se resolve por
   `resolverTenantConfigurado()` em `config/tenants/index.ts`, nunca por
   literal.
4. **Infraestrutura entra por porta.** Autenticação em
   `src/lib/autenticacao/porta.ts`, persistência em
   `src/lib/aprendizado/porta-repositorio.ts`. Supabase é o provedor de hoje,
   não a arquitetura. Nada de `import` de SDK de nuvem fora de `provedores/`.
5. **Não remover teste para ficar verde.** Teste que cobre código removido sai
   junto, com a justificativa no commit. Teste que falha por outro motivo se
   investiga.
6. **Mensagens de commit e comentários em português**, no padrão do repositório.

---

## U0. Vazamento do nome do cliente no modo demonstração

**Independente. Curta. Vai primeiro porque é o que o cliente novo vê.**

A plataforma passou a ter um tenant neutro por padrão, mas seis pontos ainda
fixam o cliente em literal. Duas telas escrevem o nome dele em modo
demonstração:

- `src/app/admin/auditoria/page.tsx:34` imprime `REDE CARREIRO AUTOPEÇAS` no
  cabeçalho, com as cores do cliente (`#0F2B5C`, `#D4AF37`) fixas no JSX, para
  qualquer tenant. A linha `:10` fixa `const tenantId = "carreiro"`, então a
  tela também consulta a trilha do tenant errado.
- `src/app/configuracoes/tema/page.tsx:8` inicializa o campo com
  `"REDE CARREIRO"`.
- `src/app/layout.tsx:18` cai em `|| "carreiro"` quando não há header
  `x-tenant-id` — deveria cair no tenant neutro.
- `src/app/api/health/route.ts:14`, `src/app/api/pedidos/route.ts:60` e
  `src/components/cockpit/CockpitPrincipal.tsx:144` repetem o mesmo literal.

Todos devem passar a usar a resolução central. A identidade visual já vem do
tenant (`gerarStringCssVarsInline` no layout); o cabeçalho da auditoria deve
consumir essas variáveis em vez de hex fixo.

**Pronto quando:** `grep -rn "carreiro" src/` só devolver comentários,
importações de `@adapters/carreiro` e referências a `TENANT_CARREIRO`; e a
aplicação subir sem `.env.local` sem exibir nome de rede em nenhuma tela.

---

## U1. Estabilidade da suíte

**Independente. Vai cedo porque limpa o sinal para todos os outros agentes.**

`tests/adapters/estresse-mock-carga.test.ts` e `tests/adapters/mock-25k.test.ts`
afirmam tempo de relógio ("< 250 ms") e falham quando a máquina está ocupada.
Observado: 3 a 4 falhas diferentes por rodada com um build em paralelo, 18/18
passando com a máquina livre. Não é regressão — é o teste medindo a carga da
máquina, não o código.

A proteção contra regressão de desempenho deve continuar existindo. Caminhos
possíveis: medir trabalho em vez de tempo (número de alocações, passagens sobre
a coleção), calibrar contra um baseline medido na própria máquina no início da
suíte, ou isolar os testes de tempo numa suíte separada que não roda no caminho
padrão.

**Pronto quando:** a suíte passar duas vezes seguidas com um `next build`
rodando em paralelo, e a proteção de desempenho continuar detectando uma
regressão real (demonstre introduzindo uma lentidão artificial e mostrando o
teste vermelho).

---

## U2. Grade paralela

**BLOQUEIA U4 (parte do cockpit) e U6. Nenhum outro agente deve tocar em grade
antes desta fechar.**

Existem duas implementações de grade. `src/components/cockpit/GridCockpitVirtualizado.tsx`
(215 linhas) e `src/components/cockpit/baseColumns.tsx` (452 linhas) formam uma
implementação completa que **o aplicativo nunca renderiza**: só o barril
`src/components/cockpit/index.ts` e dois testes a alcançam. A grade viva é
`src/components/cockpit/CockpitPrincipal.tsx` com
`src/components/cockpit/colunas-cockpit.tsx`.

Consequência: `tests/cockpit/virtualizacao-grid.test.tsx` e
`tests/e2e/tier1-features/cockpit-matriz.test.ts` validam código que ninguém
usa. A cobertura mede a árvore errada.

Antes de apagar, comparar as duas definições de coluna: se a árvore morta tiver
comportamento que a viva não tem, ele se migra, não se perde.

`src/components/tooltips/TooltipNfeDoDia.tsx` é o único tooltip que ainda desenha
o painel como `div` absoluto em vez de portal — o mesmo defeito que fazia quatro
outros serem recortados pelo `overflow-hidden` da célula. Só a árvore morta o
usa, então o defeito não aparece hoje. Ou sai junto, ou converte para o
primitivo `src/components/ui/tooltip.tsx` com `variante="painel"`, como os
outros.

**Pronto quando:** existir uma implementação só, o barril não exportar mais
código morto, e os dois testes estiverem apontados para a árvore viva ou
removidos com justificativa registrada no commit.

---

## U3. Persistência do que foi decidido

**Independente dos demais. Duas pontas, mesma camada nova — não separar.**

**A trilha de auditoria esvazia a cada deploy.** `src/lib/auditoria/repositorio-auditoria.ts:98`
guarda tudo num `Map` em memória (`registrosPorTenant`). O encadeamento SHA-256
existe, é testado e detecta adulteração, mas nada sobrevive a um restart, e
`/admin/auditoria` lê desse mapa.

**Pedido não tem ciclo de vida.** `src/app/pedidos/page.tsx` já lê registro real,
mas só existe um estado: "foi exportado". Faltam enviado ao fornecedor,
confirmado e recebido, cada um com data e responsável. Sem isso não há resposta
para "o que pedi e ainda não chegou".

A exportação já grava item a item em `aprendizado_snapshot` / `aprendizado_item`
(esquema em `docs/supabase/schema-aprendizado.sql`). Use como base em vez de
criar uma segunda fonte: duas tabelas para a mesma pergunta um dia discordam.

Atenção ao invariante 4: a persistência entra pela porta do repositório. E
atenção à ordem de gravação — a verificação de cadeia precisa continuar válida
sobre o registro persistido, não só sobre o que está em memória.

Sem `.env.local` (Supabase), o agente não alcança o banco real. Faça o caminho
em memória continuar funcionando como fallback declarado, e teste a persistência
contra um duplo da porta.

**Pronto quando:** a trilha sobreviver a um restart, `validarCadeiaAuditoria`
passar sobre o dado lido de volta do repositório, a tela mostrar registros de
dias anteriores, e o pedido avançar de estado pela interface com data e
responsável gravados.

---

## U4. Identidade e alçada de verdade

**Depende de U2 para a parte que toca `CockpitPrincipal.tsx`.**

**A carteira do comprador é encenação.** `CARTEIRAS_DEMO` em
`src/components/cockpit/CockpitPrincipal.tsx:87` é uma lista fixa, e é ela que
alimenta `fornecedoresPermitidos` (linha 130, usada na carga em ~203). Qualquer
pessoa escolhe qualquer carteira num seletor (linha 461). O login já carrega a
carteira real da conta (`allowedSupplierIds`) e o cadastro em
`/configuracoes/usuarios` já a define — o dado certo existe e está sendo
ignorado.

Comprador sem carteira **falha fechada**: enxerga zero fornecedor, não o
catálogo inteiro. Gestor e admin seguem irrestritos (`allowedSupplierIds: null`).
A restrição precisa valer no servidor, não só na tela: conferir também o filtro
em `src/app/api/compras/route.ts`.

**Conta sem manutenção.** Não há troca de senha, recuperação nem desativação. A
porta está em `src/lib/autenticacao/porta.ts`; o provedor Supabase em
`src/lib/autenticacao/provedores/supabase.ts` tem a chave privilegiada e já
administra usuários. A conta órfã `gestor.demo` (criada antes da migração para
login por usuário, não autentica mais) sai ou migra.

O provedor demo (`provedores/demo.ts`) precisa acompanhar a porta — se a
operação existe no contrato, existe nos dois provedores.

**Pronto quando:** o seletor de carteira sumir, o cockpit usar a carteira da
sessão, um comprador sem carteira ver grade vazia, a pessoa trocar a própria
senha, o admin desativar uma conta, e `gestor.demo` não existir mais.

---

## U5. Telas pela metade

**Independente, menos a edição de modelos, que toca o cockpit — ver Sequência.**

**Tema & White-Label é maquete.** `src/app/configuracoes/tema/page.tsx` tem
campos que só mexem no `useState`. Salvar não muda nada e ainda parece que
mudou. As telas de Lojas e Parâmetros já foram convertidas para mostrar a
verdade do arquivo do tenant — use-as como referência.

**Decisão que este agente precisa tomar antes de codar:** `config/tenants/*.ts`
é código-fonte compilado, e o sistema de arquivos é somente leitura em produção
(Vercel). Escrever o arquivo funciona no localhost e quebra no deploy. Ou a
persistência vai para o repositório (invariante 4), ou tema é configuração de
deploy e a tela passa a ser somente leitura, mostrando de onde o valor vem.
Escolha uma, registre a escolha no commit, e não entregue uma tela que finge
salvar.

**Transferências mostra um destino por vez.** `src/app/transferencias/page.tsx`
calcula o plano para uma loja receptora. Falta a visão de rede: o que cada loja
manda e recebe, de uma vez. O tooltip de destino já existe e funciona — não
regrida o contraste dele (`variante="painel"`).

**Modelos de exportação não se editam pela tela.** A API em
`src/app/api/exportacao/modelos/route.ts` já sobrescreve e apaga; a interface só
cria. Faltam renomear, alterar colunas e excluir.

**Pronto quando:** o tema persistir de verdade ou declarar honestamente que não
se edita ali; a tela de transferências mostrar a rede inteira; e um modelo de
exportação puder ser renomeado, alterado e excluído pela interface.

---

## U6. Régua do motor

**Depende de U2. As três pontas internas são sequenciais entre si: E1 primeiro.**

Mexer nas três em paralelo faz uma mascarar o efeito da outra na validação.

**Primeiro: decidir o padrão de "sem histórico na loja em foco".** Quando não há
registro na loja, vendas, consumo e notas caem para 0 em
`src/lib/cockpit/gerador-linhas-matriz.ts:213-214` e campos vizinhos. Afeta cerca
de **75% das linhas**. Zero afirma "não vendeu"; não medido diz "não sabemos", e
é o que o resto do projeto faz (invariante 1).

Consequência a medir antes de entregar: "não medido" numa coluna numérica muda
ordenação, filtro por faixa, contagem dos chips e o conteúdo do arquivo
exportado. Verifique os quatro. É a razão pela qual esta unidade espera U2 — com
duas grades, a correção pode cair na que ninguém vê.

**Depois: lote vem de vocabulário, não de dado.** `core/travas/lote-multiplo.ts`
tem `detectarLotePorHistograma` (linha 47), mas o adapter usa inferência por
categoria (`adapters/carreiro/mapeador-dax.ts:202`,
`inferirLotePadraoPorCategoria`). A precedência correta é ERP > histograma >
vocabulário. Depende da consulta trazer a fração de linhas múltiplas de k a
partir de `NOTAS_ITEMS[NQTDE]`.

**Depois: elegibilidade conta 90 dias, não 12 meses.** A regra homologada é 3
notas distintas em 12 meses mais 2 meses ativos. Hoje a consulta traz
`NotasVenda90d` (`adapters/carreiro/consultas-homologadas.ts:390`) e é esse valor
que alimenta o critério. Precisa de um `Notas12m`.

**Armadilha ao mexer em DAX:** o `executeQueries` do Power BI trunca a resposta
por TAMANHO do payload, sem erro e sem aviso. Acrescentar uma coluna pode reduzir
silenciosamente as LINHAS que voltam — medido: 2 colunas devolveram 100.000
linhas, 17 colunas devolveram 26.362 de 126.280. Toda consulta alterada exige
conferir a contagem contra um `COUNTROWS` do mesmo filtro. O catálogo hoje
carrega paginado por cursor; mantenha.

**Pronto quando:** a decisão de E1 estiver aplicada e os quatro efeitos colaterais
conferidos; o lote vier do dado onde houver evidência; e a elegibilidade usar
12 meses.

---

## U7. Salvaguarda do que a fonte do cliente não entrega

**Não é unidade de código. É levantamento com o time de BI do cliente.**

Quatro campos estão hoje **corretamente** declarados como não medidos. O risco é
alguém "resolver" preenchendo com zero. Nenhum agente deve fechar nenhum destes
escrevendo código.

- **Quantidade já pedida.** Declarado em `adapters/carreiro/mapeador-dax.ts:339`.
  `TBL_SOLICITACOES_COMPRAS_HIST` existe e cobre 15.219 produtos, mas das 100
  solicitações abertas e aprovadas **nenhuma tem `PEDIDO_COMPRA_ID`**: são
  pedidos internos, não mercadoria a caminho. Tratar como se fosse faria o motor
  comprar menos do que precisa, porque a fórmula subtrai esse valor da
  necessidade. Falta saber onde o ERP registra o pedido firme ao fornecedor.
- **Transferência recebida não se distingue de compra.** Em
  `adapters/carreiro/entradas-confirmacao.ts`, o que chegou por transferência
  soma dentro de `qtdEntrada`. O suprimento fica correto (é a soma que a
  calibração usa), mas o status "transferencia" nunca dispara.
- **O grupo do ERP não é confiável.** `CLASSES[ADESCRICAO]` deveria ser a família
  da peça (MOTOR, SUSPENSÃO), mas algumas lojas cadastraram marca como classe
  ("PERFECT - PEÇAS AUTOMOTIVAS"). O sub-grupo (`SUBCLASSES`) é sólido.
- **Sub-grupo cobre 86%.** Os outros 14% chegam nulos e viram travessão. Falta
  saber se é cadastro incompleto ou categoria que não se aplica.

**Pronto quando:** cada um tiver ou a origem do dado no modelo, ou registro
explícito de que não existe. Se o levantamento destravar o dado, U6 pode
fechar as duas pontas que dependem dele.

---

## Critérios de aceite do projeto

### Build e qualidade
- [ ] `npm run build` compila sem erro
- [ ] `npm test` passa e é determinístico — duas rodadas seguidas com um build
      em paralelo
- [ ] **Nenhum teste removido sem justificativa registrada no commit.** A
      contagem vai CAIR em U2, e isso é o resultado correto: os testes que
      cobriam a árvore morta saem. Não existe piso de número de testes
- [ ] Código morto da grade expurgado do bundle

### White-label
- [ ] A aplicação sobe sem nenhuma variável de ambiente
- [ ] Nenhuma tela exibe nome de rede real em modo demonstração
- [ ] Nenhum literal de cliente fora de `config/tenants/` e `adapters/`

### Auditoria e pedidos
- [ ] A trilha sobrevive a restart e a verificação SHA-256 vale sobre o dado lido
      de volta
- [ ] O pedido transita exportado → enviado → confirmado → recebido, com data e
      responsável

### Alçada
- [ ] Cada pessoa vê no cockpit apenas os fornecedores da sua sessão, imposto no
      servidor
- [ ] Comprador sem carteira recebe grade vazia
- [ ] Troca de senha pelo usuário e desativação pelo admin funcionam, nos dois
      provedores

### Motor
- [ ] Linha sem histórico na loja em foco fica não medida, não zero
- [ ] Ordenação, filtro por faixa, contagem de chips e exportação conferidos após
      essa mudança
- [ ] Elegibilidade usa 12 meses
- [ ] Nenhum campo do U7 foi preenchido com zero

### Telas
- [ ] Tema persiste de verdade ou declara honestamente que não se edita ali
- [ ] Transferências mostra a rede inteira
- [ ] Modelo de exportação pode ser criado, renomeado, alterado e excluído pela
      interface

---

## Sequência

```
U0 vazamento ─┐
U1 suíte ─────┴─→ U2 grade ─┬─→ U4 identidade (parte cockpit)
                            └─→ U6 régua (E1 → E2 → E3)

U3 auditoria/pedido ──── independente, pode ir a qualquer momento
U5 telas ─────────────── independente; a edição de modelos espera U2
U7 levantamento BI ───── paralelo, não é código; pode destravar U6
```

Três dependências reais, e só três:

1. **U2 antes de qualquer trabalho em grade.** Enquanto existirem duas
   implementações, uma correção pode ser feita na que ninguém vê.
2. **Dentro de U6, E1 antes de E2 e E3.** A decisão sobre zero versus não medido
   muda a base de comparação das outras duas.
3. **U7 pode destravar E2 e E3**, se o levantamento com o BI liberar o dado.

U0 e U1 vão primeiro não por dependência, mas por economia: U0 é o que o cliente
novo vê, e U1 impede que cada agente seguinte gaste contexto investigando
vermelho que não é dele.

# Pontas soltas da plataforma

Levantamento feito em 11/09/2026, cruzando o código com o que ficou registrado
nas sessões de trabalho. São **20 pontas**, agrupadas por lógica compartilhada:
cada GRUPO é uma unidade de trabalho independente, pensada para ser entregue a
um agente com contexto próprio.

Dentro de cada grupo, as pontas mexem no mesmo lugar do código ou dependem da
mesma decisão. Trabalhar duas pontas do mesmo grupo em agentes separados
provoca conflito; grupos diferentes não se cruzam.

Estado na data: 705 testes passando, build de produção compilando, a plataforma
sobe em modo demonstração sem nenhuma variável de ambiente.

---

## Grupo A — Persistência do que foi decidido

**Por que junto:** as duas pontas precisam da mesma camada nova, um estado
durável do pedido. Resolver uma sem a outra deixa metade da história gravada.

### A1. A trilha de auditoria esvazia a cada deploy
`src/lib/auditoria/repositorio-auditoria.ts:98` guarda tudo num `Map` em
memória. O encadeamento SHA-256 existe, é testado e detecta adulteração, mas
nada sobrevive a um restart, e `/admin/auditoria` lê desse mapa.

**Pronto quando:** a trilha persistir, a verificação de cadeia continuar
passando sobre o dado gravado, e a tela mostrar registros de dias anteriores.

### A2. Pedido não tem ciclo de vida
`src/app/pedidos/page.tsx` já lê o registro real, mas só existe um estado:
"foi exportado". Falta enviado ao fornecedor, confirmado e recebido. Sem isso,
não há como responder "o que pedi e ainda não chegou".

**Pronto quando:** o pedido tiver estados com data e responsável, e a tela
permitir avançar de um para o outro.

**Observação comum ao grupo:** a exportação já grava item a item em
`aprendizado_snapshot` / `aprendizado_item` (esquema em
`docs/supabase/schema-aprendizado.sql`). Use isso como base em vez de criar uma
segunda fonte: duas tabelas para a mesma pergunta um dia discordam.

---

## Grupo B — Identidade e alçada de verdade

**Por que junto:** as duas tratam de quem é a pessoa e o que ela pode ver, e
ambas mexem na porta de autenticação.

### B1. A carteira do comprador é encenação
`CARTEIRAS_DEMO` em `src/components/cockpit/CockpitPrincipal.tsx:87` é uma
lista fixa, e é ela que alimenta `fornecedoresPermitidos` (linha 130, usada na
carga em ~203). Qualquer pessoa escolhe qualquer carteira num seletor. O login
já carrega a carteira real da conta (`allowedSupplierIds`) e o cadastro em
`/configuracoes/usuarios` já a define.

**Pronto quando:** o cockpit usar a carteira da sessão, o seletor sumir, e um
comprador sem carteira não enxergar fornecedor nenhum (falha fechada).

### B2. Conta sem manutenção
Não há troca de senha, recuperação nem desativação. A porta está em
`src/lib/autenticacao/porta.ts`; o provedor Supabase em
`src/lib/autenticacao/provedores/supabase.ts` tem a chave privilegiada e já
administra usuários.

**Pronto quando:** a pessoa trocar a própria senha, o admin desativar uma conta,
e a conta órfã `gestor.demo` (criada antes da migração para login por usuário,
não autentica mais) for removida ou migrada.

---

## Grupo C — Grade paralela e cobertura de teste

**Por que sozinho:** mexe na definição de colunas e no componente de grade.
Qualquer outro agente que toque em grade deve esperar este terminar.

### C1. Existem duas implementações de grade
`src/components/cockpit/GridCockpitVirtualizado.tsx` (215 linhas) e
`src/components/cockpit/baseColumns.tsx` (452 linhas) formam uma implementação
completa que **o aplicativo nunca renderiza**: só o barril
`src/components/cockpit/index.ts` e testes a alcançam. A grade real é
`CockpitPrincipal` + `colunas-cockpit.tsx`.

Consequência: `tests/cockpit/virtualizacao-grid.test.tsx` e
`tests/e2e/tier1-features/cockpit-matriz.test.ts` validam código que ninguém
usa. A cobertura do projeto está medindo a árvore errada.

**Pronto quando:** existir uma implementação só, e os testes que hoje cobrem a
árvore morta estiverem apontados para a viva ou removidos com justificativa.

### C2. Tooltip de notas do dia ficou para trás
`src/components/tooltips/TooltipNfeDoDia.tsx` é o único que ainda desenha o
painel como `div` absoluto em vez de portal — o mesmo defeito que fazia os
outros quatro serem recortados pelo `overflow-hidden` da célula. Ele só é usado
pela árvore morta, então o defeito não aparece hoje.

**Pronto quando:** ou ele for removido junto com a árvore, ou converter para o
primitivo com `variante="painel"`, como os outros.

---

## Grupo D — O que a fonte do cliente não entrega

**Por que junto:** nenhuma se resolve só no código. Todas exigem levantamento
com o time de BI do cliente, e todas hoje estão corretamente declaradas como
não medidas — o risco é alguém "resolver" preenchendo com zero.

### D1. Quantidade já pedida indisponível
Declarado em `adapters/carreiro/mapeador-dax.ts:339`. A tabela
`TBL_SOLICITACOES_COMPRAS_HIST` existe e cobre 15.219 produtos, mas das 100
solicitações abertas e aprovadas **nenhuma tem `PEDIDO_COMPRA_ID`**: são pedidos
internos, não mercadoria a caminho. Tratar como se fosse faria o motor comprar
menos do que precisa, porque a fórmula subtrai esse valor da necessidade.

**Pronto quando:** souber onde o ERP registra o pedido firme ao fornecedor, ou
ficar documentado que ele não existe no modelo.

### D2. Transferência recebida não se distingue de compra
Na confirmação de entrada do ciclo de aprendizado, o que chegou por
transferência soma dentro de `qtdEntrada`. O suprimento real fica correto (é a
soma que a calibração usa), mas o status "transferencia" nunca dispara.
Declarado em `adapters/carreiro/entradas-confirmacao.ts`.

**Pronto quando:** a entrada trouxer a origem do movimento, ou ficar registrado
que o modelo não separa.

### D3. O grupo do ERP não é confiável
`CLASSES[ADESCRICAO]` deveria ser a família da peça (MOTOR, SUSPENSÃO), mas
algumas lojas cadastraram marca como classe ("PERFECT - PEÇAS AUTOMOTIVAS").
O sub-grupo (`SUBCLASSES`) é sólido; o grupo precisa de decisão com o cliente.

**Pronto quando:** existir uma regra de uso, ou o campo sair da tela.

### D4. Sub-grupo cobre 86%
Os outros 14% chegam nulos e aparecem como travessão. Falta saber se é cadastro
incompleto ou categoria que não se aplica.

---

## Grupo E — Régua do motor

**Por que junto:** as três mudam o número que o motor sugere, e as três pedem
teste contra o dado real antes de valer. Mexer nelas em paralelo faz uma mascarar
o efeito da outra na validação.

### E1. Decidir o padrão de "sem histórico na loja"
Quando não há registro de histórico na loja em foco, vendas, consumo e notas
caem para 0. Afeta cerca de **75% das linhas**. Zero afirma "não vendeu";
não medido diz "não sabemos", e o projeto segue essa distinção em todo o resto
(ver `camposIndisponiveis`). É uma decisão de padrão, não um bug pontual, e
deve vir ANTES das outras duas deste grupo.

Código: `src/lib/cockpit/gerador-linhas-matriz.ts:213-214` e os campos vizinhos.

### E2. Lote ainda vem de vocabulário, não de dado
`core/travas/lote-multiplo.ts` tem o detector por histograma
(`detectarLotePorHistograma`), mas o adapter usa a inferência por categoria
(`adapters/carreiro/mapeador-dax.ts:202`). A precedência correta é ERP >
histograma > vocabulário.

**Pronto quando:** a consulta trouxer a fração de linhas múltiplas de k a partir
de `NOTAS_ITEMS[NQTDE]`, e o lote vier do dado onde houver evidência.

### E3. Elegibilidade conta notas em 90 dias, não em 12 meses
A regra homologada é 3 notas distintas em 12 meses mais 2 meses ativos. Hoje a
consulta traz `NotasVenda90d` (`adapters/carreiro/consultas-homologadas.ts:390`)
e é esse valor que alimenta o critério.

**Pronto quando:** existir um `Notas12m` na consulta e a elegibilidade usar ele.

---

## Grupo F — Telas que ficaram pela metade

**Por que junto:** todas são interação sobre dado que já existe. Nenhuma precisa
de fonte nova.

### F1. Tema & White-Label é maquete
`src/app/configuracoes/tema/page.tsx` tem campos que só mexem na memória do
navegador. Mudar não muda nada e ainda parece que muda. As telas de Lojas e
Parâmetros já foram convertidas para mostrar a verdade do arquivo do tenant —
use-as como referência de abordagem.

### F2. Transferências mostra um destino por vez
`src/app/transferencias/page.tsx` calcula o plano para uma loja receptora. Falta
a visão de rede: o que cada loja manda e recebe, de uma vez.

### F3. Modelos de exportação não se editam pela tela
A API em `src/app/api/exportacao/modelos/route.ts` já sobrescreve e apaga; a
interface só cria. Falta renomear, alterar colunas e excluir pelo cockpit.

---

## Grupo G — Infraestrutura e entrega

**Por que junto:** curtas, independentes entre si, nenhuma toca regra de
negócio. Podem ir num agente só.

### G1. Testes de latência instáveis
`tests/adapters/estresse-mock-carga.test.ts` e
`tests/adapters/mock-25k.test.ts` afirmam tempo de relógio ("< 250ms") e falham
quando a máquina está ocupada. Observado: 3 a 4 falhas diferentes a cada rodada
com um build em paralelo, e 18/18 passando com a máquina livre.

**Pronto quando:** a suíte passar duas vezes seguidas com um `next build`
rodando junto, sem perder a proteção contra regressão de desempenho.

### G2. Página do cockpit ainda pesa 5,4 MB
Caiu de 54 MB com a codificação tabular e a carga progressiva, mas ainda serve
2.236 linhas acionáveis dentro do HTML. Medições de referência em
`docs/` e na memória do projeto.

### G3. PDF do cliente desatualizado
Os números de bateria misturam extrações de 19/08 e 02/09.

---

## Como distribuir

Ordem sugerida quando houver dependência:

1. **Grupo C antes de qualquer trabalho em grade.** Enquanto existirem duas
   implementações, uma correção pode ser feita na que ninguém vê.
2. **E1 antes de E2 e E3.** A decisão sobre "zero versus não medido" muda a base
   de comparação das outras duas.
3. **Grupo D antes de fechar E2 e E3**, se o levantamento com o BI destravar o
   dado que elas precisam.

Os grupos A, B, F e G não dependem de ninguém.

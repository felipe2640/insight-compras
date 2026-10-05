# Linguagem do domínio

Vocabulário desta plataforma. Quem escreve código, teste ou documento aqui usa
estes termos, com estes sentidos. Decisões de arquitetura que os produziram
estão em `docs/adr/`.

## Cliente (tenant)

Uma rede de autopeças atendida pela plataforma. Tem cadastro próprio em
`config/tenants/<id>.ts`: identidade visual, lojas, parâmetros calibrados do
motor, layouts de exportação e a **Fonte de Dados**.

Cada instalação atende **um** cliente, declarado em `TENANT_ATIVO`
(obrigatório em produção — ADR-0001).

### Natureza do cliente

- **real**: opera sobre o estoque de uma rede de verdade. Exige credencial
  própria, e nunca pode ver dado sintético ou vencido (ADR-0002).
- **sintética**: mostruário e desenvolvimento. Não toca a nuvem de ninguém.

Derivada da fonte, nunca declarada à mão: `naturezaTenant(tenant)`.

## Filial (loja)

Unidade de estoque do cliente, com `filialId` próprio. O cadastro declara,
para cada filial, os **Identificadores de Fonte**: os valores EXATOS que a
fonte devolve para aquela loja (na Carreiro, `CADEMP[ACODEMP]` = `"1|<guid>"`).

Valor que não está na lista é **loja não mapeada**: a linha é descartada e o
fato aparece em `metadados.lojasNaoMapeadas`. Nunca vira a filial 1.

## Fonte de Dados

De onde vêm catálogo, estoque, venda e, quando existe, o ciclo de compras do
ERP. Implementa o contrato `InventoryAdapter` (`adapters/`). Hoje há duas:
Power BI via DAX e a sintética.

### Capacidade

O que aquela fonte **consegue** entregar, declarado como sub-objeto opcional do
adaptador: `pedidosERP`, `cotacoesERP`, `entradasConfirmadas`, além da flag
`forneceSugestoesErp`. Ter o sub-objeto é ter a capacidade.

O cadastro do cliente só **desliga** capacidade
(`fonte.capacidadesDesligadas`); nunca liga o que a fonte não tem (ADR-0003).
O que as rotas enxergam é o resultado de `capacidadesEfetivas(fonte, tenant)`.

### Granularidade de loja

Até onde a fonte distingue a loja num conjunto de dados: `"loja"` ou `"rede"`.
Com `"rede"`, o dado existe mas não se sabe de qual filial é — a tela mostra
"Rede" e o motor não atribui a nenhuma.

## Contexto da Requisição

`contextoDaRequisicao(request)` (rotas) e `contextoDaPagina()` (páginas):
o único lugar que resolve **usuário + cliente + fonte** e nega quando divergem.
Entrega também a loja em foco do cadastro e a carga já com os múltiplos do
cliente aplicados.

Nenhum outro arquivo lê o cabeçalho de cliente, `TENANT_ATIVO` ou a fábrica de
adaptadores — há um teste de arquitetura que falha se alguém voltar a fazê-lo.

## Campo não medido

Dado que a fonte do cliente **não fornece**, declarado em
`camposIndisponiveis` (ex.: `quantidadeJaPedida`, `diasRuptura90dias`). Zero é
uma medição; não medido é outra coisa, e aparece como "—" na tela. Nenhuma
linha de produção preenche campo ausente com zero para "limpar" a tela.

## Múltiplo de compra (lote)

Quantidade mínima de embalagem: avulso, par, jogo. Resolvido no **contexto da
requisição** a partir das entradas cruas que a fonte preserva (`loteErp`,
`loteHistograma`) e da configuração do cliente, que é editável em tela. Assim
página e API mostram sempre o mesmo número.

## Validação de Ambiente

Confere, uma vez, se a instalação tem o que o cliente dela exige: cadastro
íntegro, credenciais, e ausência de chaves que ligariam dado ou provedor
sintético num cliente real. Roda no build de produção (falha o deploy) e na
primeira requisição.

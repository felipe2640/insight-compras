# ADR-0003: As capacidades vêm da fonte; o cadastro só desliga

- **Data**: 17 de setembro de 2026
- **Status**: aceita

## Contexto

O que varia de um cliente para outro estava espalhado em quatro mecanismos:

- `tenant.fonteDados !== "powerbi-carreiro"` em 12 lugares;
- quatro métodos opcionais no adaptador (`if (adaptador.listarPedidosCompraERP)`);
- `processoCompra.habilitado` no cadastro;
- `tipoERP === "connectsoft-shopcash"`, conferido por string em duas rotas só
  para escolher um rótulo.

Um segundo ERP obrigaria a editar o tipo, a fábrica e cada um desses pontos. O
nome de um fornecedor de BI ("Power BI") também estava fixo no texto da grade,
para todo cliente.

## Decisão

1. O adaptador declara o que **consegue** entregar, como sub-objetos opcionais:
   `pedidosERP`, `cotacoesERP`, `entradasConfirmadas`, mais a flag
   `forneceSugestoesErp`. Ter o sub-objeto é ter a capacidade — não existe flag
   que possa discordar do método, e o TypeScript obriga a checar antes de usar.
2. O cadastro do cliente só **subtrai** (`fonte.capacidadesDesligadas`). Nunca
   liga o que a fonte não tem: prometer capacidade inexistente é a mesma classe
   de defeito do mock silencioso.
3. Cada conjunto de dados declara a **granularidade de loja**. Quando a fonte
   não distingue a loja, a tela mostra "Rede" em vez de atribuir à matriz.
4. O adaptador normaliza o status do ERP (`aberto`, `concluido`, `cancelado`,
   `desconhecido`); a rota só exibe. Rótulos: a fonte informa como se chama
   ("Power BI") e o cadastro informa o ERP do cliente.
5. Toda fonte passa pelo mesmo conjunto de testes de contrato, incluindo um
   cliente mínimo — 2 lojas fora do id 1 e nenhuma capacidade de ERP.

## Consequências

- Um cliente novo com outro ERP entra escrevendo um adaptador e um cadastro,
  sem tocar em rota nem em tela.
- Capacidade ausente deixa de ser um caminho não testado: o contrato exige que
  a plataforma responda "não tenho" em vez de quebrar.

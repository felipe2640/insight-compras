# ADR-0001: Uma instalação por cliente, com `TENANT_ATIVO` obrigatório

- **Data**: 17 de setembro de 2026
- **Status**: aceita

## Contexto

A plataforma resolvia o cliente da requisição por cinco caminhos, nesta ordem:
`TENANT_ATIVO`, `?tenant=` na URL, subdomínio, domínio próprio e cookie. Cada
rota e cada página escolhia por conta própria entre o cabeçalho resolvido, a
sessão do usuário e a variável de ambiente.

O efeito verificado no código: a página do cockpit usava o cliente do cabeçalho
ANTES do cliente da sessão e nunca comparava os dois. Numa instalação que
atendesse vários clientes, `/compras?tenant=<cliente>` abria a grade real para
qualquer sessão, inclusive a de demonstração. A rota `/api/compras` fazia a
conferência; a página, não. Um usuário nulo também passava, e sem papel de
comprador a carteira saía irrestrita.

## Decisão

1. Cada deploy atende **um** cliente, declarado em `TENANT_ATIVO`. Em produção
   a variável é obrigatória: sem ela, a aplicação responde erro de configuração.
2. `?tenant=`, subdomínio e cookie continuam existindo **fora de produção**,
   para desenvolvimento local, CI e preview.
3. Um único módulo — `src/lib/contexto/contexto-requisicao.ts` — resolve
   usuário, cliente e fonte, e **falha fechada**: se o cliente da sessão, o da
   URL e o da instalação não baterem, nega (403 na API, tela de erro na página).
4. Cliente desconhecido é erro em produção; fora dela, abre a demonstração com
   aviso.
5. Um teste de arquitetura impede que qualquer arquivo novo volte a ler o
   cabeçalho de cliente, `TENANT_ATIVO` ou a fábrica de adaptadores.

## Consequências

- O caminho de vazamento entre clientes deixa de existir por construção, e não
  por lembrança de quem escreve a próxima rota.
- Um deploy sem `TENANT_ATIVO` não sobe — o que é melhor do que subir servindo
  a demonstração com cara de cliente.
- Atender vários clientes no mesmo deploy passa a exigir uma decisão nova
  (e outro ADR), em vez de acontecer por omissão.

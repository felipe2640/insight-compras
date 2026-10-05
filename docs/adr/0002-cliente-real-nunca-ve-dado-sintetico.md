# ADR-0002: Cliente real nunca vê dado sintético nem dado vencido

- **Data**: 17 de setembro de 2026
- **Status**: aceita

## Contexto

A fábrica de adaptadores tinha um "fallback seguro para Mock": um cliente real
sem credenciais do Power BI recebia o gerador sintético de 25.000 SKUs. Nada na
tela dizia isso — nenhum componente lia `emModoDegradado`. O comprador decidia
compra sobre estoque inventado achando que era o da rede dele.

Havia ainda três caminhos que serviam dado antigo como se fosse atual: o cache
L2 com dado vencido, o snapshot local de emergência e a variável
`CARREIRO_PREFERIR_SNAPSHOT`.

## Decisão

1. Fonte de cliente real sem credencial é **erro** (`ErroFonteNaoConfigurada`),
   nunca mock. A mensagem diz quais variáveis faltam, e esse detalhe só aparece
   para ADMIN ou fora de produção.
2. Em produção não há snapshot de emergência, dado vencido de L2 nem
   `CARREIRO_PREFERIR_SNAPSHOT`. Fonte fora do ar é tela de erro, com o botão de
   tentar de novo. Cache **dentro do prazo** continua valendo: é dado fresco.
3. Fora de produção, snapshot e preferência por snapshot seguem disponíveis —
   é como se desenvolve sem rede.
4. A validação de ambiente recusa, numa instalação de cliente real,
   `USE_MOCK_ADAPTER`, `AUTH_PROVIDER=demo` e repositórios em memória.
5. Nenhuma tela inventa número para preencher espaço. O comparativo do
   aprendizado, que fabricava a quantidade do modelo com `produtoId % 5`,
   passa a mostrar "—".

## Consequências

- Um cliente mal configurado enxerga um erro claro, e não uma plataforma que
  funciona com números de outra realidade.
- A operação fica mais frágil a oscilação da fonte — de propósito. Entre exibir
  saldo velho sem aviso e não exibir saldo, a decisão é não exibir.

# DISPATCH — Challenger Final (Desafio Empírico e Estresse das 8 Unidades)

## Missão
Executar desafios empíricos adversariais, estresse de carga e validações de borda cobrindo as implementações das 8 unidades (U0 a U7) da plataforma Insight Compras.

## Caminho do Requisito Original
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md`

## Desafios Adversariais Obrigatórios
1. **Determinismo e Estabilidade sob Carga**: Executar `npm test` duas vezes seguidas simultaneamente a um `npm run build` em paralelo, comprovando ausência de flaky tests.
2. **Falha Fechada de RBAC (U4)**: Verificar que compradores com carteira vazia recebem grade vazia e não conseguem forçar carregamento nem via requisição direta de API.
3. **Persistência de Trilha Criptográfica (U3)**: Validar que `validarCadeiaAuditoria` se mantém válida sobre os dados lidos de volta.
4. **Comportamento de Itens Não Medidos (U6 / U7)**: Conferir que linhas sem histórico ordenam previsivelmente para o final e não interferem em filtros ou contadores de ruptura/zumbi.
5. **Visão de Rede em Transferências (U5)**: Validar que a soma líquida de transferências fecha em zero e que nenhuma doadora perde estoque abaixo do mínimo (`saldo - minStock > 0`).

## Emissão de Veredicto
Emitir veredicto formal em `handoff.md`: **APPROVE** ou **REQUEST_CHANGES**.

## 2026-09-11T21:28:25Z
Você é o Challenger responsável pelos testes de estresse e validações adversariais das 8 unidades (U0 a U7) da plataforma Insight Compras.
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\challenger_final
Leia atentamente DISPATCH.md em seu diretório e ORIGINAL_REQUEST.md em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md.

Realize os testes adversariais:
1. Determinismo e estabilidade sob carga: npm test executado 2x consecutivas concorrente com npm run build.
2. Desafie a falha fechada de RBAC (U4), persistência criptográfica SHA-256 pós-restart (U3), ordenação/filtros de não medidos (U6), e rede de transferências (U5).
3. Emita seu parecer formal em handoff.md com veredicto APPROVE ou REQUEST_CHANGES e notifique o orquestrador via send_message.


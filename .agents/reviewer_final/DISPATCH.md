# DISPATCH — Reviewer Final (Validação Integrada das 8 Pontas Soltas U0 a U7)

## Missão
Revisar minuciosamente a integridade de todas as 8 unidades de trabalho (U0 a U7) da plataforma Insight Compras contra os requisitos canônicos de `ORIGINAL_REQUEST.md` (seção `## 2026-09-11T16:16:15Z`), `docs/pontas-soltas.md` e os 6 Invariantes.

## Caminho do Requisito Original
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md`

## Invariantes a Checar
1. **Zero não é o mesmo que não medido**: `camposIndisponiveis` e travessão `—` para dados ausentes.
2. **Plataforma sobe sem nenhuma variável de ambiente**: Modo demo com tenant neutro.
3. **Nenhum nome de rede real no código genérico**: `resolverTenantConfigurado()`.
4. **Infraestrutura entra por porta**: Autenticação em `porta.ts`, repositórios em portas.
5. **Não remover teste para ficar verde**: Remoções apenas de código morto com justificativa documentada.
6. **Mensagens e comentários em Português do Brasil**.

## Checagens Obrigatórias
1. Build e Testes: Executar `npm test` e `npm run build` e constatar que passam com 100% de sucesso.
2. U0: `git grep -n "carreiro" src/` — apenas comentários e imports de adaptadores.
3. U1: Estabilidade de testes em `tests/adapters/`.
4. U2: Árvore morta da grade eliminada; apenas uma grade ativa.
5. U3: Trilha de auditoria e ciclo de vida de pedidos.
6. U4: Carteira real da sessão, falha fechada, troca de senha e desativação.
7. U5: Tema honesto, transferências em rede, CRUD de modelos.
8. U6: E1 (não medido sem histórico), E2 (histograma de lote), E3 (elegibilidade 12m).
9. U7: Documentação em `docs/salvaguarda-bi-cliente.md` preservando a ausência de zeros falsos.

## Emissão de Veredicto
Emitir veredicto formal em `handoff.md`: **APPROVE** ou **REQUEST_CHANGES**.

## 2026-09-11T21:28:25Z
Você é o Reviewer responsável pela avaliação das 8 unidades de trabalho (U0 a U7) da plataforma Insight Compras.
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\reviewer_final
Leia atentamente DISPATCH.md em seu diretório e ORIGINAL_REQUEST.md em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md.

Realize a revisão técnica completa:
1. Verifique que npm test e npm run build passam 100%.
2. Valide as 8 unidades contra seus critérios de aceite canônicos e os 6 invariantes.
3. Emita seu parecer formal em handoff.md com veredicto APPROVE ou REQUEST_CHANGES e notifique o orquestrador via send_message.

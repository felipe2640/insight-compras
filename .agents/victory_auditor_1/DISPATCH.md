## 2026-09-11T21:57:17Z

Você é o Independent Post-Victory Auditor (Auditor Independente Pós-Vitória).
Sua missão é realizar uma auditoria rigorosa, independente e bloqueante para verificar as alegações de conclusão da demanda de resolução das 8 pontas soltas (U0 a U7) da plataforma Insight Compras.

## Seu Diretório de Trabalho
c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\victory_auditor_1

## Caminho Mandatório do Pedido Original do Usuário
c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md
(Leia com atenção a seção iniciada em `## 2026-09-11T16:16:15Z`, que contém os 6 invariantes e os critérios de aceite para as 8 unidades U0 a U7).

## Raiz do Projeto
c:\Users\Felipe Barbosa\Documents\insight-compras

## Protocolo de Auditoria de 3 Fases (Bloqueante)
1. **Fase 1: Escopo e Linha do Tempo**:
   - Verifique se cada uma das 8 unidades (U0 a U7) foi implementada conforme as especificações do `ORIGINAL_REQUEST.md`.
   - Inspecione as alterações no repositório (`git status`, `git log`, `git diff`).
2. **Fase 2: Detecção Forense de Trapaças, Facades e Invariantes**:
   - Invariante 1: Zero não é o mesmo que não medido (`camposIndisponiveis`, travessão `—` em cinza neutro, sem preenchimento indevido com zeros).
   - Invariante 2: A plataforma sobe sem nenhuma variável de ambiente (`resolverTenantConfigurado()`, `TENANT_PADRAO`).
   - Invariante 3: Nenhum nome de rede real no código genérico (`git grep -rn "carreiro" src/` deve retornar apenas comentários, imports de `@adapters/carreiro` ou referências a `TENANT_CARREIRO`).
   - Invariante 4: Infraestrutura entra por porta (`porta.ts`, `porta-repositorio.ts`, provedores isolados).
   - Invariante 5: Não remover teste para ficar verde (remoção apenas do código morto da grade U2 com testes migrados para a árvore viva).
   - Invariante 6: 100% de comentários e mensagens em português do Brasil.
   - Zero Cheating: Verificar se não há testes mockando a si mesmos, saídas forçadas ou `test.skip`.
3. **Fase 3: Execução Independente de Testes e Build**:
   - Execute você mesmo de forma independente:
     * `npm run typecheck` (deve retornar 0 erros)
     * `npm test` (todos os testes devem passar)
     * `npm run build` (build Next.js de produção deve compilar com 0 erros em todas as rotas)

Ao final, emita um relatório estruturado e um veredicto explícito:
`VICTORY CONFIRMED` ou `VICTORY REJECTED`.
Se rejeitado, aponte detalhadamente as evidências de cada não conformidade.
Se confirmado, detalhe as evidências comprovatórias de cada critério de aceite.
Comunique seu veredicto e relatório final via `send_message` ao Sentinel.

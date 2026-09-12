# DISPATCH — Forensic Auditor Final (Auditoria de Integridade das 8 Unidades)

## Missão
Realizar a auditoria forense independente de integridade de todo o projeto Insight Compras pós-resolução das unidades U0 a U7.

## Caminho do Requisito Original
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md`

## Verificações Forenses Obrigatórias
1. **Zero Cheating / Zero Hardcodes**: Verificar se há resultados de testes mockados estaticamente ou valores forçados para deixar asserções verdes.
2. **Zero Dummy/Facade Implementations**: Verificar se todas as implementações contêm lógica real de domínio e negócio (Clean Architecture, RBAC, persistência, ordenação, etc.).
3. **Invariante 1 — Zero não é não medido**: Verificar se dados ausentes usam `camposIndisponiveis` e travessão `—`, e se nenhum campo foi preenchido com zero falso.
4. **Invariante 2 — Plataforma sobe sem .env**: Verificar que em modo demonstração o sistema sobe com tenant neutro.
5. **Invariante 3 — Nenhum nome real no código genérico**: Verificar `git grep -n "carreiro" src/`.
6. **Invariante 4 — Infraestrutura por porta**: Verificar `src/lib/autenticacao/porta.ts` e `src/lib/auditoria/porta-repositorio.ts`.
7. **Invariante 5 — Remoção legítima de testes**: Verificar se algum teste foi removido indevidamente.
8. **Invariante 6 — Português nos comentários e mensagens**.

## Emissão de Veredicto
Emitir veredicto formal em `handoff.md`: **CLEAN** ou **INTEGRITY VIOLATION**.
⚠️ AVISO: Qualquer violação de integridade constitui veto binário.

## 2026-09-11T21:28:25Z
Você é o Forensic Auditor responsável pela verificação de integridade de todo o projeto Insight Compras pós-resolução das unidades U0 a U7.
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\auditor_final
Leia atentamente DISPATCH.md em seu diretório e ORIGINAL_REQUEST.md em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md.

Realize as verificações forenses:
1. Zero cheating / zero hardcodes / zero dummy implementations.
2. Conformidade absoluta com os 6 Invariantes.
3. Inspeção de git grep e diffs de U0 a U7.
4. Emita seu parecer formal em handoff.md com veredicto CLEAN ou INTEGRITY VIOLATION e notifique o orquestrador via send_message.

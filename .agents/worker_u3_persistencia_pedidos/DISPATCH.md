# DISPATCH — Worker U3 (Persistência de Auditoria e Ciclo de Vida de Pedidos)

## Missão
Resolver integralmente a Unidade U3 conforme `ORIGINAL_REQUEST.md` (seção `## 2026-09-11T16:16:15Z`, item `## U3. Persistência do que foi decidido`) e `docs/pontas-soltas.md` (Grupo A).

## Caminho do Requisito Original
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md`

## Invariantes Obrigatórios
1. Zero não é o mesmo que não medido.
2. A plataforma sobe sem nenhuma variável de ambiente (modo demo).
3. Nenhum nome de rede real no código genérico.
4. **Infraestrutura entra por porta.** Autenticação em `src/lib/autenticacao/porta.ts`, persistência em porta de repositório (`src/lib/aprendizado/porta-repositorio.ts` ou porta dedicada em `src/lib/auditoria/`). Nada de `import` de SDK de nuvem fora de `provedores/`.
5. Não remover teste para ficar verde.
6. Mensagens de commit e comentários em português.

## Arquivos de Propriedade Exclusiva
- `src/lib/auditoria/repositorio-auditoria.ts`
- `src/lib/auditoria/`
- `src/lib/pedidos/`
- `src/app/admin/auditoria/page.tsx`
- `src/app/pedidos/page.tsx`
- `src/app/api/pedidos/route.ts`
- `tests/auditoria/`
- `tests/pedidos/`

## Tarefas Específicas
1. **Persistência da Trilha de Auditoria**:
   - `src/lib/auditoria/repositorio-auditoria.ts` atualmente armazena registros apenas em um `Map` em memória.
   - Implementar persistência durável via porta de repositório (com fallback gracioso em memória quando sem `.env.local` / sem banco de dados).
   - O encadeamento SHA-256 (`validarCadeiaAuditoria`) deve permanecer 100% válido sobre o registro lido de volta da persistência.
   - A tela `/admin/auditoria` deve exibir registros históricos sobrevivendo a reinicialização.
2. **Ciclo de Vida Completo de Pedidos**:
   - Atualmente `src/app/pedidos/page.tsx` possui apenas o estado "foi exportado".
   - Implementar os estados: `exportado` → `enviado` → `confirmado` → `recebido`, gravando data e responsável em cada transição.
   - Integrar com a persistência de aprendizado (`aprendizado_snapshot` / `aprendizado_item` em `docs/supabase/schema-aprendizado.sql`) sem criar fontes conflitantes.
   - A interface de pedidos deve permitir que o comprador avance de estado (ex: marcar como enviado ao fornecedor, confirmar, registrar recebimento).
3. **Testes e Verificação**:
   - Criar/atualizar testes automatizados comprovando que a trilha sobrevive a reinicializações simuladas e que a validação de integridade criptográfica SHA-256 passa.
   - Testar avanço de estados do ciclo de vida de pedidos.
   - Executar `npm run build` e `npm test`.

## Aviso Obrigatório de Integridade
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-11T16:33:04Z
Você é o Worker responsável pela Unidade U3 (Persistência de auditoria e ciclo de vida de pedidos).
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_u3_persistencia_pedidos
Leia atentamente DISPATCH.md em seu diretório e ORIGINAL_REQUEST.md em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute:
1. Implementar persistência durável para a trilha de auditoria via porta de repositório, mantendo fallback em memória para modo demo e garantindo que validarCadeiaAuditoria (SHA-256) permaneça íntegra após restart.
2. Implementar ciclo de vida completo de pedidos (exportado -> enviado -> confirmado -> recebido) com data e responsável gravados, e UI para transição de estados.
3. Rodar testes e compilação (npm run build).
4. Gerar progress.md e handoff.md e notificar o orquestrador via send_message.

# DISPATCH — Worker U4 (Identidade e Alçada de Verdade)

## Missão
Resolver integralmente a Unidade U4 conforme `ORIGINAL_REQUEST.md` (seção `## 2026-09-11T16:16:15Z`, item `## U4. Identidade e alçada de verdade`) e `docs/pontas-soltas.md` (Grupo B).

## Caminho do Requisito Original
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md`

## Invariantes Obrigatórios
1. Zero não é o mesmo que não medido.
2. A plataforma sobe sem nenhuma variável de ambiente (modo demo).
3. Nenhum nome de rede real no código genérico.
4. **Infraestrutura entra por porta.** Autenticação em `src/lib/autenticacao/porta.ts`. Provedores em `src/lib/autenticacao/provedores/`. Nada de SDK de nuvem fora de `provedores/`. Se a operação existe no contrato, existe nos dois provedores (`demo.ts` e `supabase.ts`).
5. Não remover teste para ficar verde.
6. Mensagens de commit e comentários em português.

## Arquivos de Propriedade Exclusiva
- `src/components/cockpit/CockpitPrincipal.tsx`
- `src/app/api/compras/route.ts`
- `src/lib/autenticacao/porta.ts`
- `src/lib/autenticacao/provedores/supabase.ts`
- `src/lib/autenticacao/provedores/demo.ts`
- `src/lib/autenticacao/`
- `src/app/configuracoes/usuarios/page.tsx`
- `tests/autenticacao/`
- `tests/seguranca/`

## Tarefas Específicas
1. **Eliminar seletor estático e conectar carteira da sessão**:
   - Em `src/components/cockpit/CockpitPrincipal.tsx`, eliminar a lista estática `CARTEIRAS_DEMO` e o seletor visual de carteiras.
   - O cockpit deve ler `allowedSupplierIds` da sessão real do usuário autenticado (via `useSession()` / contexto de autenticação).
   - **Falha Fechada**: Comprador sem carteira (`allowedSupplierIds: []` ou sem carteira atribuída) **falha fechada**: enxerga zero fornecedor (grade vazia com mensagem amigável), e NÃO o catálogo inteiro.
   - Gestor e admin continuam irrestritos (`allowedSupplierIds: null`).
2. **Garantir restrição no servidor (`/api/compras`)**:
   - Conferir e reforçar o filtro em `src/app/api/compras/route.ts` para que compradores sem fornecedores permitidos recebam lista vazia no backend também.
3. **Manutenção de contas (Troca de senha e desativação)**:
   - Expandir a porta `src/lib/autenticacao/porta.ts` para incluir métodos de:
     - Troca de senha da própria conta (`alterarSenha(usuarioId, senhaAtual, novaSenha)`).
     - Desativação de conta por admin (`desativarUsuario(usuarioId)`).
   - Implementar nos dois provedores: `provedores/supabase.ts` e `provedores/demo.ts`.
   - Adicionar na interface (ex: `/configuracoes/usuarios` e modal/seção de perfil) as ações de troca de senha e desativação de usuário pelo administrador.
4. **Remoção da conta órfã `gestor.demo`**:
   - Eliminar ou migrar a conta órfã `gestor.demo` (criada antes da migração para login por usuário, que não autentica mais).
5. **Testes e Build**:
   - Criar/atualizar testes automatizados comprovando a falha fechada, a leitura da carteira da sessão, a troca de senha e a desativação nos dois provedores.
   - Executar `npm run build` e testes.

## Aviso Obrigatório de Integridade
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-11T16:49:14Z
Você é o Worker responsável pela Unidade U4 (Identidade e alçada de verdade).
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_u4_identidade_alcada
Leia atentamente DISPATCH.md em seu diretório e ORIGINAL_REQUEST.md em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute:
1. Eliminar seletor estático e conectar cockpit à carteira da sessão (allowedSupplierIds). Garantir falha fechada para compradores sem carteira (vê vazio, não catálogo todo).
2. Garantir restrição no servidor em /api/compras.
3. Adicionar troca de senha e desativação de usuário na porta e nos provedores (demo e supabase), com interface em /configuracoes/usuarios.
4. Remover/migrar conta órfã gestor.demo.
5. Rodar testes e npm run build.
6. Gerar progress.md e handoff.md e notificar o orquestrador via send_message.


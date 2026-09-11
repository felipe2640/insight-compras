# Progresso — Unidade U4: Identidade e Alçada de Verdade

Last visited: 2026-09-11T16:49:14Z

## Status
Em andamento — Investigação e levantamento da base de código.

## Passos Planejados
- [x] 1. Investigar arquivos envolvidos e mapear pontos de alteração.
- [ ] 2. Eliminar seletor estático e `CARTEIRAS_DEMO` de `CockpitPrincipal.tsx`, conectar à carteira da sessão com falha fechada para compradores.
- [ ] 3. Reforçar restrição no servidor em `/api/compras/route.ts` e `/compras/page.tsx`.
- [ ] 4. Expandir porta de autenticação (`porta.ts`) e ambos provedores (`demo.ts`, `supabase.ts`) com `alterarSenha` e `desativarUsuario`.
- [ ] 5. Criar endpoints de API (`/api/auth/alterar-senha`, PATCH em `/api/admin/usuarios`) e integrá-los na interface `/configuracoes/usuarios/page.tsx`.
- [ ] 6. Remover/migrar conta órfã `gestor.demo`.
- [ ] 7. Adicionar/atualizar testes automatizados para cobrir falha fechada, alçada na API e no cockpit, troca de senha e desativação de usuário.
- [ ] 8. Rodar testes e `npm run build`.
- [ ] 9. Gerar `handoff.md` e notificar o orquestrador via `send_message`.

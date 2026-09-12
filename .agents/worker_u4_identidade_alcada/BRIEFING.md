# BRIEFING — 2026-09-11T16:49:14Z

## Mission
Resolver integralmente a Unidade U4: alçada de verdade na carteira de compradores, falha fechada, segurança no backend, manutenção de contas (troca de senha e desativação) e expurgo da conta órfã gestor.demo.

## 🔒 My Identity
- Archetype: implementer
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_u4_identidade_alcada
- Original parent: dba28047-346c-4f0c-a93a-1fb8c01aa8d1
- Milestone: U4 - Identidade e Alçada de Verdade

## 🔒 Key Constraints
- Zero não é o mesmo que não medido.
- A plataforma sobe sem nenhuma variável de ambiente (modo demo).
- Nenhum nome de rede real no código genérico.
- Infraestrutura entra por porta (autenticação em src/lib/autenticacao/porta.ts, provedores em src/lib/autenticacao/provedores/). Se a operação existe no contrato, existe nos dois provedores (demo.ts e supabase.ts).
- Não remover teste para ficar verde.
- Mensagens de commit e comentários em português.
- Falha fechada: comprador sem carteira (allowedSupplierIds: [] ou sem fornecedores atribuídos) falha fechada: enxerga zero fornecedor (grade vazia), não o catálogo todo. Gestor e admin seguem irrestritos (allowedSupplierIds: null).
- Restrição obrigatória no servidor (/api/compras).
- Manutenção de contas (troca de senha e desativação) na porta, em ambos os provedores e na interface.
- Expurgo/migração da conta órfã gestor.demo.

## Current Parent
- Conversation ID: dba28047-346c-4f0c-a93a-1fb8c01aa8d1
- Updated: 2026-09-11T16:49:14Z

## Task Summary
- **What to build**: Conectar cockpit à carteira real da sessão (allowedSupplierIds), eliminar seletor estático e lista CARTEIRAS_DEMO, implementar falha fechada para comprador sem carteira no front e no back (/api/compras), expandir porta de autenticação com alterarSenha e desativarUsuario (demo e supabase), implementar interface em /configuracoes/usuarios, remover/migrar gestor.demo, validar com testes e build.
- **Success criteria**: Seletor estático removido; cockpit respeita carteira da sessão; comprador sem carteira vê grade vazia; restrição garantida no backend /api/compras; troca de senha e desativação funcionando na porta, em ambos os provedores e na UI; gestor.demo removido; testes passando e build passando.
- **Interface contracts**: src/lib/autenticacao/porta.ts
- **Code layout**: src/lib/autenticacao/, src/components/cockpit/, src/app/api/compras/, src/app/configuracoes/usuarios/

## Change Tracker
- **Files modified**: Nenhum ainda
- **Build status**: Não executado
- **Pending issues**: Investigação inicial em andamento

## Quality Status
- **Build/test result**: Pendente
- **Lint status**: Pendente
- **Tests added/modified**: Nenhum ainda

## Key Decisions Made
- Inicializando planejamento detalhado da Unidade U4.

## Artifact Index
- DISPATCH.md — Instruções da tarefa
- BRIEFING.md — Memória de trabalho persistente
- progress.md — Registro de progresso e heartbeat
- handoff.md — Relatório final de handoff de 5 componentes

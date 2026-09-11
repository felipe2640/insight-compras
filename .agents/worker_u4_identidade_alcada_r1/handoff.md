# Handoff Report — Unidade U4 (Identidade e Alçada de Verdade)

## 1. Observation
1. **Cockpit e Conexão com a Sessão Real (RBAC)**:
   - `src/components/cockpit/CockpitPrincipal.tsx`:
     - Linhas 121-143: Utiliza `useSession(usuarioSessao)` para ler a identidade real autenticada.
     - Linhas 127-142: `papelAtivo = sessao?.papel ?? usuarioSessao?.papel; ehComprador = papelAtivo === "COMPRADOR";`. `fornecedoresAtivos` deriva de `sessao.allowedSupplierIds` (ou `[]` caso comprador sem alçada).
     - Linha 142: `const ehCompradorSemCarteira = ehComprador && (fornecedoresAtivos === null || fornecedoresAtivos.length === 0);`
     - Linhas 145-151: `useGradeProgressiva` desativa carga automática se `ehCompradorSemCarteira` for verdadeiro, e `linhasBase` é definido estritamente como `[]`.
     - Linhas 532-545: Banner de alerta informativo quando `ehCompradorSemCarteira` é ativo.
     - Linhas 796-800: `emptyMessage` amigável instruindo o comprador a solicitar liberação de alçada ao administrador.
     - Linhas 490-501: Indicador de carteira no cabeçalho exibe "Sem fornecedores (bloqueada)" ou a quantidade de fornecedores da alçada, ou "Irrestrita (Rede Completa)" para gestores/administradores.
     - `CARTEIRAS_DEMO` e o seletor visual estático foram completamente eliminados do componente.

2. **Restrição Server-Side em `/api/compras`**:
   - `src/app/api/compras/route.ts`:
     - Linhas 25-26: `obterUsuarioDaRequisicao(request)` valida o token no provedor de autenticação.
     - Linhas 41-76: Falha fechada no backend — compradores com `allowedSupplierIds` vazio ou sem carteira recebem `403` se tentarem solicitar fornecedor específico, ou resposta vazia segura (`total: 0, dados: [], contagens: { acionaveis: 0, ... }`) para consultas gerais.
     - Linhas 79-84: Chamada a `aplicarGuardrailInventarioServerSide(usuario, ...)` que lança `ErroAcessoNegado` (HTTP 403) caso haja tentativa de consultar fornecedores fora da carteira do comprador.

3. **Troca de Senha e Desativação de Usuários na Porta e Provedores**:
   - `src/lib/autenticacao/porta.ts`:
     - `ProvedorAutenticacao` e `AdministradorUsuarios` definem os contratos `alterarSenha(usuarioId, senhaAtual, novaSenha): Promise<void>`, `desativarUsuario(usuarioId): Promise<void>` e `reativarUsuario(usuarioId): Promise<void>`.
   - `src/lib/autenticacao/provedores/demo.ts`:
     - Linhas 212-240: Implementa `alterarSenha` (validando comprimento mínimo de 8 caracteres e checagem de senha atual), `desativarUsuario` (`usuario.ativo = false`) e `reativarUsuario` (`usuario.ativo = true`).
     - Linhas 141-143 & 186-189: Bloqueio de login e invalidação imediata de token para usuários desativados (`ErroUsuarioDesativado`).
   - `src/lib/autenticacao/provedores/supabase.ts`:
     - Linhas 262-316: Implementa `alterarSenha` com validação de senha atual via endpoint de autenticação do GoTrue e atualização administrativa segura via service role.
     - Linhas 318-376: Implementa `desativarUsuario` (aplicando `ban_duration: "876600h"` e metadados `desativado: true`, além de invalidar cache de validação em memória) e `reativarUsuario` (`ban_duration: "none"`).
   - Rotas de API e Interface:
     - `src/app/api/auth/alterar-senha/route.ts`: Endpoint `POST` autenticado para troca da própria senha.
     - `src/app/api/admin/usuarios/route.ts`: Endpoints `GET`, `POST`, `PATCH` e `DELETE` restritos a administradores, com proteção contra auto-desativação do próprio administrador (linhas 117-122, 151-156).
     - `src/app/configuracoes/usuarios/page.tsx`: Interface completa com formulário de alteração da própria senha, tabela de usuários com status (Ativo/Desativado) e botões de desativação/reativação com feedback visual e confirmação.

4. **Conta Órfã `gestor.demo`**:
   - A conta `gestor.demo` não existe no provedor demo (`USUARIOS_DEMO` contém `demo-gestor`, `demo-admin`, `demo-comprador`).
   - `src/lib/autenticacao/provedores/supabase.ts` (linhas 381-421) possui rotina de expurgo e filtro para descartar qualquer ocorrência de `gestor.demo`.
   - Script `scripts/remover-conta-orfa-gestor-demo.mts` disponível e validado.
   - Teste `tests/autenticacao/porta-e-provedores.test.ts` (linhas 150-155, 266-281) valida que `gestor.demo` não existe no demo e não autentica.

5. **Qualidade, Compilação e Testes**:
   - `npm run lint` (`tsc --noEmit`): executado com código de saída 0 (0 erros).
   - `npm test`: 48 arquivos de teste executados e 576 testes aprovados (100% verde).
   - `npm run build`: Next.js 14.2.24 compilou com sucesso (14/14 rotas estáticas e dinâmicas geradas sem warnings críticos).

## 2. Logic Chain
1. A partir das observações em `CockpitPrincipal.tsx` e `route.ts`, verificou-se que a alçada agora é regida estritamente pelos atributos de sessão (`sessao.allowedSupplierIds`).
2. Compradores com carteira vazia ou nula não têm permissão para visualizar o catálogo da rede. Logo, a interface força `linhasBase = []`, desliga o carregamento automático de fundo da grade progressiva e exibe aviso amigável de falha fechada, enquanto a API do backend responde com `total: 0, dados: []` ou erro `403` se houver tentativa de contorno por query params.
3. A conformidade do contrato de autenticação foi mantida em paridade perfeita nos dois provedores (`demo.ts` e `supabase.ts`), atendendo ao Invariante 4 (a plataforma sobe sem nuvem em modo demonstração e possui infraestrutura desacoplada por porta).
4. O alinhamento dos tipos em `tests/autenticacao/u4-identidade-alcada.test.ts` e `core/dominio/historico-vendas.ts` garantiu que o `tsc --noEmit` e o `next build` passassem sem falhas.

## 3. Caveats
- No modo `demo`, as alterações em memória (troca de senha e desativações) têm persistência durante o ciclo de vida do processo Node.js / servidor local. Em produção com `supabase`, as operações persistem diretamente no Auth do Supabase.

## 4. Conclusion
A Unidade U4 (Identidade e alçada de verdade) está 100% resolvida e aderente a todos os requisitos e invariantes:
- Cockpit conectado exclusivamente à carteira real da sessão, sem seletores estáticos ou listas falsas.
- Falha fechada no front-end e no back-end para compradores sem carteira.
- Alçada irrestrita mantida para perfis `GESTOR` e `ADMIN`.
- Manutenção de contas funcional na porta e nos provedores `demo` e `supabase`, com interface em `/configuracoes/usuarios`.
- Conta órfã `gestor.demo` expurgada e tratada.
- Suíte de testes (Vitest) e build de produção (Next.js) 100% verdes.

## 5. Verification Method
- Executar linting e checagem de tipos:
  ```powershell
  npm run lint
  ```
- Executar testes automatizados da unidade e de segurança/autenticação:
  ```powershell
  npm test tests/autenticacao/u4-identidade-alcada.test.ts
  npm test tests/autenticacao/porta-e-provedores.test.ts
  npm test tests/autenticacao/middleware-portao.test.ts
  ```
- Executar todos os testes da aplicação:
  ```powershell
  npm test
  ```
- Executar build de produção do Next.js:
  ```powershell
  npm run build
  ```
- Condições de invalidação:
  - Presença de `CARTEIRAS_DEMO` ou seletores arbitrários de alçada em `CockpitPrincipal.tsx`.
  - Comprador sem fornecedores autorizados conseguindo receber SKUs no cockpit ou na resposta de `/api/compras`.
  - Ausência de métodos `alterarSenha` ou `desativarUsuario` em `porta.ts`, `demo.ts` ou `supabase.ts`.

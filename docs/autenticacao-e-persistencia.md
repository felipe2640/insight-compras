# Autenticação e persistência independentes de nuvem

A plataforma é white-label também na infraestrutura: **nenhuma rota, tela ou
cálculo importa Supabase**. Elas falam com duas **portas** (interfaces), e cada
nuvem é um arquivo em `provedores/`.

| Porta | Arquivo | Provedores hoje | Seleção |
|---|---|---|---|
| Autenticação | `src/lib/autenticacao/porta.ts` | `supabase` (GoTrue), `demo` (HMAC local) | `AUTH_PROVIDER` ou automático |
| Persistência do aprendizado | `src/lib/aprendizado/porta-repositorio.ts` | `supabase` (PostgREST), `memoria`, `nenhum` | `APRENDIZADO_PROVIDER` ou automático |

Automático: se `SUPABASE_URL` + `SUPABASE_ANON_KEY` existem, autenticação é
Supabase; senão `demo`. Se `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` existem,
persistência é Supabase; senão `nenhum` (no-op: a exportação nunca falha).

## Como a identidade circula

```
/login  ->  POST /api/auth/entrar  ->  provedor.entrar(email, senha)
                                        cookie httpOnly `insight_sessao` = {provedor, token, renovação, expira}
middleware (Edge)  ->  rota pública? passa
                       sem cookie/vencido? página -> /login?next=..., API -> 401
                       token vencido + renovação? provedor.renovar() e regrava o cookie
rota de API        ->  obterUsuarioDaRequisicao(): provedor.validar(token) -> UsuarioAutenticado
```

Regras:
- As rotas **nunca** leem `x-user-*`. Identidade vem só da sessão validada.
- Papel e carteira moram no provedor (no Supabase: `app_metadata`, que só a chave
  privilegiada escreve). A tela de login não escolhe papel.
- Comprador sem carteira cadastrada **falha fechado** (não vê fornecedor nenhum).
- Conta de outro tenant é revogada no ato do login.
- Chave privilegiada (`SUPABASE_SERVICE_ROLE_KEY`) só no servidor; nunca no cliente.

## Para trocar de nuvem (Firebase, Cognito, Google Identity, Vercel…)

1. Criar `src/lib/autenticacao/provedores/<nome>.ts` implementando
   `ProvedorAutenticacao` (e `AdministradorUsuarios` se quiser criar usuários
   pela plataforma).
2. Registrar em `src/lib/autenticacao/fabrica.ts` e adicionar o id em
   `IdProvedorAutenticacao` (porta) e no decodificador do cookie (`sessao.ts`).
3. Para persistência: `src/lib/aprendizado/provedores/<nome>.ts` implementando
   `RepositorioAprendizado`; registrar em `repositorio.ts`.
4. Os testes de contrato em `tests/autenticacao` e `tests/aprendizado` valem
   para qualquer provedor: rode-os contra o novo.

Nada em `src/app`, `core`, `adapters` ou `config` muda.

## Usuários

```bash
SENHA_NOVO_USUARIO='...' npx tsx scripts/criar-usuario.mts --email x@y --nome "Nome" --papel GESTOR|COMPRADOR|ADMIN [--tenant carreiro] [--fornecedores 12,34]
```

Sem `SENHA_NOVO_USUARIO`, uma senha aleatória é gerada e impressa uma única vez.

## Variáveis

| Variável | Uso | Onde |
|---|---|---|
| `SUPABASE_URL` | ambos | servidor |
| `SUPABASE_ANON_KEY` | login por senha e validação do token | servidor (é pública, mas não precisa ir ao navegador) |
| `SUPABASE_SERVICE_ROLE_KEY` | persistência do aprendizado e administração de usuários | **só servidor** |
| `AUTH_PROVIDER` | `supabase` / `demo` | opcional |
| `APRENDIZADO_PROVIDER` | `supabase` / `memoria` / `nenhum` | opcional |
| `DEMO_SENHA`, `AUTH_SECRET` | provedor demo | opcional |

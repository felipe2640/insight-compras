# Finalização da migração do Diário para o Supabase compartilhado

**Data:** 2026-09-21
**Repositórios:** `felipe2640/insight-compras` e `felipe2640/diario`
**Destino:** projeto Supabase `rede-carreiro` (`nzomnqxqljhwqyewehvo`)

## Objetivo

Eliminar a dependência operacional do projeto Supabase antigo do Diário sem
misturar identidades entre aplicações. O projeto `rede-carreiro` passa a
concentrar a persistência útil das duas aplicações, mantendo:

- uma instalação/deploy por cliente e `TENANT_ATIVO` obrigatório;
- isolamento de tenant no banco por Supabase Auth/JWT + RLS;
- isolamento adicional por aplicação (`insight-compras` e `diario`);
- os usuários `admin` e `valmir` exclusivos do Insight Compras;
- os sete usuários atuais do Diário exclusivos do Diário, com os mesmos logins,
  senhas, papéis, lojas, fornecedores, páginas permitidas e estado ativo;
- `service_role` apenas em bootstrap, migração, administração de usuários e jobs
  explicitamente privilegiados;
- o Supabase antigo disponível até a validação final do corte.

## Estado auditado

### Supabase antigo do Diário

| Estrutura | Linhas | Destino |
|---|---:|---|
| `fornecedor_grupo` | 1 | já copiada; manter e app-scopear |
| `usuario_grupo` | 2 | importar novamente após criar os usuários corretos do Diário |
| `secao_multiplo_compra` | 96 | já copiada; manter e app-scopear |
| `margem_alvo` | 1 | já copiada; manter e app-scopear |
| `shadow_snapshot` | 274 | descartar após validação; dados de demonstração autorizados para exclusão |
| `shadow_item` | 14.878 | descartar após validação; não recriar no destino |
| `shadow_feedback` | 0 | descartar |
| `parametros_modelo` | 0 | não migrar; o Insight já tem modelo próprio |
| `margem_alerta` | 0 | criar somente a estrutura tenant/app-scoped usada pelo runtime |
| `margem_mensal` | 0 | criar somente a estrutura tenant/app-scoped usada pelo runtime |

O projeto antigo possui nove tabelas públicas sem RLS. Esse risco deixa de ser
aceito no corte: ele não será usado como fallback automático e será excluído
depois da validação final.

### Supabase compartilhado

- `tenants` contém `carreiro`.
- `tenant_members` contém apenas os dois usuários humanos do Insight Compras.
- as estruturas `aprendizado_*` são o modelo maduro; `shadow_*` não será
  recriado nem importado.
- `fornecedor_grupo`, `secao_multiplo_compra` e `margem_alvo` conferem com a
  origem por contagem e hash.
- `usuario_grupo` está vazio, após remoção dos dois vínculos feitos com o modelo
  de identidade incorreto.
- as migrations `001` e `003` existem no repositório e o schema existe no banco,
  mas não constam integralmente no histórico remoto. A PR final não tentará
  reaplicá-las; a migration corretiva será idempotente sobre o estado real e o
  runbook registrará a reconciliação do histórico.

## Decisões de arquitetura

### 1. Identidades independentes por aplicação

`tenant_members` continua sendo a fonte de autorização do Insight Compras. Os
usuários do Diário **não** serão inseridos nessa tabela.

Será criada `app_members`, com chave `(tenant_id, app_id, user_id)` e referência
a `auth.users`. Para o Diário, ela armazena:

- `legacy_user_ref` (ID da planilha);
- `username` e `username_normalized`;
- papel `admin` ou `user`;
- IDs de lojas;
- fornecedores permitidos (inclusive a diferença entre `null` e lista vazia);
- páginas permitidas;
- estado ativo.

O JWT dos usuários do Diário terá em `app_metadata` somente os dados estáveis de
autorização: `tenant_id`, `app_id=diario`, `account_type`, `legacy_user_ref` e
papel. As permissões mutáveis ficam em `app_members`, para não depender de JWT
desatualizado.

Uma conta técnica `account_type=runtime` por tenant/aplicação fará o acesso
server-side normal do Diário. Ela autentica com a chave publicável e senha,
recebe JWT de curta duração e passa pelas mesmas políticas RLS. Sua senha fica
somente nas variáveis protegidas do deploy. O runtime não usa `service_role`.

### 2. Preservação das senhas

Um bootstrap idempotente lê a aba `Usuarios` diretamente da planilha e cria os
sete usuários pelo Supabase Auth Admin API, fornecendo exatamente a senha atual.
As senhas existem apenas em memória durante a execução: não entram em manifesto,
log, commit ou tabela pública.

O e-mail interno de Auth é determinístico e não é exibido ao usuário. O login
continua aceitando o mesmo nome de usuário e a mesma senha. Antes de aplicar, o
dry-run valida duplicidades, campos obrigatórios e compatibilidade das senhas
com as regras do Supabase, sem imprimir os segredos.

### 3. Configuração do Diário no destino

Será criada `diario_lojas` para retirar do Google Sheets a configuração de lojas.
As quatro tabelas já importadas receberão `app_id='diario'` e suas chaves,
índices, FKs e políticas serão ajustados para o escopo composto
`(tenant_id, app_id, ...)`.

`usuario_grupo` passa a referenciar `app_members`, nunca `tenant_members`. O RPC
de importação deixa de receber um mapa arbitrário de UUIDs: ele resolve
`legacy_user_ref` diretamente em `app_members` do mesmo tenant e da aplicação
`diario`. A assinatura antiga é removida para impedir a reintrodução do erro.

Também serão criadas as estruturas vazias `margem_alerta`, `margem_mensal` e
`margem_tendencia`, porque o código atual usa essas funcionalidades e o banco de
origem não possui dados a transportar nelas.

### 4. Políticas RLS e privilégios

As políticas das estruturas do Diário exigirão simultaneamente:

1. usuário autenticado;
2. `auth.uid()` presente e ativo em `app_members`;
3. mesmo `tenant_id` da linha;
4. `app_id='diario'` no membership e no JWT;
5. papel `admin` para INSERT/UPDATE/DELETE administrativos.

Os helpers de RLS ficam em schema privado, com `search_path=''`, checagem
explícita de `auth.uid()` e EXECUTE revogado de `PUBLIC`. As colunas usadas nas
políticas e FKs terão índices compostos. `anon` não recebe acesso às tabelas; o
papel `authenticated` recebe apenas os grants necessários e RLS decide as linhas.

Os usuários do Diário não poderão ler ou escrever `aprendizado_*`, porque não
pertencem a `tenant_members`. Os usuários do Insight não poderão acessar as
estruturas do Diário, porque não pertencem a `app_members` com `app_id=diario`.

### 5. Runtime e transição no Diário

O cliente PostgREST atual, que usa `SUPABASE_SERVICE_ROLE_KEY`, será substituído
por um cliente server-side que:

- autentica a conta técnica do Diário usando a chave publicável;
- mantém e renova seu JWT em cache seguro do servidor;
- adiciona `tenant_id=TENANT_ATIVO` e `app_id=diario` às escritas;
- depende de RLS, mesmo que um filtro seja omitido no código;
- falha fechado quando identidade ou tenant estiver incorreto.

O login NextAuth terá dois provedores selecionáveis por
`DIARIO_AUTH_BACKEND=supabase|sheet`. O valor de corte é `supabase`. `sheet`
existe apenas como rollback explícito durante a validação; indisponibilidade do
Supabase não provoca fallback automático que possa contornar a autorização.

A administração de usuários passa a operar no Supabase. Criação, alteração de
senha e desativação usam uma rota administrativa server-side com
`service_role`, permitida por este desenho. Listagem e configuração comum usam
JWT/RLS.

### 6. Aposentadoria de `shadow_*`

As rotas e jobs legados de shadow mode não apontarão para novas tabelas
`shadow_*`. O modo fica explicitamente aposentado após o corte. O Insight
Compras continua responsável por `aprendizado_*` e pela rotina diária de
sugestões já existente e validada.

O workflow de keepalive do Diário será alterado para consultar uma tabela do
Diário no projeto compartilhado usando JWT da conta técnica, sem
`service_role`. Os jobs locais antigos de análise ficam documentados como
arquivados e não bloqueiam o funcionamento do Diário.

## Migração e cutover

1. Aplicar a migration corretiva no projeto `rede-carreiro`.
2. Executar testes adversariais com usuários de dois tenants e das duas
   aplicações para SELECT/INSERT/UPDATE/DELETE e FKs cross-tenant/cross-app.
3. Rodar o bootstrap em dry-run contra a planilha.
4. Criar a conta técnica, os sete usuários do Diário, `app_members` e lojas.
5. Reexecutar a importação idempotente para materializar os dois vínculos
   `usuario_grupo` nos usuários corretos.
6. Validar contagens e hashes das configurações.
7. Publicar preview do Diário com `DIARIO_AUTH_BACKEND=supabase` e o projeto
   compartilhado.
8. Testar os sete logins, páginas, lojas, grupos, múltiplos de compra e margem.
9. Promover para produção mantendo o projeto antigo intacto.
10. Após período de validação e confirmação do usuário, remover os segredos do
    Supabase antigo dos deploys e workflows.
11. Fazer uma última verificação de ausência de tráfego e excluir o projeto
    Supabase antigo do Diário. A exclusão é a única etapa irreversível e não será
    executada antes da confirmação final.

## Rollback

- Antes do corte: nenhuma alteração no runtime atual.
- Durante a validação: definir `DIARIO_AUTH_BACKEND=sheet` e restaurar as
  variáveis do Supabase antigo, sem apagar dados do destino.
- Migration: a reversão remove somente objetos novos e restaura as políticas
  anteriores; as três configurações já validadas permanecem recuperáveis pelo
  `migration_batch_id`.
- Contas criadas pelo bootstrap são marcadas por `app_id=diario` e podem ser
  desativadas/revertidas sem tocar `admin` ou `valmir`.
- Depois da exclusão do projeto antigo, o rollback passa a ser feito a partir do
  manifesto/configuração validado e das contas do Supabase compartilhado; por
  isso a exclusão só ocorre depois do aceite final.

## Testes e critérios de aceite

- testes SQL adversariais cobrem SELECT/INSERT/UPDATE/DELETE nos dois tenants;
- referências compostas recusam grupo, usuário ou loja de outro tenant/app;
- usuário do Insight não acessa dados do Diário e vice-versa;
- conta runtime não acessa outro tenant nem `aprendizado_*`;
- os sete usuários entram com as senhas atuais;
- papéis, lojas, fornecedores, páginas e estado ativo conferem com a planilha;
- as contagens finais são 1 grupo, 2 vínculos, 96 seções e 1 margem para
  `carreiro/diario`;
- `shadow_*` não existe no destino e nenhuma chamada de produção depende dela;
- builds e suítes completas dos dois repositórios passam;
- a rotina diária de sugestões do Insight permanece inalterada e verde;
- PRs coordenadas documentam ordem de deploy, variáveis, rollout e rollback;
- o Supabase antigo só é excluído após o checklist de produção e confirmação
  explícita.

## Entrega

Haverá exatamente uma PR final no `insight-compras` e uma PR final no `diario`.
Elas podem conter vários commits pequenos e revisáveis, mas não serão divididas
em novas PRs intermediárias.

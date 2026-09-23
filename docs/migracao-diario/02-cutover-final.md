# Cutover final do Diário para o Supabase compartilhado

Este runbook coordena as PRs finais de `insight-compras` e `diario`. O destino é
o projeto `rede-carreiro` (`nzomnqxqljhwqyewehvo`), mantendo uma instalação por
cliente e `TENANT_ATIVO` obrigatório. O projeto antigo do Diário é
`escsriqutzfdwbockfym`.

## Regras de segurança

- Não excluir, pausar nem alterar o projeto antigo antes do aceite final.
- Usuários do Diário pertencem a `app_members(trairi, diario)`; `admin` e
  `valmir` continuam somente em `tenant_members` do Insight Compras.
- O runtime usa JWT de usuário e RLS. A `service_role` fica restrita a migration,
  bootstrap, importação administrativa e jobs privilegiados.
- Não recriar tabelas `shadow_*`. O histórico já copiado para `aprendizado_*`
  com IDs deslocados é de Trairi e deve ser classificado/reconciliado antes do
  aceite; snapshots novos sem itens não são comparativos úteis.
- A migration final não depende de reaplicar `001` ou `003`: ambos já existem no
  schema remoto, embora tenham sido executados manualmente e não apareçam no
  histórico remoto completo.

## 1. Preparação e backup

1. Confirmar backup recuperável dos dois projetos.
2. Registrar as contagens do projeto antigo: `1 fornecedor_grupo`,
   `2 usuario_grupo`, `96 secao_multiplo_compra` e `1 margem_alvo`.
3. Confirmar que o manifesto exportado contém somente essas configurações úteis.
4. Confirmar que os sete acessos do Diário e as lojas/páginas vêm da mesma
   planilha usada hoje; nenhuma senha deve ser registrada em logs ou commits.

## 2. Preparar o backend compartilhado

1. Conferir que `diario_app_identity`, `app_members_user_fk_index` e
   `tenant_trairi` já constam no banco. As migrations finais
   `20260923171249_diario_read_aprendizado.sql` e
   `20260923171321_runtime_rls_tenant_app.sql` foram aplicadas via Supabase e
   devem constar no histórico remoto com essas mesmas versões. Não executar
   manualmente o SQL novamente.
2. Conferir `app_members`, `diario_lojas`, as novas tabelas de margem, RLS,
   policies, grants e FKs compostas `(tenant_id, app_id, ...)`.
3. Em banco descartável, executar
   `supabase/tests/diario_app_rls_adversarial.sql` depois de todas as migrations.
   Nunca executar esse teste em
   produção porque ele cria identidades sintéticas dentro de uma transação.
4. Confirmar que um JWT sem `app_id=diario`, com tenant errado ou apenas com
   membership do Insight recebe zero linhas das tabelas do Diário.

## 3. Bootstrap dos usuários e lojas

Na PR do `diario`, executar primeiro o dry-run do bootstrap. Depois, com a
`service_role` somente no ambiente administrativo, criar/atualizar os sete
usuários no Supabase Auth preservando as mesmas senhas da planilha e preencher
`app_members`/`diario_lojas`. O bootstrap precisa ser idempotente.

Aceite desta etapa:

- sete usuários Auth confirmados;
- sete `app_members` humanos ativos em `trairi/diario`, mais um runtime;
- `app_metadata.tenant_id=trairi` e `app_metadata.app_id=diario`;
- nenhum desses UUIDs em `tenant_members`;
- lojas, páginas e fornecedores permitidos equivalentes à planilha.

## 4. Importar as configurações úteis

Definir somente no terminal administrativo:

```text
MIGRACAO_TENANT_ID=trairi
INSIGHT_SUPABASE_URL=<URL do rede-carreiro>
INSIGHT_SUPABASE_SERVICE_ROLE_KEY=<segredo temporário>
```

Executar primeiro sem `--apply` e revisar o resumo. Depois aplicar o mesmo
manifesto. O RPC resolve `legacy_user_ref` exclusivamente em `app_members` e
deve resultar em `1 fornecedor_grupo`, `2 usuario_grupo`,
`96 secao_multiplo_compra` e `1 margem_alvo`. Guardar o `batchId` para rollback
seletivo.

Repetir a importação uma vez e confirmar idempotência: as contagens e os valores
permanecem iguais, sem linhas duplicadas.

No momento do corte, com os dois projetos ainda disponíveis e somente em
terminal administrativo, executar `npm run migration:reconcile-learning` com
`DIARIO_SUPABASE_URL`, `DIARIO_SUPABASE_SERVICE_ROLE_KEY`,
`INSIGHT_SUPABASE_URL` e `INSIGHT_SUPABASE_SERVICE_ROLE_KEY`. O script é
somente-leitura e falha se houver item ausente/alterado ou snapshot ausente
que contenha itens. Snapshots sem itens são reportados separadamente.

## 5. Preview e produção do Diário

No preview, configurar o Supabase compartilhado e
`DIARIO_AUTH_BACKEND=supabase`, mantendo o fallback de planilha disponível.
Testar os sete logins, lojas/páginas autorizadas, grupos de fornecedores,
múltiplos por seção, margens e uma operação de gravação/leitura por JWT.

Depois do aceite do preview, **antes do merge que dispara o deploy automático**,
configurar em Production
`TENANT_ATIVO=trairi`, `DIARIO_AUTH_BACKEND=supabase`, a URL/chave pública do
projeto compartilhado e as credenciais da conta runtime. Os segredos sensíveis
do Preview não são promovidos automaticamente. Observar erros de autenticação,
negações RLS, leituras no Supabase antigo e resultados funcionais. Se houver
falha, voltar `DIARIO_AUTH_BACKEND=sheet` e redeployar para recuperar o login;
isso não restaura o banco antigo para configurações. Para rollback integral,
redeployar o commit anterior e restaurar URL/chave antigas, mantendo ambos os
bancos e reconciliando as escritas posteriores. Não chamar
`reverter_importacao_diario` como parte de um rollback automático: poderia
apagar mudanças legítimas posteriores ao corte.

## 6. Reconciliação final

Comparar por tenant/app:

```sql
select count(*) from public.app_members
where tenant_id = 'trairi' and app_id = 'diario' and ativo;

select 'fornecedor_grupo', count(*) from public.fornecedor_grupo
where tenant_id = 'trairi' and app_id = 'diario'
union all
select 'usuario_grupo', count(*) from public.usuario_grupo
where tenant_id = 'trairi' and app_id = 'diario'
union all
select 'secao_multiplo_compra', count(*) from public.secao_multiplo_compra
where tenant_id = 'trairi' and app_id = 'diario'
union all
select 'margem_alvo', count(*) from public.margem_alvo
where tenant_id = 'trairi' and app_id = 'diario';
```

Além das contagens, comparar o conteúdo normalizado/hashes do manifesto, validar
SELECT/INSERT/UPDATE/DELETE cross-tenant e confirmar que o Diário lê somente
`aprendizado_*` de Trairi, sem conseguir escrever nessas tabelas.

## 7. Encerramento do legado

Somente após aceite explícito, período de observação sem tráfego e comprovação
de rollback:

1. remover do deploy as credenciais do Supabase antigo e da planilha;
2. manter um backup/exportação final;
3. confirmar que não existem chamadas ao projeto `escsriqutzfdwbockfym`;
4. então planejar separadamente a exclusão do projeto antigo e dos dados
   `shadow_*` de teste. Esta PR não executa essa exclusão.

O job privilegiado diário do Insight permanece em
`.github/workflows/previsao-ia-diaria.yml`; esta migração não altera sua agenda,
segredos nem responsabilidade de gerar as sugestões diárias.

# ADR-0004: Isolamento multi-tenant também no banco

- **Data**: 21 de setembro de 2026
- **Status**: proposta

## Contexto

O ADR-0001 determina uma instalação por cliente e mantém `TENANT_ATIVO`
obrigatório em produção. Essa barreira no deploy continua válida, mas não basta
para proteger um backend Supabase compartilhado: um filtro `tenant_id` esquecido
ou adulterado ainda poderia atravessar a fronteira do cliente quando a aplicação
usa `service_role`, pois essa chave ignora RLS.

O banco de produção tinha RLS habilitado nas tabelas operacionais, mas nenhuma
política. Por isso, toda persistência usava `service_role`, inclusive requisições
humanas autenticadas. As FKs do ciclo de aprendizado também ligavam somente IDs,
sem provar que pai e filho pertenciam ao mesmo tenant.

## Decisão

1. `TENANT_ATIVO` continua obrigatório e cada deploy continua atendendo um só
   cliente. Este ADR acrescenta uma segunda barreira; não substitui o ADR-0001.
2. `tenants` cadastra os clientes e `tenant_members` associa `auth.users` a eles.
3. Uma operação humana só enxerga um tenant quando três fatos coincidem:
   `auth.uid()`, a associação ativa e `app_metadata.tenant_id` do JWT.
4. Tabelas de domínio referenciam `tenants`; relações internas críticas usam FKs
   compostas com `tenant_id`.
5. O papel `authenticated` recebe somente os grants necessários, protegidos por
   políticas RLS. `anon` não recebe acesso às tabelas de negócio.
6. `service_role` fica reservado a administração, migrações e jobs privilegiados.
   A migração do runtime para JWT será feita em PR separada, para permitir rollback
   sem alterar schema e aplicação ao mesmo tempo.
7. A trilha `auditoria_pedido` permanece imutável para usuários: leitura por tenant,
   sem UPDATE ou DELETE autenticado.

## Compatibilidade e rollout

A migração primeiro cria e preenche associações a partir do `app_metadata` atual.
Ela mantém os grants de `service_role`, portanto o runtime existente não muda de
comportamento. Só depois os repositórios interativos passarão a enviar o JWT do
usuário. Jobs de IA e tarefas administrativas continuarão privilegiados.

## Rollback

O arquivo `202609210001_tenant_rls_foundation.rollback.sql` restaura o modelo
fechado anterior (somente `service_role`), recria as FKs simples e remove as novas
estruturas de autorização. Ele não apaga nenhuma linha de domínio.

## Critérios de aceite

- membro de A lê e altera somente A;
- SELECT/INSERT/UPDATE/DELETE contra B falham ou afetam zero linhas;
- uma linha de A não referencia pai de B;
- `anon` não acessa dados de negócio;
- Carreiro e seus usuários atuais são preservados;
- o ADR-0001 e `TENANT_ATIVO` permanecem inalterados.

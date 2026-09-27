# Módulo de Cotação — Acoplamento aos projetos em produção

> Como o trabalho dos agentes entra no Diário e no Insight Compras, que já
> estão em produção, sem que o comprador perceba nada até o piloto ser ligado.

## Mapa do que está no ar (27/09/2026)

| Peça | Onde | Produção | O que o módulo faz com ela |
|---|---|---|---|
| Insight Compras | GitHub `felipe2640/insight-compras` (**público**) · Vercel `insight-compras` | deploy automático do `main` | Recebe telas, rotas e o corte, atrás de flag |
| Diário | GitHub `felipe2640/diario` (privado) · Vercel `diario` | deploy automático do `main` | Recebe só o botão "Enviar para cotação", atrás de flag |
| Supabase `rede-carreiro` | sa-east-1, Postgres 17 | compartilhado pelos dois apps | Recebe uma migração aditiva |
| Portal do vendedor | pasta nova `portal-vendedor/` neste repositório | novo projeto Vercel `cotacao-portal` (Root Directory = `portal-vendedor`) | Nasce isolado; só fala com RPCs |
| Cotaflash | Connectsoft | continua em uso | Roda em paralelo até o portão G3 |

**Atenção: `insight-compras` é público.** Nada de e-mail de vendedor, CNPJ,
token, chave ou dado real em código, teste, fixture ou handoff. Fixtures usam
o tenant sintético.

## As quatro travas que protegem a produção

1. **Flag dupla, desligada por padrão.** O módulo só existe quando
   `COTACAO_HABILITADA=true` **e** o tenant tem `modulos.cotacao: true`. Sem
   isso, rotas novas respondem 404, o menu não mostra "Cotações" e a
   `validacao-ambiente` não exige nenhuma variável nova. Um teste de
   arquitetura (unidade C0) compara a lista de rotas e o menu com a flag
   desligada contra o estado de hoje.
2. **Migração aditiva, ensaiada antes.** Ela só cria tabelas e colunas `null`,
   e é aplicada primeiro num **branch do Supabase**, onde rodam os testes
   adversariais (`supabase/tests/cotacao_rls_adversarial.sql`) e as suítes de
   hoje. Só depois do portão G0 ela vai para `rede-carreiro`. Como nenhuma
   coluna existente muda, Diário e Insight continuam iguais mesmo com ela
   aplicada.
3. **Uma branch e uma PR por unidade**, com preview da Vercel. O merge no
   `main` segue a ordem das ondas do `plan.md`. Um merge fora de ordem é
   recusado pelo orquestrador.
4. **Sem chave privilegiada nova no runtime.** O portal usa só a chave
   pública. O Insight usa o JWT do usuário (ADR-0005). O único job
   privilegiado novo é o cron de prazos, igual ao `previsao-ia-diaria`.

## Sequência de entrada em produção

| Passo | Quando | Quem executa | Verificação |
|---|---|---|---|
| 1. Criar branch Supabase `cotacao-ensaio` | início da onda 0 | humano (Felipe) ou agente com o MCP do Supabase | `list_branches` mostra o branch |
| 2. Aplicar migração no branch e rodar os testes SQL | fim de C0 | worker C0 | testes adversariais passam; `get_advisors` sem alerta novo de segurança |
| 3. Merge de C0 no `main` (flag desligada) | portão G0 | orquestrador | deploy de produção do Insight igual; `/api/health` ok |
| 4. Aplicar migração em `rede-carreiro` | logo após o passo 3 | humano, com o rollback em mãos | Diário e Insight seguem funcionando; smoke de login e pedidos |
| 5. Merges das ondas 1 e 2 | portões G1 e G2 | orquestrador | produção sem mudança visível (flag desligada) |
| 6. Criar o projeto Vercel `cotacao-portal` | onda 1 (C3) | humano | preview do portal abre com convite do tenant sintético |
| 7. Ligar em **preview** | portão G2 | humano | `COTACAO_HABILITADA=true` só no ambiente Preview do Insight; E2E completo no preview |
| 8. Piloto em produção | portão G3 | humano | `modulos.cotacao: true` no tenant Carreiro + `COTACAO_HABILITADA=true` em Production + acesso só para os usuários do piloto (Campo Maior) |
| 9. Diário | após o passo 8 estável por 1 semana | humano | `DIARIO_COTACAO_HABILITADA=true` e página `cotacao-enviar` só para quem está no piloto |

## Variáveis por projeto Vercel

| Projeto | Ambiente | Variável | Valor |
|---|---|---|---|
| insight-compras | Preview | `COTACAO_HABILITADA` | `true` (passo 7) |
| insight-compras | Production | `COTACAO_HABILITADA` | ausente até o passo 8 |
| insight-compras | ambos | `COTACAO_PORTAL_URL` | URL do `cotacao-portal` |
| insight-compras | ambos | `RESEND_API_KEY`, `COTACAO_EMAIL_REMETENTE` | definidos pelo Felipe |
| insight-compras | ambos | `CRON_SECRET` | aleatório; usado pelo Vercel Cron |
| diario | ambos | `DIARIO_COTACAO_HABILITADA`, `INSIGHT_COMPRAS_URL` | passo 9 |
| cotacao-portal | ambos | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | os mesmos públicos do Insight |

O cron entra num `vercel.json` novo do Insight (hoje ele não tem) como `/api/cron/cotacao-prazos`, a
cada 30 minutos. A rota sai sem efeito quando o módulo está desligado.

## Como voltar atrás

| Situação | Ação | Tempo |
|---|---|---|
| Qualquer problema visível ao comprador | remover `COTACAO_HABILITADA` do ambiente e fazer redeploy | minutos |
| Problema só no portal | pausar o projeto `cotacao-portal` na Vercel; os convites param de abrir | minutos |
| Problema no Diário | remover `DIARIO_COTACAO_HABILITADA` | minutos |
| Migração com defeito | `202609280001_cotacao_foundation.rollback.sql`: remove só as tabelas e colunas do módulo | depois de exportar as cotações |
| Pedido gerado errado | o snapshot `origem='cotacao'` é marcado como cancelado via `historico_estados`; o Cotaflash continua disponível até G3 | imediato |

## O que observar nas primeiras semanas

- Logs de runtime da Vercel filtrando `[cotacao]` (todo log do módulo usa esse prefixo).
- `cotacao_evento`: convites abertos × respondidos × terminados por cotação.
- Comparação manual do corte com o do Cotaflash em cada cotação do piloto
  (critério do portão G3).

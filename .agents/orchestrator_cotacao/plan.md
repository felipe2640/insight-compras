# SUPERSEDED — Plano de Execução anterior C0 a C9

> **Pré-G0 v2:** C0–C9 e S1 não podem ser despachadas. Este documento é
> histórico. A revisão e os novos portões estão em `plan-v2.md`; nenhum código
> de produto começa antes da revisão humana após o novo G0.

Leia antes: `docs/cotacao/00-contexto.md` (negócio), `docs/cotacao/01-contratos.md`
(fronteiras congeladas), `docs/cotacao/02-producao.md` (como entra no ar).

## Invariantes

Os seis de sempre continuam valendo:

1. Zero não é não medido (`camposIndisponiveis` / travessão).
2. A plataforma sobe sem nenhuma variável de ambiente (modo demo, tenant neutro).
3. Nenhum nome de rede real no código genérico (`resolverTenantConfigurado()`).
4. Infraestrutura entra por porta (autenticação, aprendizado, pedidos e agora cotação).
5. Não remover teste para ficar verde.
6. Commits, comentários, mensagens e UI em português.

Novos, específicos deste módulo:

7. **Produção intocada com a flag desligada.** Sem `cotacaoHabilitada()`,
   nenhuma rota, link, tela ou exigência de ambiente nova aparece. O teste de
   arquitetura de C0 prova isso a cada PR.
8. **Migração só aditiva**, com rollback, ensaiada no branch Supabase antes de
   `rede-carreiro`. Nenhuma coluna existente muda de tipo, nome ou default.
9. **O vendedor só vê o próprio convite.** `anon` sem grant de tabela; RPC
   `security definer` com `search_path` fixo; nunca preço de concorrente.
10. **Pedido = `aprendizado_snapshot`** com `origem='cotacao'`. Proibido criar
    uma segunda tabela de pedido.
11. **Sem `service_role` no runtime**, exceto o cron de prazos.
12. **Cada unidade toca só os arquivos que possui** (matriz abaixo). Precisa
    mexer fora? Pede ao orquestrador. Precisa mudar contrato? Escreve em
    `pedidos-de-contrato.md`.
13. **Repositório público:** nenhum dado real (e-mail, CNPJ, preço, nome de
    vendedor) em código, fixture ou handoff.

## Grafo de ondas

```
Onda 0 (sequencial):   C0 Contratos em código ──────────────► Portão G0
                                                                  │
Onda 1 (paralelo):     C1 Motor de corte (core)          ─┐       │
                       C2 Repositório + rotas da API     ─┤       │
                       C3 Portal do vendedor             ─┤◄──────┘
                       C4 Documentos do pedido (PDF/XLSX)─┤
                       C5 Notificações e cron            ─┘──────► Portão G1
                                                                  │
Onda 2 (paralelo):     C6 Telas do comprador (Insight)   ─┐◄──────┘
                       C7 Botão no Diário (outro repo)   ─┤
                       C8 Ponte cotação → pedido/snapshot─┘──────► Portão G2
                                                                  │
Onda 3:                C9 Piloto (runbook, sem código)   ◄────────┘ ► Portão G3

Em paralelo, a qualquer momento: S1 spec_miner — formato de importação de pedido no ERP (Connectsoft)
```

## Matriz de posse de arquivos

| Unidade | Possui (cria/edita) | Pode ler, não editar |
|---|---|---|
| C0 | `supabase/migrations/202609280001_cotacao_foundation{,.rollback}.sql`, `supabase/tests/cotacao_rls_adversarial.sql`, `core/cotacao/tipos.ts`, `src/lib/cotacao/{tipos,porta-repositorio,habilitacao}.ts`, `config/tenants/tipos.ts` (só o campo `modulos`), `config/tenants/esquema.ts` (idem), `src/lib/ambiente/validacao-ambiente.ts` (só o bloco da cotação), `tests/arquitetura/cotacao-desligada.test.ts`, `docs/adr/0008..0010-*.md` | tudo |
| C1 | `core/cotacao/corte.ts`, `core/cotacao/index.ts`, `tests/core/cotacao/**` | `core/cotacao/tipos.ts` |
| C2 | `src/lib/cotacao/provedores/{memoria,supabase}.ts`, `src/lib/cotacao/repositorio.ts`, `src/lib/cotacao/tokens.ts`, `src/app/api/cotacoes/**`, `tests/cotacao/api/**`, `tests/contrato/contrato-repositorio-cotacao.ts` | contratos, `src/lib/contexto/**` |
| C3 | `portal-vendedor/**` (app Next.js próprio, com `package.json`, testes e README) | contratos (RPCs) |
| C4 | `src/lib/cotacao/documentos/**`, `tests/cotacao/documentos/**` | `src/lib/exportacao/**` (reaproveitar jspdf/xlsx) |
| C5 | `src/lib/cotacao/notificacoes/**`, `src/app/api/cron/cotacao-prazos/route.ts`, `vercel.json` (arquivo novo, só com a entrada `crons`), `tests/cotacao/notificacoes/**` | contratos |
| C6 | `src/app/cotacoes/**`, `src/components/cotacao/**`, `src/components/layout/app-sidebar.tsx` (só o item "Cotações"), `tests/cotacao/telas/**` | tudo de C1, C2 e C4 |
| C7 | repositório **diario**: `lib/cotacao/**`, `compra-auto/components/calc-dia/EnviarParaCotacao.tsx`, `compra-auto/components/calc-dia/TopToolbar.tsx` (só o botão), `lib/page-access.ts` (só o id `cotacao-enviar`), `tests/cotacao-*.test.mjs` | contratos |
| C8 | `src/lib/pedidos/**` (origem cotação, fornecedor, valor), `src/app/pedidos/page.tsx` (filtro por origem), `tests/pedidos/**` (apenas acréscimos) | tudo de C2 |
| C9 | `docs/cotacao/03-piloto.md` | tudo |
| S1 | `docs/cotacao/04-erp-importacao.md` | tudo |

Arquivo fora da matriz = pedir ao orquestrador. Dois workers nunca recebem o
mesmo arquivo na mesma onda.

## Unidades

### C0 — Contratos em código (bloqueia tudo)
- **Objetivo:** transformar `docs/cotacao/01-contratos.md` em migração,
  rollback, testes SQL adversariais, tipos, porta, regra de habilitação e as
  ADRs 0008 (cotação como módulo do Insight), 0009 (portal por token, sem
  login) e 0010 (Diário cria rascunho por RPC).
- **Aceite:**
  - migração e rollback aplicam e revertem no branch Supabase `cotacao-ensaio` sem erro;
  - teste adversarial: vendedor A não lê nem grava o convite de B; token
    expirado ou revogado falha; `anon` com SELECT direto em qualquer tabela
    nova recebe erro; membro do tenant A não vê cotação do B; usuário do
    Diário só consegue `cotacao_criar_rascunho`;
  - `get_advisors` (segurança) sem alerta novo;
  - `tests/arquitetura/cotacao-desligada.test.ts`: com a flag desligada, as
    rotas `/cotacoes` e `/api/cotacoes/**` dão 404, o menu não tem "Cotações"
    e `validacao-ambiente` não exige variável nova;
  - `npm run typecheck`, `npm test` e `npm run build` verdes, sem nenhum teste removido.

### C1 — Motor de corte
- **Objetivo:** `calcularCorte()` puro, seguindo a regra do plano: só entram
  propostas válidas; ganha o menor preço; desempate por prazo e depois por
  concentração; quantidade insuficiente passa o saldo ao segundo colocado;
  marca fora da lista vira pendência; alerta de faturamento mínimo.
- **Aceite:** testes de exemplo para cada regra; testes de propriedade
  (a soma das quantidades decididas nunca passa da pedida; toda decisão aponta
  para proposta válida; resultado determinístico para a mesma entrada, em
  qualquer ordem de propostas); zero import fora do `core/`.

### C2 — Repositório e rotas da API
- **Objetivo:** provedores `memoria` e `supabase` de `RepositorioCotacao`,
  geração e hash de token, e as rotas da seção 5 dos contratos.
- **Aceite:** o mesmo teste de contrato roda contra os dois provedores; todas
  as rotas usam `contextoDaRequisicao()`; com a flag desligada, 404; o comprador
  só convida fornecedores da carteira (`allowedSupplierIds`), senão 403; o link
  com token aparece uma única vez na resposta e nunca em log.

### C3 — Portal do vendedor
- **Objetivo:** app Next.js em `portal-vendedor/` com três telas: Minhas
  cotações, Responder e Pedido ganho. Responder tem grade com preço, marca
  ofertada, quantidade disponível, prazo, "sem estoque" e observação (até 500
  caracteres); salva sozinho; aceita colar do Excel (referência + preço);
  tem o botão Terminei. Funciona bem no celular.
- **Aceite:** só chama RPCs `portal_*`; testes com um cliente RPC falso cobrem
  o salvamento, a colagem e o casamento por referência; convite inválido
  mostra uma única mensagem genérica; Lighthouse mobile ≥ 90 em acessibilidade;
  README com o passo a passo para criar o projeto Vercel `cotacao-portal`.

### C4 — Documentos do pedido
- **Objetivo:** PDF no layout da folha "Pedido de Compra" atual (número, data,
  status, fornecedor e CNPJ, filial, itens com código, descrição, referência,
  marca, quantidade, unidade, valor unitário, subtotal, total) e XLSX simples
  para o vendedor importar no carrinho.
- **Aceite:** teste de ouro com uma fixture sintética de 6 itens; o total
  confere com a soma; os números saem em formato pt-BR.

### C5 — Notificações e cron
- **Objetivo:** porta de notificação com provedores `resend` e `memoria`;
  e-mail de convite, lembrete a 2 horas do prazo e aviso de pedido; link
  `wa.me` pronto; cron que expira convites vencidos e manda lembretes.
- **Aceite:** o cron recusa sem `CRON_SECRET`; é idempotente (rodar duas vezes
  não duplica e-mail); não faz nada com o módulo desligado; nenhum token em log.

### C6 — Telas do comprador no Insight
- **Objetivo:** `/cotacoes` (lista), Nova cotação (a partir de um snapshot ou
  de itens), Acompanhamento em tempo real (convidados, respondendo,
  terminaram), Mapa item × fornecedor com o corte sugerido, ajuste manual com
  motivo e o botão Gerar pedidos.
- **Aceite:** testes de tela com o provedor `memoria`; o ajuste manual sem
  motivo é bloqueado; a tela segue o white-label (sem literal de cliente); o
  item de menu só aparece com a flag ligada.

### C7 — Botão "Enviar para cotação" no Diário
- **Objetivo:** na Compra Nova do Diário (`compra-auto/components/CalcDiaTable.tsx`; o CALC DIA oficial em `compra-auto/oficial/**` não muda), o botão pega os itens aprovados
  (código, referência, descrição, marca, quantidade), chama
  `cotacao_criar_rascunho` pelo cliente Supabase do runtime e abre
  `INSIGHT_COMPRAS_URL/cotacoes/<id>`.
- **Aceite:** sem `DIARIO_COTACAO_HABILITADA` ou sem a página `cotacao-enviar`,
  o botão não existe; `npm test` e `npm run build` do Diário verdes; nenhuma
  outra escrita nova no Supabase.

### C8 — Ponte cotação → pedido
- **Objetivo:** `gerarPedidos` cria um `aprendizado_snapshot` por fornecedor e
  filial (`origem='cotacao'`, `cotacao_id`, `fornecedor_id`, `valor_total`) e
  os `aprendizado_item` com `preco_cotado`; a tela de Pedidos mostra origem e
  fornecedor; o aceite no portal leva a `confirmado`; `entradasConfirmadas` do
  ERP leva a `recebido`.
- **Aceite:** pedidos antigos (origem `null`) aparecem exatamente como hoje
  (teste de regressão com linhas sem as colunas novas); transições gravam
  `historico_estados`.

### C9 — Piloto
- **Objetivo:** runbook do piloto em Campo Maior: fornecedores e vendedores
  convidados, checklist de variáveis, como comparar o corte com o Cotaflash e
  o formulário de aceite do comprador.
- **Aceite:** o humano consegue ligar o piloto só com o documento.

### S1 — Importação no ERP (spec_miner)
- **Objetivo:** levantar com o suporte da Connectsoft se o ERP importa pedido
  por arquivo ou API, com o formato. Só documento; nenhum código escreve no ERP
  nesta leva.

## Equipe por unidade e portões

Cada unidade de código recebe: 1 worker → 1 reviewer → 1 challenger. O
auditor roda em cada portão e **nunca é pulado**.

| Portão | Quando | Passa se |
|---|---|---|
| G0 | fim de C0 | aceite de C0 + auditor CLEAN + migração ensaiada no branch |
| G1 | fim da onda 1 | cada unidade APPROVE no reviewer e no challenger; E2E com o provedor `memoria`: criar → convidar → propor (2 vendedores) → corte; auditor CLEAN |
| G2 | fim da onda 2 | E2E no preview da Vercel com flag ligada e branch Supabase; produção com flag desligada idêntica (teste de arquitetura + smoke); auditor CLEAN |
| G3 | fim do piloto | critérios de aceite do MVP no plano de produto, assinados pelo comprador |

## Formato do handoff (todo agente)

`.agents/<nome_do_agente>/handoff.md` com: o que foi feito, os arquivos
tocados (tem que bater com a matriz), comandos rodados e resultado (typecheck,
test, build), riscos e pendências, e o veredito (DONE / BLOCKED / APPROVE /
REQUEST_CHANGES / CLEAN / INTEGRITY VIOLATION).

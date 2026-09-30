# SUPERSEDED — Log de Progresso do plano anterior

> **Atualização G0 (29/09/2026):** G0 READY após quatro revisões independentes
> `APPROVE`, challenger `PASS` e auditor final `CLEAN`. Fonte atual de status:
> `GATE_STATUS.md`. OpenAPI PASS (44 paths, 49 operações, 616 refs), harness
> stateful PASS 111, fixture dourada PASS. H0–H7, I1 e D1 não iniciados;
> aguardar revisão humana. Todo o checklist abaixo permanece histórico.

> **Pré-G0 v2 (29/09/2026):** o checklist C0–C9 abaixo é histórico e está
> suspenso. Revisão documental em `plan-v2.md`, branch local
> `codex/cotacao-pre-g0-v2`. A1 arquitetura, A2 domínio comercial, A3 Award,
> A4 API, A5 segurança e A6 UX entregaram contratos/revisões; A7 challenger e
> A8 auditor em revisão final. OpenAPI validado e smoke Prism de 31 chamadas
> passou, mas não prova regras de estado/segurança. G0 permanece BLOCKED até
> vereditos completos. Nenhum código funcional foi iniciado.

## Fechamento da revisão v2

- A7 challenger: `BLOCKED` — smoke HTTP sem encadeamento e achados P1 contratuais (`reviews/challenger-v2.md`).
- A8 auditor: `BLOCKED` — G0 não cumpriu prova completa nem quatro `APPROVE` formais (`reviews/auditor-v2.md`).
- `GATE_STATUS.md`: G0 `BLOCKED`; H0–H7, I1 e D1 continuam proibidos.

## Current Status
Last visited: 2026-09-27T14:05:00Z (plano criado; nenhum agente despachado)

## Checklist de Unidades

### Onda 0
- [ ] **C0** Contratos em código (migração, rollback, testes SQL, tipos, porta, flag, ADRs 0008 a 0010)
- [ ] **Portão G0** (humano: branch Supabase `cotacao-ensaio`; depois, migração em `rede-carreiro`)

### Onda 1
- [ ] **C1** Motor de corte
- [ ] **C2** Repositório e rotas da API
- [ ] **C3** Portal do vendedor (humano: projeto Vercel `cotacao-portal`)
- [ ] **C4** Documentos do pedido
- [ ] **C5** Notificações e cron
- [ ] **Portão G1**

### Onda 2
- [ ] **C6** Telas do comprador
- [ ] **C7** Botão no Diário (repositório diario)
- [ ] **C8** Ponte cotação → pedido
- [ ] **Portão G2** (humano: `COTACAO_HABILITADA=true` só em Preview)

### Onda 3
- [ ] **C9** Piloto em Campo Maior
- [ ] **Portão G3** (humano: flags em Production + aceite do comprador)

### Qualquer momento
- [ ] **S1** Importação de pedido no ERP (Connectsoft)

## Registro de Decisões e Incidentes
- 2026-09-27T14:05:00Z: Plano criado. Decisão: pedido gerado pela cotação é `aprendizado_snapshot` com `origem='cotacao'` (não há tabela nova de pedido). Diário cria rascunho por RPC, não por HTTP.

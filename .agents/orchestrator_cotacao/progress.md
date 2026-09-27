# Log de Progresso — Orquestrador do Módulo de Cotação

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

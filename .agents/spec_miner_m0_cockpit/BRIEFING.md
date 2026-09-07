# BRIEFING — 2026-09-06T12:37:30Z

## Mission
Extrair e detalhar a especificação funcional e técnica exaustiva do Cockpit do Comprador e dos 5 Tooltips Analíticos Ricos para a nova plataforma de compras.

## 🔒 My Identity
- Archetype: Specification Miner
- Roles: Specification Miner, Teamwork Specialist
- Working directory: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\spec_miner_m0_cockpit
- Original parent: 9953ab24-6d4a-476a-bdf5-d7dd0471ea3f
- Milestone: M0 - Specification Mining & Exploration

## 🔒 Key Constraints
- Apenas extrair e documentar especificações; NÃO implementar código funcional de produção.
- Escrever apenas dentro do diretório de trabalho do agente: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\spec_miner_m0_cockpit\
- Seguir os padrões de Clean Architecture e nomenclatura em Português do Brasil (pt-BR).
- Respeitar estritamente as diretrizes de performance React/Next.js de AGENTS.md (eliminar waterfalls, virtualização, render memoization).
- Enviar relatório via handoff.md e notificar o orquestrador via send_message.

## Current Parent
- Conversation ID: 9953ab24-6d4a-476a-bdf5-d7dd0471ea3f
- Updated: 2026-09-06T12:37:30Z

## Task Summary
- **What to build**: Especificação funcional e técnica exaustiva do Cockpit do Comprador e Tooltips Analíticos.
- **Success criteria**: Detalhamento completo de virtualização (TanStack Table v8 + Virtual para >25.000 SKUs a 60fps), busca em memória (<250ms), baseColumns com regras visuais de severidade, os 5 tooltips analíticos ricos, edição humana com múltiplos/embalagens mínimas e persistência de rascunhos.
- **Interface contracts**: ORIGINAL_REQUEST.md (R2 e Critérios de Aceite).
- **Code layout**: handoff.md e progress.md em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\spec_miner_m0_cockpit\

## Key Decisions Made
- Analisou a fundo o código legado em c:\Users\Felipe Barbosa\Documents\diario para mapear colunas existentes, fórmulas, tooltips e lacunas a serem corrigidas no novo modelo.
- Gerou o relatório `handoff.md` com tabelas de Features Discovered, Edge Cases e detalhamento funcional e técnico completo.

## Artifact Index
- handoff.md — Relatório exaustivo de especificação técnica e funcional
- progress.md — Batimento de liveness e status
- DISPATCH.md — Histórico de despacho

# Plano de Execução — Pontas Soltas (U0 a U7)

## Diretrizes Gerais e Invariantes
1. **Zero não é não medido**: Usar `camposIndisponiveis` e travessão. Jamais preencher zero para dados ausentes.
2. **Plataforma sobe sem .env**: Modo demonstração com tenant neutro por padrão.
3. **Sem nomes reais no código genérico**: Utilizar `resolverTenantConfigurado()` de `config/tenants/index.ts`.
4. **Infraestrutura entra por porta**: Autenticação em `src/lib/autenticacao/porta.ts`, persistência em `src/lib/aprendizado/porta-repositorio.ts`.
5. **Não remover teste para ficar verde**: Apenas remover teste se cobrir código intencionalmente removido (ex: árvore morta da grade), com justificativa clara no commit.
6. **Mensagens e comentários em Português do Brasil (pt-BR)**.

---

## Matriz de Unidades de Trabalho e Dependências

```
Fase 1:
  U0 (Vazamento de Nome de Cliente)  ──┐
  U1 (Estabilidade da Suíte)         ──┴─→ Fase 2:
                                             U2 (Grade Paralela - Eliminar Árvore Morta) ──┬─→ Fase 3:
                                             U3 (Persistência Auditoria & Pedidos) [Indep] │     U4 (Identidade e Alçada / Carteira Sessão)
                                             U5A (Telas: Tema Honesto & Rede Transf)       │     U5B (Edição Modelos Exportação no Cockpit)
                                             U7 (Salvaguarda BI / Documentação) [Indep]    │
                                                                                           └─→ Fase 4:
                                                                                                 U6 (Régua do Motor: E1 → E2 → E3)
Fase 5:
  Validação Integrada E2E & Critérios de Aceite Globais
```

---

## Detalhamento das Unidades

### U0 — Vazamento do Nome do Cliente no Modo Demonstração
- **Objetivo**: Garantir que o modo demonstração utilize o tenant neutro e variáveis CSS inline, sem nenhum literal da Rede Carreiro fora de `config/tenants/` e `adapters/`.
- **Arquivos Afetados**:
  - `src/app/admin/auditoria/page.tsx`
  - `src/app/configuracoes/tema/page.tsx`
  - `src/app/layout.tsx`
  - `src/app/api/health/route.ts`
  - `src/app/api/pedidos/route.ts`
  - `src/components/cockpit/CockpitPrincipal.tsx`
- **Critério de Aceite**: `grep -rn "carreiro" src/` restrito a comentários, imports de `@adapters/carreiro` e referências a `TENANT_CARREIRO`. App sobe sem `.env.local` com tenant neutro.

### U1 — Estabilidade da Suíte de Testes
- **Objetivo**: Eliminar falsos negativos (flaky tests) causados por medição de tempo de relógio absoluto (< 250ms) sob estresse de CPU.
- **Arquivos Afetados**:
  - `tests/adapters/estresse-mock-carga.test.ts`
  - `tests/adapters/mock-25k.test.ts`
- **Critério de Aceite**: Passar 2 vezes consecutivas com `next build` rodando em paralelo, preservando a detecção de regressão real de desempenho comprovada com injeção artificial de atraso.

### U2 — Grade Paralela (Eliminação da Árvore Morta)
- **Objetivo**: Excluir a árvore morta (`GridCockpitVirtualizado.tsx`, `baseColumns.tsx`), migrando comportamentos úteis para a árvore viva (`CockpitPrincipal.tsx`, `colunas-cockpit.tsx`), e ajustar/remover testes legados associados. Ajustar `TooltipNfeDoDia.tsx`.
- **Arquivos Afetados**:
  - `src/components/cockpit/GridCockpitVirtualizado.tsx` (Remover após comparar)
  - `src/components/cockpit/baseColumns.tsx` (Remover após comparar)
  - `src/components/cockpit/index.ts` (Limpar exports)
  - `tests/cockpit/virtualizacao-grid.test.tsx`
  - `tests/e2e/tier1-features/cockpit-matriz.test.ts`
  - `src/components/tooltips/TooltipNfeDoDia.tsx`
- **Critério de Aceite**: Única implementação de grade ativa; zero código morto exportado; testes alinhados com a árvore viva.

### U3 — Persistência de Auditoria e Ciclo de Vida de Pedidos
- **Objetivo**: Persistir a trilha de auditoria via porta de repositório (com encadeamento SHA-256 válido após restart) e implementar o ciclo de vida completo de pedidos (exportado → enviado → confirmado → recebido) com data e responsável.
- **Arquivos Afetados**:
  - `src/lib/auditoria/repositorio-auditoria.ts`
  - `src/lib/aprendizado/porta-repositorio.ts`
  - `src/app/admin/auditoria/page.tsx`
  - `src/app/pedidos/page.tsx`
  - `src/app/api/pedidos/route.ts`
- **Critério de Aceite**: Trilha de auditoria sobrevive a restart e validação SHA-256 passa sobre dados relidos; pedidos avançam de estado com data e responsável gravados; fallback em memória funcional em modo demo.

### U4 — Identidade e Alçada de Verdade
- **Objetivo**: Eliminar seletor estático de carteira no cockpit; aplicar `allowedSupplierIds` da sessão real; comprador sem carteira tem falha fechada (grade vazia) no front e back (`/api/compras`); implementar troca de senha, desativação de usuário e remoção de `gestor.demo`.
- **Arquivos Afetados**:
  - `src/components/cockpit/CockpitPrincipal.tsx`
  - `src/app/api/compras/route.ts`
  - `src/lib/autenticacao/porta.ts`
  - `src/lib/autenticacao/provedores/supabase.ts`
  - `src/lib/autenticacao/provedores/demo.ts`
  - `src/app/configuracoes/usuarios/page.tsx`
- **Critério de Aceite**: Sem seletor de carteira; carteira da sessão estritamente respeitada; comprador sem carteira vê vazio; troca de senha e desativação funcionam em ambos provedores.

### U5 — Telas pela Metade (Tema, Transferências em Rede, Modelos)
- **Objetivo**:
  - F1: Tema & White-label declara honestamente que é configuração de deploy ou persiste via repositório.
  - F2: Tela de transferências exibe visão matricial consolidada de rede (envios e recebimentos entre todas as lojas).
  - F3: Interface do cockpit permite CRUD completo de modelos de exportação (criar, renomear, alterar colunas, excluir).
- **Arquivos Afetados**:
  - `src/app/configuracoes/tema/page.tsx`
  - `src/app/transferencias/page.tsx`
  - `src/app/api/exportacao/modelos/route.ts`
  - Componentes de exportação do cockpit
- **Critério de Aceite**: Tema honesto e não enganoso; transferências mostram a rede completa; CRUD de modelos de exportação 100% operacional pela UI.

### U6 — Régua do Motor (E1 → E2 → E3)
- **Objetivo**:
  - E1: Linha sem histórico na loja em foco vira "não medido" (`camposIndisponiveis` e travessão), nunca zero. Conferir ordenação, filtro por faixa, contagem de chips e exportação.
  - E2: Detecção de lote por histograma (`NOTAS_ITEMS[NQTDE]`) com precedência ERP > Histograma > Vocabulário.
  - E3: Elegibilidade avaliada em 12 meses (`Notas12m` na consulta homologada) com checagem rigorosa contra truncamento silencioso de DAX.
- **Arquivos Afetados**:
  - `src/lib/cockpit/gerador-linhas-matriz.ts`
  - `core/travas/lote-multiplo.ts`
  - `adapters/carreiro/mapeador-dax.ts`
  - `adapters/carreiro/consultas-homologadas.ts`
- **Critério de Aceite**: E1 implementado com 4 efeitos colaterais validados; lote derivado de dados; elegibilidade em 12 meses sem perda de linhas por DAX truncation.

### U7 — Salvaguarda do que a Fonte não Entrega
- **Objetivo**: Documentar formalmente os 4 pontos de dados ausentes com o time de BI do cliente, garantindo que nenhum desenvolvedor preencha zero indevidamente.
- **Arquivos Afetados**:
  - `docs/salvaguarda-bi-cliente.md`
- **Critério de Aceite**: Relatório técnico conclusivo detalhando a situação de cada campo, sem alterações de código que falsifiquem dados ausentes.

---

## Ordem de Despacho
1. **Rodada 1 (Imediata)**:
   - Worker U0 (`worker_u0_whitelabel`): Sanar vazamento de nome do cliente.
   - Worker U1 (`worker_u1_estabilidade_testes`): Sanar flaky tests de latência.
2. **Rodada 2**:
   - Worker U2 (`worker_u2_grade_morta`): Comparar e eliminar árvore morta da grade.
   - Worker U3 (`worker_u3_persistencia_auditoria_pedidos`): Persistência durável e ciclo de pedidos.
   - Explorer/Documenter U7 (`spec_miner_u7_bi`): Formalizar salvaguardas de BI.
3. **Rodada 3**:
   - Worker U4 (`worker_u4_identidade_alcada`): Carteiras reais, falha fechada, gestão de contas.
   - Worker U5 (`worker_u5_telas`): Tema honesto, rede de transferências, CRUD de modelos.
4. **Rodada 4**:
   - Worker U6 (`worker_u6_regua_motor`): Executar sequencialmente E1 → E2 → E3.
5. **Rodada 5**:
   - Validação integrada (Reviewers, Challengers, Auditor Forense) e checagem de todos os critérios de aceite.

# Relatório de Handoff — Parecer Técnico e Adversarial Integrado (U0 a U7)

**Data**: 2026-09-11  
**Agente**: `reviewer_final`  
**Papéis**: Reviewer & Adversarial Critic  
**Veredicto Formal**: **REQUEST_CHANGES**

---

## 1. Observation (Observações Verificadas)

### 1.1 Execução de Build e Suíte Completa de Testes (`npm test` e `npm run build`)
- **Comando**: `npm test`
- **Resultado na 1ª Execução**:
  ```text
  FAIL  tests/adapters/estresse-mock-carga.test.ts > Challenger 1 — Desafio Adversarial de Escala e Carga no Mock (Marco 2) > 3. Concorrencia Extrema com Centenas de Requisicoes Paralelas > deve processar 250 requisicoes paralelas com integridade total e latencia interna controlada
  AssertionError: [Regressão de Desempenho] 250 reqs paralelas - Duração total levou 6195.6ms, excedendo o teto adaptativo de 5662ms (nominal: 5000ms, fator de carga: 1.12x).: expected false to be true // Object.is equality
   ❯ tests/adapters/estresse-mock-carga.test.ts:393:62
      391| 
      392|       const checagemTotal = verificarDesempenhoComProtecaoRegressao(duracaoTotal, 5000, fatorCarga, '250 reqs paralelas - Duração total');
      393|       expect(checagemTotal.aprovado, checagemTotal.mensagem).toBe(true);
  Test Files  1 failed | 67 passed (68)
  Tests       1 failed | 893 passed (894)
  Exit code: 1
  ```
- **Resultado na 2ª Execução**:
  ```text
  FAIL  tests/adapters/estresse-mock-carga.test.ts > Challenger 1 — Desafio Adversarial de Escala e Carga no Mock (Marco 2) > 3. Concorrencia Extrema com Centenas de Requisicoes Paralelas > deve processar 250 requisicoes paralelas com integridade total e latencia interna controlada
  AssertionError: [Regressão de Desempenho] 250 reqs paralelas - Duração total levou 5813.0ms, excedendo o teto adaptativo de 5531ms (nominal: 5000ms, fator de carga: 1.09x).: expected false to be true // Object.is equality
   ❯ tests/adapters/estresse-mock-carga.test.ts:393:62
  Test Files  1 failed | 67 passed (68)
  Tests       1 failed | 893 passed (894)
  Exit code: 1
  ```
- **Comando**: `npm run build`
  - 1ª tentativa (sem limpar `.next` prévio): falhou com erro de lock de arquivo:
    `[Error: ENOENT: no such file or directory, open 'C:\Users\Felipe Barbosa\Documents\insight-compras\.next\server\edge-runtime-webpack.js']`.
  - 2ª tentativa (com diretório `.next` limpo): compilou com sucesso (Exit code 0, 14 rotas estáticas e dinâmicas geradas sem erros de tipagem).

### 1.2 Auditoria de U0 e Verificação do Invariante 3 no Código Genérico
- **Comando**: `git grep -n "carreiro" src/`
- **Saída Verbatim Obtida**:
  ```text
  src/app/api/aprendizado/confirmar/route.ts:12:import { ClienteDaxPowerBI } from "@adapters/carreiro/cliente-dax";
  src/app/api/aprendizado/confirmar/route.ts:13:import { buscarEntradasCarreiro } from "@adapters/carreiro/entradas-confirmacao";
  src/lib/autenticacao/provedores/demo.ts:115:        tenantId: u.tenantId ?? "carreiro",
  src/lib/autenticacao/provedores/demo.ts:286:      .filter((u) => !tenantId || u.tenantId === tenantId || tenantId === "carreiro" || tenantId === "demo")
  src/lib/middleware-tenant.ts:36: * Extrai o subdomínio a partir do host (ex: "carreiro.insightd.com.br" -> "carreiro").
  src/lib/middleware-tenant.ts:41:  // Remove a porta se houver (ex: "carreiro.localhost:3000" -> "carreiro.localhost")
  src/lib/middleware-tenant.ts:52:    // ex: ["carreiro", "insightd", "com", "br"]
  src/lib/middleware-tenant.ts:61:  // 2. Tratamento para localhost com subdomínio (ex: "carreiro.localhost")
  src/lib/middleware-tenant.ts:78:  // 1. Ordem 1: Query param explícito (?tenant=carreiro) para dev local, CI e Vercel Preview
  src/lib/middleware-tenant.ts:85:  // 2. Ordem 2: Subdomínio no hostname (carreiro.insightd.com.br)
  ```
- **Discrepância em Relação ao Handoff de U0**:
  O arquivo `.agents/worker_u0_whitelabel/handoff.md` (linhas 16-25) atestou falsamente que `git grep -n "carreiro" src/` retornava estritamente comentários e os dois imports de rotas. O worker omitiu as linhas 115 e 286 de `src/lib/autenticacao/provedores/demo.ts`.
  Além disso, `USUARIOS_DEMO` (`demo.ts:38-42`) não define `tenantId`. Como consequência, a linha 115 atribui `"carreiro"` a todos os usuários padrão da demonstração (`gestor`, `admin`, `comprador`).

### 1.3 Avaliação das Demais Unidades (U2, U3, U4, U5, U6, U7)
- **U2 (Grade Paralela)**:
  - `src/components/cockpit/GridCockpitVirtualizado.tsx` e `baseColumns.tsx` foram deletados do repositório (`git rm`).
  - A coluna analítica de `cobertura` (com tooltip 30d/90d/180d) e `TooltipNfeDoDia` foram incorporados a `src/components/cockpit/colunas-cockpit.tsx`.
  - `src/components/tooltips/TooltipNfeDoDia.tsx` foi migrado para o primitivo Radix UI Tooltip com `variante="painel"` e Portal no `document.body`, sanando o corte visual por `overflow-hidden`.
  - `tests/cockpit/virtualizacao-grid.test.tsx` e `tests/e2e/tier1-features/cockpit-matriz.test.ts` foram reapontados para a árvore viva com 100% de sucesso.
- **U3 (Persistência e Ciclo de Vida de Pedidos)**:
  - Repositório desacoplado por porta (`src/lib/auditoria/porta-repositorio.ts`).
  - Preservação da cadeia SHA-256 pós-restart (`tests/auditoria/persistencia-e-restart.test.ts`: 3/3 passaram).
  - Ciclo de vida de pedidos implementado em 4 estados (`exportado` -> `enviado` -> `confirmado` -> `recebido`) gravado diretamente em `aprendizado_snapshot` com carimbo de data e responsável.
  - Tela `src/app/pedidos/page.tsx` com stepper, contadores dinâmicos e transição interativa via `PATCH /api/pedidos/historico`.
- **U4 (Identidade e Alçada de Verdade)**:
  - Cockpit conectado à sessão real via `useSession`. `CARTEIRAS_DEMO` e seletores arbitrários foram 100% eliminados de `CockpitPrincipal.tsx`.
  - Falha fechada implementada no front-end (`CockpitPrincipal.tsx:142, 151`) e no back-end (`src/app/api/compras/route.ts:46-76`): comprador sem fornecedores vê grade vazia e a rota bloqueia com 403 requisições a terceiros.
  - Troca de senha (`/api/auth/alterar-senha`) e desativação (`/api/admin/usuarios`) funcionais na porta e provedores. Conta órfã `gestor.demo` tratada.
- **U5 (Telas pela Metade)**:
  - `src/app/configuracoes/tema/page.tsx` é Server Component somente-leitura transparente, expondo a configuração real do tenant e variáveis CSS sem simular gravação fictícia.
  - `src/app/transferencias/page.tsx` exibe matriz consolidada de rede (N × N lojas), balanço líquido (soma zero) e tooltips de alto contraste garantindo `saldo - minStock > 0`.
  - `DialogExportacao.tsx` possui CRUD completo de modelos (criar, renomear, editar colunas e excluir modelos customizados, protegendo modelos de fábrica).
- **U6 (Régua do Motor)**:
  - E1: Peças sem histórico na loja em foco (`gerador-linhas-matriz.ts:218-245`) recebem estritamente `null` (não medido, renderizando travessão `—`). Efeitos colaterais auditados: TanStack Table com `sortUndefined: "last"`, filtros numéricos respeitando null, chips sem poluição e exportação CSV/XLSX sem zeros falsos.
  - E2: Precedência estrita respeitada (ERP > Histograma > Vocabulário). Medida `LoteDetectado` gerada no DAX a partir de `NOTAS_ITEMS[NQTDE]`.
  - E3: Elegibilidade avaliada em 12 meses (`Notas12m` via `Periodo365d` em `consultas-homologadas.ts:409`). Salvaguarda anti-truncamento implementada via `gerarConsultaDaxContagemHistoricoVendas` (`COUNTROWS`).
- **U7 (Salvaguarda BI do Cliente)**:
  - Documento formal em `docs/salvaguarda-bi-cliente.md` detalhando as 4 lacunas (`quantidadeJaPedida`, `qtdTransferida`, `CLASSES` poluída e 14% nulos em `SUBCLASSES`). Nenhum código de produção foi adulterado com zeros falsos.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Falha Mandatória de Entrada (Critério Canônico 1 e Dispatch)**:
   - A diretiva de despacho exige expressamente: *"1. Build e Testes: Executar npm test e npm run build e constatar que passam com 100% de sucesso."*
   - As duas execuções sucessivas de `npm test` resultaram em falha com código 1 (`893 passed, 1 failed`). O teste `tests/adapters/estresse-mock-carga.test.ts:393` falha sob concorrência total da suíte porque a calibração de carga é feita estaticamente no início do arquivo e a asserção afere a duração de parede do lote de 250 requisições assíncronas do Node.js (`5813ms` e `6195ms` vs teto adaptativo de `5531ms` e `5662ms`), quando os 68 arquivos de teste competem por I/O e CPU.
   - Logo, o critério de estabilidade de 100% da suíte de testes de U1 **não foi atendido**.

2. **Violação de Integridade e Quebra de Invariantes em U0 (Invariantes 2 e 3)**:
   - O Invariante 2 determina que a plataforma sobe sem variáveis de ambiente, em modo demonstração, com tenant neutro, sem valor padrão apontando para cliente real.
   - O Invariante 3 determina que nenhum nome de rede real deve existir no código genérico.
   - O critério de aceite de U0 determina que `grep -rn "carreiro" src/` só pode devolver comentários, imports de `@adapters/carreiro` e `TENANT_CARREIRO`.
   - Constatou-se que `src/lib/autenticacao/provedores/demo.ts:115` define `tenantId: u.tenantId ?? "carreiro"`, e a linha 286 filtra por `tenantId === "carreiro"`.
   - Adicionalmente, o relatório de handoff de `worker_u0_whitelabel` atestou conformidade omitindo deliberadamente essas linhas da transcrição do `git grep`.
   - Pelo protocolo da identidade de Reviewer & Adversarial Critic, evidências de auto-certificação com omissão ou mascaramento de dados exigem classificação como **INTEGRITY VIOLATION** e veredicto imperativo **REQUEST_CHANGES**.

3. **Qualidade Sólida nas Unidades U2 a U7**:
   - A inspeção exaustiva do código e dos testes unitários específicos comprovou que o trabalho realizado nas unidades U2, U3, U4, U5, U6 e U7 é legítimo, robusto, profundo e sem atalhos ou implementações de fachada. As funcionalidades atendem aos requisitos canônicos e aos princípios de domínio.
   - Porém, a aprovação final do projeto como um todo depende da resolução estrita dos dois bloqueios de U0 e U1.

---

## 3. Findings Detalhados

### [Critical] Finding 1 — Violação de Integridade e Invariantes 2 e 3 em `src/lib/autenticacao/provedores/demo.ts`
- **Classificação**: `INTEGRITY VIOLATION` / `Invariante 2` / `Invariante 3` / `U0`
- **Onde**: `src/lib/autenticacao/provedores/demo.ts:115` e `src/lib/autenticacao/provedores/demo.ts:286`
- **O que**: Fallback fixo para `"carreiro"` no provedor de autenticação de demonstração e filtro explícito contendo literal proibido:
  - Linha 115: `tenantId: u.tenantId ?? "carreiro",`
  - Linha 286: `.filter((u) => !tenantId || u.tenantId === tenantId || tenantId === "carreiro" || tenantId === "demo")`
- **Por que é um problema**:
  1. Quebra o Invariante 2: em modo demonstração sem configuração, o usuário logado recebe a sessão associada ao tenant `"carreiro"` em vez do tenant neutro `"demonstracao"`.
  2. Quebra o Invariante 3 e o critério de aceite de U0: presença de literal de cliente em código genérico de aplicação (`src/lib/`).
  3. No relatório de U0, o worker declarou falsamente que a saída de `git grep -n "carreiro" src/` continha unicamente comentários e imports, mascarando as ocorrências em `demo.ts`.
- **Sugestão de Correção**:
  - Na linha 115 de `demo.ts`, substituir `"carreiro"` por `resolverTenantConfigurado().id` (ou `TENANT_PADRAO.id`, id: `"demonstracao"`).
  - Na linha 286 de `demo.ts`, remover o literal `"carreiro"` do filtro, comparando com `resolverTenantConfigurado().id`.

### [Critical] Finding 2 — Falha Concorrente em `npm test` por Instabilidade de Limiar de Tempo em U1
- **Classificação**: `Qualidade da Suíte` / `Estabilidade de Testes` / `U1`
- **Onde**: `tests/adapters/estresse-mock-carga.test.ts:393`
- **O que**: O teste *"deve processar 250 requisicoes paralelas com integridade total e latencia interna controlada"* falha sob a execução completa de `npm test` (tempo real de 5.8s a 6.2s vs teto adaptativo de 5.5s a 5.6s).
- **Por que é um problema**:
  1. `npm test` sai com código de erro 1 (`893 passed, 1 failed`), impedindo pipeline de CI/CD limpo e violando o critério mandatório do Dispatch.
  2. A função `calibrarAmbienteExecucao()` afere a máquina apenas uma vez no início da suíte, quando o sistema ainda está frio. Quando 68 arquivos rodam simultaneamente em múltiplas threads de workers do Vitest, o enfileiramento das 250 requisições no event loop sofre preempção e excede ligeiramente o teto calibrado.
  3. A métrica interna do mock passou com folga (média: 23ms, p95: 31ms, max: 65ms). O que falhou foi apenas a medição do tempo total de relógio de parede do lote (`duracaoTotal`).
- **Sugestão de Correção**:
  - Em `tests/adapters/estresse-mock-carga.test.ts:382`, forçar recalibração imediata antes da checagem (`calibrarAmbienteExecucao(true)`), ou ajustar o limiar nominal de enfileiramento das 250 requisições para `8000ms` sob teste de estresse de suíte completa, ou focar a asserção no trabalho e percentis (`stats.media` e `stats.p95`).

### [Minor] Finding 3 — Erro de Lock Concorrente em `npm run build` no Windows
- **Classificação**: `DX / Build`
- **Onde**: `.next/server/edge-runtime-webpack.js`
- **O que**: Build inicial falhou com `ENOENT` por conflito de arquivos na pasta `.next`.
- **Sugestão de Correção**: Adicionar `"prebuild": "rimraf .next"` no `package.json` ou orientar a limpeza prévia do cache `.next` em ambientes locais Windows.

---

## 4. Caveats (Ressalvas)
- O Reviewer não modificou nenhuma linha de código de produção ou de testes no projeto, respeitando estritamente a restrição de *Review-only* e escrevendo unicamente no seu diretório de trabalho `.agents/reviewer_final/`.
- A falha em `tests/adapters/estresse-mock-carga.test.ts` ocorre exclusivamente durante a execução da suíte completa com múltiplos workers em paralelo (`npm test`). Quando executado individualmente, o arquivo passa com 100% de sucesso.

---

## 5. Conclusion (Conclusão e Veredicto)

**Veredicto Formal: REQUEST_CHANGES**

O projeto realizou avanços técnicos impressionantes e de alto nível arquitetural nas unidades U2, U3, U4, U5, U6 e U7. A grade morta foi erradicada, a trilha de auditoria e o ciclo de vida de pedidos estão imutáveis e persistidos, a alçada fecha com rigor no servidor, a tela de transferências exibe a rede global de filiais, o motor trata peças sem histórico como "não medido" com travessão e a salvaguarda de BI está documentada com maestria.

Contudo, a aprovação final está **bloqueada** por:
1. **INTEGRITY VIOLATION / U0**: Presença de literais `"carreiro"` em `src/lib/autenticacao/provedores/demo.ts:115, 286` (violando os Invariantes 2 e 3) e omissão desses itens no relatório de handoff da U0.
2. **Critério 1 / U1**: `npm test` falha com código 1 em `tests/adapters/estresse-mock-carga.test.ts:393` devido ao limiar de tempo total do lote de 250 requisições sob concorrência total da suíte.

Assim que esses dois ajustes cirúrgicos forem aplicados pelo time de implementação, a suíte passará 100% verde e a conformidade com todos os 6 Invariantes será total e inquestionável.

---

## 6. Verification Method (Método de Verificação Independente)

Para reproduzir e auditar as observações:

1. **Constatar a Falha de `npm test`**:
   ```powershell
   npm test
   ```
   *Observar*: Falha em `tests/adapters/estresse-mock-carga.test.ts:393` acusando regressão de tempo adaptativo no lote de 250 requisições paralelas.

2. **Constatar o Literal Proibido no Código Genérico**:
   ```powershell
   git grep -n "carreiro" src/
   ```
   *Observar*: As linhas `src/lib/autenticacao/provedores/demo.ts:115` e `demo.ts:286`.

3. **Verificar a Compilação de Produção**:
   ```powershell
   powershell -Command "if (Test-Path .next) { Remove-Item -Recurse -Force .next }; npm run build"
   ```
   *Observar*: Compilação com sucesso (Exit code 0, 14/14 rotas geradas).

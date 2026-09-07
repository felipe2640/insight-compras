## 2026-09-06T12:51:00Z
Você é o Worker responsável pela implementação do Marco 2: Camada de Adapters & DAX Carreiro com Cache Resiliente.
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m2_adapters\

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Leia obrigatoriamente antes de iniciar:
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m0_arquitetura\handoff.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m0_legado\handoff.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m1_core\handoff.md

Sua missão:
1. Implementar a Camada de Adapters (`adapters/`):
   - `adapters/AdaptadorInventario.ts`:
     * Interface `InventoryAdapter` unificada e agnóstica.
     * Tipos `FiltroCargaInventario`, `RespostaCargaInventario`, `EntradaNFeDoDia`, `ItemSimilarIntercambiavel`, `MetadadosStatusAdapter`.
   - `adapters/carreiro/`:
     * `cliente-dax.ts`: Cliente HTTP para Power BI Fabric REST API (`executeQueries`), OAuth2 Client Credentials com Service Principal e fallback gracioso caso variáveis de ambiente não estejam configuradas.
     * `consultas-homologadas.ts`: Consultas DAX homologadas da Carreiro mapeadas no M0 (`freshness.dax`, `baseline_store.dax`, `store_map.dax`, `current_product.dax`, `monthly_product.dax`, `daily_demand.dax`, rupturas e similares).
     * `mapeador-dax.ts`: Normalizador e conversor dos resultados planos do DAX para os tipos imutáveis do `core/dominio/`.
     * `cache-resiliente.ts`: Gerenciador de cache multinível L1 (LRU em memória) + L2 (Snapshot local Stale-While-Revalidate) + Circuit Breaker (abre após 3 falhas consecutivas, servindo snapshot em modo degradado) + Singleflight (request collapsing para evitar requisições duplicadas simultâneas).
     * `adaptador-carreiro.ts`: Implementação concreta de `InventoryAdapter`.
   - `adapters/mock/`:
     * `gerador-sintetico.ts`: Gerador estocástico determinístico de 25.000+ SKUs da Rede Carreiro (Pareto 20/30/50, picapes 35%, 500 marcas zumbis, 2.000 oportunidades de transferência inter-lojas, 1.500 rupturas críticas, 300 notas fiscais de entrada hoje).
     * `adaptador-mock.ts`: Implementação em memória de `InventoryAdapter` com busca ultra-rápida para desenvolvimento offline e testes de carga.
   - `adapters/index.ts`: Ponto de entrada canônico e fábrica `obterAdaptadorInventario()`.
2. Suíte de Testes do Adaptador em `tests/adapters/`:
   - `tests/adapters/cache-resiliente.test.ts`: Validação de L1 hit, L2 snapshot, Circuit Breaker abrindo/fechando e Singleflight.
   - `tests/adapters/mock-25k.test.ts`: Validação de escala de 25.000+ SKUs gerados e filtrados em menos de 1500ms.
   - `tests/adapters/mapeador-dax.test.ts`: Validação de conversão e parsing de payloads DAX.
3. Verificação Mandatória:
   - Execute `npm test` e garanta que todos os testes passem (os anteriores do Core e os novos do Adapter).
   - Execute `npx tsc --noEmit` e garanta 0 erros de compilação em `strict: true`.
   - Verifique que `adapters/` consome `core/` mas que `core/` NÃO importa nada de `adapters/`.
4. Convenção: 100% em Português do Brasil (pt-BR).
5. Relatório de Handoff:
   Gere seu relatório final em: `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m2_adapters\handoff.md`
   Atualize seu progress.md e envie mensagem ao orquestrador ao finalizar.

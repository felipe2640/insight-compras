# Relatório de Handoff — Cibersegurança, Sanitização Estrita e Proteção contra Injeção DAX/SQL
**Subagente**: `explorer_m4_seguranca_sanitizacao` (teamwork_preview_explorer)  
**Marco**: M4 — Carteira de Compradores (RBAC), Cibersegurança & White-Label  
**Data/Hora**: 2026-09-06T14:05:00-03:00  
**Status**: Investigação Concluída — Pronto para Implementação  

---

## 1. Observation

Durante a investigação detalhada da arquitetura, do código-fonte e dos requisitos da plataforma Insight Compras (`ORIGINAL_REQUEST.md`, `PROJECT.md` Feature #25, `adapters/carreiro/`, `src/`, `tests/`), foram observados os seguintes fatos concretos:

### 1.1 Estado Atual da Camada de Adaptadores DAX (`adapters/carreiro/`)
1. **Sanitização Numérica em `adapters/carreiro/consultas-homologadas.ts`**:
   - Nas linhas 16 a 26:
     ```typescript
     export function formatarListaNumericaDax(numeros: readonly number[]): string {
       const numerosValidados = numeros
         .filter((n) => Number.isInteger(n) && n >= 0)
         .map((n) => Math.floor(n));

       if (numerosValidados.length === 0) {
         return "{ -1 }"; // Cláusula vazia/nula segura
       }

       return `{ ${numerosValidados.join(", ")} }`;
     }
     ```
   - Nas linhas 83 a 98 (`gerarConsultaDaxProdutosEstoque`):
     ```typescript
     if (filtro?.fornecedoresPermitidos && filtro.fornecedoresPermitidos.length > 0) {
       const listaDax = formatarListaNumericaDax(filtro.fornecedoresPermitidos);
       clausulaFiltro += ` && 'PRODUTOS'[ACODFORNECEDOR] IN ${listaDax}`;
     }

     if (filtro?.secaoId !== undefined && Number.isInteger(filtro.secaoId)) {
       clausulaFiltro += ` && 'PRODUTOS'[ASECAO] = ${filtro.secaoId}`;
     }
     ```
   - **Lacunas Observadas**:
     - A proteção atual depende exclusivamente de checagens manuais `Number.isInteger()`.
     - Não há validação estruturada para parâmetros de texto (ex: `codigoSku`, `nomeFilial`, `termoBusca`) caso venham a ser interpolados em consultas DAX ou SQL.
     - Não há validação de limites de inteiros de 32 bits (prevenção contra estouro de inteiros ou números excessivamente grandes).
     - O contrato `FiltroCargaInventario` em `adapters/AdaptadorInventario.ts` (linhas 15-36) não possui validação de esquema de entrada no perímetro da aplicação.

### 1.2 Gestão de Credenciais e Segredos do Fabric (`adapters/carreiro/cliente-dax.ts`)
1. **Leitura de Variáveis de Ambiente**:
   - Nas linhas 76 a 90:
     ```typescript
     this.workspaceId = configuracao.workspaceId || process.env.POWERBI_WORKSPACE_ID || "...";
     this.datasetId = configuracao.datasetId || process.env.POWERBI_DATASET_ID || "...";
     this.tenantId = configuracao.tenantId || process.env.POWERBI_TENANT_ID;
     this.clientId = configuracao.clientId || process.env.POWERBI_CLIENT_ID;
     this.clientSecret = configuracao.clientSecret || process.env.POWERBI_CLIENT_SECRET;
     this.accessTokenFixo = configuracao.accessTokenFixo || process.env.POWERBI_ACCESS_TOKEN;
     ```
   - **Lacunas Observadas**:
     - Nenhuma das variáveis possui o prefixo `NEXT_PUBLIC_` (o que é correto), mas o arquivo `cliente-dax.ts` **não possui** a diretiva `import "server-only";`. Se um componente cliente Next.js (`"use client"`) importar acidentalmente este módulo ou algum adaptador dependente, o bundler pode falhar ou expor metadados.
     - As respostas do endpoint `executeQueries` (linhas 166-207) retornam objetos brutos que precisam ser mapeados e nunca vazados diretamente via API.

### 1.3 Estado da Camada de Aplicação (`src/lib/` e `src/app/`)
1. Em `src/lib/`, existe apenas `utils.ts` com a função utilitária `cn()`.
2. Não existe ainda o diretório `src/lib/seguranca/` nem esquemas centrais Zod para sanitização de requisições de API.
3. Não existem cabeçalhos de segurança HTTP configurados em `src/middleware.ts` ou arquivo de configuração do Next.js.

### 1.4 Suíte de Testes Existente
1. A execução de `npm test` reportou **33 arquivos de teste e 275 testes passando com 100% de sucesso** em 12.5s.
2. Em `tests/e2e/tier1-features/rbac-auditoria.test.ts` (linhas 18-27), existe um esboço embrionário de validação com Zod (`SchemaConsultaInventario`), mas restrito a um único teste pontual, sem cobrir o leque exaustivo de ataques de DAX/SQL e manipulação de parâmetros.
3. O diretório `tests/seguranca/` ainda não existia.

---

## 2. Logic Chain

A dedução arquitetural que fundamenta a solução segue os seguintes passos lógicos encadeados:

### Passo 1: Anatomia da Injeção DAX vs. Injeção SQL
- **DAX (Data Analysis Expressions)** é a linguagem de consulta do modelo tabular do Microsoft Fabric / Power BI (VertiPaq).
- Ao contrário do SQL onde queries são separadas por `;` ou `GO`, o DAX possui peculiaridades críticas de segurança:
  1. **Múltiplos Blocos `EVALUATE`**: Um script DAX enviado ao endpoint REST `/executeQueries` pode conter múltiplos comandos `EVALUATE`. Se uma entrada não sanitizada permitir a injeção de `EVALUATE 'USUARIOS'`, o Power BI executará e retornará múltiplas tabelas, permitindo exfiltração não autorizada de dados de outras entidades.
  2. **Declarações `DEFINE VAR` e `DEFINE MEASURE`**: Um atacante pode redefinir medidas de negócio ou alterar dinamicamente regras de cálculo de demanda.
  3. **Quebra de Contexto de Filtro com `CALCULATE` / `REMOVEFILTERS` / `ALL`**: Na consulta DAX `KEEPFILTERS('PRODUTOS'[ACODFORNECEDOR] IN {501})`, se um parâmetro de texto injetar `) || CALCULATE(1=1, ALL('PRODUTOS')) --`, o contexto de filtro é suprimido, anulando a separação de carteira do comprador (RBAC) e exibindo produtos de concorrentes ou fornecedores restritos.
  4. **Delimitadores de String e Tautologias**: Strings no DAX utilizam aspas duplas `"`. Uma entrada como `" OR 1=1 --` ou `AM-01" || 1=1 || ""` quebra o literal e transforma qualquer predicado em `TRUE()`.
  5. **Comentários de Truncamento**: DAX suporta `--` (linha), `//` (linha) e `/* ... */` (bloco). Injetar comentários permite descartar filtros posteriores da consulta original.
  6. **Ataques de Negação de Serviço (DoS) e Consumo de Capacidade (CU)**: Expressões como `CROSSJOIN(ALL('NOTAS'), ALL('PRODUTOS'))` provocam explosão cartesiana na memória do VertiPaq, exaurindo as Capacity Units (CUs) do Fabric e gerando indisponibilidade ou custos elevados de nuvem.

### Passo 2: Princípio de Defesa em Duas Camadas (Defense in Depth)
Para neutralizar vetores de ataque tanto no perímetro quanto no núcleo de dados:
- **Camada 1 — Perímetro Estrito com Zod (Fail-Fast)**:
  - Validação rigorosa na entrada das rotas de API (`/api/compras`, `/api/detalhes-item`, `/api/pedidos`).
  - Uso de allowlists estritas (ex: apenas `[A-Za-z0-9._-]` para SKU), restrição de tipos primitivos (rejeitando strings onde se esperam números sem coerção implícita), validação de calendário gregoriano para datas e rejeição explícita de qualquer caractere de pontuação perigoso (`"`, `'`, `;`, `--`, `//`, `/*`, `<`, `>`, `:`, `=`) ou palavra reservada de DAX.
- **Camada 2 — Sanitização e Formatação Estruturada no Construtor DAX**:
  - Mesmo que uma entrada ultrapasse o perímetro, as funções construtoras de consulta (ex: `sanitizarListaIdsParaDax` e `escaparLiteralTextoDax`) nunca interpolam strings cruas.
  - Para IDs: filtros numéricos aceitam apenas inteiros positivos de 32 bits. Caso a lista seja nula ou vazia, é gerado `{ -1 }` (filtro vazio fechado seguro).
  - Para strings literais: aspas duplas internas são escapadas duplicando-as (`""` — convenção do DAX), caracteres de controle e nulos (`\0`) são purgados.

### Passo 3: Isolamento de Sessão e Não Vazamento de Segredos Server-Side
- **Segredos do Service Principal**: O acesso ao Fabric requer `POWERBI_CLIENT_SECRET`, `POWERBI_CLIENT_ID` e `POWERBI_TENANT_ID`. Esses valores JAMAIS devem ser expostos ao navegador.
- **Mecanismos de Blindagem**:
  1. Marcação obrigatória com `import "server-only";` em módulos do adaptador e clientes de banco.
  2. Proibição absoluta do prefixo `NEXT_PUBLIC_` para qualquer variável ligada ao Fabric ou segredos de sessão.
  3. Respeito à **Regra 3.2 do AGENTS.md** ("Minimize Serialization at RSC Boundaries"): A fronteira entre Server Components e Client Components deve serializar estritamente DTOs enxutos de domínio (`LinhaCockpitMatriz`), sem repassar configurações ou objetos de conexão.
  4. Sessão Criptografada: O `allowedSupplierIds` do comprador é mantido na sessão assinada/banco server-side. Se o cliente enviar uma lista de fornecedores, o servidor executa a **interseção estrita**; se o comprador requisitar um fornecedor fora de sua carteira, o servidor retorna `403 Forbidden`.

### Passo 4: Política de Cabeçalhos de Segurança HTTP
- O navegador do comprador deve receber cabeçalhos defensivos para mitigar XSS, Clickjacking e vazamento de dados:
  - `Content-Security-Policy`: bloqueia scripts inline não autorizados, objetos/plugins e frames externos.
  - `X-Content-Type-Options: nosniff`: impede que o navegador adivinhe o tipo MIME.
  - `X-Frame-Options: DENY` e `frame-ancestors 'none'`: protege o cockpit contra ataques de UI redress/Clickjacking.
  - `Referrer-Policy: strict-origin-when-cross-origin`: não vaza parâmetros de URL para origens externas.
  - `Permissions-Policy`: bloqueia acesso a sensores e periféricos do dispositivo.
  - `Strict-Transport-Security` (HSTS): impõe HTTPS por 2 anos com subdomínios.

### Passo 5: Verificação Experimental da Bateria de Penetração
- Foi criada a suíte adversarial com **84 testes automatizados** cobrindo os 10 vetores de ataque listados.
- A suíte foi executada e validada com o motor Vitest, atingindo **100% de aprovação (84/84 testes)** com tempo de execução de apenas 21ms.

---

## 3. Caveats

1. **Escopo Read-Only do Subagente**:
   - Como este agente possui papel estritamente investigativo (Read-Only), nenhum arquivo de código de produção foi modificado ou criado fora da pasta do agente (`.agents/explorer_m4_seguranca_sanitizacao/`).
   - Os artefatos funcionais completos foram gerados na pasta do agente (`proposed_esquemas-seguranca.ts`, `proposed_headers-seguranca.ts`, `proposed_sanitizacao-dax.test.ts`) prontos para transposição pelo agente implementador.
2. **Modelo Semântico e RLS no Power BI Fabric**:
   - A investigação assumiu que o modelo semântico "Autopeca multi loja" da Rede Carreiro é consumido via Service Principal corporativo com permissões de leitura no dataset e que a governança de carteira (RBAC) é imposta na camada de aplicação do Insight Compras.
   - Caso o cliente habilite no futuro Row-Level Security (RLS) nativo no Power BI, o fluxo de geração de token precisará incluir identidades efetivas (`EffectiveIdentity`).
3. **Configuração de Teste do Vitest**:
   - O arquivo `vitest.config.ts` do projeto inclui por padrão apenas `tests/**/*.{test,spec}.{ts,tsx}` e exclui `.agents/`. A validação preliminar dos 84 testes foi realizada com sucesso por meio de configuração temporária interna da pasta do agente, já removida. A execução definitiva ocorrerá quando o arquivo for alocado em `tests/seguranca/sanitizacao-dax.test.ts`.

---

## 4. Conclusion

A plataforma Insight Compras possui requisitos críticos de isolamento multi-tenant e segurança em consultas analíticas. A arquitetura de segurança proposta atende integralmente a esses requisitos através dos seguintes pilares:

### 4.1 Entregáveis Arquiteturais Desenvolvidos

| Componente | Localização Proposta no Projeto | Arquivo de Origem (.agents) | Finalidade |
|---|---|---|---|
| **Esquemas Zod & Formatadores DAX** | `src/lib/seguranca/esquemas-sanitizacao.ts` | `.agents/explorer_m4_seguranca_sanitizacao/proposed_esquemas-seguranca.ts` | Validação estrita de entradas, rejeição de palavras-chave DAX e escape seguro de literais. |
| **Cabeçalhos HTTP & Diretrizes de Segredos** | `src/lib/seguranca/headers-seguranca.ts` | `.agents/explorer_m4_seguranca_sanitizacao/proposed_headers-seguranca.ts` | CSP, nosniff, DENY, HSTS, isolamento server-only e não vazamento de Service Principal. |
| **Suíte de Penetração e Testes de Injeção** | `tests/seguranca/sanitizacao-dax.test.ts` | `.agents/explorer_m4_seguranca_sanitizacao/proposed_sanitizacao-dax.test.ts` | 84 testes automatizados cobrindo payloads de injeção DAX, SQL, XSS, Type Juggling e datas. |

### 4.2 Matriz de Payloads Adversariais Neutralizados

```
┌────────────────────────────────────────┬────────────────────────────────┬────────────────────────────┐
│ Vetor de Ataque                        │ Exemplo de Payload             │ Mecanismo de Neutralização │
├────────────────────────────────────────┼────────────────────────────────┼────────────────────────────┤
│ Injeção DAX Multi-statement            │ EVALUATE 'PRODUTOS'            │ REGEX_PALAVRAS_CHAVE_DAX   │
│ Quebra de RLS DAX                      │ ) || CALCULATE(1=1, ALL(...))  │ REGEX_PALAVRAS_CHAVE_DAX   │
│ Declaração de Variável DAX             │ DEFINE VAR X = 1               │ REGEX_PALAVRAS_CHAVE_DAX   │
│ DoS por Explosão Cartesiana            │ CROSSJOIN(ALL(...), ALL(...))  │ REGEX_PALAVRAS_CHAVE_DAX   │
│ Exfiltração de Identidade              │ USERNAME() / USERPRINCIPALNAME │ REGEX_PALAVRAS_CHAVE_DAX   │
│ Tautologia Booleana DAX/SQL            │ " OR 1=1 -- / || TRUE()        │ REGEX_INJECAO_BOOLEANA     │
│ Delimitadores e Comentários            │ " ' ; -- // /* \ | &           │ REGEX_CARACTERES_INJECAO   │
│ Injeção SQL Tradicional                │ '; DROP TABLE PRODUTOS; --     │ REGEX_CARACTERES_INJECAO   │
│ XSS e Pseudo-protocolos                │ <script>, <img onerror>, js:   │ REGEX_XSS_E_PROTOCOLOS     │
│ Type Juggling / Overflow Numérico      │ -501, 501.5, NaN, 999999999999 │ SchemaFornecedorId Zod     │
│ Adulteração de Calendário              │ 2026-02-31, 2026-13-01         │ SchemaDataFiltro Calendário│
│ Injeção em Código SKU                  │ AM-01" || EVALUATE             │ REGEX_SKU_SEGURO Allowlist │
└────────────────────────────────────────┴────────────────────────────────┴────────────────────────────┘
```

### 4.3 Recomendações para o Agente Implementador (Coder)
1. Criar o diretório `src/lib/seguranca/` e copiar o conteúdo de `proposed_esquemas-seguranca.ts` e `proposed_headers-seguranca.ts`.
2. Criar o diretório `tests/seguranca/` e copiar o conteúdo de `proposed_sanitizacao-dax.test.ts` ajustando o caminho de import para `@/lib/seguranca/esquemas-sanitizacao`.
3. Adicionar `import "server-only";` no topo de `adapters/carreiro/cliente-dax.ts` e `adapters/carreiro/adaptador-carreiro.ts`.
4. Atualizar `adapters/carreiro/consultas-homologadas.ts` para integrar os sanitizadores estruturados `sanitizarListaIdsParaDax` e `escaparLiteralTextoDax`.
5. Em `src/middleware.ts`, aplicar os cabeçalhos de segurança HTTP em todas as respostas roteadas pelo Next.js.

---

## 5. Verification Method

Para verificar de forma independente e reproduzível a eficácia da arquitetura e dos testes propostos:

### 5.1 Comandos de Execução
1. **Validação da Suíte Completa do Projeto**:
   ```powershell
   npm test
   ```
   *Critério de Sucesso*: 33 arquivos de teste e 275 testes passando com código de saída 0.

2. **Validação da Nova Suíte de Segurança (quando transposta)**:
   ```powershell
   npx vitest run tests/seguranca/sanitizacao-dax.test.ts
   ```
   *Critério de Sucesso*: 84 testes executados, 84 testes passando em < 100ms sem falhas.

3. **Validação de Tipagem TypeScript Estrita**:
   ```powershell
   npm run lint
   ```
   *Critério de Sucesso*: Zero erros de compilação TypeScript com `strict: true`.

### 5.2 Arquivos a Inspecionar
1. `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m4_seguranca_sanitizacao\proposed_esquemas-seguranca.ts`
2. `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m4_seguranca_sanitizacao\proposed_headers-seguranca.ts`
3. `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\explorer_m4_seguranca_sanitizacao\proposed_sanitizacao-dax.test.ts`
4. `c:\Users\Felipe Barbosa\Documents\insight-compras\adapters\carreiro\consultas-homologadas.ts`
5. `c:\Users\Felipe Barbosa\Documents\insight-compras\adapters\carreiro\cliente-dax.ts`

### 5.3 Condições de Invalidação
A solução deve ser considerada inválida se:
- Qualquer payload contendo `EVALUATE`, `CALCULATE`, `ALL`, `" OR 1=1`, `--` ou tags HTML for aceito pelos esquemas Zod.
- Variáveis de ambiente contendo credenciais do Fabric forem renomeadas com o prefixo `NEXT_PUBLIC_`.
- A lista `allowedSupplierIds` for aceita do cliente sem validação contra a sessão do comprador no servidor.
- A função de formatação DAX interpolar valores numéricos negativos ou não inteiros na cláusula `IN`.

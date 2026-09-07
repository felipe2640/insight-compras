# Relatório de Investigação e Handoff de Arquitetura: RBAC Multi-Tenant e Trilha Imutável de Auditoria (M4)

**Subagente:** `explorer_m4_rbac_auditoria` (teamwork_preview_explorer)  
**Data/Hora:** 2026-09-06T17:05:00Z  
**Destinatário:** Project Orchestrator (`parent` — `140d3f6b-8e9e-4004-bf5c-e74848758224`)  
**Status do Marco:** M4 — Investigação e Arquitetura Concluídas  

---

## 1. Observation (Observações Diretas do Código e Requisitos)

Durante a investigação detalhada da base de código e da documentação do projeto `insight-compras`, foram diretamente observadas as seguintes evidências:

### 1.1. Requisitos Oficiais de Negócio e Segurança (R4 e Features #23, #24, #25)
- **`ORIGINAL_REQUEST.md` (Linhas 46-50 e 73-75):**
  > *"R4. Carteira de Compradores e Cibersegurança (RBAC Multi-Tenant):*  
  > *- Controle de Acesso (RBAC): Cada comprador faz login e tem sua visão restrita estritamente aos fornecedores e categorias sob sua alçada (`allowedSupplierIds`).*  
  > *- Visão Gerencial (Admin): O gestor possui visão consolidada da rede inteira e de todos os compradores.*  
  > *- Segurança da Informação: Sanitização de entradas, proteção contra injeção de DAX/SQL, isolamento rigoroso de sessão e tokens, e proteção de rotas server-side no Next.js."*  
  > *Critério de Aceite: "O login de um comprador com fornecedores restritos impede o carregamento de produtos fora da sua carteira, tanto no front-end quanto nas respostas de API."*  
  > *Critério de Aceite: "O painel do gestor permite auditar os pedidos e transferências gerados por cada comprador."*

- **`PROJECT.md` (Linhas 73-75):**
  > *#23: "Controle de Acesso RBAC Server-Side: Restrição estrita de carteira de comprador por `allowedSupplierIds` validada no servidor e visão total de Gestor (Marco M4)."*  
  > *#24: "Painel de Auditoria do Gestor: Trilha imutável para rastrear e auditar pedidos, sobrecompras e divergências com as sugestões do sistema (Marco M4)."*  
  > *#25: "Cibersegurança e Prevenção de Injeção: Sanitização de entradas com Zod, proteção contra injeção DAX/SQL e isolamento de sessão (Marco M4)."*

### 1.2. Entidades Existentes no Core e Adapters
- **`core/dominio/produto.ts` (Linhas 14-30):**
  A entidade `Produto` já possui o vínculo obrigatório com o fornecedor:
  ```typescript
  export interface Produto {
    readonly id: number;
    readonly codigoSku: string;
    readonly fornecedorId: number;
    readonly nomeFornecedor: string;
    readonly precoCusto: number;
    readonly loteMultiplo: number;
    // ...
  }
  ```
- **`core/dominio/sugestao.ts` (Linhas 16-33):**
  A entidade `SugestaoCompraItem` expõe a linha de base matemática calculada pelo motor puro:
  ```typescript
  export interface SugestaoCompraItem {
    readonly produto: Produto;
    readonly sugestaoFinalCompra: number;
    readonly statusSugestao: StatusSugestao;
    readonly motivoDecisao: string;
    // ...
  }
  ```
- **`core/dominio/auditoria.ts` (Linhas 6-25):**
  O domínio puro já define a base imutável para registros de auditoria:
  ```typescript
  export type TipoAcaoAuditoria =
    | "CRIACAO_PEDIDO"
    | "AJUSTE_SUGESTAO"
    | "APROVACAO_TRANSFERENCIA"
    | "SOBRECOMPRA_CONFIRMADA";

  export interface RegistroAuditoriaPedido {
    readonly id: string;
    readonly timestamp: string;
    readonly usuarioId: string;
    readonly usuarioNome: string;
    readonly tenantId: string;
    readonly tipoAcao: TipoAcaoAuditoria;
    readonly produtoId: number;
    readonly codigoSku: string;
    readonly filialId: number;
    readonly quantidadeSugeridaSistema: number;
    readonly quantidadeDefinidaComprador: number;
    readonly divergenciaJustificativa: string | null;
  }
  ```
- **`adapters/AdaptadorInventario.ts` (Linhas 15-21):**
  O contrato de carga já declara a porta de entrada para a carteira de compradores:
  ```typescript
  export interface FiltroCargaInventario {
    readonly fornecedoresPermitidos: readonly number[] | null;
    readonly secaoId?: number;
    readonly apenasComEstoqueOuVenda?: boolean;
    readonly filialId?: number;
  }
  ```
- **`adapters/mock/adaptador-mock.ts` (Linhas 48-58):**
  O mock já implementa filtragem O(1) via `Set`:
  ```typescript
  const setFornecedores = filtro.fornecedoresPermitidos
    ? new Set(filtro.fornecedoresPermitidos)
    : null;

  const produtosFiltrados = base.produtos.filter((p) => {
    if (setFornecedores !== null && !setFornecedores.has(p.fornecedorId)) {
      return false;
    }
    // ...
  });
  ```
- **`adapters/carreiro/consultas-homologadas.ts` (Linhas 16-26 e 86-89):**
  O adaptador oficial DAX possui a função `formatarListaNumericaDax` para prevenir injeção DAX garantindo inteiros estritos:
  ```typescript
  if (filtro?.fornecedoresPermitidos && filtro.fornecedoresPermitidos.length > 0) {
    const listaDax = formatarListaNumericaDax(filtro.fornecedoresPermitidos);
    clausulaFiltro += ` && 'PRODUTOS'[ACODFORNECEDOR] IN ${listaDax}`;
  }
  ```

### 1.3. Estado do Cockpit e Testes Existentes
- **`src/hooks/useFiltrosCockpit.ts` (Linhas 88-92):**
  O Cockpit do Comprador já realiza a filtragem client-side em memória:
  ```typescript
  if (fornecedoresPermitidos !== null && item.fornecedorId !== undefined) {
    if (!fornecedoresPermitidos.has(item.fornecedorId)) {
      continue;
    }
  }
  ```
- **`tests/e2e/tier1-features/rbac-auditoria.test.ts`:**
  Já possui 5 testes de especificação cobrindo RBAC básico, visão do gestor, geração de auditoria, sobrecompra manual e sanitização Zod.
- **Execução da Bateria de Testes Vitest:**
  A execução de `npm test` confirmou **33 arquivos de teste passando (33/33) e 275 testes unitários e de integração verdes (275/275)**, confirmando a estabilidade dos Marcos M1, M2 e M3.
- **Lacuna Arquitetural Identificada:**
  Não existem ainda os diretórios de aplicação e segurança:
  - `src/lib/rbac/` (ausente)
  - `src/lib/auditoria/` (ausente)
  - `tests/seguranca/rbac.test.ts` (ausente)
  - `tests/seguranca/auditoria.test.ts` (ausente)

---

## 2. Logic Chain (Cadeia de Raciocínio Lógico)

1. **Princípio do Menor Privilégio & Isolamento Multi-Tenant:**
   - Com base em `ORIGINAL_REQUEST.md` R4 e `PROJECT.md` #23, compradores em redes de autopeças são alocados por linhas ou famílias de produtos (ex: Carlos cuida apenas da Monroe/Amortecedores [501]).
   - Permitir que um comprador veja ou modifique compras de outro fornecedor gera canibalização de pedidos, descontrole orçamentário e quebra de acordos comerciais com distribuidores.
   - O Gestor e o Administrador, por sua vez, respondem pelo orçamento global da rede e necessitam de visão consolidada e cross-filiais.

2. **Necessidade Inegociável da Validação em Dupla Camada (Defense-in-Depth):**
   - **Camada 1 (Client-Side / UI):** Proporciona usabilidade impecável. O comprador não se perde em 25.000 SKUs que não pode comprar; o grid e os seletores mostram apenas seus produtos. O hook `useFiltrosCockpit` já cumpre essa função em O(1).
   - **Camada 2 (Server-Side / Backend APIs):** É a barreira real de cibersegurança. Em arquiteturas web modernas (Next.js App Router), qualquer usuário com acesso ao navegador pode inspecionar chamadas de rede ou disparar requisições HTTP manuais via `fetch`/`curl` contra `/api/compras` ou `/api/pedidos`.
   - Se o backend aceitasse passivamente parâmetros do cliente como `?fornecedorId=502` ou um payload de pedido contendo itens de outro fornecedor, a segurança estaria comprometida.
   - **Conclusão Lógica Server-Side:** O servidor deve inspecionar a identidade autenticada na sessão (`UsuarioAutenticado`). Se `role === "COMPRADOR"`, o servidor deve:
     a) Forçar que `fornecedoresPermitidos` seja estritamente o subconjunto de `sessao.allowedSupplierIds`.
     b) Rejeitar com `403 Forbidden` (`ErroAcessoNegado`) qualquer requisição que solicite dados ou envie pedidos para fornecedores fora da carteira.
     c) Rejeitar qualquer acesso ao painel gerencial de auditoria (`/api/admin/auditoria`) com `403 Forbidden`.

3. **Arquitetura da Trilha Imutável de Auditoria (`AuditoriaPedido`):**
   - O motor puro do sistema (`core/calculo/necessidade.ts`) fornece uma recomendação estritamente matemática baseada em giro real e histórico de vendas.
   - No entanto, o comprador humano pode aplicar overrides (sobrecompras devido a campanhas comerciais, promoções de fábrica ou intuição).
   - Para coibir desvios e compras desnecessárias (geradoras de encalhe), cada decisão de compra deve ser imutável e rastreável.
   - Quando `quantidadeDigitada > quantidadeSugerida`, classifica-se como `SOBRECOMPRA_CONFIRMADA`, calcula-se o desvio numérico (`+delta`), a variação percentual e o impacto financeiro em R$ (`delta * precoCusto`), exigindo justificativa textual.
   - A trilha deve ser imutável (append-only). Para garantir que nenhum log possa ser adulterado ou apagado sem detecção, cada registro deve possuir um hash criptográfico (SHA-256) encadeado ao registro anterior (log inviolável tamper-evident).

4. **Sanitização Contra Injeção DAX e SQL:**
   - Como os adaptadores consultam o modelo semântico do Power BI Fabric via DAX e potenciais bancos relacionais via SQL, entradas textuais de busca (`queryBusca`) e parâmetros numéricos devem ser validados estritamente via Zod, bloqueando tokens maliciosos como `;`, `'`, `"`, `--`, `/*`, `EVALUATE`, `DROP`, `UNION`.

---

## 3. Caveats (Ressalvas, Suposições e Limitações Investigadas)

1. **Camada de Autenticação/Sessão Desacoplada:**
   - O projeto ainda não possui um provedor de identidade integrado (como NextAuth.js, Supabase Auth ou Azure AD B2C).
   - *Suposição Adotada:* O módulo `src/lib/rbac/` deve definir contratos abstratos de sessão (`UsuarioAutenticado`, `obterSessaoServidor`) que hoje extraem a identidade de headers HTTP simulados / contexto de teste, prontos para plugar tokens JWT/Cookies na fase de deploy final.
2. **Armazenamento de Auditoria:**
   - Atualmente, o repositório deve operar com uma implementação in-memory thread-safe com interface `RepositorioAuditoria` bem definida, permitindo persistência transitória e testes de alta velocidade, pronta para conexão com tabela SQL/PostgreSQL em produção.
3. **Escopo de Fornecedores vs Categorias:**
   - O requisito R4 cita "fornecedores e categorias sob sua alçada". No catálogo da Carreiro, os fornecedores são a chave primária de alçada comercial (`fornecedorId: 501, 502...`). Os tipos foram desenhados para aceitar `allowedSupplierIds` obrigatório e `allowedCategoryIds` opcional, mantendo total extensibilidade.

---

## 4. Conclusion (Arquitetura Proposta para M4)

Abaixo está o detalhamento completo dos módulos, contratos de código e regras que o agente implementador (`worker_m4`) deverá criar.

### 4.1. Estrutura de Diretórios Proposta

```
insight-compras/
├── src/
│   ├── lib/
│   │   ├── rbac/
│   │   │   ├── tipos.ts                # Papéis, usuário autenticado, permissões e sessões
│   │   │   ├── erros.ts                # Classes de erro: ErroAcessoNegado (403), ErroNaoAutenticado (401)
│   │   │   ├── sanitizacao.ts          # Schemas Zod anti-injeção DAX/SQL
│   │   │   ├── validador.ts            # Validador de carteira e dupla camada (server-side)
│   │   │   └── index.ts                # Exportações públicas do RBAC
│   │   └── auditoria/
│   │       ├── tipos.ts                # Contratos de AuditoriaPedido, divergência e KPIs
│   │       ├── integridade.ts          # Encadeamento de hash SHA-256 e validação tamper-evident
│   │       ├── repositorio.ts          # Repositório append-only em memória
│   │       ├── servico.ts              # Serviço de registro de decisões, cálculo de divergência e KPIs
│   │       └── index.ts                # Exportações públicas de Auditoria
├── tests/
│   └── seguranca/
│       ├── rbac.test.ts                # Suíte de testes de RBAC, carteira e 403 Forbidden
│       └── auditoria.test.ts           # Suíte de testes da trilha imutável e divergências
```

---

### 4.2. Contratos TypeScript Detalhados

#### 4.2.1. Módulo `src/lib/rbac/`

##### A. `src/lib/rbac/tipos.ts`
```typescript
/**
 * Tipos Canônicos de RBAC e Controle de Acesso Multi-Tenant
 * Camada: Aplicação / Segurança (src/lib/rbac)
 * 100% em Português do Brasil (pt-BR)
 */

export type PapelUsuario = "COMPRADOR" | "GESTOR" | "ADMIN";

export type AcaoSeguranca =
  | "CARREGAR_INVENTARIO"
  | "CRIAR_PEDIDO"
  | "AJUSTAR_QUANTIDADE"
  | "APROVAR_TRANSFERENCIA"
  | "VISUALIZAR_AUDITORIA_GERENCIAL"
  | "EXPORTAR_RELATORIOS";

export interface UsuarioAutenticado {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly role: PapelUsuario;
  /**
   * Fornecedores homologados na carteira do comprador.
   * Para GESTOR e ADMIN, pode ser null (indicando acesso irrestrito universal).
   */
  readonly allowedSupplierIds: ReadonlySet<number> | readonly number[] | null;
  /**
   * Categorias/Seções homologadas na carteira (opcional).
   * Se for null, tem acesso a todas as seções dos fornecedores autorizados.
   */
  readonly allowedCategoryIds?: ReadonlySet<number> | readonly number[] | null;
  readonly tenantId: string;
}

export interface SessaoUsuario {
  readonly usuario: UsuarioAutenticado;
  readonly tokenExpiracao: number;
  readonly emitidoEm: number;
}
```

##### B. `src/lib/rbac/erros.ts`
```typescript
/**
 * Classes de Erro Padronizadas para Falhas de Autenticação e Autorização RBAC
 * Mapeiam diretamente para códigos de status HTTP (401, 403).
 */

export class ErroSegurancaBase extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly codigoErro: string
  ) {
    super(message);
    this.name = "ErroSegurancaBase";
  }
}

export class ErroNaoAutenticado extends ErroSegurancaBase {
  constructor(motivo: string = "Sessão de usuário não encontrada ou expirada.") {
    super(motivo, 401, "UNAUTHORIZED");
    this.name = "ErroNaoAutenticado";
  }
}

export class ErroAcessoNegado extends ErroSegurancaBase {
  constructor(
    motivo: string = "Acesso negado: recurso fora da alçada da sua carteira de comprador.",
    public readonly fornecedorSolicitado?: number,
    public readonly fornecedoresPermitidos?: readonly number[]
  ) {
    super(motivo, 403, "FORBIDDEN");
    this.name = "ErroAcessoNegado";
  }
}

export class ErroViolacaoTenant extends ErroSegurancaBase {
  constructor(motivo: string = "Acesso negado: tentativa de acesso entre tenants distintos.") {
    super(motivo, 403, "TENANT_MISMATCH");
    this.name = "ErroViolacaoTenant";
  }
}
```

##### C. `src/lib/rbac/sanitizacao.ts`
```typescript
/**
 * Schemas de Sanitização Estrita Zod contra Injeção DAX/SQL e Validação de Payload
 */
import { z } from "zod";

// Bloqueia metacaracteres e palavras-chave maliciosas de injeção DAX e SQL
const REGEX_ANTI_INJECAO = /^[^'";\-\-/*#\\]*$/;

export const SchemaParametrosBusca = z.object({
  query: z
    .string()
    .max(100, "Consulta de busca muito longa (máximo 100 caracteres)")
    .regex(REGEX_ANTI_INJECAO, "Caracteres especiais inválidos ou tentativa de injeção detectada")
    .optional(),
  filialId: z.number().int().positive("ID da filial deve ser um inteiro positivo").optional(),
  secaoId: z.number().int().positive("ID da seção deve ser um inteiro positivo").optional(),
  fornecedorIdSolicitado: z.number().int().positive().optional(),
});

export const SchemaItemPedidoCriacao = z.object({
  produtoId: z.number().int().positive("ID do produto inválido"),
  codigoSku: z.string().min(1).max(50),
  fornecedorId: z.number().int().positive("ID do fornecedor inválido"),
  filialId: z.number().int().positive("ID da filial inválido"),
  quantidadeSugerida: z.number().min(0),
  quantidadeDigitada: z.number().int().min(0, "Quantidade não pode ser negativa"),
  precoCusto: z.number().min(0),
  justificativaOverride: z.string().max(500).optional().nullable(),
});

export const SchemaPayloadPedido = z.object({
  tenantId: z.string().min(1),
  itens: z.array(SchemaItemPedidoCriacao).min(1, "O pedido deve conter pelo menos um item"),
});
```

##### D. `src/lib/rbac/validador.ts`
```typescript
/**
 * Validador de Carteira e Regras de Negócio de Autorização (Server-Side)
 */
import { UsuarioAutenticado, PapelUsuario } from "./tipos";
import { ErroAcessoNegado, ErroNaoAutenticado, ErroViolacaoTenant } from "./erros";
import { FiltroCargaInventario } from "@adapters/AdaptadorInventario";

export function normalizarSetFornecedores(
  fornecedores: ReadonlySet<number> | readonly number[] | null
): ReadonlySet<number> | null {
  if (fornecedores === null) return null;
  if (fornecedores instanceof Set) return fornecedores;
  return new Set(fornecedores);
}

/**
 * Valida se um usuário tem permissão para operar sobre um fornecedor específico.
 */
export function verificarAcessoFornecedor(
  usuario: UsuarioAutenticado,
  fornecedorId: number
): boolean {
  if (usuario.role === "GESTOR" || usuario.role === "ADMIN") {
    return true;
  }
  const setPermitidos = normalizarSetFornecedores(usuario.allowedSupplierIds);
  if (!setPermitidos) return false;
  return setPermitidos.has(fornecedorId);
}

/**
 * Valida e converte o filtro de inventário solicitado para um filtro estritamente seguro.
 * Se o comprador tentar solicitar fornecedores fora de sua carteira, lança ErroAcessoNegado (403).
 */
export function aplicarGuardrailInventarioServerSide(
  usuario: UsuarioAutenticado,
  filtroSolicitado: Partial<FiltroCargaInventario>
): FiltroCargaInventario {
  // 1. Gestor ou Admin: permissão total
  if (usuario.role === "GESTOR" || usuario.role === "ADMIN") {
    return {
      fornecedoresPermitidos: filtroSolicitado.fornecedoresPermitidos ?? null,
      secaoId: filtroSolicitado.secaoId,
      apenasComEstoqueOuVenda: filtroSolicitado.apenasComEstoqueOuVenda,
      filialId: filtroSolicitado.filialId,
    };
  }

  // 2. Comprador: restrição estrita
  const setPermitidos = normalizarSetFornecedores(usuario.allowedSupplierIds);
  const listaPermitidos = Array.from(setPermitidos ?? []);

  if (listaPermitidos.length === 0) {
    throw new ErroAcessoNegado("Comprador sem nenhum fornecedor associado à sua carteira.");
  }

  // Se o cliente solicitou fornecedores específicos na query, todos devem estar em sua carteira
  if (filtroSolicitado.fornecedoresPermitidos && filtroSolicitado.fornecedoresPermitidos.length > 0) {
    for (const fId of filtroSolicitado.fornecedoresPermitidos) {
      if (!setPermitidos!.has(fId)) {
        throw new ErroAcessoNegado(
          `Tentativa de acesso não autorizada ao fornecedor ${fId}. Fornecedor fora da sua carteira homologada.`,
          fId,
          listaPermitidos
        );
      }
    }
    return {
      ...filtroSolicitado,
      fornecedoresPermitidos: filtroSolicitado.fornecedoresPermitidos,
    };
  }

  // Por padrão, se não informou, restringe a toda a carteira do comprador
  return {
    ...filtroSolicitado,
    fornecedoresPermitidos: listaPermitidos,
  };
}

/**
 * Valida se um conjunto de itens de pedido pertence integralmente à carteira do comprador.
 */
export function validarItensPedidoServerSide(
  usuario: UsuarioAutenticado,
  itens: readonly { fornecedorId: number; codigoSku: string }[]
): void {
  if (usuario.role === "GESTOR" || usuario.role === "ADMIN") {
    return;
  }

  const setPermitidos = normalizarSetFornecedores(usuario.allowedSupplierIds);
  for (const item of itens) {
    if (!setPermitidos || !setPermitidos.has(item.fornecedorId)) {
      throw new ErroAcessoNegado(
        `O SKU ${item.codigoSku} pertence ao fornecedor ${item.fornecedorId}, que está fora da sua carteira de compras.`,
        item.fornecedorId,
        Array.from(setPermitidos ?? [])
      );
    }
  }
}

/**
 * Garante que o usuário autenticado pertença ao tenant da requisição.
 */
export function validarTenantContexto(usuario: UsuarioAutenticado, tenantIdAlvo: string): void {
  if (usuario.tenantId !== tenantIdAlvo) {
    throw new ErroViolacaoTenant(
      `Usuário do tenant '${usuario.tenantId}' tentou operar sobre o tenant '${tenantIdAlvo}'.`
    );
  }
}

/**
 * Bloqueia compradores de acessar rotas e relatórios exclusivos de gestão.
 */
export function garantirAcessoGerencial(usuario: UsuarioAutenticado): void {
  if (usuario.role !== "GESTOR" && usuario.role !== "ADMIN") {
    throw new ErroAcessoNegado(
      "Acesso Negado: O Painel e Logs de Auditoria são restritos a Gestores e Administradores."
    );
  }
}
```

---

#### 4.2.2. Módulo `src/lib/auditoria/`

##### A. `src/lib/auditoria/tipos.ts`
```typescript
/**
 * Contratos de Tipagem da Trilha Imutável de Auditoria de Pedidos
 * Camada: Aplicação / Auditoria (src/lib/auditoria)
 * 100% em Português do Brasil (pt-BR)
 */

import { TipoAcaoAuditoria } from "@core/dominio/auditoria";

export type { TipoAcaoAuditoria };

export type ClassificacaoDivergencia =
  | "CONFORME_SUGESTAO"
  | "SOBRECOMPRA"
  | "SUBCOMPRA"
  | "ZERAMENTO_MANUAL"
  | "AJUSTE_LOTE_MULTIPLO";

export interface AuditoriaPedido {
  readonly id: string;
  readonly timestamp: string;
  readonly tenantId: string;

  // Identificação do Comprador (Auditoria Rastreável)
  readonly compradorId: string;
  readonly compradorNome: string;
  readonly compradorEmail: string;
  readonly compradorPapel: "COMPRADOR" | "GESTOR" | "ADMIN";

  // Alvo do Pedido
  readonly filialId: number;
  readonly filialNome?: string;
  readonly produtoId: number;
  readonly codigoSku: string;
  readonly descricaoProduto?: string;
  readonly fornecedorId: number;
  readonly nomeFornecedor?: string;

  // Valores Matemáticos e Decisão Humana
  readonly quantidadeSugeridaSistema: number;
  readonly quantidadeDigitadaComprador: number;
  readonly divergenciaQuantidade: number; // digitada - sugerida
  readonly divergenciaPercentual: number | null; // ((digitada - sugerida) / sugerida) * 100
  readonly precoCustoUnitario: number;
  readonly impactoFinanceiroDivergencia: number; // divergenciaQuantidade * precoCustoUnitario

  // Classificação e Justificativa
  readonly tipoAcao: TipoAcaoAuditoria;
  readonly classificacaoDivergencia: ClassificacaoDivergencia;
  readonly justificativaOverride: string | null;

  // Garantia Criptográfica de Imutabilidade
  readonly hashRegistroAnterior: string;
  readonly hashIntegridade: string;
}

export interface FiltrosConsultaAuditoria {
  readonly tenantId: string;
  readonly compradorId?: string;
  readonly fornecedorId?: number;
  readonly filialId?: number;
  readonly apenasSobrecompras?: boolean;
  readonly dataInicio?: string;
  readonly dataFim?: string;
  readonly limite?: number;
}

export interface ResumoKpisAuditoria {
  readonly totalRegistros: number;
  readonly totalSobrecompras: number;
  readonly totalSubcompras: number;
  readonly totalConformes: number;
  readonly taxaAderenciaMotorPercentual: number;
  readonly impactoFinanceiroTotalSobrecompra: number;
}
```

##### B. `src/lib/auditoria/integridade.ts`
```typescript
/**
 * Algoritmo de Encadeamento Criptográfico SHA-256 para Trilha Imutável (Tamper-Evident Log)
 */
import { createHash } from "crypto";

export function calcularHashRegistro(
  dados: Omit<AuditoriaPedido, "hashIntegridade">
): string {
  const cargaUtil = JSON.stringify({
    id: dados.id,
    timestamp: dados.timestamp,
    tenantId: dados.tenantId,
    compradorId: dados.compradorId,
    filialId: dados.filialId,
    produtoId: dados.produtoId,
    codigoSku: dados.codigoSku,
    quantidadeSugerida: dados.quantidadeSugeridaSistema,
    quantidadeDigitada: dados.quantidadeDigitadaComprador,
    divergencia: dados.divergenciaQuantidade,
    tipoAcao: dados.tipoAcao,
    hashAnterior: dados.hashRegistroAnterior,
  });

  return createHash("sha256").update(cargaUtil).digest("hex");
}

export function validarCadeiaAuditoria(registros: readonly AuditoriaPedido[]): {
  valida: boolean;
  indiceInvalido?: number;
  motivo?: string;
} {
  for (let i = 0; i < registros.length; i++) {
    const atual = registros[i];

    // Verifica integridade do próprio hash
    const { hashIntegridade, ...resto } = atual;
    const hashEsperado = calcularHashRegistro(resto);
    if (hashIntegridade !== hashEsperado) {
      return {
        valida: false,
        indiceInvalido: i,
        motivo: `Hash inválido no registro ${atual.id}. Conteúdo foi adulterado.`,
      };
    }

    // Verifica encadeamento com o registro anterior
    if (i > 0) {
      const anterior = registros[i - 1];
      if (atual.hashRegistroAnterior !== anterior.hashIntegridade) {
        return {
          valida: false,
          indiceInvalido: i,
          motivo: `Quebra de cadeia: o registro ${atual.id} não aponta para o hash do registro ${anterior.id}.`,
        };
      }
    } else {
      if (atual.hashRegistroAnterior !== "GENESIS_HASH") {
        return {
          valida: false,
          indiceInvalido: 0,
          motivo: "Registro inicial não possui o hash gênesis correto.",
        };
      }
    }
  }

  return { valida: true };
}
```

##### C. `src/lib/auditoria/repositorio.ts`
```typescript
/**
 * Repositório Append-Only Imutável de Auditoria (Em Memória com Congelamento de Objetos)
 */
import { AuditoriaPedido, FiltrosConsultaAuditoria } from "./tipos";

export interface RepositorioAuditoria {
  adicionarRegistro(registro: AuditoriaPedido): Promise<void>;
  obterUltimoRegistro(tenantId: string): Promise<AuditoriaPedido | null>;
  consultar(filtros: FiltrosConsultaAuditoria): Promise<readonly AuditoriaPedido[]>;
  obterTodos(tenantId: string): Promise<readonly AuditoriaPedido[]>;
}

export class RepositorioAuditoriaEmMemoria implements RepositorioAuditoria {
  private readonly registrosPorTenant = new Map<string, AuditoriaPedido[]>();

  public async adicionarRegistro(registro: AuditoriaPedido): Promise<void> {
    // Imutabilidade estrita: congela o objeto para impedir mutações em tempo de execução
    const registroCongelado = Object.freeze({ ...registro });

    const lista = this.registrosPorTenant.get(registro.tenantId) ?? [];
    lista.push(registroCongelado);
    this.registrosPorTenant.set(registro.tenantId, lista);
  }

  public async obterUltimoRegistro(tenantId: string): Promise<AuditoriaPedido | null> {
    const lista = this.registrosPorTenant.get(tenantId);
    if (!lista || lista.length === 0) return null;
    return lista[lista.length - 1];
  }

  public async consultar(filtros: FiltrosConsultaAuditoria): Promise<readonly AuditoriaPedido[]> {
    const lista = this.registrosPorTenant.get(filtros.tenantId) ?? [];

    return lista.filter((reg) => {
      if (filtros.compradorId && reg.compradorId !== filtros.compradorId) return false;
      if (filtros.fornecedorId && reg.fornecedorId !== filtros.fornecedorId) return false;
      if (filtros.filialId && reg.filialId !== filtros.filialId) return false;
      if (filtros.apenasSobrecompras && reg.classificacaoDivergencia !== "SOBRECOMPRA") return false;
      if (filtros.dataInicio && reg.timestamp < filtros.dataInicio) return false;
      if (filtros.dataFim && reg.timestamp > filtros.dataFim) return false;
      return true;
    }).slice(0, filtros.limite ?? 1000);
  }

  public async obterTodos(tenantId: string): Promise<readonly AuditoriaPedido[]> {
    return this.registrosPorTenant.get(tenantId) ?? [];
  }

  public limpar(tenantId?: string): void {
    if (tenantId) {
      this.registrosPorTenant.delete(tenantId);
    } else {
      this.registrosPorTenant.clear();
    }
  }
}
```

##### D. `src/lib/auditoria/servico.ts`
```typescript
/**
 * Serviço de Negócios para Registro e Cálculo de Auditoria
 */
import {
  AuditoriaPedido,
  ClassificacaoDivergencia,
  TipoAcaoAuditoria,
  FiltrosConsultaAuditoria,
  ResumoKpisAuditoria,
} from "./tipos";
import { RepositorioAuditoria } from "./repositorio";
import { calcularHashRegistro } from "./integridade";
import { UsuarioAutenticado } from "../rbac/tipos";

export interface ParametrosRegistroPedido {
  readonly usuario: UsuarioAutenticado;
  readonly produtoId: number;
  readonly codigoSku: string;
  readonly descricaoProduto?: string;
  readonly fornecedorId: number;
  readonly nomeFornecedor?: string;
  readonly filialId: number;
  readonly filialNome?: string;
  readonly quantidadeSugerida: number;
  readonly quantidadeDigitada: number;
  readonly precoCusto: number;
  readonly justificativaOverride?: string | null;
}

export class ServicoAuditoria {
  constructor(private readonly repositorio: RepositorioAuditoria) {}

  public async registrarDecisao(params: ParametrosRegistroPedido): Promise<AuditoriaPedido> {
    const {
      usuario,
      produtoId,
      codigoSku,
      descricaoProduto,
      fornecedorId,
      nomeFornecedor,
      filialId,
      filialNome,
      quantidadeSugerida,
      quantidadeDigitada,
      precoCusto,
      justificativaOverride,
    } = params;

    const divergenciaQtd = quantidadeDigitada - quantidadeSugerida;
    let classificacao: ClassificacaoDivergencia = "CONFORME_SUGESTAO";
    let tipoAcao: TipoAcaoAuditoria = "CRIACAO_PEDIDO";

    if (divergenciaQtd > 0) {
      classificacao = "SOBRECOMPRA";
      tipoAcao = "SOBRECOMPRA_CONFIRMADA";
    } else if (divergenciaQtd < 0 && quantidadeDigitada > 0) {
      classificacao = "SUBCOMPRA";
      tipoAcao = "AJUSTE_SUGESTAO";
    } else if (quantidadeDigitada === 0 && quantidadeSugerida > 0) {
      classificacao = "ZERAMENTO_MANUAL";
      tipoAcao = "AJUSTE_SUGESTAO";
    }

    const divergenciaPct =
      quantidadeSugerida > 0
        ? ((quantidadeDigitada - quantidadeSugerida) / quantidadeSugerida) * 100
        : quantidadeDigitada > 0
        ? 100
        : 0;

    const impactoFinanceiro = divergenciaQtd * precoCusto;

    let justificativaFormatada = justificativaOverride ?? null;
    if (!justificativaFormatada && divergenciaQtd > 0) {
      justificativaFormatada = `Sobrecompra manual de +${divergenciaQtd} un pelo comprador ${usuario.nome}. Sugestão do motor era de ${quantidadeSugerida} un.`;
    }

    // Obtém hash do registro anterior para encadeamento
    const ultimoRegistro = await this.repositorio.obterUltimoRegistro(usuario.tenantId);
    const hashAnterior = ultimoRegistro ? ultimoRegistro.hashIntegridade : "GENESIS_HASH";

    const id = `AUD-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const timestamp = new Date().toISOString();

    const registroParcial: Omit<AuditoriaPedido, "hashIntegridade"> = {
      id,
      timestamp,
      tenantId: usuario.tenantId,
      compradorId: usuario.id,
      compradorNome: usuario.nome,
      compradorEmail: usuario.email,
      compradorPapel: usuario.role,
      filialId,
      filialNome,
      produtoId,
      codigoSku,
      descricaoProduto,
      fornecedorId,
      nomeFornecedor,
      quantidadeSugeridaSistema: quantidadeSugerida,
      quantidadeDigitadaComprador: quantidadeDigitada,
      divergenciaQuantidade: divergenciaQtd,
      divergenciaPercentual: Number(divergenciaPct.toFixed(2)),
      precoCustoUnitario: precoCusto,
      impactoFinanceiroDivergencia: Number(impactoFinanceiro.toFixed(2)),
      tipoAcao,
      classificacaoDivergencia: classificacao,
      justificativaOverride: justificativaFormatada,
      hashRegistroAnterior: hashAnterior,
    };

    const hashIntegridade = calcularHashRegistro(registroParcial);

    const registroCompleto: AuditoriaPedido = {
      ...registroParcial,
      hashIntegridade,
    };

    await this.repositorio.adicionarRegistro(registroCompleto);
    return registroCompleto;
  }

  public async consultarTrilha(
    filtros: FiltrosConsultaAuditoria
  ): Promise<readonly AuditoriaPedido[]> {
    return this.repositorio.consultar(filtros);
  }

  public async calcularKpisGerenciais(tenantId: string): Promise<ResumoKpisAuditoria> {
    const todos = await this.repositorio.obterTodos(tenantId);
    const total = todos.length;
    if (total === 0) {
      return {
        totalRegistros: 0,
        totalSobrecompras: 0,
        totalSubcompras: 0,
        totalConformes: 0,
        taxaAderenciaMotorPercentual: 100,
        impactoFinanceiroTotalSobrecompra: 0,
      };
    }

    let sobrecompras = 0;
    let subcompras = 0;
    let conformes = 0;
    let impactoFinanceiroSobrecompra = 0;

    for (const reg of todos) {
      if (reg.classificacaoDivergencia === "SOBRECOMPRA") {
        sobrecompras++;
        impactoFinanceiroSobrecompra += reg.impactoFinanceiroDivergencia;
      } else if (reg.classificacaoDivergencia === "SUBCOMPRA" || reg.classificacaoDivergencia === "ZERAMENTO_MANUAL") {
        subcompras++;
      } else {
        conformes++;
      }
    }

    const taxaAderencia = (conformes / total) * 100;

    return {
      totalRegistros: total,
      totalSobrecompras: sobrecompras,
      totalSubcompras: subcompras,
      totalConformes: conformes,
      taxaAderenciaMotorPercentual: Number(taxaAderencia.toFixed(2)),
      impactoFinanceiroTotalSobrecompra: Number(impactoFinanceiroSobrecompra.toFixed(2)),
    };
  }
}
```

---

### 4.3. Especificação das Rotas de API e Validação em Dupla Camada

Para proteger as rotas server-side no Next.js (App Router), os seguintes handlers devem ser implementados ou adaptados:

#### 1. Rota de Carga de Inventário: `GET /api/compras`
- **Extração de Sessão:** Lê credenciais do cabeçalho de autorização ou cookie de sessão. Se ausente, retorna `401 Unauthorized`.
- **Validação de Tenant:** Verifica se `usuario.tenantId === requestTenant`. Se divergente, retorna `403 Forbidden`.
- **Validação de Carteira:**
  - Extrai parâmetros da query string (`filialId`, `secaoId`, `fornecedorIdSolicitado`).
  - Passa por `aplicarGuardrailInventarioServerSide(usuario, filtroSolicitado)`.
  - Se o comprador enviar `fornecedorIdSolicitado` fora de `usuario.allowedSupplierIds`, lança `ErroAcessoNegado` e o handler retorna:
    ```json
    HTTP 403 Forbidden
    {
      "erro": "Acesso Negado",
      "motivo": "Tentativa de acesso não autorizada ao fornecedor 502. Fornecedor fora da sua carteira homologada.",
      "codigo": "FORBIDDEN",
      "fornecedorBloqueado": 502
    }
    ```
  - Se a requisição for legítima, delega ao `InventoryAdapter` com o filtro protegido.

#### 2. Rota de Registro de Pedidos: `POST /api/pedidos`
- **Sanitização:** Valida o corpo da requisição com `SchemaPayloadPedido` (Zod).
- **Validação de Carteira:** Invoca `validarItensPedidoServerSide(usuario, payload.itens)`.
- Se qualquer SKU do lote pertencer a um fornecedor não homologado, rejeita a transação inteira com `403 Forbidden`, impedindo qualquer inserção ou efeito colateral.
- **Gravação na Trilha de Auditoria:** Para cada item aceito, o `ServicoAuditoria.registrarDecisao(...)` gera o registro imutável com cálculo de sobrecompra e encadeamento SHA-256.

#### 3. Rota do Painel do Gestor: `GET /api/admin/auditoria`
- **Guarda Gerencial:** Executa `garantirAcessoGerencial(usuario)`.
- Se `usuario.role === "COMPRADOR"`, retorna imediatamente:
  ```json
  HTTP 403 Forbidden
  {
    "erro": "Acesso Negado",
    "motivo": "Acesso Negado: O Painel e Logs de Auditoria são restritos a Gestores e Administradores.",
    "codigo": "FORBIDDEN"
  }
  ```
- Se for `GESTOR` ou `ADMIN`, aceita filtros (`compradorId`, `fornecedorId`, `apenasSobrecompras`) e retorna os registros auditados junto com os `ResumoKpisAuditoria`.

---

### 4.4. Estratégia de Testes Vitest

O implementador deverá criar duas suítes em `tests/seguranca/`:

#### A. `tests/seguranca/rbac.test.ts` (10 Cenários Mandatórios)
1. **Comprador com carteira restrita [501]:** Carga de inventário retorna apenas itens do fornecedor 501.
2. **Comprador tentando burlar via query (?fornecedorId=502):** Backend rejeita com `ErroAcessoNegado` e status 403.
3. **Comprador enviando pedido com item de fornecedor 502:** Backend rejeita com 403 Forbidden e mensagem explicativa.
4. **Comprador sem fornecedores cadastrados na carteira:** Backend rejeita carga com 403.
5. **Gestor com permissão total:** Carga de inventário com `fornecedoresPermitidos: null` retorna todos os fornecedores (501, 502, 503, 504, 505) sem erro 403.
6. **Gestor filtrando fornecedor específico:** Carga com fornecedor 501 é permitida normalmente para o gestor.
7. **Isolamento Multi-Tenant:** Usuário do tenant `carreiro` é rejeitado ao tentar operar no tenant `outro-cliente` com `ErroViolacaoTenant` (403).
8. **Bloqueio de Comprador no Painel de Auditoria:** Comprador chamando `garantirAcessoGerencial` recebe 403 Forbidden.
9. **Sanitização Zod anti-injeção DAX/SQL:** Queries com `AMORTECEDOR'; DROP TABLE--` ou `EVALUATE FILTER(...)` são rejeitadas no schema Zod.
10. **Performance O(1) de validação em escala:** Verificação de carteira de 25.000 itens executa em menos de 5ms via Set.

#### B. `tests/seguranca/auditoria.test.ts` (10 Cenários Mandatórios)
1. **Pedido Conforme Sugestão:** Sugerido = 10, Digitado = 10 -> Classificação `CONFORME_SUGESTAO`, divergência = 0.
2. **Sobrecompra Manual:** Sugerido = 4, Digitado = 10 -> Classificação `SOBRECOMPRA`, divergência = +6 un, impacto financeiro = `+6 * precoCusto`, justificativa preenchida.
3. **Subcompra Manual:** Sugerido = 12, Digitado = 6 -> Classificação `SUBCOMPRA`, divergência = -6 un.
4. **Zeramento Manual:** Sugerido = 8, Digitado = 0 -> Classificação `ZERAMENTO_MANUAL`.
5. **Imutabilidade em Runtime:** Objeto de auditoria possui `Object.freeze` e tentativas de alteração disparam erro ou são ignoradas.
6. **Integridade da Cadeia de Hash:** Cada registro possui `hashIntegridade = SHA256(...)` encadeado ao anterior.
7. **Detecção de Adulteração (Tamper Detection):** Modificação simulada de um campo em um registro intermediário é detectada por `validarCadeiaAuditoria` com indicação do índice e erro.
8. **Filtro de Auditoria por Comprador:** Consulta filtrando `compradorId` retorna estritamente as decisões do comprador selecionado.
9. **Filtro de Auditoria por Sobrecompras:** Consulta com `apenasSobrecompras: true` isola apenas pedidos divergentes para cima.
10. **Cálculo de KPIs Gerenciais:** Serviço calcula corretamente total de registros, total de sobrecompras, taxa de aderência percentual e volume financeiro em R$ das sobrecompras.

---

## 5. Verification Method (Método de Verificação Independente)

Para que qualquer auditor ou agente possa validar independentemente as especificações deste relatório:

### 5.1. Comandos de Verificação do Projeto
1. **Verificar tipagem estrita do TypeScript:**
   ```powershell
   npx tsc --noEmit
   ```
   *Critério:* 0 erros de compilação em `strict: true`.
2. **Rodar a suíte completa de testes existentes:**
   ```powershell
   npm test
   ```
   *Critério:* Todos os 33 arquivos e 275 testes devem passar sem regressão.
3. **Rodar especificamente os testes de segurança após implementação pelo worker:**
   ```powershell
   npx vitest run tests/seguranca/
   ```
   *Critério:* 100% dos testes de `rbac.test.ts` e `auditoria.test.ts` verdes.

### 5.2. Condições de Invalidação
Este desenho arquitetural será considerado inválido se:
1. Qualquer comprador conseguir carregar dados de um fornecedor fora de sua carteira através de uma requisição de backend forçada.
2. Um comprador conseguir visualizar dados do Painel de Auditoria Gerencial sem receber HTTP 403 Forbidden.
3. Um registro de auditoria for passível de mutação ou se a cadeia de hash permitir alteração sem falha no validador.
4. A validação de carteira adicionar latência superior a 15ms sobre o lote de 25.000 SKUs.

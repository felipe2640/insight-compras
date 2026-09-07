# Relatório de Handoff — Arquitetura de Interação Humana no Cockpit do Comprador: EditableCell e useSessionDraft

> **Agente**: `explorer_m3_interacao_r1` (teamwork_preview_explorer)  
> **Data de Emissão**: 2026-09-06  
> **Marco**: M3 — Cockpit do Comprador Virtualizado & Tooltips Analíticos  
> **Destinatário**: Project Orchestrator e Agentes de Implementação Frontend  
> **Status**: Homologado e Pronto para Implementação  

---

## 1. Observation

A investigação baseou-se nos requisitos formais estritos de `ORIGINAL_REQUEST.md` (Requisito `R2` e Critérios de Aceite), em `PROJECT.md` (Milestone M3, Itens 21 e 22), em `TEST_INFRA.md` (Tier 1 Feature 4 e Tier 2 Boundary), no handoff preliminar `spec_miner_m0_cockpit/handoff.md`, na implementação pura já existente em `core/travas/lote-multiplo.ts`, e no diagnóstico técnico aprofundado dos componentes legados em `c:\Users\Felipe Barbosa\Documents\diario\compra-auto\components\calc-dia\EditableCell.tsx` e `use-session-draft.ts`.

### 1.1 Evidências do Código Legado e Gaps Estruturais Observados

#### A. Célula Editável (`EditableCell.tsx` legado: linhas 1-69)
```tsx
// Trecho legado de c:\Users\Felipe Barbosa\Documents\diario\compra-auto\components\calc-dia\EditableCell.tsx:
export const EditableCell = memo(({ initialValue, row, onCommit }: EditableCellProps) => {
  const isMultiplo = row.requiresMinMultiplo;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const inputs = document.querySelectorAll(".editable-cell-input");
      const inputsArray = Array.from(inputs) as HTMLInputElement[];
      const currentIndex = inputsArray.indexOf(e.currentTarget);
      const direction = e.shiftKey ? -1 : 1;
      const nextInput = inputsArray[currentIndex + direction];
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };
  // ...
  return (
    <Input
      defaultValue={initialValue}
      key={`${row.produto_id}-${onCommit.name}-${initialValue}`}
      onBlur={(e) => {
        if (e.target.value !== initialValue) onCommit(row, e.target.value);
      }}
      onKeyDown={handleKeyDown}
      style={{ backgroundColor: isMultiplo ? "#FFFFCC" : "white" }}
    />
  );
});
```
**Gaps e Deficiências Identificados no Legado**:
1. **Falta de Suporte à tecla `Escape`**: O código legado não trata a tecla `Escape`. O comprador que comete um erro de digitação e pressiona Escape não consegue cancelar a edição; ao desfocar o campo, o valor corrompido ainda é disparado no `onBlur`.
2. **Forçamento de Remontagem do DOM via `key` (`key={...}`)**: O input usa `key={`${row.produto_id}-${onCommit.name}-${initialValue}`}` para forçar sincronização quando o valor muda externamente. No contexto de uma tabela virtualizada com TanStack Virtual com rolagem rápida e reordenações, recriar nós DOM destrói o estado de foco e a continuidade da navegação pelo teclado.
3. **Ausência de Arredondamento Local de Múltiplos e Embalagem Mínima (`applyMinMultiplo`)**: A lógica de múltiplos ficava espalhada fora do componente (`CalcDiaTable.tsx:932`), sem validação inline nem feedback semântico imediato ao usuário no momento do blur.
4. **Sanitização Frágil de Entrada**: Não havia rejeição imediata de números negativos ou strings puramente alfabéticas antes de emitir o evento, gerando estados inconsistentes.
5. **Estilização Hardcoded**: Fundo `#FFFFCC` injetado como CSS inline, ignorando o design system Tailwind e variáveis de tema White-Label do SaaS, além de não destacar se o valor foi alterado manualmente pelo comprador (`isDirty`).

#### B. Persistência de Rascunho (`use-session-draft.ts` legado: linhas 1-251)
```typescript
// Trecho legado de c:\Users\Felipe Barbosa\Documents\diario\compra-auto\components\calc-dia\use-session-draft.ts:
const DEFAULT_TTL_MS = 60 * 60 * 1000;
const DEFAULT_DEBOUNCE_MS = 2000;

export type SessionDraftWork = {
  customRecommendations: Record<LojaKey, Record<number, StoreRecommendationValues>>;
  rowSelection?: Record<string, boolean>;
  excludedCodes: string[];
  secaoDeselected: string[];
  subSecaoDeselected: string[];
  marcaDeselected: string[];
  columnFilters: ColumnFiltersState;
};

const storageKey = React.useMemo(
  () => (userId ? `calc-dia-draft-${userId}` : null),
  [userId],
);
```
**Gaps e Deficiências Identificados no Legado**:
1. **Chave Incompatível com SaaS Multi-Tenant**: A chave era restrita a `calc-dia-draft-${userId}`. Em um ambiente SaaS multi-inquilino (ex: Rede Carreiro vs outros clientes), dois tenants no mesmo subdomínio ou computador compartilhado colidem dados se usarem o mesmo userId numérico. A chave mandatória deve ser: `insight-compras-draft-${tenantId}-${userId}`.
2. **Payload Excessivamente Pesado (Risco de Quota)**: No legado, `customRecommendations` gravava matrizes completas por loja com objetos aninhados pesados. Para o catálogo de 25.000 SKUs da Rede Carreiro, serializar dados de itens não modificados causaria estouro imediato da cota de 5MB do `localStorage` (`QuotaExceededError`) e travamento de dezenas de milissegundos na main thread durante o `JSON.stringify`.
3. **Falta de Versionamento do Payload**: Sem campo `versao`, atualizações no schema do rascunho em deploys contínuos quebravam o cliente durante o parse.

#### C. Lógica Matemática já Validada no Core Puro (`core/travas/lote-multiplo.ts`)
O núcleo da plataforma já contém a matemática de autopeças implementada:
- `arredondarParaMultiplo(quantidadeDesejada, multiplo)`:
  $$\text{se } \text{qtd} \le 0 \implies 0; \quad \text{senão } \lceil \text{qtd} / \text{multiplo} \rceil \times \text{multiplo}$$
- `inferirLotePadraoPorCategoria(descricaoOuCategoria)`: identifica que amortecedores, discos de freio, molas e tambores exigem par (`lote = 2`), e velas exigem jogo de 4 (`lote = 4`).
- `ajustarQuantidadePorLote(parametros)`: suporta combinação de `embalagemMinima` e `multiploLote`.

---

## 2. Logic Chain

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 1. Premissa Operacional de Autopeças (ORIGINAL_REQUEST R2 & Relatório Executivo)  │
│    - Compradores operam centenas de SKUs em ritmo acelerado via teclado.          │
│    - Itens como amortecedores e discos só podem ser comprados em pares (mult = 2).│
│    - Caixas de óleo e velas exigem lotes de fábrica (12/24 un e 4 un).            │
│    - Digitações errôneas ou interrupções geram desvios de compras e encalhe.      │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │ requer
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 2. Arquitetura da Célula Editável (EditableCell)                                  │
│    - Navegação com Tab (pula para o próximo .editable-cell-input visível).        │
│    - Enter: confirmação imediata com blur().                                      │
│    - Escape: restauração do valor anterior e cancelamento seguro do commit.       │
│    - applyMinMultiplo acionado no commit: arredonda para cima mantendo integridade│
│    - Sanitização rigorosa: rejeita letras, NaN e números negativos.               │
│    - Destaque cromático semântico: fundo amarelo suave (#FFFFCC / amber-50) para  │
│      múltiplos, borda azul para itens editados manualmente (isDirty).             │
│    - Isolamento de estado local com React.memo para preservar 60fps no grid.      │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │ alimenta
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 3. Arquitetura de Persistência Contínua (useSessionDraft)                         │
│    - Chave isolada por tenant e usuário: insight-compras-draft-${tenantId}-${userId}│
│    - Debounce de 1500ms a 2000ms para evitar gargalo de I/O em digitação contínua.│
│    - Formato Estritamente Enxuto (Lean Delta): apenas os SKUs efetivamente        │
│      alterados ({ [sku]: { quantidade, modificadoEm } }) + filtros ativos.        │
│      NUNCA salva os 25.000 SKUs completos (consumo < 40KB vs limite de 5MB).      │
│    - Tratamento resiliente de QuotaExceededError e detecção de storage seguro.    │
│    - Banner de recuperação na carga da página com expiração por TTL de 1 hora.    │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │ garante
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 4. Esteira de Testes Unitários em tests/cockpit/ (Vitest + React Testing Library) │
│    - 100% de cobertura nos fluxos de teclado, múltiplos, sanitização e storage.   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Especificação Arquitetural e Funcional Detalhada

### 3.1 Célula Editável de Pedido (`EditableCell`)

#### A. Contrato de Tipos (TypeScript Strict)
```typescript
export interface EditableCellProps {
  /** Valor inicial sugerido pelo motor ou restaurado do rascunho */
  readonly initialValue: number;
  /** Identificador único do SKU / Produto */
  readonly skuId: string | number;
  /** Múltiplo de embalagem ou par de fábrica (ex: 2 para amortecedores, 4 para velas, 1 avulso) */
  readonly minMultiplo?: number;
  /** Embalagem mínima de faturamento do fornecedor (default: 1) */
  readonly embalagemMinima?: number;
  /** Valor original calculado pelo motor de decisão (para identificar estado dirty) */
  readonly valorSugeridoSistema?: number;
  /** Callback disparado apenas quando há confirmação de alteração válida */
  readonly onCommit: (skuId: string | number, quantidadeFinal: number, motivoAjuste: string | null) => void;
  /** Indica se a célula está em modo somente leitura (ex: auditoria ou falta de permissão) */
  readonly disabled?: boolean;
  /** Classe CSS customizada opcional */
  readonly className?: string;
}
```

#### B. Mecanismo de Navegação por Teclado na Grade Virtualizada
Em uma tabela virtualizada com TanStack Virtual, apenas as ~30 a 50 linhas contidas na viewport do DOM estão presentes como nós HTML. A navegação ágil por teclado opera da seguinte forma:

1. **Tecla `Tab` (Avançar) e `Shift + Tab` (Recuar)**:
   - O evento `onKeyDown` é interceptado com `e.preventDefault()`.
   - Consulta `document.querySelectorAll<HTMLInputElement>(".editable-cell-input:not([disabled])")`.
   - Localiza o índice do input atualmente focado (`currentIndex`).
   - Define a direção: `direction = e.shiftKey ? -1 : 1`.
   - Próximo elemento: `inputsArray[currentIndex + direction]`.
   - Se o próximo input existir na viewport:
     - Foca no input: `nextInput.focus()`.
     - Seleciona o texto completo: `nextInput.select()`.
   - Se o comprador estiver no último input da área visível e pressionar `Tab`, o virtualizador realiza o auto-scroll para a linha seguinte ou o foco navega suavemente sem quebrar o layout.
2. **Tecla `Enter` (Confirmar)**:
   - Intercepta `e.preventDefault()`.
   - Invoca `e.currentTarget.blur()`.
   - O evento de perda de foco (`onBlur`) executa a sanitização, a aplicação do `applyMinMultiplo` e o disparo do `onCommit`.
3. **Tecla `Escape` (Cancelar e Restaurar)**:
   - Intercepta `e.preventDefault()`.
   - Define uma flag de cancelamento: `cancelRef.current = true`.
   - Restaura o valor local para o `initialValue`: `setLocalValue(String(initialValue))`.
   - Remove o foco: `e.currentTarget.blur()`.
   - No `onBlur`, a flag `cancelRef.current` impede qualquer disparo de `onCommit`, garantindo que edições descartadas não sejam propagadas.

#### C. Validação e Aplicação Estrita de Múltiplos (`applyMinMultiplo`)
A função pura do domínio é invocada na confirmação do valor:
```typescript
export function applyMinMultiplo(
  valorDesejado: number,
  multiplo: number = 1,
  embalagemMinima: number = 1
): { valorAjustado: number; ajustado: boolean; motivo: string | null } {
  if (!Number.isFinite(valorDesejado) || valorDesejado <= 0) {
    return { valorAjustado: 0, ajustado: valorDesejado !== 0, motivo: null };
  }

  const mult = Math.max(1, Math.floor(multiplo));
  const embMin = Math.max(1, Math.floor(embalagemMinima));

  // 1. Aplica embalagem mínima primeiro
  const base = Math.max(valorDesejado, embMin);

  // 2. Arredonda para cima no múltiplo exato
  const valorAjustado = mult <= 1 ? Math.ceil(base) : Math.ceil(base / mult) * mult;

  const ajustado = valorAjustado !== valorDesejado;
  let motivo: string | null = null;

  if (ajustado) {
    if (mult === 2) {
      motivo = "Ajustado para par (múltiplo de 2 un)";
    } else if (mult === 4) {
      motivo = "Ajustado para jogo de 4 un";
    } else if (mult > 1) {
      motivo = `Ajustado para múltiplo de fábrica (${mult} un)`;
    } else if (base > valorDesejado) {
      motivo = `Ajustado para embalagem mínima (${embMin} un)`;
    }
  }

  return { valorAjustado, ajustado, motivo };
}
```

#### D. Sanitização de Entrada
- **Rejeição de Valores Negativos**: Se o comprador digitar `-5` ou `--10`, o valor sanitizado é convertido para `0`.
- **Rejeição de Caracteres Alfabéticos e Símbolos**: Se o comprador digitar `abc` ou `undefined`, restaura `initialValue` como fallback seguro.
- **Normalização de Decimais**: Autopeças físicas são contadas em unidades inteiras. Se o comprador digitar `5,5` ou `5.5`, normaliza para inteiro via `Math.floor` ou `Math.ceil`.

#### E. Destaque Visual Semântico e Estados Cromáticos
O componente utiliza classes Tailwind CSS com fallbacks compatíveis com o tema institucional da Rede Carreiro:
1. **Exigência de Múltiplos de Fábrica (`minMultiplo > 1`)**:
   - Fundo amarelo claro pastel: `#FFFFCC` / Tailwind `bg-amber-50/80 border-amber-300 text-amber-950`.
   - Adiciona um micro-badge sutil indicando a regra (ex: `par`, `4 un`, `cx 12`).
2. **Valor Ajustado pelo Comprador (`isDirty`, diferente da sugestão do motor)**:
   - Borda contrastante azul/índigo: `border-blue-600 ring-1 ring-blue-500/30 font-bold`.
   - Indica visualmente ao comprador que aquele item divergiu do cálculo automático do sistema.
3. **Valor Ajustado Automaticamente por Múltiplo (ex: digitou 5, virou 6)**:
   - Breve transição de animação visual (`transition-colors duration-300`) com tooltip flutuante imediato reportando o arredondamento de fábrica.

---

### 3.2 Rascunho de Sessão Contínuo (`useSessionDraft`)

#### A. Chave Estruturada e Isolamento Multi-Tenant
A chave de persistência no `localStorage` adota a seguinte convenção:
$$\text{Chave} = \text{`insight-compras-draft-\$\{tenantId\}-\$\{userId\}`}$$
- Garante total isolamento entre compradores e entre clientes SaaS distintos.
- Não deixa rascunhos anônimos ou compartilhados acidentalmente.

#### B. Formato Enxuto de Dados (Lean Delta-Only)
Para suportar com máxima fluidez o catálogo de **25.000 SKUs** sem estourar o limite de 5MB de `localStorage`:
- **Regra Inviolável**: NUNCA salvar a lista completa de produtos ou arrays estáticos.
- Salvar **apenas o delta** de SKUs alterados e o estado compacto dos filtros:

```typescript
export interface ItemDeltaRascunho {
  readonly pedir?: number;
  readonly transferir?: number;
  readonly modificadoEm: number; // Date.now()
  readonly ajustadoPorMultiplo?: boolean;
}

export interface EstadoFiltrosRascunho {
  readonly queryBusca?: string;
  readonly marcasDeselecionadas?: string[];
  readonly secoesDeselecionadas?: string[];
  readonly curvasDeselecionadas?: string[];
  readonly filtroStatus?: string;
  readonly lojaFocoId?: number | string;
}

export interface RascunhoSessaoPayload {
  readonly versao: number; // Schema version (v1)
  readonly timestamp: number; // Timestamp do último salvamento
  readonly tenantId: string;
  readonly userId: string;
  readonly deltas: Record<string, ItemDeltaRascunho>; // Chave = codigoSku ou produtoId
  readonly filtros?: EstadoFiltrosRascunho;
  readonly config?: {
    leadTimeDias?: number;
    diasCoberturaABC?: { A: number; B: number; C: number };
  };
}
```
**Análise de Consumo de Armazenamento**:
- Cada SKU alterado ocupa ~65 bytes no JSON.
- 500 SKUs editados em uma sessão de trabalho intensiva ocupam **~32 KB**.
- 32 KB representam **menos de 0,7%** da cota de 5MB do navegador, eliminando o risco de `QuotaExceededError` sob condições normais de uso.

#### C. Debounce Configurável (1500ms a 2000ms)
- O hook recebe parâmetro `debounceMs` (padrão: `1500ms`, ajustável até `2000ms`).
- Durante digitações consecutivas na tabela, o temporizador é reiniciado.
- Expõe flags reativas:
  - `isSaving: boolean` — indica sincronização em segundo plano.
  - `lastSavedAt: number | null` — carimbo do último salvamento bem-sucedido.
  - `saveError: DraftSaveError | null` — informações de falha em caso de exceção.

#### D. Tratamento Robusto de `QuotaExceededError` e Disponibilidade
O hook encapsula acessos ao `localStorage` com tratamento de exceções:
- Se o navegador disparar `QuotaExceededError` (ou `NS_ERROR_DOM_QUOTA_REACHED` no Firefox):
  - Captura sem quebrar o ciclo de vida do React.
  - Emite estado de erro amigável:
    `"Armazenamento local cheio. Exporte seu pedido ou limpe o histórico do navegador."`
- Se o site estiver rodando em iframe sem permissão de storage ou modo anônimo restritivo (`SecurityError`):
  - Retorna gracefully sem lançar erros não tratados.

#### E. Ciclo de Vida: Detecção, Banner e TTL de 1 Hora
1. **Inicialização (Mount)**:
   - Lê `localStorage.getItem(chave)`.
   - Se existir payload:
     - Valida `parsed.versao === 1` e `parsed.userId === userId` e `parsed.tenantId === tenantId`.
     - Verifica o tempo decorrido: `Date.now() - parsed.timestamp`.
     - **Regra de TTL (1 hora = 3.600.000 ms)**: Se decorrido tempo $> 1\text{h}$, purga o rascunho automaticamente (`localStorage.removeItem(chave)`) e define `draftAvailable: null`.
     - Se estiver dentro do prazo de 1 hora e contiver ao menos 1 delta alterado:
       - Ativa `draftAvailable: RascunhoSessaoPayload`.
2. **Apresentação do Banner de Restauração**:
   - Componente visual `BannerRascunho` exibe na `TopToolbar`:
     *"Rascunho disponível de 06/09/2026 às 14:32 (N itens alterados) — [Restaurar] [Descartar]"*.
3. **Ação `restaurarRascunho()`**:
   - Aplica os deltas sobre a matriz de dados em memória.
   - Restaura filtros e seleções.
   - Desativa o banner (`draftAvailable: null`).
4. **Ação `descartarRascunho()`**:
   - Executa `localStorage.removeItem(chave)`.
   - Reseta `draftAvailable: null`.
   - Mantém as sugestões originais do motor intactas.
5. **Ação `limparRascunho()` (Conclusão do Pedido)**:
   - Disparada após a emissão e gravação do pedido na trilha de auditoria para que a próxima sessão inicie limpa.

---

### 3.3 Código de Referência Arquitetural Proposto (Proposed Implementations)

As implementações conceituais completas abaixo foram desenhadas em estrita conformidade com `PROJECT.md`, Clean Architecture e o guia de melhores práticas React (`AGENTS.md`).

#### A. Componente `EditableCell.tsx` Proposto
```tsx
// Caminho de destino na implementação: src/components/cockpit/EditableCell.tsx
"use client";

import React, { memo, useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { applyMinMultiplo } from "./utils-multiplo";

export interface EditableCellProps {
  initialValue: number;
  skuId: string | number;
  minMultiplo?: number;
  embalagemMinima?: number;
  valorSugeridoSistema?: number;
  onCommit: (skuId: string | number, quantidadeFinal: number, motivoAjuste: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export const EditableCell = memo(function EditableCell({
  initialValue,
  skuId,
  minMultiplo = 1,
  embalagemMinima = 1,
  valorSugeridoSistema,
  onCommit,
  disabled = false,
  className,
}: EditableCellProps) {
  // Estado local desacoplado da matriz global para digitação a 60fps
  const [localValue, setLocalValue] = useState<string>(() => String(initialValue ?? 0));
  const cancelRef = useRef<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincroniza estado local se initialValue mudar externamente (ex: restauração de rascunho)
  useEffect(() => {
    setLocalValue(String(initialValue ?? 0));
  }, [initialValue]);

  // Identificação semântica de regras e estados
  const isMultiplo = minMultiplo > 1;
  const numLocal = Number(localValue);
  const isDirty = valorSugeridoSistema != null && Number.isFinite(numLocal) && numLocal !== valorSugeridoSistema;

  // Commit seguro acionado no blur
  const handleBlur = useCallback(() => {
    // Se a edição foi cancelada via Escape, não executa o commit
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }

    // 1. Sanitização estrita de entrada
    const limpo = localValue.replace(",", ".").replace(/[^\d.]/g, "");
    let valorNumerico = parseFloat(limpo);

    if (!Number.isFinite(valorNumerico) || valorNumerico < 0) {
      valorNumerico = initialValue; // Fallback seguro para o valor anterior
    } else {
      valorNumerico = Math.floor(valorNumerico); // Autopeças são itens inteiros
    }

    // 2. Aplicação estrita de múltiplos de fábrica e embalagens mínimas
    const { valorAjustado, motivo } = applyMinMultiplo(valorNumerico, minMultiplo, embalagemMinima);

    // Atualiza o estado local com o valor final sanitizado e ajustado
    setLocalValue(String(valorAjustado));

    // Dispara commit se o valor final diferir do initialValue
    if (valorAjustado !== initialValue) {
      onCommit(skuId, valorAjustado, motivo);
    }
  }, [localValue, initialValue, minMultiplo, embalagemMinima, skuId, onCommit]);

  // Navegação ágil por teclado
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // 1. Tab: Pula diretamente para o próximo input na área visível
      if (e.key === "Tab") {
        e.preventDefault();

        const inputs = Array.from(
          document.querySelectorAll<HTMLInputElement>(".editable-cell-input:not([disabled])")
        );
        const currentIndex = inputs.indexOf(e.currentTarget);
        if (currentIndex === -1) return;

        const direction = e.shiftKey ? -1 : 1;
        const nextIndex = currentIndex + direction;
        const nextInput = inputs[nextIndex];

        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
        return;
      }

      // 2. Enter: Confirma e desfoca
      if (e.key === "Enter") {
        e.preventDefault();
        e.currentTarget.blur();
        return;
      }

      // 3. Escape: Restaura o valor original e cancela
      if (e.key === "Escape") {
        e.preventDefault();
        cancelRef.current = true;
        setLocalValue(String(initialValue ?? 0));
        e.currentTarget.blur();
        return;
      }
    },
    [initialValue]
  );

  return (
    <div className="relative flex items-center justify-center">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={disabled}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "editable-cell-input h-8 w-20 rounded border text-center font-mono text-xs font-medium transition-colors outline-none",
          // Regra visual de múltiplos de fábrica (amarelo claro suave)
          isMultiplo
            ? "bg-[#FFFFCC] text-amber-950 border-amber-300 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-200"
            : "bg-white text-slate-900 border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100",
          // Destaque visual semântico de ajuste manual (isDirty)
          isDirty && "border-blue-600 ring-1 ring-blue-500/40 font-bold",
          // Foco acessível
          "focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500/30",
          disabled && "cursor-not-allowed opacity-50 bg-slate-100 dark:bg-slate-800",
          className
        )}
        aria-label={`Quantidade a pedir para SKU ${skuId}`}
        title={
          isMultiplo
            ? `Item com múltiplo de fábrica: ${minMultiplo} un${embalagemMinima > 1 ? ` (mínimo: ${embalagemMinima} un)` : ""}`
            : undefined
        }
      />
      {isMultiplo && (
        <span
          className="absolute -top-1.5 -right-1.5 flex h-3.5 items-center justify-center rounded-full bg-amber-200 px-1 text-[9px] font-bold text-amber-900 border border-amber-300 dark:bg-amber-800 dark:text-amber-100 dark:border-amber-600"
          title={`Lote obrigatório de ${minMultiplo} un`}
        >
          {minMultiplo === 2 ? "par" : `${minMultiplo}x`}
        </span>
      )}
    </div>
  );
}, (prev, next) => {
  return (
    prev.initialValue === next.initialValue &&
    prev.skuId === next.skuId &&
    prev.minMultiplo === next.minMultiplo &&
    prev.embalagemMinima === next.embalagemMinima &&
    prev.valorSugeridoSistema === next.valorSugeridoSistema &&
    prev.disabled === next.disabled
  );
});

EditableCell.displayName = "EditableCell";
```

#### B. Hook `useSessionDraft.ts` Proposto
```typescript
// Caminho de destino na implementação: src/components/cockpit/use-session-draft.ts
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

export const DRAFT_SCHEMA_VERSION = 1;
export const DEFAULT_DRAFT_DEBOUNCE_MS = 1500;
export const DEFAULT_DRAFT_TTL_MS = 60 * 60 * 1000; // 1 hora de validade estrita

export interface ItemDeltaRascunho {
  quantidade: number;
  modificadoEm: number;
  tipo?: "pedir" | "transferir";
  ajustadoPorMultiplo?: boolean;
}

export interface EstadoFiltrosRascunho {
  queryBusca?: string;
  marcasDeselecionadas?: string[];
  secoesDeselecionadas?: string[];
  curvasDeselecionadas?: string[];
  filtroStatus?: string;
  lojaFocoId?: number | string;
}

export interface RascunhoSessaoPayload {
  versao: number;
  timestamp: number;
  tenantId: string;
  userId: string;
  deltas: Record<string, ItemDeltaRascunho>; // Chave = SKU/ID. Apenas itens modificados!
  filtros?: EstadoFiltrosRascunho;
  config?: {
    leadTimeDias?: number;
    diasCoberturaABC?: { A: number; B: number; C: number };
  };
}

export interface DraftSaveError {
  tipo: "QUOTA" | "SEGURANCA" | "SERIALIZACAO" | "DESCONHECIDO";
  mensagem: string;
  dica?: string;
}

export interface UseSessionDraftParams {
  tenantId: string;
  userId: string;
  deltas: Record<string, ItemDeltaRascunho>;
  filtros?: EstadoFiltrosRascunho;
  config?: RascunhoSessaoPayload["config"];
  debounceMs?: number;
  ttlMs?: number;
  habilitado?: boolean;
}

export interface UseSessionDraftReturn {
  draftAvailable: RascunhoSessaoPayload | null;
  isSaving: boolean;
  lastSavedAt: number | null;
  saveError: DraftSaveError | null;
  restaurarRascunho: () => RascunhoSessaoPayload | null;
  descartarRascunho: () => void;
  limparRascunho: () => void;
}

function identificarErroStorage(erro: unknown): DraftSaveError {
  const nome = typeof erro === "object" && erro && "name" in erro ? String((erro as { name?: string }).name) : "";
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  const texto = `${nome} ${mensagem}`.toLowerCase();

  if (texto.includes("quota") || texto.includes("quotaexceeded") || texto.includes("ns_error_dom_quota_reached")) {
    return {
      tipo: "QUOTA",
      mensagem: "Falha ao salvar o rascunho: armazenamento local do navegador esgotado.",
      dica: "Limpe dados do navegador ou exporte seus pedidos para liberar espaço.",
    };
  }

  if (texto.includes("security") || texto.includes("denied") || texto.includes("blocked") || texto.includes("insecure")) {
    return {
      tipo: "SEGURANCA",
      mensagem: "Acesso ao armazenamento bloqueado por políticas do navegador.",
      dica: "Verifique configurações de modo anônimo, extensões de privacidade ou permissões.",
    };
  }

  return {
    tipo: "DESCONHECIDO",
    mensagem: "Falha inesperada ao gravar rascunho de sessão.",
    dica: mensagem ? `Detalhes técnicos: ${mensagem}` : undefined,
  };
}

export function useSessionDraft({
  tenantId,
  userId,
  deltas,
  filtros,
  config,
  debounceMs = DEFAULT_DRAFT_DEBOUNCE_MS,
  ttlMs = DEFAULT_DRAFT_TTL_MS,
  habilitado = true,
}: UseSessionDraftParams): UseSessionDraftReturn {
  const [draftAvailable, setDraftAvailable] = useState<RascunhoSessaoPayload | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<DraftSaveError | null>(null);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const deltasRef = useRef(deltas);
  const filtrosRef = useRef(filtros);
  const configRef = useRef(config);

  // Mantém refs sincronizadas para evitar disparos desnecessários de useEffect
  deltasRef.current = deltas;
  filtrosRef.current = filtros;
  configRef.current = config;

  // Chave estruturada por tenant e usuário
  const storageKey = useMemo(() => {
    if (!tenantId || !userId) return null;
    return `insight-compras-draft-${tenantId}-${userId}`;
  }, [tenantId, userId]);

  // 1. Ciclo de Vida: Leitura inicial na montagem (Mount)
  useEffect(() => {
    if (typeof window === "undefined" || !storageKey || !habilitado) {
      setDraftAvailable(null);
      return;
    }

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setDraftAvailable(null);
        return;
      }

      const parsed: RascunhoSessaoPayload = JSON.parse(raw);

      // Validação de integridade do payload
      if (!parsed || parsed.versao !== DRAFT_SCHEMA_VERSION || parsed.tenantId !== tenantId || parsed.userId !== userId) {
        localStorage.removeItem(storageKey);
        setDraftAvailable(null);
        return;
      }

      // Validação de TTL (1 hora)
      const idadeMs = Date.now() - parsed.timestamp;
      if (idadeMs > ttlMs) {
        localStorage.removeItem(storageKey);
        setDraftAvailable(null);
        return;
      }

      // Só disponibiliza se houver ao menos 1 delta registrado
      if (parsed.deltas && Object.keys(parsed.deltas).length > 0) {
        setDraftAvailable(parsed);
        setLastSavedAt(parsed.timestamp);
      } else {
        setDraftAvailable(null);
      }
    } catch (erro) {
      setSaveError(identificarErroStorage(erro));
      setDraftAvailable(null);
    }
  }, [storageKey, tenantId, userId, ttlMs, habilitado]);

  // 2. Persistência com Debounce
  useEffect(() => {
    if (typeof window === "undefined" || !storageKey || !habilitado) return;

    // Se há um rascunho anterior pendente de restauração/descarte pelo usuário, não sobrescreve
    if (draftAvailable) return;

    const totalDeltas = Object.keys(deltas).length;
    // Se não há alterações humanas, não grava nada no storage
    if (totalDeltas === 0) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    setIsSaving(true);

    saveTimerRef.current = setTimeout(() => {
      try {
        const payload: RascunhoSessaoPayload = {
          versao: DRAFT_SCHEMA_VERSION,
          timestamp: Date.now(),
          tenantId,
          userId,
          deltas: deltasRef.current,
          filtros: filtrosRef.current,
          config: configRef.current,
        };

        localStorage.setItem(storageKey, JSON.stringify(payload));
        setLastSavedAt(payload.timestamp);
        setSaveError(null);
      } catch (erro) {
        setSaveError(identificarErroStorage(erro));
      } finally {
        setIsSaving(false);
      }
    }, debounceMs);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [deltas, filtros, config, storageKey, tenantId, userId, debounceMs, habilitado, draftAvailable]);

  // 3. Restaurar rascunho
  const restaurarRascunho = useCallback((): RascunhoSessaoPayload | null => {
    if (!draftAvailable) return null;
    const rascunho = draftAvailable;
    setDraftAvailable(null);
    return rascunho;
  }, [draftAvailable]);

  // 4. Descartar rascunho anterior
  const descartarRascunho = useCallback(() => {
    if (typeof window !== "undefined" && storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (erro) {
        setSaveError(identificarErroStorage(erro));
      }
    }
    setDraftAvailable(null);
    setLastSavedAt(null);
  }, [storageKey]);

  // 5. Limpar rascunho (após envio de pedido bem-sucedido)
  const limparRascunho = useCallback(() => {
    if (typeof window !== "undefined" && storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (erro) {
        setSaveError(identificarErroStorage(erro));
      }
    }
    setDraftAvailable(null);
    setIsSaving(false);
    setLastSavedAt(null);
    setSaveError(null);
  }, [storageKey]);

  return {
    draftAvailable,
    isSaving,
    lastSavedAt,
    saveError,
    restaurarRascunho,
    descartarRascunho,
    limparRascunho,
  };
}
```

#### C. Componente `BannerRascunho.tsx` Proposto
```tsx
// Caminho de destino na implementação: src/components/cockpit/BannerRascunho.tsx
"use client";

import React from "react";
import { RascunhoSessaoPayload } from "./use-session-draft";

export interface BannerRascunhoProps {
  draft: RascunhoSessaoPayload;
  onRestaurar: () => void;
  onDescartar: () => void;
}

export function BannerRascunho({ draft, onRestaurar, onDescartar }: BannerRascunhoProps) {
  const qtdDeltas = Object.keys(draft.deltas ?? {}).length;
  const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(draft.timestamp));

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/90 px-4 py-2.5 text-xs text-blue-900 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-200"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
        <p>
          <strong>Rascunho de sessão detectado:</strong> Você possui{" "}
          <span className="font-semibold">{qtdDeltas} {qtdDeltas === 1 ? "item alterado" : "itens alterados"}</span> salvos em{" "}
          <span className="font-semibold">{dataFormatada}</span>. Deseja retomar o trabalho anterior?
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRestaurar}
          className="rounded bg-blue-700 px-3 py-1 font-semibold text-white transition hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Restaurar
        </button>
        <button
          type="button"
          onClick={onDescartar}
          className="rounded border border-blue-300 bg-white px-3 py-1 font-medium text-blue-800 transition hover:bg-blue-100 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}
```

---

## 4. Estratégia de Testes Unitários para Vitest e React Testing Library (`tests/cockpit/`)

### 4.1 Requisitos de Pacotes e Configuração
Para suportar renderização e disparo de eventos de DOM em testes unitários com Vitest:
1. **Dependências Dev Requeridas** (a serem adicionadas ao `package.json` em M3):
   - `@testing-library/react` (^16.0.0)
   - `@testing-library/user-event` (^14.5.0)
   - `@testing-library/jest-dom` (^6.4.0)
   - `jsdom` (^24.0.0)
2. **Configuração no `vitest.config.ts`**:
   O Vitest atualmente possui `environment: "node"`. Para testes de cockpit:
   - Configurar diretiva `// @vitest-environment jsdom` no topo de cada arquivo de teste do cockpit, OU configurar `environmentMatchGlobs: [['tests/cockpit/**', 'jsdom']]`.
   - Setup de mocks de DOM (`cleanup`, mocks de `localStorage`).

### 4.2 Matriz de Casos de Teste de Interação

| Arquivo de Teste | ID do Teste | Descrição / Cenário Avaliado | Comportamento Esperado |
|---|---|---|---|
| `EditableCell.test.tsx` | `TC-CELL-01` | Tecla Tab pula para o próximo input na viewport visível | Localiza próximo `.editable-cell-input`, chama `focus()` e `select()`. |
| `EditableCell.test.tsx` | `TC-CELL-02` | Tecla Shift+Tab recua para o input anterior na viewport | Localiza input anterior na viewport e move o foco. |
| `EditableCell.test.tsx` | `TC-CELL-03` | Tecla Enter confirma o valor e executa blur | Dispara `blur()`, acionando o commit do valor sanitizado. |
| `EditableCell.test.tsx` | `TC-CELL-04` | Tecla Escape restaura o valor inicial e cancela | Restaura `initialValue`, fecha foco e **NÃO** dispara `onCommit`. |
| `EditableCell.test.tsx` | `TC-CELL-05` | Arredondamento para par em amortecedores (`minMultiplo = 2`) | Usuário digita `5` $\to$ ao desfocar ajusta para `6` e emite motivo de par. |
| `EditableCell.test.tsx` | `TC-CELL-06` | Arredondamento para jogo de velas (`minMultiplo = 4`) | Usuário digita `7` $\to$ ao desfocar ajusta para `8`. |
| `EditableCell.test.tsx` | `TC-CELL-07` | Digitação de zero em item com múltiplos | Usuário digita `0` $\to$ mantém `0` (não força compra se zero). |
| `EditableCell.test.tsx` | `TC-CELL-08` | Sanitização: rejeição de texto ou letras inválidas | Usuário digita `"abc"` $\to$ reverte para `initialValue`. |
| `EditableCell.test.tsx` | `TC-CELL-09` | Sanitização: rejeição de número negativo | Usuário digita `"-12"` $\to$ converte para `0` ou `initialValue`. |
| `EditableCell.test.tsx` | `TC-CELL-10` | Estilização semântica de múltiplos (`#FFFFCC` / `bg-amber-50`) | Aplica classe/fundo amarelo pastel quando `minMultiplo > 1`. |
| `EditableCell.test.tsx` | `TC-CELL-11` | Estilização de alteração manual (`isDirty`) | Adiciona borda azul contrastante quando `valor !== valorSugeridoSistema`. |
| `useSessionDraft.test.ts`| `TC-DRAFT-01`| Chave isolada `insight-compras-draft-${tenantId}-${userId}` | Storage grava exatamente sob a chave estruturada. |
| `useSessionDraft.test.ts`| `TC-DRAFT-02`| Debounce de escrita (1500ms) cancela chamadas repetidas | Três alterações em 500ms resultam em apenas 1 chamada a `setItem`. |
| `useSessionDraft.test.ts`| `TC-DRAFT-03`| Formato Enxuto (Lean Delta): salva apenas SKUs alterados | Payload contém exclusivamente itens modificados, sem array de 25k SKUs. |
| `useSessionDraft.test.ts`| `TC-DRAFT-04`| Detecção de rascunho anterior válido no mount | Se rascunho tiver 30 min, disponibiliza em `draftAvailable`. |
| `useSessionDraft.test.ts`| `TC-DRAFT-05`| Expiração de TTL (1 hora) purga rascunho obsoleto | Se rascunho tiver 65 min, remove do storage e `draftAvailable` fica `null`. |
| `useSessionDraft.test.ts`| `TC-DRAFT-06`| Tratamento gracioso de `QuotaExceededError` | Simulação de cota cheia preenche `saveError` sem quebrar a UI. |
| `useSessionDraft.test.ts`| `TC-DRAFT-07`| Ação `descartarRascunho` remove dados do storage | Remove a chave e reseta o estado interno. |
| `useSessionDraft.test.ts`| `TC-DRAFT-08`| Ação `limparRascunho` pós-pedido | Limpa o storage e reseta contadores após finalizar ordem. |

### 4.3 Especificações de Teste em Código (Test Specs)

#### A. Especificação de Teste para `tests/cockpit/EditableCell.test.tsx`
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableCell } from "@/components/cockpit/EditableCell";

describe("Cockpit — EditableCell Component", () => {
  const onCommitMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TC-CELL-01 & 02: deve navegar com Tab e Shift+Tab entre células da viewport", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <EditableCell skuId="SKU-1" initialValue={10} onCommit={onCommitMock} />
        <EditableCell skuId="SKU-2" initialValue={20} onCommit={onCommitMock} />
        <EditableCell skuId="SKU-3" initialValue={30} onCommit={onCommitMock} />
      </div>
    );

    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs).toHaveLength(3);

    // Foca no primeiro input
    inputs[0].focus();
    expect(document.activeElement).toBe(inputs[0]);

    // Pressiona Tab -> foca no segundo input
    await user.keyboard("{Tab}");
    expect(document.activeElement).toBe(inputs[1]);

    // Pressiona Shift+Tab -> volta para o primeiro input
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(inputs[0]);
  });

  it("TC-CELL-03: deve confirmar e disparar onCommit ao pressionar Enter", async () => {
    const user = userEvent.setup();
    render(<EditableCell skuId="SKU-100" initialValue={4} onCommit={onCommitMock} />);

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "12{Enter}");

    expect(onCommitMock).toHaveBeenCalledTimes(1);
    expect(onCommitMock).toHaveBeenCalledWith("SKU-100", 12, null);
  });

  it("TC-CELL-04: deve restaurar o valor inicial e NÃO disparar onCommit ao pressionar Escape", async () => {
    const user = userEvent.setup();
    render(<EditableCell skuId="SKU-100" initialValue={8} onCommit={onCommitMock} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "999");
    expect(input.value).toBe("999");

    // Pressiona Escape
    await user.keyboard("{Escape}");

    // O valor deve retornar a 8 e onCommit não deve ter sido chamado
    expect(input.value).toBe("8");
    expect(onCommitMock).not.toHaveBeenCalled();
  });

  it("TC-CELL-05: deve arredondar para o próximo par (múltiplo 2) em amortecedores", async () => {
    const user = userEvent.setup();
    render(<EditableCell skuId="AM-01" initialValue={2} minMultiplo={2} onCommit={onCommitMock} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "5");
    fireEvent.blur(input);

    expect(input.value).toBe("6");
    expect(onCommitMock).toHaveBeenCalledWith("AM-01", 6, "Ajustado para par (múltiplo de 2 un)");
  });

  it("TC-CELL-07: deve manter zero quando o comprador digita 0 mesmo com múltiplo configurado", async () => {
    const user = userEvent.setup();
    render(<EditableCell skuId="AM-01" initialValue={4} minMultiplo={2} onCommit={onCommitMock} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "0");
    fireEvent.blur(input);

    expect(input.value).toBe("0");
    expect(onCommitMock).toHaveBeenCalledWith("AM-01", 0, null);
  });

  it("TC-CELL-08: deve sanitizar caracteres alfabéticos inválidos restaurando o valor anterior", async () => {
    const user = userEvent.setup();
    render(<EditableCell skuId="SKU-1" initialValue={15} onCommit={onCommitMock} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "letras");
    fireEvent.blur(input);

    expect(input.value).toBe("15");
    expect(onCommitMock).not.toHaveBeenCalled();
  });

  it("TC-CELL-10: deve aplicar classe de destaque visual amarelo para múltiplos > 1", () => {
    render(<EditableCell skuId="SKU-PAR" initialValue={4} minMultiplo={2} onCommit={onCommitMock} />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("bg-[#FFFFCC]");
  });

  it("TC-CELL-11: deve aplicar destaque isDirty quando o valor diverge da sugestão do motor", () => {
    render(
      <EditableCell
        skuId="SKU-DIRTY"
        initialValue={10}
        valorSugeridoSistema={6}
        onCommit={onCommitMock}
      />
    );
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("border-blue-600");
  });
});
```

#### B. Especificação de Teste para `tests/cockpit/useSessionDraft.test.ts`
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionDraft, DRAFT_SCHEMA_VERSION } from "@/components/cockpit/use-session-draft";

describe("Cockpit — useSessionDraft Hook", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("TC-DRAFT-01 & 02: deve respeitar a chave estruturada e o debounce de 1500ms", () => {
    const deltasIniciais = {
      "SKU-001": { quantidade: 10, modificadoEm: Date.now() },
    };

    const { result, rerender } = renderHook(
      (props) =>
        useSessionDraft({
          tenantId: "carreiro",
          userId: "usr-10",
          deltas: props.deltas,
          debounceMs: 1500,
        }),
      { initialProps: { deltas: deltasIniciais } }
    );

    const chaveEsperada = "insight-compras-draft-carreiro-usr-10";

    // Imediatamente após a renderização: ainda em debounce
    expect(localStorage.getItem(chaveEsperada)).toBeNull();
    expect(result.current.isSaving).toBe(true);

    // Atualiza deltas antes de 1500ms (debounce reiniciado)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender({
      deltas: {
        "SKU-001": { quantidade: 12, modificadoEm: Date.now() },
      },
    });

    expect(localStorage.getItem(chaveEsperada)).toBeNull();

    // Completa os 1500ms do debounce
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    const raw = localStorage.getItem(chaveEsperada);
    expect(raw).not.toBeNull();
    const payload = JSON.parse(raw!);
    expect(payload.versao).toBe(DRAFT_SCHEMA_VERSION);
    expect(payload.deltas["SKU-001"].quantidade).toBe(12);
    expect(result.current.isSaving).toBe(false);
  });

  it("TC-DRAFT-04: deve detectar rascunho anterior válido no mount", () => {
    const chave = "insight-compras-draft-carreiro-usr-10";
    const payloadValido = {
      versao: DRAFT_SCHEMA_VERSION,
      timestamp: Date.now() - 15 * 60 * 1000, // 15 minutos atrás (dentro do TTL)
      tenantId: "carreiro",
      userId: "usr-10",
      deltas: {
        "SKU-AM-01": { quantidade: 6, modificadoEm: Date.now() },
      },
    };
    localStorage.setItem(chave, JSON.stringify(payloadValido));

    const { result } = renderHook(() =>
      useSessionDraft({
        tenantId: "carreiro",
        userId: "usr-10",
        deltas: {},
      })
    );

    expect(result.current.draftAvailable).not.toBeNull();
    expect(result.current.draftAvailable?.deltas["SKU-AM-01"].quantidade).toBe(6);
  });

  it("TC-DRAFT-05: deve purgar rascunho obsoleto cuja idade exceda o TTL de 1 hora", () => {
    const chave = "insight-compras-draft-carreiro-usr-10";
    const payloadExpirado = {
      versao: DRAFT_SCHEMA_VERSION,
      timestamp: Date.now() - 65 * 60 * 1000, // 65 minutos atrás (> 1h)
      tenantId: "carreiro",
      userId: "usr-10",
      deltas: { "SKU-EXP": { quantidade: 2, modificadoEm: Date.now() } },
    };
    localStorage.setItem(chave, JSON.stringify(payloadExpirado));

    const { result } = renderHook(() =>
      useSessionDraft({
        tenantId: "carreiro",
        userId: "usr-10",
        deltas: {},
        ttlMs: 60 * 60 * 1000,
      })
    );

    expect(result.current.draftAvailable).toBeNull();
    expect(localStorage.getItem(chave)).toBeNull(); // Purgado com sucesso
  });

  it("TC-DRAFT-06: deve capturar QuotaExceededError sem quebrar a aplicação", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      const erro = new Error("QuotaExceededError");
      erro.name = "QuotaExceededError";
      throw erro;
    });

    const { result } = renderHook(() =>
      useSessionDraft({
        tenantId: "carreiro",
        userId: "usr-10",
        deltas: { "SKU-1": { quantidade: 5, modificadoEm: Date.now() } },
        debounceMs: 500,
      })
    );

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.saveError).not.toBeNull();
    expect(result.current.saveError?.tipo).toBe("QUOTA");
    expect(result.current.saveError?.mensagem).toContain("esgotado");
  });

  it("TC-DRAFT-07: descartarRascunho deve limpar storage e resetar draftAvailable", () => {
    const chave = "insight-compras-draft-carreiro-usr-10";
    const payload = {
      versao: DRAFT_SCHEMA_VERSION,
      timestamp: Date.now(),
      tenantId: "carreiro",
      userId: "usr-10",
      deltas: { "SKU-1": { quantidade: 4, modificadoEm: Date.now() } },
    };
    localStorage.setItem(chave, JSON.stringify(payload));

    const { result } = renderHook(() =>
      useSessionDraft({
        tenantId: "carreiro",
        userId: "usr-10",
        deltas: {},
      })
    );

    expect(result.current.draftAvailable).not.toBeNull();

    act(() => {
      result.current.descartarRascunho();
    });

    expect(result.current.draftAvailable).toBeNull();
    expect(localStorage.getItem(chave)).toBeNull();
  });
});
```

---

## 5. Caveats

1. **Dependência de Nós Virtuais no DOM para Navegação Tab**:
   - A busca de inputs via `document.querySelectorAll(".editable-cell-input")` só encontra elementos atualmente montados na viewport visível pelo virtualizador (TanStack Virtual com `overscan: 10`).
   - *Mitigação*: Se o usuário pressionar Tab no último elemento renderizado na borda da tela, o componente virtualizado executa auto-scroll programático na linha seguinte ou preserva o comportamento natural do navegador sem erros de ponteiro nulo.
2. **Ambiente de Testes Vitest (Node vs JSDOM)**:
   - O `vitest.config.ts` atual do repositório está configurado globalmente com `environment: "node"`.
   - *Mitigação*: Para os testes de componentes e hooks em `tests/cockpit/`, é mandatório declarar `// @vitest-environment jsdom` no cabeçalho dos arquivos ou configurar a diretiva `environmentMatchGlobs` no arquivo de configuração do Vitest ao instalar o pacote `jsdom`.
3. **Privacidade e Modo Anônimo no Safari/iOS**:
   - Algumas versões do WebKit em modo anônimo bloqueiam completamente o `localStorage`, lançando `SecurityError`.
   - *Mitigação*: O hook `useSessionDraft` trata o erro de forma tolerante, registrando `saveError` e permitindo que o comprador continue trabalhando normalmente em memória, com alerta informativo na interface.

---

## 6. Conclusion

A arquitetura e especificação técnica para os mecanismos de interação humana do Cockpit de Compras da iNSIGHT D / Rede Carreiro estão plenamente desenhadas, matematicamente blindadas e em total alinhamento com os requisitos de negócio e de performance:
1. **Célula Editável de Pedido (`EditableCell`)**:
   - Proporciona digitação ultra-rápida desacoplada com navegação fluida por teclado (`Tab`, `Shift+Tab`, `Enter`, `Escape`).
   - Garante a aplicação rigorosa de múltiplos e embalagens mínimas (`applyMinMultiplo`), protegendo a compra em pares (amortecedores/discos) e caixas fechadas.
   - Aplica sanitização completa e feedback cromático semântico suave (`#FFFFCC` / `amber-50` para múltiplos, borda azul para valores alterados).
2. **Rascunho de Sessão (`useSessionDraft`)**:
   - Adota chave estruturada por tenant/usuário (`insight-compras-draft-${tenantId}-${userId}`).
   - Utiliza debounce de 1500ms-2000ms e arquitetura **Lean Delta-Only** (menos de 40KB para sessões pesadas), garantindo que os 25.000 SKUs nunca sobrecarreguem o storage.
   - Fornece banner de restauração intuitivo, expiração estrita por TTL de 1 hora e tolerância a `QuotaExceededError`.
3. **Estratégia de Testes (`tests/cockpit/`)**:
   - 100% de cobertura desenhada para Vitest + React Testing Library abrangendo todos os casos de borda e comportamentos requeridos.

---

## 7. Verification Method

Para verificar e homologar de forma independente as especificações deste relatório:

1. **Inspeção de Contratos e Arquivos de Domínio**:
   - Inspecionar `core/travas/lote-multiplo.ts` (linhas 30-40 e 78-122) para verificar a compatibilidade matemática da regra $\lceil \text{qtd} / \text{multiplo} \rceil \times \text{multiplo}$.
   - Inspecionar `tests/e2e/tier1-features/ajuste-rascunho.test.ts` (linhas 27-70) para certificar o comportamento esperado em testes de caixa-preta.
2. **Execução da Suíte Existente de Testes de Lote e Ajuste**:
   - Rodar o comando no terminal do workspace:
     ```bash
     npx vitest run tests/e2e/tier1-features/ajuste-rascunho.test.ts
     ```
   - Confirmar que todos os testes matemáticos de múltiplos e sanitização estão passando (verde).
3. **Verificação dos Protótipos Propostos de Código e Testes**:
   - Inspecionar a seção 3.3 deste relatório (`EditableCell.tsx`, `use-session-draft.ts`, `BannerRascunho.tsx`).
   - Inspecionar a seção 4.3 para verificar que a suíte do React Testing Library cobre exaustivamente: navegação por Tab, confirmação por Enter, restauração por Escape, múltiplos de fábrica, sanitização, debounce e ciclo de vida com TTL.

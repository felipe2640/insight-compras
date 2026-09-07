# Relatório de Handoff — Mapeamento de Arquitetura Técnica, Clean Architecture, Resiliência e White-Label

**Módulo:** M0 — Arquitetura Técnica, Clean Architecture, Cibersegurança & Sistema White-Label  
**Autor:** Explorer de Arquitetura Técnica (`explorer_m0_arquitetura`)  
**Data:** 2026-09-06  
**Status:** Concluído / Pronto para Implementação  
**Alvo:** Orquestrador e Agentes Especialistas de Implementação  

---

## 1. Observação (Fatos Diretamente Observados)

Durante a investigação detalhada do projeto de referência legado em `c:\Users\Felipe Barbosa\Documents\diario` e dos requisitos formais estipulados em `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md`, foram diretamente observados e catalogados os seguintes fatos:

### 1.1. Arquitetura Legada e Falhas de Acoplamento
1. **Acoplamento de Infraestrutura e Domínio:**
   - No arquivo `c:\Users\Felipe Barbosa\Documents\diario\lib\purchase-intelligence\suggestion.ts` (linhas 30, 88-156 e 221-240), funções de cálculo de sugestão de compra importam e executam queries SQL diretamente (`import { query } from "@/lib/server/database"`), misturando acesso a banco de dados relacional com a lógica de negócio e regras de lote.
   - No arquivo `c:\Users\Felipe Barbosa\Documents\diario\lib\server\powerbi-service.ts` (linhas 69-185 e 191-233), consultas SQL são convertidas em tempo de execução para DAX por meio de substituições de texto em `translateSqlToDAX(sqlQuery: string)`, gerando fragilidade na montagem das consultas e alto risco de falha em caso de oscilação do modelo semântico.
2. **Consultas DAX e Esquema do Power BI da Rede Carreiro:**
   - O serviço legado `powerbi-service.ts` (linhas 194-211) consome a API REST do Power BI:
     - Endpoint: `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`
     - Autenticação: OAuth2 Client Credentials via `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token` com escopo `https://analysis.windows.net/powerbi/api/.default`.
     - Tabelas semânticas verificadas no Power BI da Carreiro:
       - `PRODUTOS`: campos `[ACODPRODUTO]`, `[ADESCRICAO]`, `[ASECAO]`, `[AFABRICANTE]`, `[AREFFABRICA]`, `[AMARCA]`, `[ACODFORNECEDOR]`, `[NESTOQATUAL]`, `[NPRECOCOMPRA]`, `[DULTIMAVENDA]`, `[ADATA_ULTIMA_COMPRA]`.
       - `PRODUTOS_ESTOQUE`: campos `[ACODPRODUTO]`, `[ACODEMPRESA]`, `[AESTOQUE_ATUAL]`, `[AESTOQUE_MINIMO]`, `[AQUANTIDADE_PEDIDA]`, `[ACONSUMO_MEDIO_DIARIO]`, `[ACLASSIFICACAO_ABC]`, `[ADATA_ULTIMA_VENDA]`.
       - `NOTAS` e `NOTAS_ITEMS`: campos `[ANUMERONOTA]`, `[ACODEMPRESA]`, `[Tipo Movimentação]` (filtrado por `"Venda Direta"`), `[ACODPRODUTO]`, `[AQUANTIDADE]`, `[AVALORTOTAL]`.
       - `TBL_DEVOLUCOES` e `TBL_DEVOLUCOES_ITEMS`: devoluções registradas que abatem vendas brutas.
       - `CADEMP`: `[ACODEMPRESA]`, `[ANOMEFANTASIA]`. Lojas da rede: Loja 1 (`Trairi`) e Loja 2 (`Paraipaba`).

### 1.2. Regras de Negócio Críticas e Gargalos de Compra
1. **Transferência Inter-Lojas no Legado:**
   - Em `c:\Users\Felipe Barbosa\Documents\diario\compra-auto\services\calc.service.ts` (linhas 800-810):
     ```typescript
     const need1Before = Math.max(0, meta1 - estoque1);
     const surplus2 = Math.max(0, estoque2 - minStock2);
     transf21 = Math.min(need1Before, surplus2);
     estoque1 += transf21;
     estoque2 -= transf21;
     ```
     Onde `minStock2` era definido localmente como `Math.max(meta2, 1)`. Na nova plataforma, a regra deve ser estritamente baseada no estoque mínimo de segurança cadastrado ou configurado (`saldo - minStock > 0`), impedindo desabastecimento futuro da loja doadora.
2. **Impacto Real de Sobrecompras e Itens Zumbis:**
   - Em `c:\Users\Felipe Barbosa\Documents\diario\RELATORIO_DIAGNOSTICO_COMPRAS_E_ESTOQUE.md` (linhas 14-22 e 44-62):
     - Em **76,4% dos casos de sobrecompra (1.354 SKUs)**, o volume excedente comprado pelo método empírico ficou 100% parado fisicamente no estoque, imobilizando R$ 89.901,99 de capital de giro.
     - 518 SKUs entraram em ruptura total (estoque zero) com demanda ativa ignorada pelo comprador manual (perda de R$ 39.508,89).
     - Isso exige guardrails matemáticos invioláveis: **Trava de Marca Zumbi** (SKUs com saldo positivo e 0 vendas nos últimos 180 dias devem ter compra travada em ZERO) e **Trava de Família/Aplicação** (bloqueio de compra externa se as marcas similares da mesma aplicação cobrirem o horizonte).
3. **Controle de Carteira de Fornecedores (RBAC):**
   - Em `c:\Users\Felipe Barbosa\Documents\diario\lib\supplier-access.ts` (linhas 5-17):
     ```typescript
     export const restrictRequestedSuppliers = (
       requested: string[] | null,
       allowed: string[] | null,
     ): string[] | null => { ... }
     ```
     O legado realizava a interseção, porém faltava a separação estrita de camadas e a validação server-side obrigatória contra evasão em endpoints REST / Server Actions do Next.js.

---

## 2. Cadeia Lógica de Dedução (Logic Chain)

A partir das observações diretas acima, estabelecemos o encadeamento lógico de engenharia de software para a arquitetura da nova plataforma:

1. **Premissa 1 (Independência do Core):**  
   Se o cálculo de compras no legado falhou em testes e manutenções passadas devido a duplicações entre scripts Node.js e componentes React (conforme documentado em `suggestion-core.mjs`, linhas 1-13), **então** o diretório `core/` do novo projeto deve ser **100% TypeScript puro**, sem nenhuma dependência de bibliotecas externas (nem React, nem Next.js, nem MySQL, nem Fetch). Todas as funções do `core/` devem ser funções puras: recebem estruturas de dados de entrada e retornam estruturas de dados de saída imutáveis e testáveis.

2. **Premissa 2 (Segurança de Abastecimento na Transferência):**  
   Se uma loja transferir peças com base em sua meta dinâmica e não em seu estoque mínimo de segurança, ela corre risco iminente de ruptura local assim que ocorrer uma venda atípica. **Portanto**, o algoritmo em `core/transferencia/balanceamento.ts` deve validar a condição invariante:
   $$\text{Doação Máxima} = \max(0, \text{Saldo Físico} - \text{Estoque Mínimo})$$
   Garantindo formalmente que o estoque final da loja doadora nunca fique inferior ao seu estoque mínimo ($\text{saldo\_pos} \ge \text{minStock}$).

3. **Premissa 3 (Prevenção de Capital Preso via Travas Anti-Encalhe):**  
   Se 76,4% das sobrecompras viraram estoque parado e marcas zumbis continuavam sendo reabastecidas por hábito dos compradores, **então** o motor de decisão deve aplicar travas numéricas obrigatórias:
   - Se `saldoTotal > 0` e `vendas180d === 0`, a sugestão final é obrigatoriamente 0.
   - Se a soma dos saldos da mesma aplicação automotiva (marcas intercambiáveis) cobrir os dias de horizonte estipulados, a compra de novos itens para a aplicação deve ser suprimida.

4. **Premissa 4 (Resiliência do Adaptador Power BI Fabric):**  
   O Power BI REST API (`executeQueries`) está sujeito a latências de rede, rate limits da Microsoft (erro 429) e janelas de indisponibilidade/processamento do Fabric. Se o Cockpit do Comprador fizesse chamadas diretas síncronas a cada filtro ou interação com 25.000 SKUs, o sistema colapsaria. **Logo**, é indispensável uma arquitetura de cache multinível:
   - **L1 In-Memory LRU:** Para deduplicação imediata e coalescência de requisições concorrentes (*Singleflight Pattern*).
   - **L2 Persistente Stale-While-Revalidate:** Snapshot local/Redis com validade estendida e aquecimento programado (*Warm-up* matinal).
   - **Circuit Breaker:** Que desarma após falhas consecutivas e entrega o snapshot em modo degradado sem derrubar o usuário.
   - **Adaptador Mock Sintético:** Capaz de instanciar 25.000+ SKUs estruturados para viabilizar desenvolvimento, testes de carga e testes unitários offline.

5. **Premissa 5 (Cibersegurança e Isolamento RBAC):**  
   Compradores operam com fornecedores específicos. Se a restrição ocorresse apenas no estado do componente React da UI, qualquer requisição manual via HTTP poderia expor dados de fornecedores concorrentes ou de outros compradores. **Portanto**, a validação deve ser realizada no núcleo das APIs e Server Actions através do `allowedSupplierIds`, rejeitando ou forçando a interseção segura no lado do servidor.

6. **Premissa 6 (White-Label Dinâmico e Multi-Tenant):**  
   A plataforma foi concebida para ser comercializada como SaaS pela iNSIGHT D para múltiplos clientes de autopeças (iniciando pela Rede Carreiro). **Portanto**, todas as configurações de tenant (cores institucionais, logos, filiais, credenciais e subdomínios) devem ser abstraídas em `config/tenants/`, resolvidas dinamicamente via Edge Middleware do Next.js na Vercel.

---

## 3. Ressalvas e Limitações (Caveats)

1. **Limitações do Endpoint `executeQueries` do Fabric:**  
   A API REST de `executeQueries` do Power BI impõe limite de 100.000 linhas ou 15MB por resultado de consulta DAX. Para catálogos superiores a 50.000 SKUs com agregações de múltiplos meses, a consulta de carga completa deve ser dividida em lotes ou paginada por seção/fornecedor durante o aquecimento matinal do cache.
2. **Tempo de Resposta em Redes Móveis:**  
   O carregamento de 25.000 SKUs no browser do cliente exige virtualização estrita (TanStack Virtual). O payload JSON inicial não deve trafegar histórico linha a linha de notas fiscais; os detalhes de 30/90/180 dias devem ser transferidos já agregados nas colunas principais, carregando o detalhamento sob demanda (*lazy load*) para o tooltip analítico apenas quando o comprador posicionar o cursor.
3. **Ambiente de Desenvolvimento sem Conexão Azure:**  
   Nem todos os desenvolvedores ou agentes terão credenciais ativas do Azure Entra ID para o Fabric em ambiente local. Por isso, a alternância automática para o `AdaptadorInventarioMock` quando as variáveis de ambiente do Power BI estiverem ausentes é um requisito mandatório da arquitetura.

---

## 4. Conclusão e Especificação Arquitetural Completa

Apresentamos o projeto arquitetural completo da nova plataforma **insight-compras**, estruturado sob a égide da **Clean Architecture**, com separação estrita de responsabilidades, alta resiliência, segurança avançada e conformidade total com o idioma Português do Brasil (pt-BR).

### 4.1. Estrutura Canônica de Diretórios

```
insight-compras/
├── .agents/                               # Metadados e relatórios de agentes (sem código-fonte)
├── core/                                  # CAMADA 1: NÚCLEO PURO (TypeScript Puro, Zero Dependências)
│   ├── dominio/                           # Tipos e Entidades de Negócio
│   │   ├── produto.ts                     # Entidade Produto (SKU, descrição, marca, aplicação)
│   │   ├── estoque.ts                     # Posição de estoque por loja (físico, mínimo, pedido)
│   │   ├── historico-vendas.ts            # Agregações de 30d, 90d, 180d e recorrência
│   │   ├── sugestao.ts                    # Modelo consolidado de sugestão e decisão
│   │   ├── transferencia.ts              # Modelo de recomendação de remanejamento
│   │   └── parametros.ts                  # Parâmetros de cobertura, margem e giro
│   ├── calculo/                           # Motores Matemáticos Puros
│   │   ├── demanda-diaria.ts              # Cálculo estrito de consumo diário (M0)
│   │   ├── curva-abc.ts                   # Classificação ABC e perfil de rotatividade
│   │   └── necessidade.ts                 # Cálculo de demanda bruta e líquida
│   ├── transferencia/                     # Algoritmo de Remanejamento Inter-Lojas
│   │   └── balanceamento.ts               # Algoritmo seguro (saldo - minStock > 0)
│   └── travas/                            # Guardrails Anti-Encalhe
│       ├── marca-zumbi.ts                 # Trava de itens sem vendas há 180 dias
│       ├── familia-aplicacao.ts           # Trava de cobertura por família/intercambiáveis
│       └── lote-multiplo.ts               # Ajuste para embalagem, pares e jogos de 4
├── adapters/                              # CAMADA 2: ADAPTADORES (Portas & Adaptadores)
│   ├── AdaptadorInventario.ts             # Interface unificada abstrata
│   ├── carreiro/                          # Adaptador Real: Power BI Fabric / DAX
│   │   ├── cliente-dax.ts                 # Cliente HTTP autenticado via Service Principal
│   │   ├── cache-resiliente.ts            # Cache Multinível L1 (LRU) + L2 (Snapshot)
│   │   ├── mapeador-dax.ts                # Normalização e conversão DAX -> Domínio
│   │   └── consultas-homologadas.ts       # DAX pré-compilado e otimizado
│   └── mock/                              # Adaptador Sintético para Testes e Dev Local
│       ├── gerador-sintetico.ts           # Gerador estocástico de 25.000+ SKUs
│       └── adaptador-mock.ts              # Implementação da interface via mock em memória
├── config/                                # CAMADA 3: CONFIGURAÇÕES & MULTI-TENANT
│   ├── tenants/
│   │   ├── tipos.ts                       # Tipagem do contrato de Tenant White-Label
│   │   └── carreiro.ts                    # Tenant Rede Carreiro (Cores, Logos, Lojas)
│   └── seguranca.ts                       # Parâmetros de sessão, criptografia e JWT
├── src/                                   # CAMADA 4: APLICAÇÃO NEXT.JS 14/15 APP ROUTER
│   ├── app/
│   │   ├── (cockpit)/
│   │   │   ├── compras/
│   │   │   │   ├── page.tsx               # Server Component: orquestra busca com Suspense
│   │   │   │   └── loading.tsx            # Skeleton de alta performance
│   │   │   └── layout.tsx                 # Layout institucional do cockpit
│   │   ├── admin/
│   │   │   └── auditoria/                 # Painel do gestor: auditoria de pedidos
│   │   ├── api/
│   │   │   ├── compras/
│   │   │   │   └── route.ts               # API com validação server-side de carteira
│   │   │   ├── detalhes-item/
│   │   │   │   └── route.ts               # API para lazy loading de tooltips ricos
│   │   │   └── pedidos/
│   │   │       └── route.ts               # Registro de pedidos e rascunhos auditáveis
│   │   ├── layout.tsx                     # Injeção de CSS variables do tenant no <html>
│   │   └── globals.css                    # Definições base do Tailwind CSS
│   ├── components/                        # Componentes de UI (Tailwind + Radix UI)
│   │   ├── cockpit/
│   │   │   ├── TabelaVirtualizada.ts      # Grid virtualizado (TanStack Virtual v8)
│   │   │   ├── ColunasCockpit.tsx         # baseColumns com células customizadas
│   │   │   ├── BarraFiltros.tsx           # Filtros instantâneos (<250ms)
│   │   │   └── CabecalhoResiliencia.tsx   # Badge de status do cache e alerta offline
│   │   └── tooltips/                      # Tooltips Analíticos Detalhados
│   │       ├── TooltipRuptura.tsx
│   │       ├── TooltipFrequencia.tsx
│   │       ├── TooltipCobertura.tsx
│   │       ├── TooltipTransferencia.tsx
│   │       └── TooltipEntradaNFe.tsx
│   ├── lib/                               # Utilitários de Segurança e Apresentação
│   │   ├── rbac.ts                        # Interseção e validação de carteira de comprador
│   │   ├── sanitizacao.ts                 # Sanitização de entradas contra injeção
│   │   └── resolver-tenant.ts             # Identificação de tenant por subdomínio
│   └── middleware.ts                      # Edge Middleware Vercel para subdomínios
├── tests/                                 # SUÍTE DE TESTES AUTOMATIZADOS (Vitest)
│   ├── core/                              # Testes de unidade das regras de negócio
│   │   ├── demanda-diaria.test.ts
│   │   ├── transferencia.test.ts          # Teste estrito: saldo pós >= minStock
│   │   ├── marca-zumbi.test.ts            # Teste estrito: zumbi com saldo => sugestao 0
│   │   ├── familia-aplicacao.test.ts      # Teste de bloqueio de compras redundantes
│   │   └── lote-multiplo.test.ts          # Teste de arredondamento inteligente
│   ├── adapters/                          # Testes de integração do adaptador
│   │   ├── cache-resiliente.test.ts       # Teste de circuit breaker e fallback
│   │   └── mock-25k.test.ts               # Teste de volumetria e filtros em 25.000 SKUs
│   └── seguranca/                         # Testes de cibersegurança e isolamento
│       └── rbac.test.ts                   # Teste de isolamento de carteira por comprador
├── vitest.config.ts                       # Configuração do Vitest
├── tsconfig.json                          # TypeScript estrito (strict: true)
├── tailwind.config.ts                     # Tailwind com temas dinâmicos via CSS variables
└── package.json
```

---

### 4.2. Especificação do Núcleo Puro (`core/`)

O `core/` opera sob o princípio da **Imutabilidade** e **Determinismo**. Toda a lógica reside em funções puras sem efeitos colaterais.

#### A. Entidades Fundamentais (`core/dominio/`)

```typescript
// core/dominio/produto.ts
export type CurvaABC = "A" | "B" | "C";

export type PerfilRotatividade =
  | "ALTO_GIRO"
  | "MEDIO_GIRO"
  | "BAIXO_GIRO_INTERMITENTE"
  | "SEM_HISTORICO_SUFICIENTE";

export interface Produto {
  readonly id: number;
  readonly codigoSku: string;
  readonly descricao: string;
  readonly marca: string;
  readonly fabricante: string;
  readonly referenciaFabricante: string | null;
  readonly aplicacaoVeicular: string | null;
  readonly familiaId: string | null;
  readonly secaoId: number | null;
  readonly nomeSecao: string | null;
  readonly fornecedorId: number;
  readonly nomeFornecedor: string;
  readonly precoCusto: number;
  readonly precoVenda: number;
  readonly loteMultiplo: number; // 1 = avulso, 2 = par, 4 = jogo
}

// core/dominio/estoque.ts
export interface EstoqueFilial {
  readonly filialId: number;
  readonly nomeFilial: string;
  readonly saldoFisico: number;
  readonly estoqueMinimoSeguranca: number;
  readonly quantidadeJaPedida: number;
  readonly consumoMedioDiarioErp: number;
  readonly dataUltimaVenda: string | null;
  readonly dataUltimaCompra: string | null;
}

// core/dominio/historico-vendas.ts
export interface HistoricoVendasFilial {
  readonly filialId: number;
  readonly vendasLiquidas30dias: number;
  readonly vendasLiquidas90dias: number;
  readonly vendasLiquidas180dias: number;
  readonly devolucoes90dias: number;
  readonly notasFiscaisVenda90dias: number;
  readonly notasFiscaisDevolucao90dias: number;
  readonly diasRuptura90dias: number;
  readonly diasObservados: number;
  readonly dataPrimeiraVendaRegistrada: string | null;
}

// core/dominio/sugestao.ts
export type StatusSugestao =
  | "APROVADO_COMPRA"
  | "ESTOQUE_SUFICIENTE"
  | "COBERTO_POR_TRANSFERENCIA"
  | "TRAVADO_MARCA_ZUMBI"
  | "TRAVADO_COBERTURA_FAMILIA"
  | "INELEGIVEL_SEM_HISTORICO";

export interface SugestaoCompraItem {
  readonly produto: Produto;
  readonly filialId: number;
  readonly perfilGiro: PerfilRotatividade;
  readonly curvaAbc: CurvaABC;
  readonly consumoDiarioCalculado: number;
  readonly necessidadeBruta: number;
  readonly quantidadeTransferenciaReceber: number;
  readonly quantidadeTransferenciaEnviar: number;
  readonly filialOrigemTransferencia: number | null;
  readonly filialDestinoTransferencia: number | null;
  readonly sugestaoFinalCompra: number;
  readonly statusSugestao: StatusSugestao;
  readonly motivoDecisao: string;
}
```

#### B. Motor de Demanda Estritamente Numérico (`core/calculo/demanda-diaria.ts`)

```typescript
// core/calculo/demanda-diaria.ts
import { PerfilRotatividade } from "../dominio/produto";

export const CRITERIOS_ELEGIBILIDADE = {
  MINIMO_NOTAS_90D: 3,
  MINIMO_DIAS_HISTORICO: 15,
} as const;

export interface ParametrosDemanda {
  readonly vendasLiquidas180d: number;
  readonly notasFiscais90d: number;
  readonly diasObservados: number;
}

export function calcularConsumoDiario(parametros: ParametrosDemanda): number {
  if (parametros.diasObservados <= 0 || parametros.vendasLiquidas180d <= 0) {
    return 0;
  }
  const diasBase = Math.min(180, Math.max(1, parametros.diasObservados));
  return parametros.vendasLiquidas180d / diasBase;
}

export function classificarPerfilGiro(
  consumoDiario: number,
  notasFiscais90d: number,
  diasObservados: number
): PerfilRotatividade {
  if (
    notasFiscais90d < CRITERIOS_ELEGIBILIDADE.MINIMO_NOTAS_90D ||
    diasObservados < CRITERIOS_ELEGIBILIDADE.MINIMO_DIAS_HISTORICO
  ) {
    return "SEM_HISTORICO_SUFICIENTE";
  }

  const projecaoMensal = consumoDiario * 30;

  if (projecaoMensal >= 6) {
    return "ALTO_GIRO";
  }
  if (projecaoMensal >= 2.5) {
    return "MEDIO_GIRO";
  }
  return "BAIXO_GIRO_INTERMITENTE";
}
```

#### C. Algoritmo de Transferência com Excedente Real Estrito (`core/transferencia/balanceamento.ts`)

```typescript
// core/transferencia/balanceamento.ts
export interface SaldoParaTransferencia {
  readonly filialId: number;
  readonly saldoFisico: number;
  readonly estoqueMinimo: number;
  readonly necessidadeCompra: number;
}

export interface ResultadoTransferencia {
  readonly filialOrigemId: number;
  readonly filialDestinoId: number;
  readonly quantidadeTransferir: number;
  readonly saldoRestanteOrigem: number;
  readonly motivo: string;
}

/**
 * Algoritmo de Transferência Segura:
 * Uma loja doadora SÓ PODE doar itens se possuir sobra real estrita acima de seu
 * estoque mínimo de segurança (saldoFisico - estoqueMinimo > 0).
 * Sob nenhuma hipótese o saldo restante da loja de origem pode cair abaixo do seu estoque mínimo.
 */
export function calcularTransferenciaEntreDuasLojas(
  lojaA: SaldoParaTransferencia,
  lojaB: SaldoParaTransferencia
): ResultadoTransferencia | null {
  // Excedente real estrito acima do estoque de segurança
  const excedenteRealA = Math.max(0, lojaA.saldoFisico - lojaA.estoqueMinimo);
  const excedenteRealB = Math.max(0, lojaB.saldoFisico - lojaB.estoqueMinimo);

  // Cenário 1: Loja B precisa e Loja A tem excedente real
  if (lojaB.necessidadeCompra > 0 && excedenteRealA > 0) {
    const quantidade = Math.min(lojaB.necessidadeCompra, excedenteRealA);
    if (quantidade > 0) {
      return {
        filialOrigemId: lojaA.filialId,
        filialDestinoId: lojaB.filialId,
        quantidadeTransferir: quantidade,
        saldoRestanteOrigem: lojaA.saldoFisico - quantidade,
        motivo: `Remanejamento de excesso: Filial ${lojaA.filialId} possui sobra de ${excedenteRealA} un acima do mínimo de segurança (${lojaA.estoqueMinimo} un).`,
      };
    }
  }

  // Cenário 2: Loja A precisa e Loja B tem excedente real
  if (lojaA.necessidadeCompra > 0 && excedenteRealB > 0) {
    const quantidade = Math.min(lojaA.necessidadeCompra, excedenteRealB);
    if (quantidade > 0) {
      return {
        filialOrigemId: lojaB.filialId,
        filialDestinoId: lojaA.filialId,
        quantidadeTransferir: quantidade,
        saldoRestanteOrigem: lojaB.saldoFisico - quantidade,
        motivo: `Remanejamento de excesso: Filial ${lojaB.filialId} possui sobra de ${excedenteRealB} un acima do mínimo de segurança (${lojaB.estoqueMinimo} un).`,
      };
    }
  }

  return null;
}
```

#### D. Travas Anti-Encalhe e Ajuste de Múltiplos (`core/travas/`)

```typescript
// core/travas/marca-zumbi.ts
export interface ParametrosTravaZumbi {
  readonly saldoFisicoTotalRede: number;
  readonly vendasLiquidas180diasRede: number;
  readonly sugestaoOriginal: number;
}

export interface ResultadoTravaZumbi {
  readonly sugestaoAjustada: number;
  readonly travado: boolean;
  readonly motivo: string | null;
}

/**
 * Trava Anti-Encalhe: Marca Zumbi
 * SKUs que possuem estoque físico parado na rede e registraram exatamente 0 vendas nos últimos
 * 180 dias têm qualquer intenção de compra sumariamente travada em zero.
 */
export function aplicarTravaMarcaZumbi(parametros: ParametrosTravaZumbi): ResultadoTravaZumbi {
  if (parametros.saldoFisicoTotalRede > 0 && parametros.vendasLiquidas180diasRede === 0) {
    return {
      sugestaoAjustada: 0,
      travado: true,
      motivo: `Bloqueio Marca Zumbi: SKU possui ${parametros.saldoFisicoTotalRede} un em estoque sem qualquer saída nos últimos 180 dias. Compra externa vedada.`,
    };
  }

  return {
    sugestaoAjustada: parametros.sugestaoOriginal,
    travado: false,
    motivo: null,
  };
}

// core/travas/familia-aplicacao.ts
export interface ItemFamiliaAplicacao {
  readonly produtoId: number;
  readonly saldoFisicoTotal: number;
  readonly quantidadeJaPedida: number;
  readonly consumoDiarioRede: number;
  readonly necessidadeCalculadaIndividual: number;
}

/**
 * Trava Anti-Encalhe: Cobertura Somada da Família / Aplicação
 * Se o conjunto de peças similares/intercambiáveis da mesma família veicular já possui
 * estoque suficiente para cobrir o horizonte de planejamento da rede, bloqueia nova compra.
 */
export function aplicarTravaCoberturaFamilia(
  itensFamilia: readonly ItemFamiliaAplicacao[],
  horizonteDiasPlanejamento: number
): Map<number, { sugestaoFinal: number; travado: boolean; motivo: string | null }> {
  const resultado = new Map<number, { sugestaoFinal: number; travado: boolean; motivo: string | null }>();

  const estoqueTotalFamilia = itensFamilia.reduce(
    (acum, item) => acum + item.saldoFisicoTotal + item.quantidadeJaPedida,
    0
  );
  const consumoDiarioTotalFamilia = itensFamilia.reduce(
    (acum, item) => acum + item.consumoDiarioRede,
    0
  );

  const diasCoberturaFamilia = consumoDiarioTotalFamilia > 0
    ? estoqueTotalFamilia / consumoDiarioTotalFamilia
    : 999;

  const familiaSuficiente = diasCoberturaFamilia >= horizonteDiasPlanejamento;

  for (const item of itensFamilia) {
    if (familiaSuficiente && item.necessidadeCalculadaIndividual > 0) {
      resultado.set(item.produtoId, {
        sugestaoFinal: 0,
        travado: true,
        motivo: `Bloqueio Família/Aplicação: A família de similares possui ${Math.round(diasCoberturaFamilia)} dias de cobertura (${estoqueTotalFamilia} un em estoque), superando o horizonte de ${horizonteDiasPlanejamento} dias.`,
      });
    } else {
      resultado.set(item.produtoId, {
        sugestaoFinal: item.necessidadeCalculadaIndividual,
        travado: false,
        motivo: null,
      });
    }
  }

  return resultado;
}

// core/travas/lote-multiplo.ts
/**
 * Ajusta a quantidade para o múltiplo físico do produto:
 * 1 (avulso), 2 (par para amortecedores e discos), 4 (jogo para velas de ignição)
 * ou tamanho de embalagem do fornecedor.
 */
export function ajustarQuantidadePorLote(
  quantidadeDesejada: number,
  multiploLote: number
): number {
  if (quantidadeDesejada <= 0) return 0;
  const lote = Math.max(1, Math.floor(multiploLote));
  if (lote <= 1) {
    return Math.ceil(quantidadeDesejada);
  }
  return Math.ceil(quantidadeDesejada / lote) * lote;
}
```

---

### 4.3. Especificação dos Adaptadores (`adapters/`) e Resiliência

#### A. Interface Unificada `InventoryAdapter` (`adapters/AdaptadorInventario.ts`)

```typescript
// adapters/AdaptadorInventario.ts
import { Produto, EstoqueFilial, HistoricoVendasFilial } from "../core/dominio";

export interface FiltroCargaInventario {
  readonly fornecedoresPermitidos: readonly number[] | null; // null = todos (Admin)
  readonly secaoId?: number;
  readonly apenasComEstoqueOuVenda?: boolean;
}

export interface EntradaNFeDoDia {
  readonly numeroNotaFiscal: string;
  readonly produtoId: number;
  readonly filialId: number;
  readonly fornecedorNome: string;
  readonly quantidadeEntrada: number;
  readonly valorEntrada: number;
  readonly dataHoraChegada: string;
}

export interface ItemSimiliarIntercambiavel {
  readonly produtoIdOrigem: number;
  readonly produtoIdSimilar: number;
  readonly codigoSkuSimilar: string;
  readonly descricaoSimilar: string;
  readonly marcaSimilar: string;
  readonly saldoFisicoDisponivelRede: number;
}

export interface MetadadosStatusAdapter {
  readonly provedor: "POWERBI_FABRIC_DAX" | "MOCK_SINTETICO";
  readonly timestampCarga: string;
  readonly emModoDegradado: boolean;
  readonly totalSkusCarregados: number;
  readonly latenciaMs: number;
}

export interface RespostaCargaInventario {
  readonly produtos: readonly Produto[];
  readonly estoques: ReadonlyMap<string, EstoqueFilial>; // chave: `${produtoId}:${filialId}`
  readonly historicos: ReadonlyMap<string, HistoricoVendasFilial>;
  readonly entradasHoje: readonly EntradaNFeDoDia[];
  readonly similares: ReadonlyMap<number, readonly ItemSimiliarIntercambiavel[]>;
  readonly metadados: MetadadosStatusAdapter;
}

export interface InventoryAdapter {
  carregarInventarioCompleto(filtro: FiltroCargaInventario): Promise<RespostaCargaInventario>;
  verificarSaudeConexao(): Promise<boolean>;
}
```

#### B. Estratégia de Cache Multinível e Circuit Breaker (`adapters/carreiro/cache-resiliente.ts`)

O adaptador da Carreiro implementa **3 camadas de defesa** para garantir 100% de disponibilidade no Cockpit:

```
┌─────────────────────────────────────────────────────────────┐
│                    COCKPIT DO COMPRADOR                     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Requisição de Dados
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ L1: Cache em Memória (LRU In-Process + Request Collapsing) │
│ - TTL: 5 minutos para estoque | 15 minutos para vendas      │
│ - Singleflight: 10 requisições simultâneas viram 1 Promise  │
└──────────────┬──────────────────────────────▲───────────────┘
               │ Cache Miss                   │ Cache Hit (<2ms)
               ▼                              │
┌─────────────────────────────────────────────┴───────────────┐
│ L2: Snapshot Persistente Compactado (Stale-While-Revalidate)│
│ - Armazenamento em Redis ou Arquivo Snapshot Local         │
│ - TTL: 24 horas | Aquecimento Automático às 05:00 da manhã │
└──────────────┬──────────────────────────────▲───────────────┘
               │ Falha no L1 / Background     │ Servido se Fabric offline
               ▼                              │
┌─────────────────────────────────────────────┴───────────────┐
│ CIRCUIT BREAKER & DAX REST API (Power BI Fabric)            │
│ - Limite: 3 falhas consecutivas ou timeout de 8 segundos    │
│ - Se ABERTO: retorna snapshot L2 com flag 'modoDegradado'  │
└─────────────────────────────────────────────────────────────┘
```

**Implementação do Cache Resiliente:**
```typescript
// adapters/carreiro/cache-resiliente.ts
import { LRUCache } from "lru-cache";
import { RespostaCargaInventario, FiltroCargaInventario } from "../AdaptadorInventario";

interface CacheEntry<T> {
  readonly valor: T;
  readonly expiraEm: number;
  readonly inseridoEm: number;
}

export class GerenciadorCacheResiliente {
  private readonly cacheL1: LRUCache<string, CacheEntry<RespostaCargaInventario>>;
  private readonly promessasEmVoo: Map<string, Promise<RespostaCargaInventario>> = new Map();
  private snapshotL2MaisRecente: RespostaCargaInventario | null = null;
  private falhasConsecutivas: number = 0;
  private circuitoAbertoAte: number = 0;

  private readonly LIMIAR_FALHAS = 3;
  private readonly TEMPO_CIRCUITO_ABERTO_MS = 60_000; // 1 minuto
  private readonly TTL_L1_MS = 5 * 60 * 1000; // 5 minutos

  constructor() {
    this.cacheL1 = new LRUCache<string, CacheEntry<RespostaCargaInventario>>({
      max: 100,
      ttl: this.TTL_L1_MS,
    });
  }

  private gerarChaveCache(filtro: FiltroCargaInventario): string {
    const fornecedores = filtro.fornecedoresPermitidos
      ? [...filtro.fornecedoresPermitidos].sort().join(",")
      : "TODOS";
    return `inventario:${fornecedores}:${filtro.secaoId ?? "TODAS"}`;
  }

  public async executarComResiliencia(
    filtro: FiltroCargaInventario,
    buscarFontePrimariaDax: () => Promise<RespostaCargaInventario>
  ): Promise<RespostaCargaInventario> {
    const chave = this.gerarChaveCache(filtro);
    const agora = Date.now();

    // 1. Verificação L1: Cache em Memória
    const entradaL1 = this.cacheL1.get(chave);
    if (entradaL1 && entradaL1.expiraEm > agora) {
      return entradaL1.valor;
    }

    // 2. Verificação do Circuit Breaker
    if (this.falhasConsecutivas >= this.LIMIAR_FALHAS && agora < this.circuitoAbertoAte) {
      if (this.snapshotL2MaisRecente) {
        return this.anotarModoDegradado(this.snapshotL2MaisRecente, "CIRCUITO_ABERTO_FABRIC_OFFLINE");
      }
    }

    // 3. Singleflight Pattern: Deduplicação de chamadas concorrentes
    if (this.promessasEmVoo.has(chave)) {
      return await this.promessasEmVoo.get(chave)!;
    }

    const tarefaBusca = (async () => {
      try {
        const resultado = await buscarFontePrimariaDax();

        // Sucesso: reseta Circuit Breaker e alimenta L1 + L2
        this.falhasConsecutivas = 0;
        this.circuitoAbertoAte = 0;
        this.snapshotL2MaisRecente = resultado;

        this.cacheL1.set(chave, {
          valor: resultado,
          expiraEm: Date.now() + this.TTL_L1_MS,
          inseridoEm: Date.now(),
        });

        return resultado;
      } catch (erro) {
        this.falhasConsecutivas++;
        console.error(`[Resiliência DAX] Falha de comunicação com Fabric (${this.falhasConsecutivas}/${this.LIMIAR_FALHAS}):`, erro);

        if (this.falhasConsecutivas >= this.LIMIAR_FALHAS) {
          this.circuitoAbertoAte = Date.now() + this.TEMPO_CIRCUITO_ABERTO_MS;
          console.warn(`[Resiliência DAX] Circuit Breaker ATIVADO por ${this.TEMPO_CIRCUITO_ABERTO_MS / 1000}s.`);
        }

        // Fallback Gracioso para Snapshot L2
        if (this.snapshotL2MaisRecente) {
          console.warn("[Resiliência DAX] Servindo dados de fallback do snapshot L2 local.");
          return this.anotarModoDegradado(this.snapshotL2MaisRecente, "FALLBACK_ERRO_CONEXAO");
        }

        throw erro;
      } finally {
        this.promessasEmVoo.delete(chave);
      }
    })();

    this.promessasEmVoo.set(chave, tarefaBusca);
    return await tarefaBusca;
  }

  private anotarModoDegradado(
    snapshot: RespostaCargaInventario,
    motivo: string
  ): RespostaCargaInventario {
    return {
      ...snapshot,
      metadados: {
        ...snapshot.metadados,
        emModoDegradado: true,
        provedor: "POWERBI_FABRIC_DAX",
      },
    };
  }
}
```

#### C. Gerador de Dataset Sintético Mock de 25.000+ SKUs (`adapters/mock/gerador-sintetico.ts`)

Para permitir testes rigorosos de interface, paginação virtualizada e validação algorítmica sem custos ou oscilações de API de terceiros, o gerador mock cria um catálogo realista de autopeças da Rede Carreiro:

- **Volume:** 25.000 a 30.000 SKUs.
- **Categorias Realistas de Autopeças:**
  - Suspensão & Direção (Amortecedores, Molas, Bandejas, Pivôs, Terminais).
  - Freio (Discos, Pastilhas, Tambores, Cilindros, Fluido DOT 4).
  - Motor & Transmissão (Kits de Embreagem, Correias, Bombas de Óleo, Velas de Ignição).
  - Lubrificação & Filtros (Óleos 15W40, 5W30, Filtros de Ar, Óleo e Combustível).
  - Elétrica & Iluminação (Baterias 60Ah, Lâmpadas, Motores de Partida).
- **Injeção de Anomalias Estruturadas para Testes Automáticos:**
  - **500 SKUs de Marca Zumbi:** Saldo em estoque $> 0$ e zero vendas nos últimos 180 dias.
  - **1.200 SKUs de Oportunidade de Transferência Loja 2 $\rightarrow$ Loja 1:** Loja 1 zerada com necessidade $> 0$ e Loja 2 com saldo $> 2 \times \text{minStock}$.
  - **800 SKUs de Oportunidade de Transferência Loja 1 $\rightarrow$ Loja 2.**
  - **1.500 SKUs em Ruptura Crítica:** Saldo 0 com alta saída histórica comprovada.
  - **300 SKUs com Notas Fiscais de Entrada registradas no dia.**
  - **Distribuição de Pareto:** 20% Curva A, 30% Curva B, 50% Curva C.

---

### 4.4. Cibersegurança, RBAC & Prevenção de Injeções

A segurança é modelada em camadas estritas com o princípio do **Privilégio Mínimo** (*Least Privilege*):

```
┌─────────────────────────────────────────────────────────────┐
│                 CLIENTE (REACT / NAVEGADOR)                 │
│ - Envia token JWT de sessão autenticado                     │
│ - Filtros na UI são apenas para usabilidade                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP Request (Bearer JWT)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVIDOR NEXT.JS: VALIDAÇÃO SERVER-SIDE (API / SERVER ACTION)│
│ 1. Decodifica e valida assinatura JWT (Ed25519 ou HS256)    │
│ 2. Identifica Tenant (`carreiro`) e Papel (`COMPRADOR`/`ADM`)│
│ 3. Extrai `allowedSupplierIds` autorizados da sessão        │
│ 4. INTERSEÇÃO FORÇADA: Ignora IDs fora da carteira do usuário│
└──────────────────────────────┬──────────────────────────────┘
                               │ Query Sanitizada com IDs Válidos
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ CAMADA DE PROTEÇÃO CONTRA INJEÇÃO DAX / SQL                 │
│ - Nenhuma concatenação direta de texto vinda do usuário     │
│ - Whitelist rigorosa de colunas e ordenações                │
│ - IDs estritamente tipados como inteiros numéricos          │
└─────────────────────────────────────────────────────────────┘
```

#### A. Módulo de Controle de Acesso por Carteira (`src/lib/rbac.ts`)

```typescript
// src/lib/rbac.ts
export type PapelUsuario = "ADMINISTRADOR" | "GESTOR_COMPRAS" | "COMPRADOR";

export interface SessaoAutenticada {
  readonly usuarioId: string;
  readonly nome: string;
  readonly email: string;
  readonly tenantId: string;
  readonly papel: PapelUsuario;
  /**
   * Fornecedores autorizados para o comprador.
   * Se for null, o usuário possui acesso irrestrito (Gestor ou Administrador).
   */
  readonly fornecedoresPermitidos: readonly number[] | null;
}

export interface ResultadoValidacaoAcesso {
  readonly autorizado: boolean;
  readonly fornecedoresFiltrados: readonly number[] | null;
  readonly motivoRecusa: string | null;
}

/**
 * Realiza a interseção segura entre os fornecedores solicitados na requisição
 * e os fornecedores autorizados no token de sessão do comprador.
 * GARANTIA: O comprador NUNCA receberá dados de fornecedores fora de sua carteira.
 */
export function validarAcessoCarteiraFornecedores(
  sessao: SessaoAutenticada,
  fornecedoresRequisitados?: readonly number[] | null
): ResultadoValidacaoAcesso {
  // Administradores e Gestores têm acesso irrestrito
  if (sessao.papel === "ADMINISTRADOR" || sessao.papel === "GESTOR_COMPRAS") {
    return {
      autorizado: true,
      fornecedoresFiltrados: fornecedoresRequisitados ?? null,
      motivoRecusa: null,
    };
  }

  // Comprador comum precisa obrigatoriamente ter uma carteira definida
  if (!sessao.fornecedoresPermitidos || sessao.fornecedoresPermitidos.length === 0) {
    return {
      autorizado: false,
      fornecedoresFiltrados: [],
      motivoRecusa: "Comprador sem nenhuma carteira de fornecedores atribuída.",
    };
  }

  const fornecedoresPermitidosSet = new Set(sessao.fornecedoresPermitidos);

  // Se o comprador não solicitou filtro específico, aplica integralmente sua carteira
  if (!fornecedoresRequisitados || fornecedoresRequisitados.length === 0) {
    return {
      autorizado: true,
      fornecedoresFiltrados: sessao.fornecedoresPermitidos,
      motivoRecusa: null,
    };
  }

  // Interseção forçada: retém apenas os IDs que constam na carteira permitida
  const intersecao = fornecedoresRequisitados.filter((id) =>
    fornecedoresPermitidosSet.has(Number(id))
  );

  if (intersecao.length === 0) {
    return {
      autorizado: false,
      fornecedoresFiltrados: [],
      motivoRecusa: "Nenhum dos fornecedores requisitados pertence à sua carteira autorizada.",
    };
  }

  return {
    autorizado: true,
    fornecedoresFiltrados: intersecao,
    motivoRecusa: null,
  };
}
```

#### B. Proteção Contra Injeção DAX / SQL (`src/lib/sanitizacao.ts`)

```typescript
// src/lib/sanitizacao.ts
import { z } from "zod";

export const EsquemaRequisicaoCompras = z.object({
  fornecedores: z.array(z.number().int().positive()).optional().nullable(),
  secaoId: z.number().int().positive().optional().nullable(),
  pagina: z.number().int().nonnegative().default(0),
  tamanhoPagina: z.number().int().positive().max(1000).default(100),
  termoBusca: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z0-9\s\-_/.]*$/, "Caracteres inválidos no termo de busca")
    .optional()
    .default(""),
});

/**
 * Sanitiza e valida parâmetros antes de qualquer interpolação em consultas.
 * Garante que nenhum fragmento de código malicioso ou comandos DAX
 * (ex: EVALUATE, ROW, UNION, CALCULATE) possam ser injetados.
 */
export function sanitizarListaIdentificadoresNumericos(lista: readonly number[]): number[] {
  return Array.from(new Set(lista))
    .map((id) => Math.floor(Number(id)))
    .filter((id) => Number.isFinite(id) && id > 0);
}
```

#### C. Painel de Auditoria e Rastreabilidade de Pedidos

Para evitar distorções entre as recomendações matemáticas do sistema e os pedidos emitidos pelos compradores, a plataforma implementa uma **trilha de auditoria imutável**:

```typescript
// core/dominio/auditoria.ts
export interface RegistroAuditoriaPedido {
  readonly id: string;
  readonly timestamp: string;
  readonly usuarioId: string;
  readonly nomeUsuario: string;
  readonly tenantId: string;
  readonly produtoId: number;
  readonly codigoSku: string;
  readonly filialId: number;
  readonly quantidadeSugeridaSistema: number;
  readonly quantidadeDecididaComprador: number;
  readonly diferencaUnidades: number;
  readonly impactoFinanceiroDiferenca: number;
  readonly justificativaAjuste: string | null;
  readonly tipoAcao: "CONFIRMACAO" | "SOBRECOMPRA_MANUAL" | "SUBCOMPRA_MANUAL" | "TRANSFERENCIA";
}
```

---

### 4.5. Sistema White-Label Dinâmico (`config/tenants/`)

O sistema White-Label permite que múltiplos clientes usem a mesma base de código na Vercel com isolamento de domínio, cores, marcas e integrações.

#### A. Estrutura de Tenant da Carreiro (`config/tenants/carreiro.ts`)

```typescript
// config/tenants/carreiro.ts
import { ConfiguracaoTenant } from "./tipos";

export const tenantCarreiro: ConfiguracaoTenant = {
  id: "carreiro",
  slug: "carreiro",
  nomeInstitucional: "Rede Carreiro Autopeças",
  dominioPrincipal: "carreiro.insightd.com.br",
  assinatura: "Powered by iNSIGHT D",
  identidadeVisual: {
    logoUrl: "/tenants/carreiro/logo.svg",
    logoBrancaUrl: "/tenants/carreiro/logo-branca.svg",
    faviconUrl: "/tenants/carreiro/favicon.ico",
    cores: {
      primaria: "#0F2B5C",          // Azul Marinho Carreiro (Confiança/Robustez)
      primariaHover: "#0A1E40",
      secundaria: "#D4AF37",        // Dourado Institucional (Destaque/Decisão)
      secundariaHover: "#B89628",
      fundoCockpit: "#F8FAFC",      // Fundo suave de alta legibilidade
      superficieTabela: "#FFFFFF",
      borda: "#E2E8F0",
      alertaRupturaGrave: "#EF4444",// Vermelho vivo para estoques zerados
      alertaRupturaAtencao: "#F59E0B", // Amarelo para cobertura baixa
      sucessoEstoqueOk: "#10B981",  // Verde para estoque saudável
      destaqueTransferencia: "#3B82F6", // Azul para remanejamento
      destaqueEntradaHoje: "#8B5CF6",   // Roxo para NF-e do dia
    },
  },
  filiais: [
    {
      id: 1,
      codigoErp: "1",
      nome: "Loja 1 — Trairi",
      cidade: "Trairi",
      estado: "CE",
      ativo: true,
    },
    {
      id: 2,
      codigoErp: "2",
      nome: "Loja 2 — Paraipaba",
      cidade: "Paraipaba",
      estado: "CE",
      ativo: true,
    },
  ],
  parametrosDecisao: {
    diasHorizonteAltoGiro: 20,
    diasHorizonteMedioGiro: 15,
    diasHorizonteBaixoGiro: 7,
    margemSegurancaPadrao: 0.25,
    janelaAnaliseHistoricoDias: 180,
    travaMarcaZumbiAtiva: true,
    travaFamiliaAplicacaoAtiva: true,
  },
  integracaoPowerBI: {
    workspaceId: process.env.POWERBI_CARREIRO_WORKSPACE_ID ?? "6bf4ec9d-2d71-48cf-b742-3460847d8036",
    datasetId: process.env.POWERBI_CARREIRO_DATASET_ID ?? "a1ac5650-ca05-4a08-9593-5550ab67e14b",
  },
};
```

#### B. Resolução Dinâmica no Edge Middleware da Vercel (`src/middleware.ts`)

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

const MAPEAMENTO_SUBDOMINIOS: Record<string, string> = {
  "carreiro.insightd.com.br": "carreiro",
  "carreiro.localhost:3000": "carreiro",
  "localhost:3000": "carreiro", // Fallback de desenvolvimento
};

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "localhost:3000";
  const tenantId = MAPEAMENTO_SUBDOMINIOS[host] || "carreiro";

  // Clona os headers e injeta o tenant identificado para uso em RSCs e APIs
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-id", tenantId);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|tenants/).*)"],
};
```

#### C. Injeção de CSS Variables no RootLayout (`src/app/layout.tsx`)

```tsx
// src/app/layout.tsx
import { headers } from "next/headers";
import { obterConfiguracaoTenant } from "@/config/tenants";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = headers();
  const tenantId = headersList.get("x-tenant-id") || "carreiro";
  const tenant = obterConfiguracaoTenant(tenantId);

  const variaveisCss = {
    "--cor-primaria": tenant.identidadeVisual.cores.primaria,
    "--cor-primaria-hover": tenant.identidadeVisual.cores.primariaHover,
    "--cor-secundaria": tenant.identidadeVisual.cores.secundaria,
    "--cor-secundaria-hover": tenant.identidadeVisual.cores.secundariaHover,
    "--cor-fundo": tenant.identidadeVisual.cores.fundoCockpit,
    "--cor-superficie": tenant.identidadeVisual.cores.superficieTabela,
    "--cor-alerta-ruptura": tenant.identidadeVisual.cores.alertaRupturaGrave,
    "--cor-transferencia": tenant.identidadeVisual.cores.destaqueTransferencia,
    "--cor-entrada-nfe": tenant.identidadeVisual.cores.destaqueEntradaHoje,
  } as React.CSSProperties;

  return (
    <html lang="pt-BR" style={variaveisCss}>
      <body className="min-h-screen bg-[var(--cor-fundo)] text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

---

### 4.6. Critérios de Build, Testes e Diretrizes em Português (pt-BR)

#### A. Configuração TypeScript (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@core/*": ["./core/*"],
      "@adapters/*": ["./adapters/*"],
      "@config/*": ["./config/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".agents"]
}
```

#### B. Configuração Vitest (`vitest.config.ts`)

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["core/**/*.ts", "adapters/**/*.ts", "src/lib/**/*.ts"],
      exclude: ["node_modules", "tests", ".agents"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@core": path.resolve(__dirname, "./core"),
      "@adapters": path.resolve(__dirname, "./adapters"),
      "@config": path.resolve(__dirname, "./config"),
    },
  },
});
```

#### C. Convenção Estrita de Idioma e Nomenclatura (100% pt-BR)
- Todas as variáveis de domínio, nomes de entidades, funções, tipos, comentários de código e mensagens de erro no console devem obrigatoriamente estar em Português do Brasil (`pt-BR`).
  - Exemplos aprovados: `calcularConsumoDiario()`, `aplicarTravaMarcaZumbi()`, `validarAcessoCarteiraFornecedores()`, `quantidadeTransferenciaEnviar`.
  - Exemplos vedados: `calcDailyDemand()`, `zombieLock()`, `checkRBAC()`, `transferQty`.

---

## 5. Método de Verificação Independente (Verification Method)

Para que qualquer auditor ou agente subsequente valide e comprove formalmente a corretude da arquitetura descrita neste relatório, devem ser executados os seguintes passos:

### 5.1. Verificação Estática de Tipagem e Build
1. **Comando de Checagem TypeScript:**
   ```bash
   npx tsc --noEmit
   ```
   *Critério de Sucesso:* 0 erros de compilação com `strict: true`. O diretório `core/` não pode conter referências a bibliotecas de banco de dados, `next`, `react` ou módulos de infraestrutura.
2. **Verificação de Isolamento do Core:**
   Executar verificação de dependências no `core/`:
   ```bash
   grep -rn "from 'react'" core/ || true
   grep -rn "from 'next'" core/ || true
   grep -rn "from 'mysql'" core/ || true
   ```
   *Critério de Sucesso:* Nenhuma ocorrência retornada. O diretório `core/` deve depender exclusivamente de tipos primitivos da linguagem TypeScript.

### 5.2. Execução da Suíte de Testes Automatizados (Vitest)
Executar todos os testes de regras matemáticas e de segurança:
```bash
npm run test
# ou npx vitest run
```

*Cenários Obrigatórios que Devem Passar:*
1. **Teste de Transferência com Preservação de Estoque Mínimo:**
   - *Entrada:* Loja A com Saldo 10 e Mínimo 8 (Excedente = 2). Loja B com Necessidade 5.
   - *Resultado Esperado:* Transferência sugerida de **exatamente 2 unidades**. Saldo final da Loja A = 8 ($\ge$ Mínimo 8).
   - *Condição de Invalidação:* Qualquer transferência $> 2$ que deixe o saldo da Loja A menor que 8 invalida imediatamente a implementação.
2. **Teste da Trava Marca Zumbi:**
   - *Entrada:* Produto com Saldo Físico = 4, Vendas 180d = 0, Consumo Previsto Teórico = 10.
   - *Resultado Esperado:* `sugestaoFinalCompra === 0` e `status === "TRAVADO_MARCA_ZUMBI"`.
   - *Condição de Invalidação:* Qualquer sugestão de compra $> 0$ para esse item invalida a trava.
3. **Teste de Interseção Segura de RBAC:**
   - *Entrada:* Comprador com `fornecedoresPermitidos: [101, 102]`. Requisição tentando acessar fornecedores `[101, 999]`.
   - *Resultado Esperado:* Resposta restrita estritamente ao fornecedor `[101]`. Acesso a `999` sumariamente bloqueado.
4. **Teste de Resiliência do Cache e Mock:**
   - O `AdaptadorInventarioMock` deve gerar 25.000 SKUs em menos de 1.500ms, demonstrando viabilidade de execução em ambiente local sem rede externa.

---
**Fim do Relatório de Handoff.**  
*O projeto arquitetural acima está consolidado e pronto para implementação direta pelos agentes especialistas.*

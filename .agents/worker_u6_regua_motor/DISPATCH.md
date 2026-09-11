# DISPATCH — Worker U6 (Régua do Motor: E1 → E2 → E3)

## Missão
Resolver integralmente a Unidade U6 conforme `ORIGINAL_REQUEST.md` (seção `## 2026-09-11T16:16:15Z`, item `## U6. Régua do motor`) e `docs/pontas-soltas.md` (Grupo E), executando as 3 pontas em sequência estrita: E1 primeiro, depois E2, depois E3.

## Caminho do Requisito Original
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md`
Consulte também: `docs/salvaguarda-bi-cliente.md` gerado pela unidade U7.

## Invariantes Obrigatórios
1. **Zero não é o mesmo que não medido.** Usar `camposIndisponiveis` e travessão `—`. Nunca preencher com zero dados ausentes.
2. A plataforma sobe sem nenhuma variável de ambiente.
3. Nenhum nome de rede real no código genérico.
4. Infraestrutura entra por porta.
5. Não remover teste para ficar verde.
6. Mensagens de commit e comentários em português.

## Arquivos de Propriedade Exclusiva
- `src/lib/cockpit/gerador-linhas-matriz.ts`
- `core/travas/lote-multiplo.ts`
- `adapters/carreiro/mapeador-dax.ts`
- `adapters/carreiro/consultas-homologadas.ts`
- `src/lib/exportacao/catalogo-colunas.ts`
- `tests/cockpit/` (testes de ordenação, filtros, matriz)
- `tests/core/`
- `tests/adapters/`

## Sequência Obrigatória de Execução

### 1. Etapa E1: Decidir o padrão de "sem histórico na loja em foco"
- Em `src/lib/cockpit/gerador-linhas-matriz.ts:213-214` e campos vizinhos, quando não há histórico na loja em foco, o código atualmente preenche vendas, consumo e notas com 0 (afeta ~75% das linhas).
- Alinhar com o Invariante 1: quando não há histórico na loja, declarar como **não medido** (`null` / travessão / `camposIndisponiveis`), e NÃO zero ("não vendeu").
- **Medir e conferir os 4 efeitos colaterais**:
  1. **Ordenação**: Valores não medidos/nulos devem ordenar previsivelmente (fim da lista ou posição neutra).
  2. **Filtro por faixa**: Filtros numéricos (ex: giro > 0) não devem incluir itens não medidos.
  3. **Contagem dos chips**: Os chips de contagem rápida e badges do cabeçalho devem refletir a distinção entre zero e não medido.
  4. **Conteúdo do arquivo exportado**: CSV/XLSX deve exportar travessão `—` ou vazio para não medido, não `0`.

### 2. Etapa E2: Lote a partir do dado (Histograma)
- `core/travas/lote-multiplo.ts` possui `detectarLotePorHistograma` (linha 47), mas o adapter usa inferência por categoria (`adapters/carreiro/mapeador-dax.ts:202`).
- Estabelecer a precedência correta: **ERP > Histograma > Vocabulário**.
- Garantir que onde houver evidência de distribuição de múltiplos de compras a partir de `NOTAS_ITEMS[NQTDE]`, o lote seja detectado pelo histograma.

### 3. Etapa E3: Elegibilidade avaliada em 12 meses (não 90 dias)
- A regra homologada é: 3 notas distintas em 12 meses mais 2 meses ativos.
- Atualmente `adapters/carreiro/consultas-homologadas.ts:390` traz `NotasVenda90d` e usa para o critério.
- Implementar `Notas12m` na consulta homologada e alimentar o critério com essa janela de 12 meses.
- **Armadilha do DAX**: O `executeQueries` do Power BI trunca respostas por tamanho de payload em bytes sem emitir erro. Toda consulta alterada deve preservar a contagem contra `COUNTROWS` do mesmo filtro e manter a paginação por cursor.

### 4. Validação e Qualidade
- Validar todos os 4 efeitos colaterais de E1.
- Executar a suíte de testes completa e `npm run build`.
- Registrar detalhadamente em `progress.md` e `handoff.md`.

## Aviso Obrigatório de Integridade
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-11T16:49:58Z
Você é o Worker responsável pela Unidade U6 (Régua do motor: E1 -> E2 -> E3).
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_u6_regua_motor
Leia atentamente DISPATCH.md em seu diretório, ORIGINAL_REQUEST.md em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md e docs/salvaguarda-bi-cliente.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute sequencialmente:
1. E1: Sem histórico na loja em foco em src/lib/cockpit/gerador-linhas-matriz.ts vira não medido (não zero). Meça e valide os 4 efeitos colaterais: ordenação, filtro por faixa, contagem dos chips e conteúdo exportado.
2. E2: Lote vem do dado por histograma (precedência ERP > Histograma > Vocabulário).
3. E3: Elegibilidade avaliada em 12 meses (Notas12m), conferindo contra truncamento de DAX.
4. Rodar testes e npm run build.
5. Gerar progress.md e handoff.md e notificar o orquestrador via send_message.


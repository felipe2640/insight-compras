# DISPATCH — Worker U5 (Telas pela Metade: Tema, Transferências em Rede e Modelos — Iteração 1)

## Missão
Resolver integralmente a Unidade U5 conforme `ORIGINAL_REQUEST.md` (seção `## 2026-09-11T16:16:15Z`, item `## U5. Telas pela metade`) e `docs/pontas-soltas.md` (Grupo F).

## Caminho do Requisito Original
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md`

## Invariantes Obrigatórios
1. Zero não é o mesmo que não medido.
2. A plataforma sobe sem nenhuma variável de ambiente.
3. Nenhum nome de rede real no código genérico.
4. Infraestrutura entra por porta.
5. Não remover teste para ficar verde.
6. Mensagens de commit e comentários em português.

## Arquivos de Propriedade Exclusiva
- `src/app/configuracoes/tema/page.tsx`
- `src/app/transferencias/page.tsx`
- `src/components/cockpit/DialogExportacao.tsx`
- `src/components/cockpit/BotoesExportacao.tsx`
- `src/app/api/exportacao/modelos/route.ts`
- `src/lib/exportacao/`
- `tests/transferencias/`
- `tests/exportacao/`

## Tarefas Específicas
1. **F1. Tema & White-Label Honesto (`src/app/configuracoes/tema/page.tsx`)**:
   - Converter a tela para declarar honestamente a configuração de deploy do tenant (`resolverTenantConfigurado()`).
   - Apresentar de forma somente-leitura transparente, exibindo valores vigentes, arquivos de origem e variáveis CSS ativas (sem campos falsos que fingem salvar alterações no filesystem).
2. **F2. Transferências com Visão de Rede (`src/app/transferencias/page.tsx`)**:
   - Implementar visão matricial/consolidada de rede (o que cada filial envia e recebe de uma só vez).
   - Preservar o tooltip de destino com alto contraste (`variante="painel"`).
3. **F3. CRUD Completo de Modelos de Exportação pela Interface**:
   - Em `DialogExportacao.tsx` / `BotoesExportacao.tsx`, disponibilizar ações para criar, renomear, editar colunas e excluir modelos de exportação salvos via `/api/exportacao/modelos`.
4. **Testes e Build**:
   - Validar testes automatizados e `npm run build`.

## Aviso Obrigatório de Integridade
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-11T21:11:04Z

<USER_REQUEST>
Você é o Worker responsável pela Unidade U5 (Telas pela metade: Tema honesto, Transferências em rede e CRUD de modelos).
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_u5_telas_r1
Leia atentamente DISPATCH.md em seu diretório e ORIGINAL_REQUEST.md em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute:
1. F1: Converter a tela de tema (/configuracoes/tema) para declarar honestamente a configuração de deploy do tenant (somente leitura transparente com valores e variáveis CSS ativas).
2. F2: Implementar visão de rede consolidada em /transferencias (matriz de envios e recebimentos entre todas as lojas da rede).
3. F3: Implementar CRUD completo de modelos de exportação pela interface (criar, renomear, editar colunas, excluir).
4. Rodar testes e npm run build.
5. Gerar progress.md e handoff.md e notificar o orquestrador via send_message.
</USER_REQUEST>

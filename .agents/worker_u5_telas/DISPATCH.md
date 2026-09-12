# DISPATCH — Worker U5 (Telas pela Metade: Tema, Transferências em Rede e Modelos)

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
   - Atualmente a tela tem campos que apenas alteram `useState` local sem persistência durável (maquete). Como `config/tenants/*.ts` é código compilado e o filesystem é read-only na Vercel/produção:
   - A tela deve ser convertida para ser **honesta**: declarar expressamente que o tema ativo é derivado da configuração do tenant (`resolverTenantConfigurado()`), exibindo os valores vigentes de forma somente-leitura e informativa (com badges indicando a origem e as variáveis CSS geradas), ou persistir via repositório se aplicável. Jamais fingir que salvou alterações no filesystem.
2. **F2. Transferências com Visão de Rede (`src/app/transferencias/page.tsx`)**:
   - Atualmente a tela calcula o plano para uma única loja receptora por vez.
   - Implementar a **visão de rede consolidada**: matriz ou tabela exibindo o que cada loja da rede envia e recebe de uma vez só (panorama completo de transferências entre filiais).
   - Preservar o tooltip de destino de alto contraste (`variante="painel"`).
3. **F3. CRUD Completo de Modelos de Exportação pela Interface**:
   - A API (`/api/exportacao/modelos`) já possui suporte a criar, sobrescrever e excluir (`DELETE`).
   - A interface em `DialogExportacao.tsx` / `BotoesExportacao.tsx` precisa permitir:
     - Criar novo modelo com colunas selecionadas.
     - Renomear modelo existente.
     - Alterar colunas de um modelo salvo.
     - Excluir um modelo customizado salvo.
4. **Testes e Build**:
   - Validar testes unitários e de integração para transferências de rede e CRUD de modelos de exportação.
   - Executar `npm run build` e testes.

## Aviso Obrigatório de Integridade
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-11T16:49:14Z
Você é o Worker responsável pela Unidade U5 (Telas pela metade: Tema honesto, Transferências em rede e CRUD de modelos).
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_u5_telas
Leia atentamente DISPATCH.md em seu diretório e ORIGINAL_REQUEST.md em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute:
1. F1: Converter a tela de tema (/configuracoes/tema) para declarar honestamente a configuração de deploy do tenant (somente leitura transparente com valores e variáveis CSS ativas).
2. F2: Implementar visão de rede consolidada em /transferencias (matriz de envios e recebimentos entre todas as lojas da rede).
3. F3: Implementar CRUD completo de modelos de exportação pela interface (criar, renomear, editar colunas, excluir).
4. Rodar testes e npm run build.
5. Gerar progress.md e handoff.md e notificar o orquestrador via send_message.

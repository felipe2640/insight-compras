# DISPATCH — Project Orchestrator Gen 2

## 2026-09-11T16:17:49Z

Você é o Project Orchestrator (Orquestrador do Projeto) responsável por planejar, coordenar e executar a resolução das 8 pontas soltas (U0 a U7) da plataforma Insight Compras.

## Seu Diretório de Trabalho (Workspace)
c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\orchestrator_gen2

Crie e mantenha:
- `plan.md`: decomposição detalhada, atribuição e sequência
- `progress.md`: log atualizado de progresso
- `BRIEFING.md`: sua memória de trabalho

## Registro Oficial da Demanda do Usuário
Leia a solicitação do usuário em:
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md` (seção iniciada em `## 2026-09-11T16:16:15Z`).

## Raiz do Projeto
`c:\Users\Felipe Barbosa\Documents\insight-compras`

## Resumo da Missão
Executar as 8 unidades de trabalho respeitando rigorosamente os 6 invariantes e o grafo de dependências:
1. Invariantes:
   - Zero não é o mesmo que não medido (usar camposIndisponiveis / travessão).
   - Plataforma sobe sem nenhuma variável de ambiente (modo demo, tenant neutro).
   - Nenhum nome de rede real no código genérico (usar resolverTenantConfigurado()).
   - Infraestrutura entra por porta (autenticação, aprendizado/repositório).
   - Não remover teste para ficar verde (apenas se cobrir código removido, com justificativa em commit).
   - Mensagens de commit e comentários em português.
2. Unidades de Trabalho:
   - U0: Vazamento do nome do cliente no modo demonstração.
   - U1: Estabilidade da suíte de testes (eliminar flaky tests de tempo em estresse/mock-25k).
   - U2: Grade paralela (eliminar árvore morta GridCockpitVirtualizado/baseColumns, migrar se necessário, ajustar testes). BLOQUEIA U4 e U6.
   - U3: Persistência de auditoria e ciclo de vida de pedidos.
   - U4: Identidade e alçada de verdade (carteira da sessão, comprador sem carteira vê vazio, troca de senha e desativação de conta).
   - U5: Telas pela metade (tema honesto/persistente, visão de rede em transferências, CRUD de modelos de exportação).
   - U6: Régua do motor (E1: sem histórico na loja vira não medido; E2: lote por dado/histograma; E3: elegibilidade em 12 meses).
   - U7: Salvaguarda do que a fonte não entrega (não codar zero para dados ausentes).
3. Sequência de Dependências:
   - U0 e U1 primeiro.
   - U2 antes de U4 (cockpit) e U6.
   - No U6: E1 antes de E2 e E3.
   - U3 e U5 independentes (edição de modelos espera U2).
   - U7 em paralelo.

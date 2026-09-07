# Dispatch Log

## 2026-09-06T12:31:56Z

Você é o Spec Miner responsável por extrair e detalhar todas as especificações do Cockpit do Comprador e Tooltips Analíticos.
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\spec_miner_m0_cockpit\
Leia obrigatoriamente:
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md
Consulte também o projeto legado em c:\Users\Felipe Barbosa\Documents\diario para verificar tabelas, visualizações e componentes existentes.

Sua missão:
Extrair a especificação funcional e técnica exaustiva para o novo Cockpit do Comprador:
1. Virtualização de Alta Performance:
   - Estratégia exata com TanStack Table v8 + TanStack Virtual para renderizar mais de 25.000 SKUs a 60fps constantes sem travamentos.
   - Estratégia de filtro e busca em memória instantânea (< 250ms de latência percebida).
2. Matriz de Decisão (baseColumns):
   - Detalhamento de cada coluna exigida: Diagnóstico de Ruptura, Frequência (90d), Coberturas Comparativas (30d/90d/180d), Alerta de NF-e do Dia, Consulta de Itens Similares intercambiáveis com saldo positivo.
   - Formatação, ordenação, regras visuais de severidade (ex: cores de alerta de ruptura e estoque crítico).
3. Tooltips Analíticos Ricos (os 5 tooltips essenciais para decisão):
   - Tooltip de Ruptura (histórico de zeramento, dias com/sem estoque, % de ruptura).
   - Tooltip de Frequência (notas líquidas, notas de venda, notas de devolução nos 90 dias).
   - Tooltip de Cobertura (decomposição detalhada 30d, 90d e 180d).
   - Tooltip de Transferência (loja de origem, sobra real `saldo - minStock`, motivo da recomendação).
   - Tooltip de NF-e do Dia (número da nota, fornecedor, quantidade que deu entrada, data).
   - Comportamento de abertura instantânea em hover/focus e acessibilidade.
4. Ajuste Humano e Persistência:
   - Célula editável com múltiplos/embalagens mínimas e pares.
   - Salvamento e recuperação de rascunhos de sessão do comprador.
5. Gere seu relatório final completo em:
c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\spec_miner_m0_cockpit\handoff.md
Atualize seu progress.md durante a execução. Ao concluir, envie uma mensagem ao orquestrador informando que o relatório está pronto.

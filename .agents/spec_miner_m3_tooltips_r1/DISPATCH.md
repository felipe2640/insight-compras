## 2026-09-06T16:26:42Z
Subagente: spec_miner_m3_tooltips_r1 (teamwork_preview_spec_miner)
Caller: parent (140d3f6b-8e9e-4004-bf5c-e74848758224)
Working Directory: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\spec_miner_m3_tooltips_r1\

Missão:
Extrair as especificações completas e detalhadas da matriz de colunas baseColumns e dos 5 Tooltips Analíticos Ricos para o Cockpit do Comprador.

Escopo:
1. Matriz de Colunas (baseColumns):
   - Especificação de cada coluna: Código (com badges de similares e alerta NF-e do dia), Descrição, Marca/Curva, Giro Médio, Diagnóstico de Ruptura, Frequência (90d), Coberturas Comparativas (30d, 90d, 180d), Estoque Atual por Loja, Sugestão do Motor, Pedido Editável, Transferência Recomendada.
   - Coluna de Similares Intercambiáveis: badge roxo Sparkles, contagem e dados para consulta de peças equivalentes com saldo.
2. 5 Tooltips Analíticos Ricos (abertura instantânea com delayDuration={0}):
   - Tooltip de Ruptura: dias analisados, dias zerados, % taxa de ruptura, classificação (Boa <=5%, Atenção 5-10%, Grave >10%), estimativa de demanda reprimida/venda perdida.
   - Tooltip de Frequência (90d): total de notas de venda, notas de devolução, notas líquidas, percentual sobre 90d, classificação (Alta >40%, Média 15-40%, Baixa <15%) e extrato discriminado com cores semânticas (verde para venda, vermelho para devolução).
   - Tooltip de Cobertura Comparativa: análise comparativa das janelas 30d (aceleração recente), 90d (giro médio) e 180d (longo prazo/alerta de produto zumbi sem vendas), ritmo de consumo diário e dias de cobertura.
   - Tooltip de Transferência: loja de origem, sobra real (saldo - minStock > 0), loja destino, motivo e quantidade a remanejar sem desabastecer a doadora.
   - Tooltip de NF-e do Dia: alerta visual imediato com ícone AlertTriangle vermelho, número da nota fiscal, fornecedor, quantidade que deu entrada hoje e data/hora.
3. Contratos TypeScript para props, tipos e renderizadores dos tooltips e colunas.
4. Diretrizes de Acessibilidade (WAI-ARIA, foco por teclado).
5. Estratégia de testes para Vitest em tests/cockpit/.

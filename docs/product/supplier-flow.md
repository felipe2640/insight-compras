# Jornada do fornecedor — pré-G0 v2

Status: contrato de experiência para revisão de G0; não é implementação. O portal é do Cotação Hub e funciona sem Insight, Diário, Connectsoft ou ERP. A proposta pertence à organização fornecedora; cada edição registra usuário individual, método de autenticação e origem. Convite limita a cotação e não cria acesso geral ao catálogo de oportunidades.

## Jornada principal

1. **Receber e abrir.** O e-mail de convite informa buyer, prazo em fuso local, quantidade de itens e ação principal. Link de uso restrito inicia resgate; antes do OTP exibe somente contexto mínimo. Usuário existente escolhe organização autorizada; novo contato verifica e-mail individual por OTP e passa por concessão específica para aquela participação. Um link encaminhado a outra pessoa não dá acesso a outras cotações. Mostrar expiração e oferecer reenvio controlado, sem revelar se uma conta existe.
2. **Orientar.** Após autenticar, cabeçalho mostra prazo da cotação, destinos/filiais, moeda, itens totais, respondidos, sem estoque e não respondidos. Condições comerciais da proposta aparecem em painel persistente: pagamento, faturamento mínimo, frete, validade, prazo padrão, observação. A UI distingue deadline da cotação de prazo de entrega informado pelo fornecedor.
3. **Responder em grade.** Desktop apresenta linhas compactas com referência, marca, descrição, unidade e quantidade solicitada fixas; campos editáveis de referência/marca ofertada, preço unitário, disponibilidade, unidade/múltiplo/mínimo, prazo e observação. Navegação por teclado (Tab/Shift-Tab, Enter e setas quando na grade), colagem retangular de Excel e preenchimento em massa reduzem digitação. Não exigir modal ou página por item. Busca por referência, filtros `não respondido`, `com erro`, `sem estoque`, `substituição` e `alterado` mantêm o contexto. Uma linha pode ser marcada `sem estoque`, com quantidade zero e preço vazio, e desmarcada sem perder a trilha de revisão.
4. **Tratar alternativas.** Se referência ou marca muda, o portal marca substituição automaticamente, pede tipo/nota quando necessário e mostra que a alternativa depende da política do buyer. Não sugerir “aceito” apenas por ter preenchido a marca. Embalagem física, unidade de venda, quantidade mínima e múltiplo ficam visíveis ao lado da quantidade disponível para evitar preço de caixa interpretado como preço de peça.
5. **Salvar e retomar.** Autosave de células alteradas agrupa escritas em lote com debounce curto; mostra estados `salvando`, `salvo em horário X`, `erro` e `conflito`. Nunca dizer “salvo” antes da confirmação do servidor. Mudanças locais permanecem visíveis em falha de rede e podem ser reenviadas com segurança; rascunho no navegador é apoio, não fonte canônica. Ao voltar, buscar revisão corrente e reconciliar. Dois usuários da mesma organização podem editar: `If-Match`/ETag detecta conflito por revisão; oferecer comparação de valores e escolha explícita, sem sobrescrever silenciosamente.
6. **Concluir resposta.** Botão fixo `Concluir resposta` abre resumo de linhas respondidas, sem estoque, omitidas, substituições, condições comerciais e erros. Resposta parcial é permitida quando há ao menos uma linha respondida, mas itens omitidos são destacados como `sem resposta`, nunca convertidos em `sem estoque`. Erros bloqueantes apontam para a linha/campo; alertas de negócio exigem confirmação consciente. O envio usa ETag e idempotência; servidor retorna número de revisão, horário e recibo. Após concluir, edição posterior antes do prazo cria nova revisão e pede nova conclusão. Depois do prazo/fechamento, mostrar leitura e caminho de solicitação de extensão, sem promessa de salvar.
7. **Consultar resultado e pedido.** Acesso a pedido ganho exige sessão individual e autorização própria da organização no pedido, não token do convite. Exibir número Hub, destino, itens, condições congeladas, PDFs/XLSX e ações de confirmar/recusar com motivo. Recusa não é “edição da proposta”.

## Layout desktop e celular

| Superfície | Padrão operacional |
|---|---|
| Desktop | Grade virtualizada quando necessário, cabeçalho e coluna de identificação fixos, densidade configurável, colagem de várias linhas/colunas, seleção de intervalo e operações em massa com prévia. Teclas e foco previsíveis; célula inválida não move foco sem feedback. |
| Celular | Lista de cartões compactos com referência, marca, quantidade, preço e status; toque expande somente o item ativo. Barra fixa mostra progresso e `Concluir`. Busca/filtro sempre acessíveis. Teclado numérico para decimais, botões grandes para sem estoque e navegação próximo/anterior. Colagem em massa pode ser feita na tela dedicada de importação, sem simular planilha horizontal estreita. |
| Ambos | Contraste e foco visível, rótulos claros para leitor de tela, erro por campo, feedback não dependente só de cor, datas com fuso explícito, valores decimais apresentados no local do usuário mas enviados como strings canônicas. |

## Escala de 100+ itens e operações em lote

Não fazer uma requisição obrigatória por célula ou por item. A API deve aceitar lote de linhas alteradas com ID do item, operação, versão esperada e chave de idempotência; cada linha retorna sucesso/erro identificável, nova revisão e motivo, sem aceitar escrita parcial oculta. Para colagem, exibir mapeamento de colunas e prévia antes de persistir: `item_id` ou correspondência exata de referência original, nunca matching probabilístico silencioso. Linhas ambíguas ou não encontradas ficam em staging para correção. `marcar selecionados sem estoque`, definir prazo comum e aplicar condição de cabeçalho são ações em massa com contagem explícita e desfazer antes de salvar. Seleções atravessando páginas/filtros precisam mostrar escopo (`12 selecionados visíveis` versus `todos 142 filtrados`). Virtualização não pode perder foco, seleção ou estado de edição quando uma linha sai da tela.

Metas de validação em protótipo, ainda sem números normativos: fornecedor deve conseguir responder 100 itens majoritariamente por colagem e teclado, corrigir dez exceções sem abrir dez páginas, identificar todos os itens pendentes antes de concluir, retomar após interrupção e compreender conflito concorrente. Medir tempo, ações, erros de unidade/preço, taxa de recuperação de autosave e uso em celular. Um teste com rede lenta e dois usuários da mesma organização é obrigatório antes de considerar o fluxo pronto.

## Importação e resposta assistida

Fornecedor pode baixar template XLSX e fazer `upload → staging → validation → preview → commit` após autenticação; arquivo e hash ficam associados à revisão. Fórmulas são tratadas como dados, células potencialmente executáveis na exportação são escapadas, limites de tamanho/linhas e verificação de arquivo são aplicados. Se buyer lançar resposta recebida por e-mail, WhatsApp ou telefone, a UI buyer deve dizer `assistida pelo comprador` e registrar operador, fornecedor representado, origem, evidência e status de confirmação. No portal supplier, uma proposta assistida aparece como “lançada por [papel] em nome da organização”, com possibilidade de confirmar/corrigir por usuário autenticado; nunca rotular como resposta direta. A confirmação produz revisão/atestado próprio.

## Falhas e prevenção de erro

| Situação | Comportamento esperado |
|---|---|
| Preço `10,50` colado em locale pt-BR | Prévia interpreta explicitamente como decimal 10.50; ambiguidade `1,234` requer escolha de locale, nunca conversão silenciosa. |
| Preço de caixa e unidade peça | Solicitar base do preço e multiplicador; comparação fica `requires_review` se a conversão não está definida. |
| Quantidade disponível menor que solicitada | Mostrar parcial e saldo; não completar automaticamente com quantidade fictícia. |
| Mínimo/múltiplo impossíveis para necessidade | Avisar na linha e no resumo; fornecedor pode enviar a condição, mas buyer verá inelegibilidade sob política vigente. |
| Substituição sem marca/referência suficiente | Pedir dado faltante ou marcar revisão, nunca aceitar automaticamente. |
| Expiração durante edição | Preservar mudanças locais para visualização/exportação, bloquear commit tardio com mensagem e oferecer extensão formal. |
| Retry após timeout no envio | Mesma chave idempotente retorna mesmo recibo; chave com corpo alterado gera conflito claro. |
| ETag divergente | Mostrar quem alterou/quando quando autorizado; permitir recarregar ou reaplicar mudanças após comparação. |

## Critérios de aceite pré-G0

- Jornada supplier descrita apenas com recursos públicos do Hub: convite, OTP, leitura, lote, submissão, pedido e confirmação/recusa.
- Uma cotação grande não obriga centenas de requests, modais ou cliques por item.
- Cada mudança confirmada tem ator individual e revisão; autosave não mascara falhas ou conflitos.
- Resposta parcial, sem estoque, alternativa e importação assistida permanecem semanticamente distintas.
- Dados de outro buyer, outra cotação ou outro supplier não aparecem por trocar URL, convite ou filtro.

Veredito A6: **fluxo operacional viável como contrato de produto; G0 depende de endpoints bulk, erros por linha, ETag e fluxos de autenticação formalizados no OpenAPI.**

# DISPATCH — Spec Miner U7 (Salvaguarda do que a Fonte não Entrega)

## Missão
Realizar o levantamento e formalização da Unidade U7 de acordo com as especificações em `ORIGINAL_REQUEST.md` (seção `## 2026-09-11T16:16:15Z`, item `## U7. Salvaguarda do que a fonte do cliente não entrega`) e `docs/pontas-soltas.md` (Grupo D).

## Caminho do Requisito Original
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md`

## Invariantes Obrigatórios
1. **Zero não é o mesmo que não medido.** O projeto declara dado ausente em `camposIndisponiveis` e a tela mostra travessão. NUNCA codar zero para dados ausentes.
2. Nenhum código de produção deve ser alterado para forçar zeros.

## Escopo de Análise
Investigar a fundo no código e nas consultas existentes os 4 pontos:
1. **Quantidade já pedida:** `adapters/carreiro/mapeador-dax.ts:339` e `TBL_SOLICITACOES_COMPRAS_HIST`. Documentar o estado de `PEDIDO_COMPRA_ID`.
2. **Transferência recebida vs compra:** `adapters/carreiro/entradas-confirmacao.ts`. Documentar por que o suprimento soma em `qtdEntrada` e como o status "transferencia" se comporta.
3. **Grupo do ERP (`CLASSES[ADESCRICAO]`):** Análise da confiabilidade da classe vs subclasse.
4. **Sub-grupo cobertura de 86%:** 14% nulos e conversão para travessão.

## Entregável
Gerar o documento técnico `docs/salvaguarda-bi-cliente.md` detalhando as 4 pontas, as conclusões de cada uma, e recomendações claras para o time de BI e para a unidade U6.

## Aviso Obrigatório
Esta é uma unidade de levantamento e documentação analítica. NENHUM código de produção deve ser alterado preenchendo zeros falsos.

## 2026-09-11T16:19:46Z
Você é o Spec Miner responsável pelo levantamento da Unidade U7 (Salvaguarda do que a fonte do cliente não entrega).
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\spec_miner_u7_bi
Leia atentamente DISPATCH.md em seu diretório de trabalho, ORIGINAL_REQUEST.md em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md e docs/pontas-soltas.md.

Investigue os 4 pontos de dados ausentes (quantidade já pedida, transferências vs compras, grupos/classes do ERP, e cobertura de subclasses).
Gere o relatório analítico c:\Users\Felipe Barbosa\Documents\insight-compras\docs\salvaguarda-bi-cliente.md.
NÃO modifique código de produção para preencher dados com zeros falsos. Respeite o invariante 'Zero não é o mesmo que não medido'.
Ao concluir, escreva handoff.md no seu diretório e comunique ao orquestrador via send_message.

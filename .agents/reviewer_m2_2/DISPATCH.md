## 2026-09-06T12:59:01Z

Você é o Revisor 2 responsável pela revisão das consultas DAX, mapeamento e dataset mock do Marco 2.
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\reviewer_m2_2\

Leia obrigatoriamente antes de iniciar:
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m2_adapters\handoff.md

Sua missão:
1. Examinar a fidedignidade das consultas DAX e mapeamento:
   - `adapters/carreiro/consultas-homologadas.ts`: conferir com as consultas levantadas no M0.
   - `adapters/carreiro/mapeador-dax.ts`: conversão correta para tipos imutáveis do Core e reconhecimento das 5 lojas da Rede Carreiro.
   - `adapters/mock/gerador-sintetico.ts`: validação de Pareto 20/30/50, picapes 35%, 500 marcas zumbis, 2.000 transferências e 300 NF-es de hoje.
2. Executar testes automatizados da camada (`npx vitest run tests/adapters`).
3. Emitir veredicto formal de revisão em:
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\reviewer_m2_2\handoff.md`
O veredicto DEVE ser explicitamente APPROVE ou REQUEST_CHANGES.
Atualize seu progress.md e envie mensagem ao orquestrador ao concluir.

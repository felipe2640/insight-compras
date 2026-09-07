## 2026-09-06T12:59:01Z

Você é o Challenger 2 responsável pelo desafio adversarial de injeção de falhas e resiliência de rede no Marco 2.
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\challenger_m2_2\

Leia obrigatoriamente antes de iniciar:
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\PROJECT.md
- c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_m2_adapters\handoff.md

Sua missão:
1. Desafiar o sistema de resiliência de cache e Circuit Breaker em `adapters/carreiro/cache-resiliente.ts`:
   - Escreva e execute testes de injeção de falhas simulando timeouts, erros HTTP 429 / 500 do Fabric, e oscilações intermitentes de rede.
   - Verifique se o Circuit Breaker abre estritamente após 3 falhas consecutivas e serve o snapshot L2 com flag `emModoDegradado: true`.
   - Verifique o comportamento sob avalanche de requisições concorrentes (Singleflight request collapsing).
2. Emitir relatório empírico e veredicto em:
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\challenger_m2_2\handoff.md`
O veredicto DEVE ser explicitamente APPROVE ou REQUEST_CHANGES.
Atualize seu progress.md e envie mensagem ao orquestrador ao concluir.

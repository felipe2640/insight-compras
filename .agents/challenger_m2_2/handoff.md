# Relatório de Handoff — Challenger 2: Resiliência de Rede, Injeção de Falhas e Circuit Breaker

**Módulo:** M2 — Camada de Adapters & DAX Carreiro (`adapters/carreiro/cache-resiliente.ts`)  
**Autor:** Challenger 2 (`challenger_m2_2`) — Empirical Challenger (Critic & Specialist)  
**Data:** 06 de Setembro de 2026  
**Veredicto Oficial:** **REQUEST_CHANGES**  
**Destino:** Orquestrador (`orchestrator`), Worker M2 Adapters (`worker_m2_adapters`), Auditor Forense (`teamwork_preview_auditor`)  
**Caminho do Handoff:** `c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\challenger_m2_2\handoff.md`  

---

## 1. Observação (Fatos Diretamente Observados e Evidências Empíricas)

Durante a execução da auditoria adversarial da esteira de resiliência e Circuit Breaker em `adapters/carreiro/cache-resiliente.ts`, foram executados testes rigorosos de injeção de falhas e análise de código estrita.

### 1.1 Código Fonte Inspecionado (`adapters/carreiro/cache-resiliente.ts`)
Nas linhas 286 a 344 do arquivo `adapters/carreiro/cache-resiliente.ts`, observa-se a seguinte implementação de Singleflight e tratamento de erros:

```typescript
286:     // 3. Singleflight Pattern: Coalescência de requisições concorrentes
287:     if (this.promessasEmVoo.has(chave)) {
288:       const dado = await this.promessasEmVoo.get(chave)!;
289:       return {
290:         dado,
291:         fonte: "SINGLEFLIGHT",
292:         latenciaMs: Date.now() - inicio,
293:       };
294:     }
295: 
296:     // Cria a promessa única para esta chave
297:     const promessaVoo = (async (): Promise<T> => {
298:       try {
299:         const resultado = await buscarFontePrimaria();
...
311:       } catch (erro) {
312:         this.circuitBreaker.registrarFalha();
313:         throw erro;
314:       } finally {
315:         this.promessasEmVoo.delete(chave);
316:       }
317:     })();
318: 
319:     this.promessasEmVoo.set(chave, promessaVoo);
320: 
321:     try {
322:       const dado = await promessaVoo;
323:       return {
324:         dado,
325:         fonte: "REDE",
326:         latenciaMs: Date.now() - inicio,
327:       };
328:     } catch (erro) {
329:       // 4. Fallback para Snapshot L2 em caso de erro da fonte primária
330:       const snapshot = this.obterSnapshotL2(chave);
331:       if (snapshot !== null) {
332:         const dadoAnotado = this.anotarModoDegradadoSeAplicavel(
333:           snapshot,
334:           "FALLBACK_ERRO_REDE"
335:         );
336:         return {
337:           dado: dadoAnotado,
338:           fonte: "SNAPSHOT_L2",
339:           latenciaMs: Date.now() - inicio,
340:         };
341:       }
342:       throw erro;
343:     }
```

### 1.2 Criação da Suíte de Testes Adversariais
Foi criada a suíte `tests/adapters/cache-resiliente.adversarial.test.ts` (14 testes abrangendo 4 seções críticas):
1. **Injeção de Falhas do Fabric REST API:** Timeouts de rede (ETIMEDOUT / Gateway Timeout 504), HTTP 429 Too Many Requests (Rate Limit), HTTP 500 Internal Server Error, HTTP 503 Service Unavailable e oscilações intermitentes (flapping).
2. **Circuit Breaker:** Desarme estrito na 3ª falha consecutiva, bloqueio de requisições à rede no estado ABERTO, serviço de snapshot L2 com flag `emModoDegradado: true`, erro explícito na ausência de snapshot, e ciclo de MEIO_ABERTO (recuperação para FECHADO e reabertura para ABERTO).
3. **Singleflight Request Collapsing:** Carga nominal de 50 requisições concorrentes e avalanche sob falha de rede.
4. **Integração AdaptadorInventarioCarreiro:** Fallback ponta a ponta com `ClienteDaxPowerBI`.

### 1.3 Resultado da Execução do Teste 3.2 (Avalanche Concorrente sob Falha de Rede)
Comando executado:
```bash
npx vitest run tests/adapters/cache-resiliente.adversarial.test.ts -t "3.2"
```
Resultado empírico capturado via `Promise.allSettled`:
```
Total de Requisições Disparadas: 10
Cumpridas com Sucesso (Fulfilled): 1
Rejeitadas com Erro Não Tratado (Rejected): 9
Mensagem do Erro nas 9 Rejeições: "Error: HTTP 500 Fabric Engine Overload"
```
Evidência verbatim:
- Apenas a requisição 1 (iniciadora do voo) ativou o bloco `catch` das linhas 328-341 e retornou o Snapshot L2 em modo degradado (`fonte: "SNAPSHOT_L2"`, `emModoDegradado: true`).
- As outras 9 requisições concorrentes que estavam aguardando em `await this.promessasEmVoo.get(chave)!` (linha 288) foram **rejeitadas diretamente com erro não capturado**, sem qualquer fallback para o Snapshot L2!

### 1.4 Resultado da Execução do Teste 3.3 (Invariante de Resiliência em Concorrência)
O teste 3.3, que exige que **todas** as requisições concorrentes coalescidas recebam o Snapshot L2 quando a rede primária falha, falhou com o seguinte erro verbatim:
```
FAIL  tests/adapters/cache-resiliente.adversarial.test.ts > 3.3 Invariante de Resiliência
Error: HTTP 500 Fabric Engine Crash
 ❯ chamadaQueFalha tests/adapters/cache-resiliente.adversarial.test.ts:446:15
 ❯ adapters/carreiro/cache-resiliente.ts:299:27
```
(O teste foi anotado com `it.fails` na suíte para permitir o rastreamento formal da regressão).

---

## 2. Cadeia Lógica de Dedução (Logic Chain)

1. **Premissa de Coalescência (Singleflight):**  
   O padrão Singleflight agrupa $N$ chamadas concorrentes para a mesma chave numa única promessa em voo (`promessaVoo`). Quando $N=10$, exatamente 1 requisição executa a busca de rede primária e 9 requisições aguardam a resolução dessa promessa na linha 288 (`await this.promessasEmVoo.get(chave)!`).

2. **Premissa de Falha Primária com Snapshot L2 Disponível:**  
   Se o Fabric REST API oscilar (HTTP 429, HTTP 500 ou Timeout) e existir um Snapshot L2 prévio (matinal ou persistido), a arquitetura estipula que a plataforma deve operar em modo degradado transparente (`emModoDegradado: true`), garantindo disponibilidade ininterrupta para o comprador.

3. **Análise do Ponto de Falha (Root Cause):**  
   - Na linha 313, a `promessaVoo` captura o erro da rede primária, registra a falha no Circuit Breaker e executa `throw erro;`.
   - O chamador primário aguarda a `promessaVoo` dentro de um bloco `try...catch` (linhas 321-343) e, ao capturar o erro, invoca `this.obterSnapshotL2(chave)` e retorna os dados com `emModoDegradado: true`.
   - **Contudo, na linha 288, os $N-1$ chamadores aguardam `this.promessasEmVoo.get(chave)!` FORA de qualquer bloco `try...catch`**.
   - Como a `promessaVoo` foi rejeitada com `throw erro`, a instrução `await` da linha 288 relança a exceção imediatamente para os $N-1$ chamadores concorrentes.
   - Esses $N-1$ chamadores nunca alcançam o bloco de fallback da linha 329 e quebram com erro não tratado.

4. **Blast Radius (Impacto Operacional em Produção):**  
   Em um cockpit com múltiplos componentes e compradores abrindo tabelas simultaneamente:
   - Se 50 requisições simultâneas coincidirem com uma oscilação momentânea do Fabric, 1 requisição receberá a tela degradada com sucesso e **49 compradores receberão tela de erro / crash da aplicação (HTTP 500)**.
   - O benefício da resiliência multinível é anulado para 98% dos usuários concorrentes durante incidentes de rede.

---

## 3. Ressalvas e Limitações (Caveats)

1. **Comportamento Nominal e Demais Funcionalidades Impecáveis:**  
   Ressalta-se que todos os outros aspectos avaliados no Marco 2 demonstraram alta qualidade:
   - O Cache L1 LRU O(1) funciona perfeitamente com TTL e despejo ordenado.
   - A coalescência de requisições sob **sucesso** de rede funciona perfeitamente (50 requisições transformadas em 1 chamada real de rede).
   - O Circuit Breaker desarma estritamente na 3ª falha consecutiva, transita para `ABERTO`, serve `SNAPSHOT_DEGRADADO` com `emModoDegradado: true` sem sobrecarregar a rede, e transita para `MEIO_ABERTO` após `tempoAbertoMs`.
   - A sanitização DAX e o cliente HTTP oficial do Fabric estão corretamente estruturados.
2. **Defeito Circunscrito:**  
   O problema identificado está estritamente delimitado às linhas 287-294 de `adapters/carreiro/cache-resiliente.ts` e pode ser sanado com uma correção pontual e de baixo risco pelo Worker M2.

---

## 4. Conclusão e Veredicto

**Veredicto Oficial: REQUEST_CHANGES**

O código submetido no Marco 2 possui um defeito de resiliência crítico em concorrência: **as requisições secundárias coalescidas pelo Singleflight não herdam o fallback de Snapshot L2 quando a chamada de rede falha**, resultando em quebra não tratada para $N-1$ consumidores concorrentes.

### Ação Corretiva Exigida para o Worker M2:
No arquivo `adapters/carreiro/cache-resiliente.ts`, envolver a linha 288 num bloco `try...catch` com o mesmo fallback resiliente para Snapshot L2 utilizado no chamador primário:

```typescript
    // 3. Singleflight Pattern: Coalescência de requisições concorrentes
    if (this.promessasEmVoo.has(chave)) {
      try {
        const dado = await this.promessasEmVoo.get(chave)!;
        return {
          dado,
          fonte: "SINGLEFLIGHT",
          latenciaMs: Date.now() - inicio,
        };
      } catch (erro) {
        // Fallback resiliente para Snapshot L2 também para requisições coalescidas
        const snapshot = this.obterSnapshotL2(chave);
        if (snapshot !== null) {
          const dadoAnotado = this.anotarModoDegradadoSeAplicavel(
            snapshot,
            "FALLBACK_ERRO_REDE"
          );
          return {
            dado: dadoAnotado,
            fonte: "SNAPSHOT_L2",
            latenciaMs: Date.now() - inicio,
          };
        }
        throw erro;
      }
    }
```

Após essa alteração:
- Em `tests/adapters/cache-resiliente.adversarial.test.ts`, o teste 3.3 deverá ter o modificador `.fails` removido (passando a ser `it("3.3 Invariante...", ...)`) e passará com 100% de sucesso.
- O teste 3.2 poderá verificar `rejeitadas.length === 0` e `cumpridas.length === 10`.

---

## 5. Método de Verificação Independente (Verification Method)

Para reproduzir o defeito e auditar a correção:

1. **Reproduzir o Defeito Empiricamente no Código Atual:**
   ```bash
   cd "c:\Users\Felipe Barbosa\Documents\insight-compras"
   npx vitest run tests/adapters/cache-resiliente.adversarial.test.ts -t "3.2"
   ```
   *Resultado observado:* `[Empírico Avalanche Falha] Total: 10 | Cumpridas: 1 | Rejeitadas: 9`.

2. **Verificar Compilação TypeScript:**
   ```bash
   npx tsc --noEmit
   ```
   *Resultado observado:* 0 erros de compilação.

3. **Executar Toda a Suíte Adversarial:**
   ```bash
   npx vitest run tests/adapters/cache-resiliente.adversarial.test.ts
   ```
   *Resultado observado:* 14 testes executados.

4. **Condição de Aprovação (Após Correção do Worker M2):**
   - Aplicação do bloco `try...catch` com fallback L2 nas linhas 287-294 de `adapters/carreiro/cache-resiliente.ts`.
   - Execução de avalanche concorrente sob falha resultando em 100% cumpridas (`rejeitadas: 0`, `cumpridas: 10`) servindo Snapshot L2 com `emModoDegradado: true`.

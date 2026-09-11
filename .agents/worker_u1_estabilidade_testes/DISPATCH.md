# DISPATCH — Worker U1 (Estabilidade da Suíte de Testes)

## Missão
Resolver integralmente a Unidade U1 de acordo com as especificações em `ORIGINAL_REQUEST.md` (seção `## 2026-09-11T16:16:15Z`, item `## U1. Estabilidade da suíte`) e respeitar todos os 6 Invariantes.

## Caminho do Requisito Original
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md`

## Invariantes Obrigatórios
1. Zero não é o mesmo que não medido.
2. A plataforma sobe sem nenhuma variável de ambiente.
3. Nenhum nome de rede real no código genérico.
4. Infraestrutura entra por porta.
5. Não remover teste para ficar verde. Teste que falha se investiga e ajusta para medir trabalho real ou baseline relativo, não carga aleatória de CPU da máquina.
6. Mensagens de commit e comentários em português.

## Arquivos de Propriedade Exclusiva
- `tests/adapters/estresse-mock-carga.test.ts`
- `tests/adapters/mock-25k.test.ts`

## Problema
Os testes afirmam tempo de relógio absoluto ("< 250 ms") e falham quando a máquina está ocupada (ex: sob `npm run build` simultâneo). Não é regressão de código, é ruído de carga da máquina.

## Solução Requerida
- Medir trabalho em vez de tempo puro (passagens sobre coleções, alocações), ou calibrar contra um baseline medido no início da execução da suíte, ou tolerância com threshold adaptativo/estatístico baseado em benchmark da máquina.
- A proteção contra regressão de desempenho DEVE continuar existindo e ser comprovada: demonstre introduzindo uma lentidão artificial (ou em teste unitário dedicado) e mostrando o teste ficando vermelho.

## Critério de Conclusão (Pronto quando)
1. A suíte completa (`npm test`) passar duas vezes seguidas com um `next build` rodando em paralelo.
2. A proteção de desempenho continuar detectando regressão real de forma comprovada.
3. Documentar comandos e resultados em `handoff.md`.

## Aviso Obrigatório de Integridade
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-11T16:19:45Z
Você é o Worker responsável pela Unidade U1 (Estabilidade da suíte de testes).
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_u1_estabilidade_testes
Leia atentamente DISPATCH.md em seu diretório de trabalho e ORIGINAL_REQUEST.md em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute o trabalho:
1. Elimine os testes frágeis de tempo de relógio absoluto (< 250ms) em tests/adapters/estresse-mock-carga.test.ts e tests/adapters/mock-25k.test.ts, substituindo por medições robustas (trabalho/alocações/baseline/limiares estatísticos adaptativos).
2. Mantenha e comprove a proteção contra regressão de desempenho (mostre um teste acusando regressão quando um atraso artificial for introduzido).
3. Execute npm test duas vezes consecutivas com um build em paralelo para comprovar a estabilidade absoluta da suíte.
4. Registre progresso em progress.md e escreva handoff.md ao finalizar.
5. Comunique a conclusão ao orquestrador via send_message.


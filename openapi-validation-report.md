# Validação OpenAPI pré-G0

Contrato validado: `openapi/cotacao-hub-v1.yaml` (OpenAPI 3.1.0). Este relatório verifica a especificação; não afirma a existência de servidor de produto.

## Resultado reproduzível

| Verificação | Resultado |
|---|---|
| `python3 contracts/validate_openapi.py` | PASS; 44 paths, 49 operações, 34 mutações, 616 referências resolvidas, 49 declarações de segurança, 10 tipos públicos estáveis de evento, 3 exemplos validados |
| `openapi-spec-validator` | PASS, estrutura OpenAPI 3.1 |
| Redocly CLI 2.55.0, configuração recommended | 0 erros, 9 avisos de estilo: licença não declarada e descrições de oito tags |
| Campos monetários `number`/`float` | 0; contrato usa strings decimais |
| Erros semânticos do validador local | 0 |

`contracts/openapi-validation-result.json` contém a saída verificável. Instalar `contracts/requirements.txt` em ambiente isolado e executar `python3 contracts/validate_openapi.py`. O validador percorre refs, operação por operação, declarações de segurança, idempotência em mutações, `If-Match` nos comandos versionados, eventos públicos, dinheiro decimal e exemplos. Objetos de resposta podem ser extensíveis; requests de mutação rejeitam campos desconhecidos.

## Limite da prova

O ensaio encadeado em `contracts/examples/cliente-terceiro/run_stateful.py` é um mock de contrato com estado sintético. A validação aqui não comprova autenticação criptográfica, isolamento no banco, transações concorrentes, cálculo do motor ou entrega de webhook de um Hub real. Esses comportamentos exigem implementação e ensaio isolado no portão seguinte.

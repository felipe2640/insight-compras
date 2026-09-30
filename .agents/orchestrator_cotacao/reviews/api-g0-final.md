# Revisão independente de API — G0

**Veredito: APPROVE para o contrato pré-G0.** Revisei `docs/SOURCE_OF_TRUTH.md`, `openapi/cotacao-hub-v1.yaml`, `contracts/validate_openapi.py`, `contracts/examples/cliente-terceiro/README.md`, `contracts/examples/cliente-terceiro/{run_stateful,stateful_mock}.py`, `openapi-validation-report.md` e os contratos de segurança. Não alterei contratos de produto.

## Reavaliação dos bloqueios anteriores

1. O mock passou a validar corpos de entrada e de resposta, inclusive `Problem`, com os schemas do OpenAPI (`stateful_mock.py`, `_validate_response`). As respostas OAuth, challenge, convite de pedido e `EventEnvelope` agora usam os campos requeridos. `run_stateful.py` consome `challenge_id`, `event_type`, IDs e ETags de respostas anteriores, sem pré-definir IDs de entidades. Executei o ensaio: **PASS 101 verificações encadeadas e negativas**, sem status não declarados.
2. Os TTLs no texto introdutório do OpenAPI agora coincidem com `docs/security/security-contracts.md`: convite sugerido de 7 dias na UI, `expires_at` obrigatório na API, máximo 30 dias, sessão supplier 30 min ociosa/12 h absoluta e buyer federada 30 min ociosa/8 h absoluta.
3. `contracts/examples/cliente-terceiro/README.md` identifica `run_stateful.py` como prova G0, registra 101 casos, explica sua reprodução e limita corretamente o que o mock demonstra. O ensaio Prism anterior é rotulado evidência histórica.

## Cobertura e evidência

- Executei `python3 contracts/validate_openapi.py` com dependências isoladas: **PASS**, OpenAPI 3.1, 44 paths, 49 operações, 34 mutações, 615 referências resolvidas, 49 declarações de segurança, 10 tipos públicos de evento, nenhum campo monetário numérico detectado e nenhum erro semântico do validador local. `openapi-validation-report.md` registra a validação estrutural e o lint independente Redocly sem erro.
- A API pública permite o percurso de um terceiro: credencial M2M do próprio tenant, cadastro de fornecedor, snapshot de cotação, convite limitado, OTP individual, oferta, corte versionado, pedido próprio, resposta do fornecedor e reconciliação por evento/webhook. Não há pré-requisito de código do Diário, Insight, Connectsoft ou acesso ao banco compartilhado.
- Os negativos cobrem isolamento entre tenants e fornecedores, sessão de convite limitada, OTP, precondições, idempotência, reabertura/ordem emitida e replay de webhook. O contrato fixa erros com status e código estável. Os eventos públicos têm variantes tipadas no OpenAPI.

## Limite da aprovação

Este parecer aprova a **consistência e exercitabilidade do contrato**, não o comportamento de um servidor real. Autenticação criptográfica, transações concorrentes, persistência, motor de corte e entrega de webhook devem ser implementados e ensaiados no Hub isolado após o G0, conforme o plano. Headers de resposta obrigatórios devem entrar na validação automática da implementação; o mock atual verifica o uso encadeado dos ETags principais, mas não valida genericamente todos os headers declarados.

# Retenção e LGPD — política operacional para G0

Esta é uma proposta técnica configurável por contrato e jurisdição, **não uma conclusão jurídica**. Antes de produção, assessoria jurídica e clientes devem validar papéis de controlador/operador, bases legais, prazos obrigatórios, transferência internacional, suboperadores, atendimento a titulares, backup e litígio. Configuração por tenant pode estender ou reduzir prazos quando juridicamente justificada; a versão aplicada fica auditada. `D` é a data de encerramento do vínculo/registro pertinente. Expiração de credencial provoca revogação imediata, mesmo que metadados sejam retidos para investigação.

| Categoria | Finalidade e necessidade | Retenção operacional proposta | Eliminação/minimização e ressalva |
|---|---|---|---|
| Identidade buyer | autenticar, autorizar e atribuir ações | vínculo ativo + 12 meses | desativar sessão; remover atributos desnecessários; preservar ID pseudônimo em auditoria se obrigação comercial exigir |
| Identidade supplier | autenticação individual, membership e autoria | vínculo ativo + 12 meses | revogar memberships; dados globais não revelam relações entre buyers; pseudonimizar quando não houver obrigação pendente |
| Convite | provar autorização e entrega | até expiração + 90 dias | token/segredo apagado na expiração; conservar apenas metadados mínimos e resultado |
| OTP | prova efêmera de desafio | código até 5 min; metadados de segurança 30 dias | apagar hash após uso/expiração; nunca armazenar código em claro ou log |
| Sessões/credenciais | acesso e revogação | sessão até TTL; log de revogação 90 dias | segredo apagado/revogado; manter somente ID, tempo e motivo mínimos |
| Auditoria | integridade, responsabilização, investigação | D + 5 anos, sujeito a validação | append-only; pseudonimizar identificadores quando possível sem destruir prova; legal hold suspende descarte |
| Propostas e preços | negociação, corte reproduzível e disputa | D + 5 anos, sujeito a validação | preservar snapshot comercial necessário; restringir acesso; dados pessoais acessórios podem ser minimizados |
| Pedidos e cortes | obrigação comercial e replay | D + 5 anos, sujeito a validação | preservar fatos e hashes; mascarar contato pessoal sem alterar resultado histórico |
| Documentos | comprovação comercial/operacional | D + 5 anos, sujeito a validação por tipo | classificação e prazo por tipo; arquivo sensível descartado no prazo mais curto aplicável; legal hold auditado |
| Eventos/outbox | integração e rastreio | payload de entrega 90 dias; evento de domínio necessário acompanha agregado | apagar payload de retry após prazo; manter ID/estado mínimo para deduplicação e prova |
| Logs técnicos | segurança e diagnóstico | 90 dias | sem token, OTP, preço, corpo de proposta ou PII desnecessária; agregados anonimizados podem durar mais |
| Arquivos importados em staging | preview/validação antes do commit | 7 dias após upload ou 24 h após commit/rejeição | apagar bytes; conservar hash, origem, ator e resultado quando necessários à auditoria |
| Registros de idempotência | retry seguro | 72 h | apagar request/response cache; manter ID externo ou unicidade de domínio conforme agregado |

Exclusão de titular exige verificação de identidade e análise por categoria: revogar acesso e apagar dados transitórios imediatamente; anonimizar/pseudonimizar atributos pessoais quando possível; registrar retenção necessária com motivo e prazo. Não apagar fatos de pedido, corte ou auditoria de modo que altere prova comercial. Exportação e acesso são filtrados por tenant, organização, recurso e papel; jamais expõem relações de outros buyers do mesmo supplier. Backups seguem expiração e restauração com reaplicação de exclusões; prazo técnico de purga de backup e suboperadores deve ser contratado antes de produção.

**Validação jurídica/contratual pendente:** bases legais e responsabilidades da identidade supplier global; prazo fiscal/comercial real por jurisdição e documento; notificação e consentimento de contatos importados do ERP; região e transferências de dados; DPA e lista de suboperadores (e-mail, storage, observabilidade); prazo de backup, legal hold e fluxo de direitos de titulares. G0 aceita a classificação e os defaults como contrato de projeto, sem afirmar conformidade legal de produção.

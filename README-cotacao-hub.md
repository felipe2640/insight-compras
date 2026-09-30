# Cotação Hub

Plataforma B2B multi-tenant de cotação e pedidos, comercializável como módulo adicional do Insight Compras e integrável a qualquer aplicação pela API pública. Este pacote contém especificação e provas contratuais; ainda não constitui uma implementação operacional.

O Hub é um monólito modular com persistência própria. Supplier Network distingue organização global, relacionamento comercial privado e identidade individual. Sourcing conserva snapshots dos itens e respostas; Award executa política versionada com decimais exatos; Purchasing possui pedidos próprios; Integration, Communications e Audit cuidam de eventos, provedores e rastreabilidade. Insight, Diário e ERPs são consumidores opcionais.

Buyer cria, convida, acompanha, fecha, revisa o corte e emite pedidos. Supplier autentica individualmente, responde à participação autorizada e confirma ou recusa pedidos com autorização própria. Convites não dão acesso às demais cotações. `/api/v1` define autenticação, scopes, idempotência, ETag, imports, corte, documentos, eventos e webhooks assinados.

**Situação:** G0 READY contratual. A consolidação de transferência exige revisão humana; não autoriza criar repositório ou iniciar H0. O estado real anterior está registrado no relatório de prontidão.

## Validar os contratos

Usar Python 3.9+ em ambiente isolado, a partir da raiz do pacote:

```sh
python3 -m venv .venv-contracts
.venv-contracts/bin/pip install -r contracts/requirements.txt
.venv-contracts/bin/python contracts/validate_openapi.py
.venv-contracts/bin/python contracts/examples/cliente-terceiro/run_stateful.py
.venv-contracts/bin/python contracts/examples/cenario-dourado-corte/verify.py
.venv-contracts/bin/python contracts/validate_repository_package.py
```

O harness é sintético, em memória; não prova banco, autenticação ou segurança de uma implementação real. O cenário dourado usa `Decimal` e separa preço nominal, elegibilidade e custo por fornecedor/destino. Ver respectivos READMEs e resultados versionados.

## Início obrigatório dos agentes

Ler `docs/SOURCE_OF_TRUTH.md`, portões, arquitetura/ADRs, domínio/segurança, OpenAPI, fixtures e `plan-v2.md`. C0–C9 estão canceladas. H0–H7 dependem de autorização posterior; I1/D1 somente após Hub isolado. Transferir exclusivamente arquivos do manifesto, sem código ou configuração dos hospedeiros.

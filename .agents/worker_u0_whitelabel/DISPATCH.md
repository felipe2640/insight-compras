# DISPATCH — Worker U0 (Vazamento do Nome do Cliente no Modo Demonstração)

## Missão
Resolver integralmente a Unidade U0 de acordo com as especificações em `ORIGINAL_REQUEST.md` (seção `## 2026-09-11T16:16:15Z`, item `## U0. Vazamento do nome do cliente no modo demonstração`) e respeitar todos os 6 Invariantes.

## Caminho do Requisito Original
`c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md`

## Invariantes Obrigatórios
1. Zero não é o mesmo que não medido (usar camposIndisponiveis / travessão).
2. A plataforma sobe sem nenhuma variável de ambiente, em modo demonstração, com tenant neutro.
3. Nenhum nome de rede real no código genérico. Cliente se resolve por `resolverTenantConfigurado()` em `config/tenants/index.ts`, nunca por literal.
4. Infraestrutura entra por porta.
5. Não remover teste para ficar verde.
6. Mensagens de commit e comentários em português.

## Arquivos de Propriedade Exclusiva
- `src/app/admin/auditoria/page.tsx`
- `src/app/configuracoes/tema/page.tsx`
- `src/app/layout.tsx`
- `src/app/api/health/route.ts`
- `src/app/api/pedidos/route.ts`
- `src/components/cockpit/CockpitPrincipal.tsx` (apenas a resolução do tenant, linha ~144)

## Critério de Conclusão (Pronto quando)
1. `grep -rn "carreiro" src/` só devolver comentários, importações de `@adapters/carreiro` e referências a `TENANT_CARREIRO`.
2. A aplicação subir sem `.env.local` sem exibir nome de rede real em nenhuma tela (modo demonstração exibe tenant neutro).
3. O cabeçalho de auditoria consumir variáveis CSS inline (`gerarStringCssVarsInline` / tenant) em vez de hexadecimais fixos (`#0F2B5C`, `#D4AF37`).
4. `npm run build` e `npm test` passarem sem erros.

## Aviso Obrigatório de Integridade
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-11T16:20:00Z
Você é o Worker responsável pela Unidade U0 (Vazamento do nome do cliente no modo demonstração).
Seu diretório de trabalho é: c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\worker_u0_whitelabel
Leia atentamente DISPATCH.md em seu diretório de trabalho e ORIGINAL_REQUEST.md em c:\Users\Felipe Barbosa\Documents\insight-compras\.agents\ORIGINAL_REQUEST.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute o trabalho:
1. Substitua os literais 'carreiro' e cores fixas nos arquivos indicados pela resolução dinâmica do tenant (resolverTenantConfigurado(), CSS vars do layout).
2. Verifique que grep -rn "carreiro" src/ só retorna comentários, imports de @adapters/carreiro e TENANT_CARREIRO.
3. Garanta que a aplicação sobe em modo demo sem .env sem exibir nome de rede real.
4. Execute npm run build e npm test.
5. Registre progresso em progress.md e escreva handoff.md ao finalizar.
6. Comunique a conclusão ao orquestrador via send_message.

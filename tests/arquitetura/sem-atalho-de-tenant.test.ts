/**
 * Teste de ARQUITETURA: ninguém resolve tenant ou fonte por conta própria.
 *
 * Depois de centralizar tudo no contexto da requisição, nada impede um PR
 * futuro de escrever `headers().get("x-tenant-id")` numa rota nova — e foi
 * exatamente assim que a página do cockpit acabou lendo o cliente da URL sem
 * comparar com a sessão. Este teste falha com a instrução do que usar no lugar.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "../..");

/** Atalhos proibidos fora dos módulos que têm o direito de usá-los. */
const PROIBIDOS: Array<{ padrao: RegExp; mensagem: string; liberados: readonly string[] }> = [
  {
    padrao: /x-tenant-id/,
    mensagem: 'use contextoDaRequisicao()/contextoDaPagina() em vez de ler "x-tenant-id"',
    liberados: [
      "src/lib/contexto/contexto-requisicao.ts",
      "src/lib/middleware-tenant.ts",
      "src/middleware.ts",
      // O login acontece ANTES de existir sessão: ali o cabeçalho é a única
      // informação de cliente, e o provedor confere a natureza do tenant.
      "src/app/api/auth/entrar/route.ts",
      // Páginas de tema e login pintam a identidade visual antes do login.
      "src/app/layout.tsx",
      "src/app/login/page.tsx",
      "src/app/configuracoes/tema/page.tsx",
      /**
       * A validação da sessão precisa de um tenant ANTES de existir usuário —
       * é o ovo e a galinha do login. Ela valida contra o cliente que a
       * requisição alega ser; sessão de outro cliente não valida e a resposta
       * é 401. A conferência com a instalação continua no contexto.
       */
      "src/lib/autenticacao/servidor.ts",
    ],
  },
  {
    padrao: /resolverTenantConfigurado\s*\(/,
    mensagem: "o tenant da requisição vem do contexto; o do ambiente só na validação/inicialização",
    liberados: [
      "src/lib/contexto/contexto-requisicao.ts",
      "src/lib/ambiente/validacao-ambiente.ts",
      "src/lib/middleware-tenant.ts",
      "src/lib/cockpit/opcoes-tenant.ts",
      "src/lib/autenticacao/provedores/demo.ts",
      "src/lib/pedidos/repositorio.ts",
      "src/lib/auditoria/repositorio-auditoria.ts",
      "src/app/api/health/fonte/route.ts",
      // Identidade visual servida antes do login (não há sessão ainda).
      "src/app/layout.tsx",
      "src/app/configuracoes/tema/page.tsx",
    ],
  },
  {
    padrao: /process\.env\.TENANT_ATIVO/,
    mensagem: "TENANT_ATIVO é lido só por config/tenants e pela validação de ambiente",
    liberados: [
      "src/lib/contexto/contexto-requisicao.ts",
      "src/lib/ambiente/validacao-ambiente.ts",
      "src/lib/middleware-tenant.ts",
      "src/lib/autenticacao/provedores/demo.ts",
    ],
  },
  {
    padrao: /obterAdaptadorInventario\s*\(/,
    mensagem: "a fonte vem do contexto da requisição, com as capacidades já aplicadas",
    liberados: [
      "src/lib/contexto/contexto-requisicao.ts",
      // Monitoramento externo por token, sem sessão para consultar.
      "src/app/api/health/fonte/route.ts",
    ],
  },
];

function listarArquivos(diretorio: string): string[] {
  const saida: string[] = [];
  for (const entrada of fs.readdirSync(diretorio, { withFileTypes: true })) {
    const completo = path.join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      saida.push(...listarArquivos(completo));
    } else if (/\.(ts|tsx)$/.test(entrada.name)) {
      saida.push(completo);
    }
  }
  return saida;
}

describe("arquitetura: um único caminho para tenant e fonte", () => {
  const arquivos = listarArquivos(path.join(RAIZ, "src"));

  it("encontra arquivos para analisar", () => {
    expect(arquivos.length).toBeGreaterThan(20);
  });

  for (const { padrao, mensagem, liberados } of PROIBIDOS) {
    it(`nenhum atalho novo: ${padrao.source}`, () => {
      const infratores: string[] = [];

      for (const arquivo of arquivos) {
        const relativo = path.relative(RAIZ, arquivo).split(path.sep).join("/");
        if (liberados.includes(relativo)) continue;

        const conteudo = fs.readFileSync(arquivo, "utf8");
        if (padrao.test(conteudo)) infratores.push(relativo);
      }

      expect(infratores, `${mensagem}. Arquivos: ${infratores.join(", ")}`).toEqual([]);
    });
  }
});

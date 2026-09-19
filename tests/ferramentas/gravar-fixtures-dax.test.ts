/**
 * FERRAMENTA (não é teste): grava as fixtures DAX usadas pela suíte de contrato.
 *
 * Roda só com `GRAVAR_FIXTURES_DAX=1` e credenciais do Power BI no ambiente;
 * em qualquer outra execução é pulada. Mora em `tests/` porque precisa importar
 * as consultas homologadas em TypeScript — elas são a única fonte da verdade do
 * texto DAX, e uma cópia em JS puro sairia do ar na primeira alteração.
 *
 * O que é gravado é ANONIMIZADO antes de tocar o disco: nomes de produto,
 * marca, fornecedor e loja são substituídos, custos e preços passam por um
 * fator, e cada GUID vira um GUID falso estável. O resultado vai para o git, e
 * dado de cliente não vai para o git.
 *
 * Uso:
 *   GRAVAR_FIXTURES_DAX=1 npx vitest run tests/ferramentas/gravar-fixtures-dax.test.ts
 */

import fs from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import { ClienteDaxPowerBI } from "@adapters/carreiro/cliente-dax";
import {
  CONSULTA_DAX_ENTRADAS_HOJE,
  CONSULTA_DAX_SUGESTOES_ERP_HOJE,
  CONSULTA_DAX_ULTIMO_PEDIDO,
  gerarConsultaDaxHistoricoVendas,
  gerarConsultaDaxMovimentosEstoque,
  gerarConsultaDaxPedidosCompra,
  gerarConsultaDaxPosicaoEstoque,
  gerarConsultaDaxProdutosEstoque,
  gerarConsultaDaxSimilares,
} from "@adapters/carreiro/consultas-homologadas";

const ATIVA = process.env.GRAVAR_FIXTURES_DAX === "1";
const DESTINO = path.resolve(__dirname, "../fixtures/dax");

/** Duas lojas reais, que viram duas lojas falsas estáveis na fixture. */
const LOJAS_ORIGEM = [
  "1|e2adc241-50f7-4dcd-9527-423080cd8c5c",
  "1|cd87703f-0d8c-447e-9bdf-5c1d790f587b",
];
const LOJAS_DESTINO = [
  "1|aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaa1",
  "1|bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbb2",
];

const FATOR_VALOR = 1.37;
const MAX_PRODUTOS = 20;

const CAMPOS_VALOR = /pre[çc]o|custo|valor|margem|cmv/i;
const CAMPOS_TEXTO_SENSIVEL = /descricao|descrição|marca|fabricante|fornecedor|nome|aplicacao|observacao|cliente|solicitador|razao/i;

const guidsVistos = new Map<string, string>();
let contadorGuid = 0;

function guidFalso(original: string): string {
  const existente = guidsVistos.get(original);
  if (existente) return existente;
  contadorGuid += 1;
  const sufixo = String(contadorGuid).padStart(12, "0");
  const falso = `00000000-0000-4000-8000-${sufixo}`;
  guidsVistos.set(original, falso);
  return falso;
}

function anonimizarTexto(valor: string, chave: string): string {
  let saida = valor;

  for (let i = 0; i < LOJAS_ORIGEM.length; i += 1) {
    saida = saida.split(LOJAS_ORIGEM[i]).join(LOJAS_DESTINO[i]);
  }

  saida = saida.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (g) =>
    guidFalso(g.toLowerCase())
  );

  if (CAMPOS_TEXTO_SENSIVEL.test(chave)) {
    // Preserva o formato (comprimento e separadores), descarta o conteúdo.
    saida = saida.replace(/[A-Za-zÀ-ÿ]/g, "X");
  }

  return saida;
}

function anonimizarLinha(linha: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(linha)) {
    if (typeof valor === "string") {
      saida[chave] = anonimizarTexto(valor, chave);
    } else if (typeof valor === "number" && CAMPOS_VALOR.test(chave)) {
      saida[chave] = Number((valor * FATOR_VALOR).toFixed(2));
    } else {
      saida[chave] = valor;
    }
  }
  return saida;
}

describe.skipIf(!ATIVA)("gravação de fixtures DAX (ferramenta)", () => {
  it(
    "grava amostra anonimizada das consultas homologadas",
    async () => {
      const cliente = new ClienteDaxPowerBI();
      if (!cliente.possuiConfiguracaoAtiva()) {
        throw new Error(
          `sem credenciais do Power BI: faltando ${cliente.configuracoesFaltando().join(", ")}`
        );
      }

      const filtro = { fornecedoresPermitidos: null } as const;

      const consultas: Array<[string, string]> = [
        ["catalogo", gerarConsultaDaxProdutosEstoque(filtro, null, LOJAS_ORIGEM[0])],
        ["historico", gerarConsultaDaxHistoricoVendas(filtro)],
        ["posicao-loja-1", gerarConsultaDaxPosicaoEstoque(LOJAS_ORIGEM[0], filtro)],
        ["posicao-loja-2", gerarConsultaDaxPosicaoEstoque(LOJAS_ORIGEM[1], filtro)],
        ["entradas-hoje", CONSULTA_DAX_ENTRADAS_HOJE],
        ["similares", gerarConsultaDaxSimilares(null)],
        ["movimentos", gerarConsultaDaxMovimentosEstoque(30, 0)],
        ["ultimo-pedido", CONSULTA_DAX_ULTIMO_PEDIDO],
        ["sugestoes-erp", CONSULTA_DAX_SUGESTOES_ERP_HOJE],
        ["pedidos-erp", gerarConsultaDaxPedidosCompra({ dias: 30, limite: 20 })],
      ];

      fs.mkdirSync(DESTINO, { recursive: true });

      for (const [nome, dax] of consultas) {
        let linhas: readonly Record<string, unknown>[] = [];
        try {
          linhas = await cliente.executarConsultaDax(dax);
        } catch (erro) {
          console.warn(`[fixtures] ${nome} falhou:`, erro);
        }

        const amostra = linhas.slice(0, MAX_PRODUTOS).map(anonimizarLinha);
        fs.writeFileSync(
          path.join(DESTINO, `${nome}.json`),
          `${JSON.stringify(amostra, null, 2)}\n`
        );
        console.log(`[fixtures] ${nome}: ${amostra.length} linhas`);
      }
    },
    120_000
  );
});

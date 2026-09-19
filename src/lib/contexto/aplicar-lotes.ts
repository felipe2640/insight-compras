/**
 * Aplicação dos Múltiplos de Compra do Cliente
 * Camada: Aplicação (src/lib/contexto)
 * 100% em Português do Brasil (pt-BR).
 *
 * O múltiplo de embalagem é regra do CLIENTE (quais fontes valem, exceções por
 * SKU), editável na tela de Configurações. Ele vivia no construtor do
 * adaptador, e isso tinha dois efeitos ruins:
 *
 * 1. a chave da instância incluía a configuração de lotes, então cada edição
 *    criava um adaptador novo, com cache frio, e deixava o antigo preso na
 *    memória para sempre;
 * 2. só as rotas mesclavam a configuração do Supabase — a página do cockpit
 *    não —, então a grade renderizada no servidor e a API podiam mostrar
 *    múltiplos diferentes para o mesmo item.
 *
 * Aqui a regra é aplicada DEPOIS da carga, sobre as entradas cruas que o
 * adaptador preserva (`loteErp`, `loteHistograma`). A fonte não precisa saber
 * de múltiplo, e o cache dela sobrevive a qualquer edição de configuração.
 */

import type { RespostaCargaInventario } from "@adapters/AdaptadorInventario";
import { resolverLoteAutopecas } from "@adapters/comum/lote-autopecas";
import type { ConfiguracaoLotesTenant } from "@config/tenants/tipos";
import type { Produto } from "@core/dominio";

export function aplicarLotesDoCliente(
  carga: RespostaCargaInventario,
  lotes: ConfiguracaoLotesTenant
): RespostaCargaInventario {
  const produtos: Produto[] = carga.produtos.map((produto) => {
    const { lote, origem } = resolverLoteAutopecas({
      loteConfigurado: Number(lotes.multiplosPorSku[produto.codigoSku] ?? 0),
      loteCadastradoErp: produto.loteErp ?? 0,
      loteDetectadoHistograma: produto.loteHistograma ?? 0,
      descricao: produto.descricao,
      usarErp: lotes.usarErp,
      usarHistorico: lotes.usarHistorico,
      usarVocabulario: lotes.usarVocabulario,
    });

    if (lote === produto.loteMultiplo && origem === produto.origemLoteMultiplo) {
      return produto;
    }
    return { ...produto, loteMultiplo: lote, origemLoteMultiplo: origem };
  });

  return { ...carga, produtos };
}

/**
 * Cruzamento: compra real do ERP × sugestão REGISTRADA do modelo.
 * Camada: Aplicação (src/lib/aprendizado) — puro, sem I/O.
 * 100% em Português do Brasil (pt-BR).
 *
 * POR QUE ISTO EXISTE
 *
 * O comparativo "modelo × comprador" com fonte ERP fabricava o lado do modelo:
 * `qtdModelo = quantidadeComprada × fator`, com o fator escolhido por
 * `produtoId % 5` (1; 0,6; 1,4; 0; 0,8), e o perfil de giro tirado do mesmo resto.
 * Nenhum desses números saía do motor. Um em cada cinco itens aparecia com o
 * modelo sugerindo ZERO, e a tela pedia ao comprador que registrasse o motivo de
 * divergências que nunca aconteceram — gravando essas explicações no ciclo de
 * aprendizado real.
 *
 * O lado do modelo precisa vir do que o motor efetivamente sugeriu, e isso já
 * está gravado: cada exportação registra, por item, a quantidade sugerida e o
 * perfil (aprendizado_item). Aqui casamos cada compra com a sugestão que a
 * ANTECEDEU — a que o comprador tinha na tela quando decidiu.
 *
 * Sem sugestão registrada, o resultado é `null`, e a classificação de divergência
 * já trata isso como "sem_sugestao". Dizer "não sabemos" é honesto; inventar um
 * número para preencher a coluna não é.
 */

import type { ItemComparativo } from "./porta-repositorio";

/** Índice das sugestões registradas por `${produtoId}:${filialId}`. */
export type IndiceSugestoes = ReadonlyMap<string, readonly ItemComparativo[]>;

function chaveItem(produtoId: number, filialId: number): string {
  return `${produtoId}:${filialId}`;
}

export function indexarSugestoesRegistradas(
  sugestoes: readonly ItemComparativo[]
): IndiceSugestoes {
  const indice = new Map<string, ItemComparativo[]>();
  for (const s of sugestoes) {
    // Sugestão sem loja não pode ser atribuída a nenhuma compra: demanda é por
    // loja, e casar com a filial errada seria inventar o lado do modelo de novo.
    if (s.filialId === null) continue;
    const k = chaveItem(s.produtoId, s.filialId);
    const lista = indice.get(k);
    if (lista) lista.push(s);
    else indice.set(k, [s]);
  }
  return indice;
}

/**
 * A sugestão registrada mais recente, do mesmo item e da mesma loja, emitida
 * ATÉ a data da compra. Sugestão posterior à compra não explica a decisão.
 *
 * Data de compra ilegível não casa com nada: sem ela não há como saber qual
 * sugestão o comprador tinha na tela, e escolher "a mais recente" poderia pegar
 * uma posterior à compra.
 */
export function sugestaoQueAntecedeuACompra(
  indice: IndiceSugestoes,
  produtoId: number,
  filialId: number,
  dataCompra: string
): ItemComparativo | null {
  const candidatas = indice.get(chaveItem(produtoId, filialId));
  if (!candidatas || candidatas.length === 0) return null;

  const instanteCompra = Date.parse(dataCompra);
  if (!Number.isFinite(instanteCompra)) return null;

  let melhor: ItemComparativo | null = null;
  let instanteMelhor = Number.NEGATIVE_INFINITY;

  for (const s of candidatas) {
    const instante = Date.parse(s.exportadoEm);
    if (!Number.isFinite(instante) || instante > instanteCompra) continue;
    if (instante > instanteMelhor) {
      melhor = s;
      instanteMelhor = instante;
    }
  }

  return melhor;
}

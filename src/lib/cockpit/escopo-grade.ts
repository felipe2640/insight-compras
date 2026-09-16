/**
 * Escopo da grade e contagens dos chips — calculados no SERVIDOR.
 * Camada: Aplicação (src/lib/cockpit) — puro.
 *
 * POR QUÊ: o cockpit abre com as linhas ACIONÁVEIS (o que o comprador precisa
 * decidir hoje) e completa o catálogo em segundo plano. Para que os chips não
 * mintam durante essa janela, as contagens vêm do conjunto completo, calculadas
 * aqui, e não do que já chegou ao navegador.
 */

import { LinhaCockpitMatriz } from "@/tipos/cockpit";

export interface ContagensStatusGrade {
  readonly total: number;
  readonly pedir: number;
  readonly transferir: number;
  readonly ruptura: number;
  readonly zumbi: number;
  readonly sugestaoErp?: number;
}

export const CONTAGENS_STATUS_ZERADAS: ContagensStatusGrade = {
  total: 0,
  pedir: 0,
  transferir: 0,
  ruptura: 0,
  zumbi: 0,
  sugestaoErp: 0,
};

/** Linha que pede decisão: comprar, transferir, ruptura, trava anti-encalhe ou sugestão ativa do ERP. */
export function ehLinhaAcionavel(linha: LinhaCockpitMatriz): boolean {
  return (
    linha.sugestaoFinalCompra > 0 ||
    linha.quantidadeTransferenciaSugerida > 0 ||
    linha.isMarcaZumbi ||
    linha.classificacaoRuptura === "Grave" ||
    linha.classificacaoRuptura === "Atenção" ||
    Boolean(linha.sugestaoQtdErp && linha.sugestaoQtdErp > 0) ||
    Boolean(linha.temSugestaoErp)
  );
}

export function separarAcionaveis(linhas: readonly LinhaCockpitMatriz[]): {
  readonly acionaveis: LinhaCockpitMatriz[];
  readonly restante: LinhaCockpitMatriz[];
} {
  const acionaveis: LinhaCockpitMatriz[] = [];
  const restante: LinhaCockpitMatriz[] = [];
  for (const linha of linhas) {
    (ehLinhaAcionavel(linha) ? acionaveis : restante).push(linha);
  }
  return { acionaveis, restante };
}

export function contarStatusGrade(linhas: readonly LinhaCockpitMatriz[]): ContagensStatusGrade {
  let pedir = 0;
  let transferir = 0;
  let ruptura = 0;
  let zumbi = 0;
  let sugestaoErp = 0;
  for (const linha of linhas) {
    if (linha.sugestaoFinalCompra > 0) pedir++;
    if (linha.quantidadeTransferenciaSugerida > 0) transferir++;
    if (linha.classificacaoRuptura === "Grave" || linha.classificacaoRuptura === "Atenção") ruptura++;
    if (linha.isMarcaZumbi) zumbi++;
    if (Boolean(linha.sugestaoQtdErp && linha.sugestaoQtdErp > 0) || Boolean(linha.temSugestaoErp)) {
      sugestaoErp++;
    }
  }
  return { total: linhas.length, pedir, transferir, ruptura, zumbi, sugestaoErp };
}

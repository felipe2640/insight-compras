/**
 * Motor de Transferência Inter-Lojas: Balanceamento Seguro de Sobras
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 *
 * REGRA MANDATÓRIA INVIOLÁVEL:
 * Uma filial doadora SÓ PODE doar itens se possuir excedente real estrito acima do seu
 * estoque mínimo de segurança (saldoFisico - estoqueMinimo > 0).
 * Sob nenhuma hipótese o saldo restante da loja de origem pode ficar abaixo do seu estoque mínimo.
 */

export interface SaldoFilialParaTransferencia {
  readonly filialId: number;
  readonly nomeFilial?: string;
  readonly saldoFisico: number;
  readonly estoqueMinimo: number;
  readonly necessidadeCompra: number;
}

export interface ResultadoTransferencia {
  readonly produtoId?: number;
  readonly codigoSku?: string;
  readonly filialOrigemId: number;
  readonly nomeFilialOrigem: string;
  readonly filialDestinoId: number;
  readonly nomeFilialDestino: string;
  readonly quantidadeTransferir: number;
  readonly saldoOrigemAntes: number;
  readonly estoqueMinimoOrigem: number;
  readonly saldoOrigemApos: number;
  readonly necessidadeDestinoAntes: number;
  readonly necessidadeDestinoApos: number;
  readonly motivo: string;
}

/**
 * Calcula a transferência segura direta entre duas lojas específicas (ex: Loja 1 e Loja 2).
 * Retorna null se nenhuma transferência segura for possível.
 */
export function calcularTransferenciaEntreDuasLojas(
  lojaA: SaldoFilialParaTransferencia,
  lojaB: SaldoFilialParaTransferencia,
  metadadosProduto?: { produtoId?: number; codigoSku?: string }
): ResultadoTransferencia | null {
  // Excedente real estrito da doadora (acima do estoque mínimo)
  const sobraRealA = Math.max(0, lojaA.saldoFisico - lojaA.estoqueMinimo);
  const sobraRealB = Math.max(0, lojaB.saldoFisico - lojaB.estoqueMinimo);

  // Cenário 1: Loja B precisa e Loja A tem sobra real
  if (lojaB.necessidadeCompra > 0 && sobraRealA > 0) {
    const quantidade = Math.min(lojaB.necessidadeCompra, sobraRealA);
    if (quantidade > 0) {
      const saldoApos = lojaA.saldoFisico - quantidade;
      return {
        produtoId: metadadosProduto?.produtoId,
        codigoSku: metadadosProduto?.codigoSku,
        filialOrigemId: lojaA.filialId,
        nomeFilialOrigem: lojaA.nomeFilial ?? `Filial ${lojaA.filialId}`,
        filialDestinoId: lojaB.filialId,
        nomeFilialDestino: lojaB.nomeFilial ?? `Filial ${lojaB.filialId}`,
        quantidadeTransferir: quantidade,
        saldoOrigemAntes: lojaA.saldoFisico,
        estoqueMinimoOrigem: lojaA.estoqueMinimo,
        saldoOrigemApos: saldoApos,
        necessidadeDestinoAntes: lojaB.necessidadeCompra,
        necessidadeDestinoApos: lojaB.necessidadeCompra - quantidade,
        motivo: `Remanejamento de excesso: Filial ${lojaA.filialId} possui sobra de ${sobraRealA} un acima do estoque mínimo (${lojaA.estoqueMinimo} un). Saldo final preservado em ${saldoApos} un.`,
      };
    }
  }

  // Cenário 2: Loja A precisa e Loja B tem sobra real
  if (lojaA.necessidadeCompra > 0 && sobraRealB > 0) {
    const quantidade = Math.min(lojaA.necessidadeCompra, sobraRealB);
    if (quantidade > 0) {
      const saldoApos = lojaB.saldoFisico - quantidade;
      return {
        produtoId: metadadosProduto?.produtoId,
        codigoSku: metadadosProduto?.codigoSku,
        filialOrigemId: lojaB.filialId,
        nomeFilialOrigem: lojaB.nomeFilial ?? `Filial ${lojaB.filialId}`,
        filialDestinoId: lojaA.filialId,
        nomeFilialDestino: lojaA.nomeFilial ?? `Filial ${lojaA.filialId}`,
        quantidadeTransferir: quantidade,
        saldoOrigemAntes: lojaB.saldoFisico,
        estoqueMinimoOrigem: lojaB.estoqueMinimo,
        saldoOrigemApos: saldoApos,
        necessidadeDestinoAntes: lojaA.necessidadeCompra,
        necessidadeDestinoApos: lojaA.necessidadeCompra - quantidade,
        motivo: `Remanejamento de excesso: Filial ${lojaB.filialId} possui sobra de ${sobraRealB} un acima do estoque mínimo (${lojaB.estoqueMinimo} un). Saldo final preservado em ${saldoApos} un.`,
      };
    }
  }

  return null;
}

/**
 * Algoritmo Geral de Balanceamento para Rede Multi-Lojas (2 ou mais filiais).
 *
 * Itera priorizando as lojas com maior necessidade e doadoras com maior sobra real,
 * garantindo matematicamente que cada doação respeite:
 * saldoRestante >= estoqueMinimo.
 */
export function calcularBalanceamentoRede(
  filiais: readonly SaldoFilialParaTransferencia[],
  metadadosProduto?: { produtoId?: number; codigoSku?: string }
): readonly ResultadoTransferencia[] {
  if (!filiais || filiais.length < 2) {
    return [];
  }

  // Estado mutável local apenas durante o processamento algorítmico da função pura
  interface EstadoLoja {
    filialId: number;
    nomeFilial: string;
    saldoFisico: number;
    estoqueMinimo: number;
    necessidade: number;
  }

  const estadoLojas: EstadoLoja[] = filiais.map((f) => ({
    filialId: f.filialId,
    nomeFilial: f.nomeFilial ?? `Filial ${f.filialId}`,
    saldoFisico: f.saldoFisico,
    estoqueMinimo: f.estoqueMinimo,
    necessidade: Math.max(0, f.necessidadeCompra),
  }));

  const transferencias: ResultadoTransferencia[] = [];

  // Enquanto houver destinos com carência e origens com sobra real acima do mínimo
  let houveTransferencia = true;

  while (houveTransferencia) {
    houveTransferencia = false;

    // Ordena destinos por maior necessidade
    const destinos = estadoLojas
      .filter((l) => l.necessidade > 0)
      .sort((a, b) => b.necessidade - a.necessidade);

    // Ordena doadoras por maior excedente acima do mínimo
    const doadoras = estadoLojas
      .map((l) => ({
        loja: l,
        sobra: Math.max(0, l.saldoFisico - l.estoqueMinimo),
      }))
      .filter((d) => d.sobra > 0)
      .sort((a, b) => b.sobra - a.sobra);

    if (destinos.length === 0 || doadoras.length === 0) {
      break;
    }

    const destino = destinos[0];
    // Encontra a melhor doadora diferente do destino
    const doadoraInfo = doadoras.find((d) => d.loja.filialId !== destino.filialId);

    if (!doadoraInfo || doadoraInfo.sobra <= 0) {
      break;
    }

    const doadora = doadoraInfo.loja;
    const quantidade = Math.min(destino.necessidade, doadoraInfo.sobra);

    if (quantidade > 0) {
      const saldoAntes = doadora.saldoFisico;
      const saldoApos = saldoAntes - quantidade;
      const necessidadeAntes = destino.necessidade;
      const necessidadeApos = necessidadeAntes - quantidade;

      // Invariante de integridade
      if (saldoApos < doadora.estoqueMinimo) {
        throw new Error(
          `Violação de integridade: Tentativa de transferir ${quantidade} un da filial ${doadora.filialId} deixaria saldo (${saldoApos}) abaixo do estoque mínimo (${doadora.estoqueMinimo})`
        );
      }

      doadora.saldoFisico = saldoApos;
      destino.necessidade = necessidadeApos;

      transferencias.push({
        produtoId: metadadosProduto?.produtoId,
        codigoSku: metadadosProduto?.codigoSku,
        filialOrigemId: doadora.filialId,
        nomeFilialOrigem: doadora.nomeFilial,
        filialDestinoId: destino.filialId,
        nomeFilialDestino: destino.nomeFilial,
        quantidadeTransferir: quantidade,
        saldoOrigemAntes: saldoAntes,
        estoqueMinimoOrigem: doadora.estoqueMinimo,
        saldoOrigemApos: saldoApos,
        necessidadeDestinoAntes: necessidadeAntes,
        necessidadeDestinoApos: necessidadeApos,
        motivo: `Remanejamento de excesso: Filial ${doadora.filialId} transferiu ${quantidade} un para Filial ${destino.filialId}. Saldo final da origem mantido em ${saldoApos} un (mínimo ${doadora.estoqueMinimo} un).`,
      });

      houveTransferencia = true;
    }
  }

  return transferencias;
}

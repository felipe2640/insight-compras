/**
 * Harness de Teste E2E: Contexto de Teste, Fábrica de Dados Sintéticos e RBAC
 * Camada: Test Harness Opaque-Box
 */

import { Produto, CurvaABC } from "@core/dominio/produto";
import { EstoqueFilial } from "@core/dominio/estoque";
import { HistoricoVendasFilial } from "@core/dominio/historico-vendas";

export interface UsuarioAutenticado {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly role: "COMPRADOR" | "GESTOR";
  readonly allowedSupplierIds: ReadonlySet<number>;
  readonly tenantId: string;
}

export interface ConfiguracaoTenant {
  readonly id: string;
  readonly nome: string;
  readonly subdominio: string;
  readonly cores: {
    readonly primaria: string;
    readonly secundaria: string;
    readonly fundoDestaqueMultiplo: string;
  };
  readonly filiais: ReadonlyArray<{
    readonly id: number;
    readonly nome: string;
    readonly codigo: string;
  }>;
}

export const TENANT_CARREIRO: ConfiguracaoTenant = {
  id: "carreiro",
  nome: "Rede Carreiro Autopeças",
  subdominio: "carreiro.insightd.com.br",
  cores: {
    primaria: "#0F2B5C", // Azul Carreiro
    secundaria: "#D4AF37", // Dourado Carreiro
    fundoDestaqueMultiplo: "#FFFFCC", // Amarelo pastel para múltiplos
  },
  filiais: [
    { id: 1, nome: "Loja 1 - Trairi", codigo: "TRAIRI" },
    { id: 2, nome: "Loja 2 - Paraipaba", codigo: "PARAIPABA" },
  ],
};

export interface SimilarItemDto {
  readonly produtoId: number;
  readonly codigo: string;
  readonly descricao: string;
  readonly marca: string;
  readonly precoCusto: number;
  readonly estoquePorFilial: Record<number, number>;
}

export interface EntradaNotaFiscalHojeDto {
  readonly numeroNota: string;
  readonly fornecedorNome: string;
  readonly quantidadeRecebida: number;
  readonly dataEntrada: string;
}

export interface LinhaMatrizDecisaoE2E {
  readonly produtoId: number;
  readonly codigoSku: string;
  readonly descricao: string;
  readonly marca: string;
  readonly fabricante: string;
  readonly referenciaFabricante: string | null;
  readonly aplicacaoVeicular: string | null;
  readonly secaoId: number;
  readonly nomeSecao: string;
  readonly fornecedorId: number;
  readonly nomeFornecedor: string;
  readonly precoCusto: number;
  readonly loteMultiplo: number;

  // Ruptura
  readonly diasAnalisados: number;
  readonly diasZerados: number;
  readonly taxaRupturaPercentual: number;
  readonly classificacaoRuptura: "Boa" | "Atenção" | "Grave" | "Sem histórico";

  // Frequência
  readonly notasVenda90d: number;
  readonly notasDevolucao90d: number;
  readonly notasLiquidas90d: number;
  readonly frequenciaPercentual90d: number;
  readonly classificacaoFrequencia: "Alta" | "Média" | "Baixa";

  // Coberturas Comparativas
  readonly vendas30d: number;
  readonly cmd30d: number;
  readonly cobertura30dDias: number;
  readonly vendas90d: number;
  readonly cmd90d: number;
  readonly cobertura90dDias: number;
  readonly vendas180d: number;
  readonly cmd180d: number;
  readonly cobertura180dDias: number;
  readonly isMarcaZumbi: boolean;

  // Estoque
  readonly saldoEstoqueLojaFoco: number;
  readonly estoqueMinimoLojaFoco: number;
  readonly saldoEstoqueOutrasLojas: number;
  readonly quantidadeJaPedida: number;

  // Decisão
  readonly statusDecisao: "PEDIR" | "TRANSFERIR" | "PEDIR_TRANSFERIR" | "OK";
  readonly transferenciaSugerida: number;
  readonly transferenciaAjustada: number;
  readonly filialOrigemTransferenciaId: number | null;
  readonly filialOrigemSobraReal: number;
  readonly pedidoSugerido: number;
  readonly pedidoAjustado: number;

  // Auxiliares
  readonly similares: readonly SimilarItemDto[];
  readonly entradasHoje: readonly EntradaNotaFiscalHojeDto[];

  // Metadados de busca instantânea
  readonly _searchIndex: string;
}

/**
 * Cria um produto de exemplo de autopeças.
 */
export function criarProdutoTeste(parciais?: Partial<Produto>): Produto {
  return {
    id: parciais?.id ?? 1001,
    codigoSku: parciais?.codigoSku ?? "AM-MON-001",
    descricao: parciais?.descricao ?? "AMORTECEDOR DIANTEIRO COROLLA 2015/2020",
    marca: parciais?.marca ?? "MONROE",
    fabricante: parciais?.fabricante ?? "TENNECO",
    referenciaFabricante: parciais?.referenciaFabricante ?? "G7012",
    aplicacaoVeicular: parciais?.aplicacaoVeicular ?? "COROLLA 1.8/2.0 16V 2015 A 2020",
    familiaId: parciais?.familiaId ?? "FAM-AMORT-COROLLA-DIANT",
    secaoId: parciais?.secaoId ?? 10,
    nomeSecao: parciais?.nomeSecao ?? "SUSPENSAO",
    fornecedorId: parciais?.fornecedorId ?? 501,
    nomeFornecedor: parciais?.nomeFornecedor ?? "DISTRIBUIDORA MONROE BRASIL",
    precoCusto: parciais?.precoCusto ?? 250.0,
    precoVenda: parciais?.precoVenda ?? 380.0,
    loteMultiplo: parciais?.loteMultiplo ?? 2, // Par obrigatório
  };
}

/**
 * Cria posição de estoque para teste.
 */
export function criarEstoqueTeste(parciais?: Partial<EstoqueFilial>): EstoqueFilial {
  return {
    filialId: parciais?.filialId ?? 1,
    nomeFilial: parciais?.nomeFilial ?? "Loja 1 - Trairi",
    produtoId: parciais?.produtoId ?? 1001,
    saldoFisico: parciais?.saldoFisico ?? 4,
    estoqueMinimoSeguranca: parciais?.estoqueMinimoSeguranca ?? 6,
    quantidadeJaPedida: parciais?.quantidadeJaPedida ?? 0,
    diasSemVenda: null,
    sinalGovernancaCompra: null,
    usoLimiteCompra: null,
    consumoMedioDiarioErp: parciais?.consumoMedioDiarioErp ?? 0.5,
    dataUltimaVenda: parciais?.dataUltimaVenda ?? "2026-09-01",
    dataUltimaCompra: parciais?.dataUltimaCompra ?? "2026-08-15",
  };
}

/**
 * Cria histórico de vendas para teste.
 */
export function criarHistoricoVendasTeste(
  parciais?: Partial<HistoricoVendasFilial>
): HistoricoVendasFilial {
  return {
    produtoId: parciais?.produtoId ?? 1001,
    filialId: parciais?.filialId ?? 1,
    vendasLiquidas30dias: parciais?.vendasLiquidas30dias ?? 15,
    vendasLiquidas90dias: parciais?.vendasLiquidas90dias ?? 45,
    vendasLiquidas180dias: parciais?.vendasLiquidas180dias ?? 90,
    devolucoes90dias: parciais?.devolucoes90dias ?? 2,
    notasFiscaisVenda90dias: parciais?.notasFiscaisVenda90dias ?? 28,
    notasFiscaisDevolucao90dias: parciais?.notasFiscaisDevolucao90dias ?? 1,
    mesesAtivos12meses: 12,
    medianaLinhaVenda: 1,
    diasRuptura90dias: parciais?.diasRuptura90dias ?? 8,
    diasObservados: parciais?.diasObservados ?? 90,
    dataPrimeiraVendaRegistrada: parciais?.dataPrimeiraVendaRegistrada ?? "2025-01-10",
  };
}

/**
 * Gera um catálogo sintético de larga escala (até 25.000+ SKUs) para testes de estresse e BVA.
 */
export function gerarCatalogoSintetico(quantidade: number = 25000): readonly LinhaMatrizDecisaoE2E[] {
  const marcas = ["MONROE", "COFAP", "NAKATA", "BOSCH", "NGK", "FREMAX", "MOBIL", "MANN", "VALEO", "DAYCO"];
  const secoes = ["SUSPENSAO", "IGNICAO", "FREIO", "MOTOR", "FILTROS", "TRANSMISSAO", "ELETRICA", "ARREFECIMENTO"];
  const fornecedores = [
    { id: 501, nome: "DISTRIBUIDORA MONROE BRASIL" },
    { id: 502, nome: "COFAP AUTOPECAS" },
    { id: 503, nome: "NAKATA DISTRIBUIDORA" },
    { id: 504, nome: "BOSCH DO BRASIL" },
    { id: 505, nome: "NGK SPARK PLUG" },
  ];

  const itens: LinhaMatrizDecisaoE2E[] = new Array(quantidade);

  for (let i = 0; i < quantidade; i++) {
    const id = 10000 + i;
    const marca = marcas[i % marcas.length];
    const secao = secoes[i % secoes.length];
    const fornecedor = fornecedores[i % fornecedores.length];
    const codigoSku = `${marca.substring(0, 3)}-${1000 + (i % 8000)}`;
    const tipoPeca =
      secao === "SUSPENSAO"
        ? "AMORTECEDOR"
        : secao === "FREIO"
        ? "DISCO DE FREIO"
        : secao === "IGNICAO"
        ? "VELA DE IGNICAO"
        : "PECA";
    const descricao = `${tipoPeca} ${secao} ${marca} REF ${codigoSku} COMPATIVEL AUTO`;

    const diasAnalisados = 90;
    const diasZerados = i % 15 === 0 ? 12 : i % 7 === 0 ? 6 : 2;
    const taxaRuptura = (diasZerados / diasAnalisados) * 100;
    const classRuptura = taxaRuptura > 10 ? "Grave" : taxaRuptura >= 5 ? "Atenção" : "Boa";

    const notasVenda = Math.max(1, (i % 50));
    const notasDevolucao = i % 20 === 0 ? 1 : 0;
    const notasLiquidas = Math.max(0, notasVenda - notasDevolucao);
    const freqPct = (notasLiquidas / 90) * 100;
    const classFreq = freqPct > 40 ? "Alta" : freqPct >= 15 ? "Média" : "Baixa";

    const vendas30d = (i % 30) + 1;
    const vendas90d = vendas30d * 3;
    const vendas180d = vendas90d * 2;
    const cmd30d = vendas30d / 30;
    const cmd90d = vendas90d / 90;
    const cmd180d = vendas180d / 180;

    const saldoFoco = i % 5 === 0 ? 0 : (i % 25) + 2;
    const estoqueMinimo = Math.ceil(cmd90d * 15);
    const cob30d = cmd30d > 0 ? saldoFoco / cmd30d : 999;
    const cob90d = cmd90d > 0 ? saldoFoco / cmd90d : 999;
    const cob180d = cmd180d > 0 ? saldoFoco / cmd180d : 999;

    const isZumbi = saldoFoco > 0 && (i % 100 === 0);
    const searchIndex = `${codigoSku} ${descricao} ${marca} ${secao} ${fornecedor.nome}`.toLowerCase();

    itens[i] = {
      produtoId: id,
      codigoSku,
      descricao,
      marca,
      fabricante: marca,
      referenciaFabricante: `REF-${codigoSku}`,
      aplicacaoVeicular: "UNIVERSAL AUTO",
      secaoId: (i % secoes.length) + 1,
      nomeSecao: secao,
      fornecedorId: fornecedor.id,
      nomeFornecedor: fornecedor.nome,
      precoCusto: 50.0 + (i % 400),
      loteMultiplo: secao === "SUSPENSAO" || secao === "FREIO" ? 2 : secao === "IGNICAO" ? 4 : 1,
      diasAnalisados,
      diasZerados,
      taxaRupturaPercentual: taxaRuptura,
      classificacaoRuptura: classRuptura,
      notasVenda90d: notasVenda,
      notasDevolucao90d: notasDevolucao,
      notasLiquidas90d: notasLiquidas,
      frequenciaPercentual90d: freqPct,
      classificacaoFrequencia: classFreq,
      vendas30d,
      cmd30d,
      cobertura30dDias: cob30d,
      vendas90d,
      cmd90d,
      cobertura90dDias: cob90d,
      vendas180d: isZumbi ? 0 : vendas180d,
      cmd180d: isZumbi ? 0 : cmd180d,
      cobertura180dDias: isZumbi ? 9999 : cob180d,
      isMarcaZumbi: isZumbi,
      saldoEstoqueLojaFoco: saldoFoco,
      estoqueMinimoLojaFoco: estoqueMinimo,
      saldoEstoqueOutrasLojas: (i % 8),
      quantidadeJaPedida: 0,
      statusDecisao: isZumbi ? "OK" : saldoFoco <= estoqueMinimo ? "PEDIR" : "OK",
      transferenciaSugerida: 0,
      transferenciaAjustada: 0,
      filialOrigemTransferenciaId: null,
      filialOrigemSobraReal: 0,
      pedidoSugerido: isZumbi ? 0 : Math.max(0, estoqueMinimo - saldoFoco),
      pedidoAjustado: isZumbi ? 0 : Math.max(0, estoqueMinimo - saldoFoco),
      similares: [],
      entradasHoje: i % 50 === 0 ? [{
        numeroNota: `NF-${900000 + i}`,
        fornecedorNome: fornecedor.nome,
        quantidadeRecebida: 10,
        dataEntrada: "2026-09-06",
      }] : [],
      _searchIndex: searchIndex,
    };
  }

  return itens;
}

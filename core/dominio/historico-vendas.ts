/**
 * Entidade de domínio: HistoricoVendasFilial
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 */

export interface HistoricoVendasFilial {
  readonly produtoId: number;
  readonly filialId: number;
  readonly vendasLiquidas30dias: number;
  readonly vendasLiquidas90dias: number;
  readonly vendasLiquidas180dias: number;
  readonly devolucoes90dias: number;
  readonly notasFiscaisVenda90dias: number;
  readonly notasFiscaisDevolucao90dias: number;
  readonly diasRuptura90dias: number;
  readonly diasObservados: number;
  readonly dataPrimeiraVendaRegistrada: string | null;
}

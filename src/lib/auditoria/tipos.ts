/**
 * Contratos de Tipagem da Trilha Imutável de Auditoria de Pedidos
 * Camada: Aplicação / Auditoria (src/lib/auditoria/tipos.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { TipoAcaoAuditoria } from "@core/dominio/auditoria";

export type { TipoAcaoAuditoria };

export type ClassificacaoDivergencia =
  | "CONFORME_SUGESTAO"
  | "SOBRECOMPRA"
  | "SUBCOMPRA"
  | "ZERAMENTO_MANUAL"
  | "AJUSTE_LOTE_MULTIPLO";

export interface AuditoriaPedido {
  readonly id: string;
  readonly timestamp: string;
  readonly tenantId: string;

  // Identificação do Comprador (Auditoria Rastreável)
  readonly compradorId: string;
  readonly compradorNome: string;
  readonly compradorEmail: string;
  readonly compradorPapel: "COMPRADOR" | "GESTOR" | "ADMIN";

  // Alvo do Pedido
  readonly filialId: number;
  readonly filialNome?: string;
  readonly produtoId: number;
  readonly codigoSku: string;
  readonly descricaoProduto?: string;
  readonly fornecedorId: number;
  readonly nomeFornecedor?: string;

  // Valores Matemáticos e Decisão Humana
  readonly quantidadeSugeridaSistema: number;
  readonly quantidadeDigitadaComprador: number;
  readonly divergenciaQuantidade: number; // digitada - sugerida
  readonly divergenciaPercentual: number | null; // ((digitada - sugerida) / sugerida) * 100
  readonly precoCustoUnitario: number;
  readonly impactoFinanceiroDivergencia: number; // divergenciaQuantidade * precoCustoUnitario

  // Classificação e Justificativa
  readonly tipoAcao: TipoAcaoAuditoria;
  readonly classificacaoDivergencia: ClassificacaoDivergencia;
  readonly justificativaOverride: string | null;

  // Garantia Criptográfica de Imutabilidade
  readonly hashRegistroAnterior: string;
  readonly hashIntegridade: string;
}

export interface FiltrosConsultaAuditoria {
  readonly tenantId: string;
  readonly compradorId?: string;
  readonly fornecedorId?: number;
  readonly filialId?: number;
  readonly apenasSobrecompras?: boolean;
  readonly dataInicio?: string;
  readonly dataFim?: string;
  readonly limite?: number;
}

export interface ResumoKpisAuditoria {
  readonly totalRegistros: number;
  readonly totalSobrecompras: number;
  readonly totalSubcompras: number;
  readonly totalConformes: number;
  readonly taxaAderenciaMotorPercentual: number;
  readonly impactoFinanceiroTotalSobrecompra: number;
}

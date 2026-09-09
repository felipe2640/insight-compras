/**
 * PORTA de persistência do ciclo de aprendizado.
 * Camada: Aplicação (src/lib/aprendizado). Sem dependência de nuvem.
 *
 * A plataforma só conhece esta interface. Supabase, Firestore, DynamoDB, Vercel
 * Postgres ou memória são detalhes em `provedores/`. Tudo é por tenant.
 */

import type { PerfilRotatividade } from "@core/dominio";
import type { MotivoDivergencia, StatusConfirmacao, PropostaPerfil } from "@core/aprendizado";

export type IdProvedorAprendizado = "supabase" | "memoria" | "nenhum";

export interface ItemSnapshotEntrada {
  readonly produtoId: number;
  readonly sku: string;
  readonly descricao: string;
  readonly filialId: number;
  readonly custo: number;
  readonly qtdComprador: number;
  readonly qtdTransferenciaComprador: number;
  readonly qtdModelo: number | null;
  readonly qtdTransferenciaModelo: number;
  readonly perfil: PerfilRotatividade;
  readonly consumoDiario: number;
  readonly horizonteDias: number;
  readonly margemAplicada: number;
  readonly fatorCalibracao: number;
  readonly previsaoBruta: number;
  readonly elegivel: boolean;
  readonly motivoInelegibilidade: string | null;
  readonly sinalGovernanca: string | null;
}

export interface SnapshotEntrada {
  readonly tenantId: string;
  readonly filialId: number;
  readonly usuario: string;
  readonly layoutId: string;
  readonly formato: string;
  readonly itens: readonly ItemSnapshotEntrada[];
}

export interface ResultadoGravacaoSnapshot {
  readonly gravado: boolean;
  readonly snapshotId?: number;
  readonly motivo?: string;
}

export interface ItemComparativo {
  readonly id: number;
  readonly snapshotId: number;
  readonly exportadoEm: string;
  readonly usuario: string | null;
  readonly produtoId: number;
  readonly sku: string | null;
  readonly descricao: string | null;
  readonly filialId: number | null;
  readonly custo: number | null;
  readonly qtdComprador: number;
  readonly qtdModelo: number | null;
  readonly qtdTransferenciaComprador: number | null;
  readonly qtdTransferenciaModelo: number | null;
  readonly perfil: string | null;
  readonly elegivel: boolean;
  readonly motivoInelegibilidade: string | null;
  readonly sinalGovernanca: string | null;
  readonly feedback: { motivo: string; comentario: string | null; usuario: string | null } | null;
  readonly confirmacao: { status: StatusConfirmacao; qtdEntrada: number; qtdTransferida: number } | null;
}

export interface FeedbackEntrada {
  readonly tenantId: string;
  readonly itemId: number;
  readonly motivo: MotivoDivergencia;
  readonly comentario: string | null;
  readonly usuario: string;
}

export interface ItemParaConfirmar {
  readonly id: number;
  readonly snapshotId: number;
  readonly exportadoEm: string;
  readonly produtoId: number;
  readonly filialId: number;
  readonly qtdPedida: number;
}

export interface ConfirmacaoEntrada {
  readonly itemId: number;
  readonly janelaDias: number;
  readonly qtdEntrada: number;
  readonly qtdTransferida: number;
  readonly status: StatusConfirmacao;
}

export interface LinhaCalibracaoDb {
  readonly perfil: PerfilRotatividade;
  readonly consumoDiario: number;
  readonly horizonteDias: number;
  readonly margemAplicada: number;
  readonly fatorCalibracao: number;
  readonly suprimentoReal: number;
  readonly status: StatusConfirmacao;
}

export interface ParametrosPublicados {
  readonly versao: string;
  readonly margens: Readonly<Record<PerfilRotatividade, number>>;
  readonly fatorCalibracao: number;
  readonly publicadoPor: string | null;
  readonly criadoEm: string;
}

export interface PublicacaoParametros {
  readonly tenantId: string;
  readonly margens: Readonly<Record<PerfilRotatividade, number>>;
  readonly fatorCalibracao: number;
  readonly proposta: readonly PropostaPerfil[];
  readonly usuario: string;
}

export interface RepositorioAprendizado {
  readonly id: IdProvedorAprendizado;
  gravarSnapshot(entrada: SnapshotEntrada): Promise<ResultadoGravacaoSnapshot>;
  listarComparativo(p: { tenantId: string; dias: number; filialId?: number; limite?: number }): Promise<ItemComparativo[]>;
  gravarFeedback(entrada: FeedbackEntrada): Promise<void>;
  listarItensParaConfirmar(p: { tenantId: string; dias: number; limite?: number }): Promise<ItemParaConfirmar[]>;
  gravarConfirmacoes(tenantId: string, confirmacoes: readonly ConfirmacaoEntrada[]): Promise<void>;
  listarLinhasCalibracao(p: { tenantId: string; dias: number }): Promise<LinhaCalibracaoDb[]>;
  publicarParametros(entrada: PublicacaoParametros): Promise<ParametrosPublicados>;
  /** Última versão publicada para o tenant, ou null. */
  carregarParametrosPublicados(tenantId: string): Promise<ParametrosPublicados | null>;
}

export function gerarVersaoParametros(agora: Date = new Date()): string {
  return agora.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

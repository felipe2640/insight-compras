/**
 * Repositório em MEMÓRIA — para testes e para rodar o ciclo sem nuvem.
 * Camada: Aplicação (src/lib/aprendizado/provedores).
 * Vive só no processo: em serverless cada instância tem a sua. Não é produção.
 */

import {
  ConfirmacaoEntrada,
  FeedbackEntrada,
  ItemComparativo,
  ItemParaConfirmar,
  LinhaCalibracaoDb,
  ParametrosPublicados,
  PublicacaoParametros,
  RepositorioAprendizado,
  ResultadoGravacaoSnapshot,
  SnapshotEntrada,
  ItemSnapshotEntrada,
  gerarVersaoParametros,
} from "../porta-repositorio";
import type { PerfilRotatividade } from "@core/dominio";

interface SnapshotMem { id: number; tenantId: string; exportadoEm: string; usuario: string; filialId: number }
interface ItemMem extends ItemSnapshotEntrada { id: number; snapshotId: number; tenantId: string }

export class RepositorioAprendizadoMemoria implements RepositorioAprendizado {
  readonly id = "memoria" as const;
  private snapshots: SnapshotMem[] = [];
  private itens: ItemMem[] = [];
  private feedbacks = new Map<number, { motivo: string; comentario: string | null; usuario: string | null }>();
  private confirmacoes = new Map<number, ConfirmacaoEntrada & { tenantId: string }>();
  private parametros: Array<ParametrosPublicados & { tenantId: string }> = [];
  private seqSnapshot = 0;
  private seqItem = 0;

  constructor(private readonly agora: () => number = () => Date.now()) {}

  limpar(): void {
    this.snapshots = []; this.itens = []; this.feedbacks.clear(); this.confirmacoes.clear(); this.parametros = [];
  }

  private desde(dias: number): number {
    return this.agora() - dias * 86_400_000;
  }

  async gravarSnapshot(entrada: SnapshotEntrada): Promise<ResultadoGravacaoSnapshot> {
    const id = ++this.seqSnapshot;
    this.snapshots.push({ id, tenantId: entrada.tenantId, exportadoEm: new Date(this.agora()).toISOString(), usuario: entrada.usuario, filialId: entrada.filialId });
    for (const i of entrada.itens) this.itens.push({ ...i, id: ++this.seqItem, snapshotId: id, tenantId: entrada.tenantId });
    return { gravado: true, snapshotId: id };
  }

  private itensNaJanela(tenantId: string, dias: number): Array<ItemMem & { snapshot: SnapshotMem }> {
    const desde = this.desde(dias);
    const porId = new Map(this.snapshots.map((s) => [s.id, s]));
    return this.itens
      .filter((i) => i.tenantId === tenantId)
      .map((i) => ({ ...i, snapshot: porId.get(i.snapshotId)! }))
      .filter((i) => Date.parse(i.snapshot.exportadoEm) >= desde);
  }

  async listarComparativo(p: { tenantId: string; dias: number; filialId?: number; limite?: number }): Promise<ItemComparativo[]> {
    return this.itensNaJanela(p.tenantId, p.dias)
      .filter((i) => !p.filialId || i.filialId === p.filialId)
      .sort((a, b) => b.id - a.id)
      .slice(0, Math.min(5000, p.limite ?? 2000))
      .map((i) => {
        const c = this.confirmacoes.get(i.id);
        return {
          id: i.id, snapshotId: i.snapshotId, exportadoEm: i.snapshot.exportadoEm, usuario: i.snapshot.usuario,
          produtoId: i.produtoId, sku: i.sku, descricao: i.descricao, filialId: i.filialId, custo: i.custo,
          qtdComprador: i.qtdComprador, qtdModelo: i.qtdModelo,
          qtdTransferenciaComprador: i.qtdTransferenciaComprador, qtdTransferenciaModelo: i.qtdTransferenciaModelo,
          perfil: i.perfil, elegivel: i.elegivel, motivoInelegibilidade: i.motivoInelegibilidade, sinalGovernanca: i.sinalGovernanca,
          feedback: this.feedbacks.get(i.id) ?? null,
          confirmacao: c ? { status: c.status, qtdEntrada: c.qtdEntrada, qtdTransferida: c.qtdTransferida } : null,
        };
      });
  }

  async gravarFeedback(entrada: FeedbackEntrada): Promise<void> {
    this.feedbacks.set(entrada.itemId, { motivo: entrada.motivo, comentario: entrada.comentario, usuario: entrada.usuario });
  }

  async listarItensParaConfirmar(p: { tenantId: string; dias: number; limite?: number }): Promise<ItemParaConfirmar[]> {
    return this.itensNaJanela(p.tenantId, p.dias)
      .filter((i) => i.elegivel)
      .filter((i) => { const s = this.confirmacoes.get(i.id)?.status; return !s || s === "aguardando"; })
      .sort((a, b) => a.id - b.id)
      .slice(0, Math.min(5000, p.limite ?? 3000))
      .map((i) => ({ id: i.id, snapshotId: i.snapshotId, exportadoEm: i.snapshot.exportadoEm, produtoId: i.produtoId, filialId: i.filialId, qtdPedida: i.qtdComprador }));
  }

  async gravarConfirmacoes(tenantId: string, confirmacoes: readonly ConfirmacaoEntrada[]): Promise<void> {
    for (const c of confirmacoes) this.confirmacoes.set(c.itemId, { ...c, tenantId });
  }

  async listarLinhasCalibracao(p: { tenantId: string; dias: number }): Promise<LinhaCalibracaoDb[]> {
    return this.itensNaJanela(p.tenantId, p.dias)
      .filter((i) => i.elegivel && this.confirmacoes.has(i.id))
      .map((i) => {
        const c = this.confirmacoes.get(i.id)!;
        return {
          perfil: i.perfil as PerfilRotatividade, consumoDiario: i.consumoDiario, horizonteDias: i.horizonteDias,
          margemAplicada: i.margemAplicada, fatorCalibracao: i.fatorCalibracao || 1,
          suprimentoReal: c.qtdEntrada + c.qtdTransferida, status: c.status,
        };
      });
  }

  async publicarParametros(entrada: PublicacaoParametros): Promise<ParametrosPublicados> {
    const publicado = {
      tenantId: entrada.tenantId, versao: gerarVersaoParametros(new Date(this.agora())),
      margens: entrada.margens, fatorCalibracao: entrada.fatorCalibracao, publicadoPor: entrada.usuario,
      criadoEm: new Date(this.agora()).toISOString(),
    };
    this.parametros.push(publicado);
    return publicado;
  }

  async carregarParametrosPublicados(tenantId: string): Promise<ParametrosPublicados | null> {
    const doTenant = this.parametros.filter((p) => p.tenantId === tenantId);
    return doTenant.length ? doTenant[doTenant.length - 1] : null;
  }
}

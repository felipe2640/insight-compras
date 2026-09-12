/**
 * Provedor de Auditoria em Memória (Fallback para Demonstração e Testes)
 * Camada: Aplicação / Auditoria / Provedores (src/lib/auditoria/provedores/memoria.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { AuditoriaPedido, FiltrosConsultaAuditoria } from "../tipos";
import { RepositorioAuditoria } from "../porta-repositorio";
import { calcularHashRegistro } from "../criptografia";

export function gerarRegistrosAuditoriaDemo(tenantId: string): AuditoriaPedido[] {
  const agora = Date.now();
  const diaMs = 86_400_000;

  // Registro 1: 3 dias atrás - Conforme sugestão do motor (Gênesis)
  const reg1Parcial: Omit<AuditoriaPedido, "hashIntegridade"> = {
    id: `AUD-DEMO-001-${tenantId}`,
    timestamp: new Date(agora - 3 * diaMs).toISOString(),
    tenantId,
    compradorId: "usr-demo-01",
    compradorNome: "Carlos Comprador",
    compradorEmail: "carlos.comprador@insightcompras.com.br",
    compradorPapel: "COMPRADOR",
    filialId: 1,
    filialNome: "Loja Central 01",
    produtoId: 1001,
    codigoSku: "AM-MON-001",
    descricaoProduto: "Amortecedor Dianteiro Monr. G8000",
    fornecedorId: 501,
    nomeFornecedor: "Monroe Distribuição",
    quantidadeSugeridaSistema: 10,
    quantidadeDigitadaComprador: 10,
    divergenciaQuantidade: 0,
    divergenciaPercentual: 0,
    precoCustoUnitario: 150.0,
    impactoFinanceiroDivergencia: 0,
    tipoAcao: "CRIACAO_PEDIDO",
    classificacaoDivergencia: "CONFORME_SUGESTAO",
    justificativaOverride: null,
    hashRegistroAnterior: "GENESIS_HASH",
  };
  const reg1: AuditoriaPedido = Object.freeze({
    ...reg1Parcial,
    hashIntegridade: calcularHashRegistro(reg1Parcial),
  });

  // Registro 2: 2 dias atrás - Sobrecompra manual (+5 un)
  const reg2Parcial: Omit<AuditoriaPedido, "hashIntegridade"> = {
    id: `AUD-DEMO-002-${tenantId}`,
    timestamp: new Date(agora - 2 * diaMs).toISOString(),
    tenantId,
    compradorId: "usr-demo-01",
    compradorNome: "Carlos Comprador",
    compradorEmail: "carlos.comprador@insightcompras.com.br",
    compradorPapel: "COMPRADOR",
    filialId: 1,
    filialNome: "Loja Central 01",
    produtoId: 1002,
    codigoSku: "PA-COF-002",
    descricaoProduto: "Pastilha Freio Diant. Cerâmica",
    fornecedorId: 502,
    nomeFornecedor: "Cofap Freios",
    quantidadeSugeridaSistema: 5,
    quantidadeDigitadaComprador: 10,
    divergenciaQuantidade: 5,
    divergenciaPercentual: 100,
    precoCustoUnitario: 80.0,
    impactoFinanceiroDivergencia: 400.0,
    tipoAcao: "SOBRECOMPRA_CONFIRMADA",
    classificacaoDivergencia: "SOBRECOMPRA",
    justificativaOverride: "Reforço de estoque para feriado prolongado e alta demanda na loja.",
    hashRegistroAnterior: reg1.hashIntegridade,
  };
  const reg2: AuditoriaPedido = Object.freeze({
    ...reg2Parcial,
    hashIntegridade: calcularHashRegistro(reg2Parcial),
  });

  // Registro 3: 1 dia atrás - Subcompra / corte (-2 un)
  const reg3Parcial: Omit<AuditoriaPedido, "hashIntegridade"> = {
    id: `AUD-DEMO-003-${tenantId}`,
    timestamp: new Date(agora - 1 * diaMs).toISOString(),
    tenantId,
    compradorId: "usr-demo-02",
    compradorNome: "Ana Suprimentos",
    compradorEmail: "ana.suprimentos@insightcompras.com.br",
    compradorPapel: "COMPRADOR",
    filialId: 2,
    filialNome: "Filial Norte 02",
    produtoId: 2001,
    codigoSku: "DS-VAR-003",
    descricaoProduto: "Disco Freio Ventilado BD0540",
    fornecedorId: 503,
    nomeFornecedor: "Varga Freios",
    quantidadeSugeridaSistema: 8,
    quantidadeDigitadaComprador: 6,
    divergenciaQuantidade: -2,
    divergenciaPercentual: -25,
    precoCustoUnitario: 120.0,
    impactoFinanceiroDivergencia: -240.0,
    tipoAcao: "AJUSTE_SUGESTAO",
    classificacaoDivergencia: "SUBCOMPRA",
    justificativaOverride: "Ajuste manual devido a lote mínimo do fornecedor e verba da quinzena.",
    hashRegistroAnterior: reg2.hashIntegridade,
  };
  const reg3: AuditoriaPedido = Object.freeze({
    ...reg3Parcial,
    hashIntegridade: calcularHashRegistro(reg3Parcial),
  });

  return [reg1, reg2, reg3];
}

export class RepositorioAuditoriaEmMemoria implements RepositorioAuditoria {
  public readonly id = "memoria";
  private readonly registrosPorTenant = new Map<string, AuditoriaPedido[]>();

  constructor(private readonly inicializarComDemo: boolean = false) {}

  private assegurarDados(tenantId: string): AuditoriaPedido[] {
    let lista = this.registrosPorTenant.get(tenantId);
    if (!lista) {
      if (this.inicializarComDemo) {
        lista = gerarRegistrosAuditoriaDemo(tenantId);
        this.registrosPorTenant.set(tenantId, lista);
      } else {
        lista = [];
        this.registrosPorTenant.set(tenantId, lista);
      }
    }
    return lista;
  }

  public async adicionarRegistro(registro: AuditoriaPedido): Promise<void> {
    const lista = this.assegurarDados(registro.tenantId);
    const registroCongelado = Object.freeze({ ...registro });
    lista.push(registroCongelado);
    this.registrosPorTenant.set(registro.tenantId, lista);
  }

  public async obterUltimoRegistro(tenantId: string): Promise<AuditoriaPedido | null> {
    const lista = this.assegurarDados(tenantId);
    if (lista.length === 0) return null;
    return lista[lista.length - 1];
  }

  public async consultar(filtros: FiltrosConsultaAuditoria): Promise<readonly AuditoriaPedido[]> {
    const lista = this.assegurarDados(filtros.tenantId);

    return lista
      .filter((reg) => {
        if (filtros.compradorId && reg.compradorId !== filtros.compradorId) return false;
        if (filtros.fornecedorId && reg.fornecedorId !== filtros.fornecedorId) return false;
        if (filtros.filialId && reg.filialId !== filtros.filialId) return false;
        if (filtros.apenasSobrecompras && reg.classificacaoDivergencia !== "SOBRECOMPRA") return false;
        if (filtros.dataInicio && reg.timestamp < filtros.dataInicio) return false;
        if (filtros.dataFim && reg.timestamp > filtros.dataFim) return false;
        return true;
      })
      .slice(0, filtros.limite ?? 1000);
  }

  public async obterTodos(tenantId: string): Promise<readonly AuditoriaPedido[]> {
    const lista = this.assegurarDados(tenantId);
    return [...lista];
  }

  public limpar(tenantId?: string): void {
    if (tenantId) {
      this.registrosPorTenant.delete(tenantId);
    } else {
      this.registrosPorTenant.clear();
    }
  }
}

/**
 * Repositório e Serviço de Auditoria Imutável com Encadeamento Criptográfico SHA-256
 * Camada: Aplicação / Auditoria (src/lib/auditoria/repositorio-auditoria.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { createHash } from "crypto";
import {
  AuditoriaPedido,
  ClassificacaoDivergencia,
  TipoAcaoAuditoria,
  FiltrosConsultaAuditoria,
  ResumoKpisAuditoria,
} from "./tipos";
import { UsuarioAutenticado } from "../rbac/tipos";

// ============================================================================
// 1. INTEGRIDADE CRIPTOGRÁFICA (TAMPER-EVIDENT HASH CHAIN)
// ============================================================================

export function calcularHashRegistro(
  dados: Omit<AuditoriaPedido, "hashIntegridade">
): string {
  const cargaUtil = JSON.stringify({
    id: dados.id,
    timestamp: dados.timestamp,
    tenantId: dados.tenantId,
    compradorId: dados.compradorId,
    filialId: dados.filialId,
    produtoId: dados.produtoId,
    codigoSku: dados.codigoSku,
    quantidadeSugerida: dados.quantidadeSugeridaSistema,
    quantidadeDigitada: dados.quantidadeDigitadaComprador,
    divergencia: dados.divergenciaQuantidade,
    tipoAcao: dados.tipoAcao,
    hashAnterior: dados.hashRegistroAnterior,
  });

  return createHash("sha256").update(cargaUtil).digest("hex");
}

export function validarCadeiaAuditoria(registros: readonly AuditoriaPedido[]): {
  valida: boolean;
  indiceInvalido?: number;
  motivo?: string;
} {
  for (let i = 0; i < registros.length; i++) {
    const atual = registros[i];

    // Verifica integridade do próprio hash do registro
    const { hashIntegridade, ...resto } = atual;
    const hashEsperado = calcularHashRegistro(resto);
    if (hashIntegridade !== hashEsperado) {
      return {
        valida: false,
        indiceInvalido: i,
        motivo: `Hash inválido no registro ${atual.id}. Conteúdo foi adulterado.`,
      };
    }

    // Verifica encadeamento com o registro anterior
    if (i > 0) {
      const anterior = registros[i - 1];
      if (atual.hashRegistroAnterior !== anterior.hashIntegridade) {
        return {
          valida: false,
          indiceInvalido: i,
          motivo: `Quebra de cadeia: o registro ${atual.id} não aponta para o hash do registro ${anterior.id}.`,
        };
      }
    } else {
      if (atual.hashRegistroAnterior !== "GENESIS_HASH") {
        return {
          valida: false,
          indiceInvalido: 0,
          motivo: "Registro inicial não possui o hash gênesis correto.",
        };
      }
    }
  }

  return { valida: true };
}

// ============================================================================
// 2. REPOSITÓRIO APPEND-ONLY IMUTÁVEL
// ============================================================================

export interface RepositorioAuditoria {
  adicionarRegistro(registro: AuditoriaPedido): Promise<void>;
  obterUltimoRegistro(tenantId: string): Promise<AuditoriaPedido | null>;
  consultar(filtros: FiltrosConsultaAuditoria): Promise<readonly AuditoriaPedido[]>;
  obterTodos(tenantId: string): Promise<readonly AuditoriaPedido[]>;
  limpar(tenantId?: string): void;
}

export class RepositorioAuditoriaEmMemoria implements RepositorioAuditoria {
  private readonly registrosPorTenant = new Map<string, AuditoriaPedido[]>();

  public async adicionarRegistro(registro: AuditoriaPedido): Promise<void> {
    // Imutabilidade estrita: congela o objeto para impedir mutações em tempo de execução
    const registroCongelado = Object.freeze({ ...registro });

    const lista = this.registrosPorTenant.get(registro.tenantId) ?? [];
    lista.push(registroCongelado);
    this.registrosPorTenant.set(registro.tenantId, lista);
  }

  public async obterUltimoRegistro(tenantId: string): Promise<AuditoriaPedido | null> {
    const lista = this.registrosPorTenant.get(tenantId);
    if (!lista || lista.length === 0) return null;
    return lista[lista.length - 1];
  }

  public async consultar(filtros: FiltrosConsultaAuditoria): Promise<readonly AuditoriaPedido[]> {
    const lista = this.registrosPorTenant.get(filtros.tenantId) ?? [];

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
    return this.registrosPorTenant.get(tenantId) ?? [];
  }

  public limpar(tenantId?: string): void {
    if (tenantId) {
      this.registrosPorTenant.delete(tenantId);
    } else {
      this.registrosPorTenant.clear();
    }
  }
}

// ============================================================================
// 3. SERVIÇO DE AUDITORIA E CÁLCULO DE KPIS
// ============================================================================

export interface ParametrosRegistroPedido {
  readonly usuario: UsuarioAutenticado;
  readonly produtoId: number;
  readonly codigoSku: string;
  readonly descricaoProduto?: string;
  readonly fornecedorId: number;
  readonly nomeFornecedor?: string;
  readonly filialId: number;
  readonly filialNome?: string;
  readonly quantidadeSugerida: number;
  readonly quantidadeDigitada: number;
  readonly precoCusto: number;
  readonly justificativaOverride?: string | null;
}

export class ServicoAuditoria {
  constructor(private readonly repositorio: RepositorioAuditoria) {}

  public async registrarDecisao(params: ParametrosRegistroPedido): Promise<AuditoriaPedido> {
    const {
      usuario,
      produtoId,
      codigoSku,
      descricaoProduto,
      fornecedorId,
      nomeFornecedor,
      filialId,
      filialNome,
      quantidadeSugerida,
      quantidadeDigitada,
      precoCusto,
      justificativaOverride,
    } = params;

    const divergenciaQtd = quantidadeDigitada - quantidadeSugerida;
    let classificacao: ClassificacaoDivergencia = "CONFORME_SUGESTAO";
    let tipoAcao: TipoAcaoAuditoria = "CRIACAO_PEDIDO";

    if (divergenciaQtd > 0) {
      classificacao = "SOBRECOMPRA";
      tipoAcao = "SOBRECOMPRA_CONFIRMADA";
    } else if (divergenciaQtd < 0 && quantidadeDigitada > 0) {
      classificacao = "SUBCOMPRA";
      tipoAcao = "AJUSTE_SUGESTAO";
    } else if (quantidadeDigitada === 0 && quantidadeSugerida > 0) {
      classificacao = "ZERAMENTO_MANUAL";
      tipoAcao = "AJUSTE_SUGESTAO";
    }

    const divergenciaPct =
      quantidadeSugerida > 0
        ? ((quantidadeDigitada - quantidadeSugerida) / quantidadeSugerida) * 100
        : quantidadeDigitada > 0
        ? 100
        : 0;

    const impactoFinanceiro = divergenciaQtd * precoCusto;

    let justificativaFormatada = justificativaOverride ?? null;
    if (!justificativaFormatada && divergenciaQtd > 0) {
      justificativaFormatada = `Sobrecompra manual de +${divergenciaQtd} un pelo comprador ${usuario.nome}. Sugestão do motor era de ${quantidadeSugerida} un.`;
    }

    // Obtém hash do registro anterior para encadeamento
    const ultimoRegistro = await this.repositorio.obterUltimoRegistro(usuario.tenantId);
    const hashAnterior = ultimoRegistro ? ultimoRegistro.hashIntegridade : "GENESIS_HASH";

    const id = `AUD-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const timestamp = new Date().toISOString();

    const registroParcial: Omit<AuditoriaPedido, "hashIntegridade"> = {
      id,
      timestamp,
      tenantId: usuario.tenantId,
      compradorId: usuario.id,
      compradorNome: usuario.nome,
      compradorEmail: usuario.email,
      compradorPapel: usuario.role,
      filialId,
      filialNome,
      produtoId,
      codigoSku,
      descricaoProduto,
      fornecedorId,
      nomeFornecedor,
      quantidadeSugeridaSistema: quantidadeSugerida,
      quantidadeDigitadaComprador: quantidadeDigitada,
      divergenciaQuantidade: divergenciaQtd,
      divergenciaPercentual: Number(divergenciaPct.toFixed(2)),
      precoCustoUnitario: precoCusto,
      impactoFinanceiroDivergencia: Number(impactoFinanceiro.toFixed(2)),
      tipoAcao,
      classificacaoDivergencia: classificacao,
      justificativaOverride: justificativaFormatada,
      hashRegistroAnterior: hashAnterior,
    };

    const hashIntegridade = calcularHashRegistro(registroParcial);

    const registroCompleto: AuditoriaPedido = Object.freeze({
      ...registroParcial,
      hashIntegridade,
    });

    await this.repositorio.adicionarRegistro(registroCompleto);
    return registroCompleto;
  }

  public async consultarTrilha(
    filtros: FiltrosConsultaAuditoria
  ): Promise<readonly AuditoriaPedido[]> {
    return this.repositorio.consultar(filtros);
  }

  public async calcularKpisGerenciais(tenantId: string): Promise<ResumoKpisAuditoria> {
    const todos = await this.repositorio.obterTodos(tenantId);
    const total = todos.length;
    if (total === 0) {
      return {
        totalRegistros: 0,
        totalSobrecompras: 0,
        totalSubcompras: 0,
        totalConformes: 0,
        taxaAderenciaMotorPercentual: 100,
        impactoFinanceiroTotalSobrecompra: 0,
      };
    }

    let sobrecompras = 0;
    let subcompras = 0;
    let conformes = 0;
    let impactoFinanceiroSobrecompra = 0;

    for (const reg of todos) {
      if (reg.classificacaoDivergencia === "SOBRECOMPRA") {
        sobrecompras++;
        impactoFinanceiroSobrecompra += reg.impactoFinanceiroDivergencia;
      } else if (
        reg.classificacaoDivergencia === "SUBCOMPRA" ||
        reg.classificacaoDivergencia === "ZERAMENTO_MANUAL"
      ) {
        subcompras++;
      } else {
        conformes++;
      }
    }

    const taxaAderencia = (conformes / total) * 100;

    return {
      totalRegistros: total,
      totalSobrecompras: sobrecompras,
      totalSubcompras: subcompras,
      totalConformes: conformes,
      taxaAderenciaMotorPercentual: Number(taxaAderencia.toFixed(2)),
      impactoFinanceiroTotalSobrecompra: Number(impactoFinanceiroSobrecompra.toFixed(2)),
    };
  }
}

/**
 * Instância singleton compartilhada de repositório e serviço de auditoria para a aplicação.
 */
export const repositorioAuditoriaPadrao = new RepositorioAuditoriaEmMemoria();
export const servicoAuditoriaPadrao = new ServicoAuditoria(repositorioAuditoriaPadrao);




/**
 * Repositório e Serviço de Auditoria Imutável com Encadeamento Criptográfico SHA-256
 * Camada: Aplicação / Auditoria (src/lib/auditoria/repositorio-auditoria.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import {
  AuditoriaPedido,
  ClassificacaoDivergencia,
  TipoAcaoAuditoria,
  FiltrosConsultaAuditoria,
  ResumoKpisAuditoria,
} from "./tipos";
import { supabaseConfigurado } from "@/lib/aprendizado/supabase";
import { resolverTenantConfigurado , naturezaTenant } from "@config/tenants";
import {
  IdProvedorAuditoria,
  ParametrosRegistroPedido,
  RepositorioAuditoria,
} from "./porta-repositorio";
import { calcularHashRegistro, validarCadeiaAuditoria } from "./criptografia";
import { RepositorioAuditoriaEmMemoria } from "./provedores/memoria";
import { RepositorioAuditoriaSupabase } from "./provedores/supabase";

export { calcularHashRegistro, validarCadeiaAuditoria } from "./criptografia";
export type { RepositorioAuditoria, ParametrosRegistroPedido, IdProvedorAuditoria } from "./porta-repositorio";
export { RepositorioAuditoriaEmMemoria } from "./provedores/memoria";
export { RepositorioAuditoriaSupabase } from "./provedores/supabase";

// ============================================================================
// RESOLUÇÃO DE PROVEDOR E FÁBRICA
// ============================================================================

export function idProvedorAuditoria(): IdProvedorAuditoria {
  const forcado = process.env.AUDITORIA_PROVIDER?.trim().toLowerCase();
  if (forcado === "memoria") return "memoria";
  if (forcado === "supabase") return "supabase";
  return supabaseConfigurado() ? "supabase" : "memoria";
}

/**
 * Registros de demonstração: só para o tenant de DEMONSTRAÇÃO.
 *
 * O provedor em memória é o que atende quando não há banco configurado — e
 * isso acontece por OMISSÃO, bastando faltar a variável do Supabase no
 * ambiente. Semeado incondicionalmente, ele enchia a instalação de um cliente
 * REAL com registros de auditoria fabricados — numa trilha cuja promessa é ser imutável e assinada.
 *
 * Medido com TENANT_ATIVO=carreiro e sem Supabase: a tela trazia "Carlos
 * Comprador" e "Ana Suprimentos" operando em "Loja Central 01" e "Filial Norte
 * 02" — pessoas e lojas que não existem na rede — com justificativas escritas
 * e valores em reais, e os indicadores do topo calculados em cima disso.
 *
 * A regra é a mesma da fonte de dados: cliente de natureza sintética recebe
 * conteúdo sintético; cliente real começa vazio, que é a verdade.
 *
 * Lê o tenant do AMBIENTE de propósito: isto roda na inicialização do módulo,
 * fora de qualquer requisição. Numa instalação dedicada (TENANT_ATIVO
 * obrigatório em produção, ADR-0001) ambiente e requisição são o mesmo cliente.
 */
function deveSemearDemonstracao(): boolean {
  try {
    return naturezaTenant(resolverTenantConfigurado()) === "sintetica";
  } catch {
    // Sem TENANT_ATIVO em produção o erro aparece no contexto da requisição,
    // com mensagem útil. Aqui, na dúvida, NÃO semeia dado sintético.
    return false;
  }
}

let repositorioPersonalizado: RepositorioAuditoria | null = null;
let instanciaMemoria: RepositorioAuditoriaEmMemoria | null = null;
let memoriaSemeada: boolean | null = null;
let instanciaSupabase: RepositorioAuditoriaSupabase | null = null;

export function obterRepositorioAuditoria(): RepositorioAuditoria {
  if (repositorioPersonalizado) {
    return repositorioPersonalizado;
  }

  const id = idProvedorAuditoria();
  if (id === "supabase") {
    return (instanciaSupabase ??= new RepositorioAuditoriaSupabase());
  }

  const semear = deveSemearDemonstracao();
  if (!instanciaMemoria || memoriaSemeada !== semear) {
    instanciaMemoria = new RepositorioAuditoriaEmMemoria(semear);
    memoriaSemeada = semear;
  }
  return instanciaMemoria;
}

export function definirRepositorioAuditoria(repo: RepositorioAuditoria | null): void {
  repositorioPersonalizado = repo;
}

export function reiniciarRepositorioAuditoria(): void {
  repositorioPersonalizado = null;
  instanciaMemoria = null;
  memoriaSemeada = null;
  instanciaSupabase = null;
}

// ============================================================================
// SERVIÇO DE AUDITORIA E CÁLCULO DE KPIS
// ============================================================================

export class ServicoAuditoria {
  constructor(
    private readonly repositorioOuFabrica?:
      | RepositorioAuditoria
      | (() => RepositorioAuditoria)
  ) {}

  private obterRepositorio(): RepositorioAuditoria {
    if (typeof this.repositorioOuFabrica === "function") {
      return this.repositorioOuFabrica();
    }
    if (this.repositorioOuFabrica) {
      return this.repositorioOuFabrica;
    }
    return obterRepositorioAuditoria();
  }

  public async registrarDecisao(params: ParametrosRegistroPedido): Promise<AuditoriaPedido> {
    const repo = this.obterRepositorio();
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
    const ultimoRegistro = await repo.obterUltimoRegistro(usuario.tenantId);
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

    await repo.adicionarRegistro(registroCompleto);
    return registroCompleto;
  }

  public async consultarTrilha(
    filtros: FiltrosConsultaAuditoria
  ): Promise<readonly AuditoriaPedido[]> {
    return this.obterRepositorio().consultar(filtros);
  }

  public async calcularKpisGerenciais(tenantId: string): Promise<ResumoKpisAuditoria> {
    const todos = await this.obterRepositorio().obterTodos(tenantId);
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
export const repositorioAuditoriaPadrao: RepositorioAuditoria = {
  get id() {
    return obterRepositorioAuditoria().id;
  },
  adicionarRegistro: (r) => obterRepositorioAuditoria().adicionarRegistro(r),
  obterUltimoRegistro: (t) => obterRepositorioAuditoria().obterUltimoRegistro(t),
  consultar: (f) => obterRepositorioAuditoria().consultar(f),
  obterTodos: (t) => obterRepositorioAuditoria().obterTodos(t),
  limpar: (t) => obterRepositorioAuditoria().limpar(t),
};

export const servicoAuditoriaPadrao = new ServicoAuditoria(repositorioAuditoriaPadrao);

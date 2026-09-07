/**
 * Tipos Canônicos de RBAC e Controle de Acesso Multi-Tenant
 * Camada: Aplicação / Segurança (src/lib/rbac/tipos.ts)
 * 100% em Português do Brasil (pt-BR).
 */

export type PapelUsuario = "COMPRADOR" | "GESTOR" | "ADMIN";

export type AcaoSeguranca =
  | "CARREGAR_INVENTARIO"
  | "CRIAR_PEDIDO"
  | "AJUSTAR_QUANTIDADE"
  | "APROVAR_TRANSFERENCIA"
  | "VISUALIZAR_AUDITORIA_GERENCIAL"
  | "EXPORTAR_RELATORIOS";

export interface UsuarioAutenticado {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly role: PapelUsuario;
  /**
   * Fornecedores homologados na carteira do comprador.
   * Para GESTOR e ADMIN, pode ser null (indicando acesso irrestrito universal).
   */
  readonly allowedSupplierIds: ReadonlySet<number> | readonly number[] | null;
  /**
   * Categorias/Seções homologadas na carteira (opcional).
   * Se for null, tem acesso a todas as seções dos fornecedores autorizados.
   */
  readonly allowedCategoryIds?: ReadonlySet<number> | readonly number[] | null;
  readonly tenantId: string;
}

export interface SessaoUsuario {
  readonly usuario: UsuarioAutenticado;
  readonly tokenExpiracao: number;
  readonly emitidoEm: number;
}

/**
 * Classes de Erro Padronizadas para Falhas de Autenticação e Autorização RBAC
 * Mapeiam diretamente para códigos de status HTTP (401, 403).
 */

export class ErroSegurancaBase extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly codigoErro: string
  ) {
    super(message);
    this.name = "ErroSegurancaBase";
  }
}

export class ErroNaoAutenticado extends ErroSegurancaBase {
  constructor(motivo: string = "Sessão de usuário não encontrada ou expirada.") {
    super(motivo, 401, "UNAUTHORIZED");
    this.name = "ErroNaoAutenticado";
  }
}

export class ErroAcessoNegado extends ErroSegurancaBase {
  constructor(
    motivo: string = "Acesso negado: recurso fora da alçada da sua carteira de comprador.",
    public readonly fornecedorSolicitado?: number,
    public readonly fornecedoresPermitidos?: readonly number[]
  ) {
    super(motivo, 403, "FORBIDDEN");
    this.name = "ErroAcessoNegado";
  }
}

export class ErroViolacaoTenant extends ErroSegurancaBase {
  constructor(motivo: string = "Acesso negado: tentativa de acesso entre tenants distintos.") {
    super(motivo, 403, "TENANT_MISMATCH");
    this.name = "ErroViolacaoTenant";
  }
}

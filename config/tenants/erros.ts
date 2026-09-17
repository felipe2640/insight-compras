/**
 * Erros de Resolução e Cadastro de Tenant
 * Camada: Configurações & White-Label (config/tenants/erros.ts)
 * 100% em Português do Brasil (pt-BR).
 *
 * Em produção, cliente desconhecido e instalação sem TENANT_ATIVO são ERRO.
 * Cair na demonstração escondia o engano: um subdomínio digitado errado abria
 * uma plataforma que funcionava, com dado sintético, e parecia o cliente.
 */

export type MotivoErroTenant = "desconhecido" | "nao_configurado" | "cadastro_invalido";

export class ErroTenant extends Error {
  readonly motivo: MotivoErroTenant;
  /** Identificador pedido, quando houve um. Nunca é dado sensível. */
  readonly identificador?: string;

  constructor(motivo: MotivoErroTenant, mensagem: string, identificador?: string) {
    super(mensagem);
    this.name = "ErroTenant";
    this.motivo = motivo;
    this.identificador = identificador;
  }
}

/** Fora de produção a plataforma abre em demonstração; em produção, falha. */
export function ehAmbienteProducao(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

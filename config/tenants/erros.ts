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

/**
 * Esta instalação é a PRODUÇÃO de um cliente?
 *
 * Na Vercel quem responde é `VERCEL_ENV`. `NODE_ENV` não serve: todo deploy da
 * Vercel — inclusive os PREVIEWS de PR — roda com `NODE_ENV=production`. A
 * primeira versão desta função olhava os dois, e com isso o preview do PR era
 * tratado como produção: exigia TENANT_ATIVO e respondia 503 em toda página do
 * projeto de apresentação, que não declara um.
 *
 * Fora da Vercel (servidor próprio, `next start` local), vale `NODE_ENV`.
 */
export function ehAmbienteProducao(): boolean {
  const ambienteVercel = process.env.VERCEL_ENV?.trim();
  if (ambienteVercel) return ambienteVercel === "production";
  return process.env.NODE_ENV === "production";
}

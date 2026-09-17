/**
 * Contexto da Requisição: quem é o usuário, qual é o cliente, qual é a fonte
 * Camada: Aplicação (src/lib/contexto) — server-only
 * 100% em Português do Brasil (pt-BR).
 *
 * POR QUE ESTE MÓDULO EXISTE
 *
 * Cada rota e cada página montava esse contexto do seu jeito. Umas liam o
 * cabeçalho `x-tenant-id`, outras a sessão, outras a variável de ambiente, e a
 * conferência cruzada existia só onde alguém lembrou de chamar. O resultado
 * verificado no código: a página do cockpit usava o cliente da URL ANTES do
 * cliente da sessão e nunca comparava os dois — numa instalação multi-cliente,
 * `/compras?tenant=carreiro` com sessão de demonstração carregava a grade real.
 *
 * Aqui a decisão é uma só, e ela FALHA FECHADA: divergiu, nega (ADR-0001).
 * Também é aqui que a configuração de lotes do Supabase é mesclada e aplicada,
 * para página e API mostrarem sempre o mesmo múltiplo.
 */

// Server-only por construção: importa next/headers, que não roda no cliente.
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";

import {
  ConfiguracaoTenant,
  ErroTenant,
  buscarConfiguracaoTenant,
  ehAmbienteProducao,
  naturezaTenant,
  resolverTenantConfigurado,
} from "@config/tenants";
import {
  ErroFonteNaoConfigurada,
  InventoryAdapter,
  capacidadesEfetivas,
  obterAdaptadorInventario,
} from "@adapters/index";
import type { RespostaCargaInventario } from "@adapters/AdaptadorInventario";
import type { UsuarioAutenticado } from "@/lib/rbac/tipos";
import { obterUsuarioAtual, obterUsuarioDaRequisicao } from "@/lib/autenticacao/servidor";
import { carregarConfiguracaoLotes } from "@/lib/configuracao/lotes-repositorio";
import { aplicarLotesDoCliente } from "./aplicar-lotes";
import { validarAmbienteUmaVez } from "@/lib/ambiente/validacao-ambiente";

export type MotivoErroContexto =
  | "nao_autenticado"
  | "tenant_divergente"
  | "tenant_desconhecido"
  | "configuracao_incompleta"
  | "fonte_indisponivel";

export class ErroContexto extends Error {
  readonly motivo: MotivoErroContexto;
  /** Detalhe técnico (ex.: variáveis faltando). Só para ADMIN ou fora de produção. */
  readonly detalhe?: readonly string[];

  constructor(motivo: MotivoErroContexto, mensagem: string, detalhe?: readonly string[]) {
    super(mensagem);
    this.name = "ErroContexto";
    this.motivo = motivo;
    this.detalhe = detalhe;
  }
}

export interface ContextoRequisicao {
  readonly usuario: UsuarioAutenticado;
  readonly tenant: ConfiguracaoTenant;
  /** Adaptador com as capacidades que o cadastro deixou ligadas. */
  readonly fonte: InventoryAdapter;
  /** Loja que abre em foco, sempre do cadastro — nunca `?? 1`. */
  readonly filialFocoId: number;
  /**
   * Carrega o inventário já com os múltiplos do cliente aplicados.
   *
   * Existe para que ninguém use `fonte.carregarInventarioCompleto` direto e
   * acabe exibindo múltiplo diferente do que a API exibe.
   */
  carregarInventario(filtro: Parameters<InventoryAdapter["carregarInventarioCompleto"]>[0]): Promise<RespostaCargaInventario>;
}

/** Contexto para ROTAS de API (NextRequest). */
export async function contextoDaRequisicao(request: NextRequest): Promise<ContextoRequisicao> {
  const usuario = await obterUsuarioDaRequisicao(request);
  const tenantSolicitado = request.headers.get("x-tenant-id");
  return montarContexto(usuario, tenantSolicitado);
}

/** Contexto para PÁGINAS (Server Components). */
export async function contextoDaPagina(): Promise<ContextoRequisicao> {
  const usuario = await obterUsuarioAtual();
  const tenantSolicitado = headers().get("x-tenant-id") ?? cookies().get("x-tenant-id")?.value ?? null;
  return montarContexto(usuario, tenantSolicitado);
}

async function montarContexto(
  usuario: UsuarioAutenticado | null,
  tenantSolicitado: string | null
): Promise<ContextoRequisicao> {
  /**
   * Segunda camada da validação de ambiente (a primeira falha o build de
   * produção). Instalação incompleta não serve dado pela metade: para aqui.
   */
  const ambiente = validarAmbienteUmaVez();
  if (!ambiente.ok) {
    throw new ErroContexto(
      "configuracao_incompleta",
      "esta instalação não está configurada para operar",
      ambiente.problemas
    );
  }

  if (!usuario) {
    throw new ErroContexto("nao_autenticado", "sessão ausente ou inválida");
  }

  const tenant = resolverTenantDaRequisicao(usuario, tenantSolicitado);

  let fonte: InventoryAdapter;
  try {
    fonte = capacidadesEfetivas(obterAdaptadorInventario({ tenant }), tenant);
  } catch (erro) {
    if (erro instanceof ErroFonteNaoConfigurada) {
      throw new ErroContexto(
        "configuracao_incompleta",
        `a fonte de dados de "${tenant.id}" não está configurada`,
        erro.faltando
      );
    }
    throw erro;
  }

  /**
   * Cliente real nunca recebe dado sintético (ADR-0002). A fábrica já falha
   * quando falta credencial; esta é a rede de proteção contra alguém devolver
   * um mock por outro caminho (ex.: USE_MOCK_ADAPTER num ambiente errado).
   */
  if (naturezaTenant(tenant) === "real" && fonte.natureza === "sintetica") {
    throw new ErroContexto(
      "configuracao_incompleta",
      `a instalação de "${tenant.id}" está servindo dados sintéticos`,
      ["USE_MOCK_ADAPTER"]
    );
  }

  const filialFocoId = tenant.parametrosMotor.filialFocoPadraoId;

  return {
    usuario,
    tenant,
    fonte,
    filialFocoId,
    async carregarInventario(filtro) {
      const lotes = await carregarConfiguracaoLotes(tenant.id, tenant.parametrosMotor.lotes);
      const carga = await fonte.carregarInventarioCompleto(filtro);
      return aplicarLotesDoCliente(carga, lotes);
    },
  };
}

/**
 * Qual cliente esta requisição atende.
 *
 * Ordem: a instalação (TENANT_ATIVO) manda; o que vier na URL só pode
 * CONFIRMAR o cliente da sessão, nunca trocá-lo.
 */
function resolverTenantDaRequisicao(
  usuario: UsuarioAutenticado,
  tenantSolicitado: string | null
): ConfiguracaoTenant {
  const tenantDaSessao = buscarConfiguracaoTenant(usuario.tenantId);
  if (!tenantDaSessao) {
    throw new ErroContexto(
      "tenant_desconhecido",
      `a sessão aponta para o cliente "${usuario.tenantId}", que não existe no catálogo`
    );
  }

  if (tenantSolicitado) {
    const pedido = buscarConfiguracaoTenant(tenantSolicitado);
    if (!pedido) {
      if (ehAmbienteProducao()) {
        throw new ErroContexto(
          "tenant_desconhecido",
          `cliente "${tenantSolicitado}" não existe no catálogo`
        );
      }
    } else if (pedido.id !== tenantDaSessao.id) {
      // Sessão de um cliente pedindo dados de outro. Sempre nega: era por aqui
      // que a grade real aparecia para uma sessão de demonstração.
      throw new ErroContexto(
        "tenant_divergente",
        `sessão do cliente "${tenantDaSessao.id}" pediu dados de "${pedido.id}"`
      );
    }
  }

  // Instalação dedicada: confere se a sessão é deste cliente.
  let tenantDoAmbiente: ConfiguracaoTenant | null = null;
  try {
    tenantDoAmbiente = process.env.TENANT_ATIVO?.trim() ? resolverTenantConfigurado() : null;
  } catch (erro) {
    if (erro instanceof ErroTenant) {
      throw new ErroContexto("configuracao_incompleta", erro.message, ["TENANT_ATIVO"]);
    }
    throw erro;
  }

  if (tenantDoAmbiente && tenantDoAmbiente.id !== tenantDaSessao.id) {
    throw new ErroContexto(
      "tenant_divergente",
      `esta instalação atende "${tenantDoAmbiente.id}" e a sessão é de "${tenantDaSessao.id}"`
    );
  }

  if (!tenantDoAmbiente && ehAmbienteProducao()) {
    throw new ErroContexto(
      "configuracao_incompleta",
      "TENANT_ATIVO é obrigatório em produção",
      ["TENANT_ATIVO"]
    );
  }

  return tenantDaSessao;
}

/**
 * Resolvedor de Opções de Geração da Matriz a partir do Tenant Ativo
 * Camada: Aplicação / Cockpit
 * 100% em Português do Brasil (pt-BR).
 *
 * Este é o único ponto onde a configuração do cliente encontra o motor.
 * O gerador de linhas não conhece nenhum cliente — recebe tudo por injeção.
 */

import { ConfiguracaoTenant } from "@config/tenants/tipos";
import { TENANT_CARREIRO } from "@config/tenants/carreiro";
import { OpcoesGeracaoMatriz } from "./gerador-linhas-matriz";

/**
 * Resolve o tenant ativo. Hoje há um cliente; quando houver mais, esta função
 * passa a resolver por subdomínio/host — e nada mais no cockpit precisa mudar.
 */
export function obterTenantAtivo(): ConfiguracaoTenant {
  return TENANT_CARREIRO;
}

/**
 * Constrói o mapa de nomes de filiais a partir do cadastro do tenant,
 * evitando que a camada de aplicação importe constantes de um adapter.
 */
export function montarNomesFiliais(
  tenant: ConfiguracaoTenant
): Readonly<Record<number, string>> {
  const mapa: Record<number, string> = {};
  for (const filial of tenant.filiais) {
    mapa[filial.filialId] = filial.nome;
  }
  return mapa;
}

/**
 * Monta as opções do gerador com os parâmetros CALIBRADOS do cliente.
 *
 * Sem isso o motor cai no baseline não calibrado (fator 1,0) — que é
 * exatamente o modelo que o backtest reprovou.
 */
export function montarOpcoesMatriz(
  filialFocoId?: number,
  tenant: ConfiguracaoTenant = obterTenantAtivo()
): OpcoesGeracaoMatriz {
  const parametros = tenant.parametrosMotor;
  return {
    filialFocoId: filialFocoId ?? parametros.filialFocoPadraoId,
    leadTimePadraoDias: parametros.leadTimePadraoDias,
    parametrosMotor: parametros.motor,
    nomesFiliais: montarNomesFiliais(tenant),
  };
}

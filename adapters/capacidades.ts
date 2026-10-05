/**
 * Capacidades Efetivas da Fonte de Dados
 * Camada: Adapters
 * 100% em Português do Brasil (pt-BR).
 *
 * O adaptador declara o que a fonte CONSEGUE entregar; o cadastro do cliente
 * só SUBTRAI (ADR-0003). Aqui as duas coisas viram uma só, e é isso que as
 * rotas e as telas enxergam: se a capacidade não está no objeto, ela não
 * existe para aquele cliente, e o TypeScript cobra a checagem.
 */

import type { ConfiguracaoTenant, CapacidadeDesligavelTenant } from "@config/tenants/tipos";
import type { InventoryAdapter } from "./AdaptadorInventario";

/**
 * Devolve o adaptador com as capacidades que o cadastro desligou removidas.
 *
 * Nada aqui LIGA capacidade: desligar o que a fonte não tem é operação vazia,
 * e prometer o que ela não tem seria repetir o mock silencioso.
 */
export function capacidadesEfetivas(
  adaptador: InventoryAdapter,
  tenant: Pick<ConfiguracaoTenant, "fonte">
): InventoryAdapter {
  const desligadas = new Set<CapacidadeDesligavelTenant>(
    tenant.fonte.capacidadesDesligadas ?? []
  );
  if (desligadas.size === 0) return adaptador;

  const efetivo: InventoryAdapter = {
    descricaoFonte: adaptador.descricaoFonte,
    natureza: adaptador.natureza,
    carregarInventarioCompleto: (filtro) => adaptador.carregarInventarioCompleto(filtro),
    verificarSaudeConexao: () => adaptador.verificarSaudeConexao(),
    forneceSugestoesErp: desligadas.has("sugestoesErp") ? false : adaptador.forneceSugestoesErp,
    pedidosERP: desligadas.has("pedidosERP") ? undefined : adaptador.pedidosERP,
    cotacoesERP: desligadas.has("cotacoesERP") ? undefined : adaptador.cotacoesERP,
    entradasConfirmadas: desligadas.has("entradasConfirmadas")
      ? undefined
      : adaptador.entradasConfirmadas,
  };
  return efetivo;
}

/** Resumo das capacidades para exibir em tela e registrar em diagnóstico. */
export interface ResumoCapacidades {
  readonly fonte: string;
  readonly natureza: "real" | "sintetica";
  readonly pedidosERP: boolean;
  readonly cotacoesERP: boolean;
  readonly entradasConfirmadas: boolean;
  readonly sugestoesErp: boolean;
}

export function resumirCapacidades(adaptador: InventoryAdapter): ResumoCapacidades {
  return {
    fonte: adaptador.descricaoFonte,
    natureza: adaptador.natureza,
    pedidosERP: Boolean(adaptador.pedidosERP),
    cotacoesERP: Boolean(adaptador.cotacoesERP),
    entradasConfirmadas: Boolean(adaptador.entradasConfirmadas),
    sugestoesErp: adaptador.forneceSugestoesErp,
  };
}

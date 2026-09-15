/**
 * Ponto de Entrada Canônico da Camada de Adaptadores
 * Camada: Adapters (Clean Architecture)
 * 100% em Português do Brasil (pt-BR).
 */

import { InventoryAdapter } from "./AdaptadorInventario";
import {
  AdaptadorInventarioCarreiro,
  OpcoesAdaptadorCarreiro,
} from "./carreiro/adaptador-carreiro";
import { ClienteDaxPowerBI } from "./carreiro/cliente-dax";
import { AdaptadorInventarioMock } from "./mock/adaptador-mock";
import { OpcoesGeradorSintetico } from "./mock/gerador-sintetico";
import { localizarDiretorioSnapshot } from "./carreiro/carregador-snapshot-local";
import { resolverTenantConfigurado, obterConfiguracaoTenant, ConfiguracaoTenant } from "@config/tenants";

export * from "./AdaptadorInventario";
export * from "./carreiro/adaptador-carreiro";
export * from "./carreiro/cliente-dax";
export * from "./carreiro/consultas-homologadas";
export * from "./carreiro/mapeador-dax";
export * from "./carreiro/cache-resiliente";
export * from "./carreiro/carregador-snapshot-local";
export * from "./mock/adaptador-mock";
export * from "./mock/gerador-sintetico";

export type TipoProvedorInventario = "AUTO" | "CARREIRO" | "MOCK";

export interface OpcoesFabricaAdaptador {
  readonly tipo?: TipoProvedorInventario;
  readonly tenant?: string | ConfiguracaoTenant;
  readonly carreiro?: OpcoesAdaptadorCarreiro;
  readonly mock?: OpcoesGeradorSintetico;
}

/**
 * Instâncias em cache mapeadas por chave para evitar recriação desnecessária
 * e garantir que caches L1 e Circuit Breakers fiquem isolados por tenant/provedor.
 */
const mapaInstanciasAdaptadores = new Map<string, InventoryAdapter>();

export function limparInstanciasAdaptadores(): void {
  mapaInstanciasAdaptadores.clear();
}

/**
 * Fábrica canônica para obtenção do adaptador de inventário adequado ao ambiente e tenant.
 *
 * Modo AUTO (padrão): quem decide é o TENANT, pela sua `fonteDados`.
 *
 * Declarada "sintetica", a fonte não toca a nuvem de ninguém, tenha o ambiente
 * as credenciais que tiver. Para fontes reais (ex: "powerbi-carreiro"), instancia
 * o adaptador conectado ou serve o snapshot local com Circuit Breaker.
 */
export function obterAdaptadorInventario(
  opcoes: OpcoesFabricaAdaptador = {}
): InventoryAdapter {
  const tipo = opcoes.tipo ?? (process.env.USE_MOCK_ADAPTER === "true" ? "MOCK" : "AUTO");

  if (tipo === "MOCK") {
    const chave = "MOCK_GLOBAL";
    if (!mapaInstanciasAdaptadores.has(chave) || opcoes.mock) {
      mapaInstanciasAdaptadores.set(chave, new AdaptadorInventarioMock(opcoes.mock));
    }
    return mapaInstanciasAdaptadores.get(chave)!;
  }

  if (tipo === "CARREIRO") {
    const chave = "CARREIRO_FORCADO";
    if (!mapaInstanciasAdaptadores.has(chave) || opcoes.carreiro) {
      mapaInstanciasAdaptadores.set(chave, new AdaptadorInventarioCarreiro(opcoes.carreiro));
    }
    return mapaInstanciasAdaptadores.get(chave)!;
  }

  // Modo AUTO: quem decide é o tenant (passado explicitamente nas opções ou resolvido pelo ambiente)
  const tenant = typeof opcoes.tenant === "string"
    ? obterConfiguracaoTenant(opcoes.tenant)
    : opcoes.tenant ?? resolverTenantConfigurado();

  if (tenant.fonteDados === "sintetica") {
    const chave = `MOCK_${tenant.id}`;
    if (!mapaInstanciasAdaptadores.has(chave) || opcoes.mock) {
      mapaInstanciasAdaptadores.set(chave, new AdaptadorInventarioMock(opcoes.mock));
    }
    return mapaInstanciasAdaptadores.get(chave)!;
  }

  if (tenant.fonteDados === "powerbi-carreiro") {
    const chave = `CARREIRO_${tenant.id}`;
    const clienteDax = new ClienteDaxPowerBI(opcoes.carreiro?.configuracaoDax);
    if (clienteDax.possuiConfiguracaoAtiva() || opcoes.carreiro?.diretorioSnapshot) {
      if (!mapaInstanciasAdaptadores.has(chave) || opcoes.carreiro) {
        mapaInstanciasAdaptadores.set(chave, new AdaptadorInventarioCarreiro({
          ...opcoes.carreiro,
          clienteDax,
        }));
      }
      return mapaInstanciasAdaptadores.get(chave)!;
    }
  }

  // Fallback seguro para Mock
  const chaveFallback = `MOCK_FALLBACK_${tenant.id}`;
  if (!mapaInstanciasAdaptadores.has(chaveFallback) || opcoes.mock) {
    mapaInstanciasAdaptadores.set(chaveFallback, new AdaptadorInventarioMock(opcoes.mock));
  }
  return mapaInstanciasAdaptadores.get(chaveFallback)!;
}

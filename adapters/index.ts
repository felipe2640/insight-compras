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
import { resolverTenantConfigurado } from "@config/tenants";

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
  readonly carreiro?: OpcoesAdaptadorCarreiro;
  readonly mock?: OpcoesGeradorSintetico;
}

/**
 * Instância singleton compartilhada para evitar recriação desnecessária em requisições serverless.
 */
let instanciaMockSingleton: AdaptadorInventarioMock | null = null;
let instanciaCarreiroSingleton: AdaptadorInventarioCarreiro | null = null;

/**
 * Fábrica canônica para obtenção do adaptador de inventário adequado ao ambiente.
 *
 * Modo AUTO (padrão): quem decide é o TENANT, pela sua `fonteDados`.
 *
 * Antes decidia o ambiente: havendo credenciais de Power BI, devolvia o
 * adaptador da Carreiro — com os GUIDs e os nomes CADEMP dela — para qualquer
 * tenant. O ambiente de DEMONSTRAÇÃO, cuja razão de existir é não expor
 * cliente nenhum, servia o estoque real da rede sob nomes sintéticos assim que
 * as credenciais estivessem no ambiente. E o segundo cliente herdaria o
 * mapeamento do primeiro, calado.
 *
 * Declarada "sintetica", a fonte não toca a nuvem de ninguém, tenha o ambiente
 * as credenciais que tiver.
 */
export function obterAdaptadorInventario(
  opcoes: OpcoesFabricaAdaptador = {}
): InventoryAdapter {
  const tipo = opcoes.tipo ?? (process.env.USE_MOCK_ADAPTER === "true" ? "MOCK" : "AUTO");

  if (tipo === "MOCK") {
    if (!instanciaMockSingleton || opcoes.mock) {
      instanciaMockSingleton = new AdaptadorInventarioMock(opcoes.mock);
    }
    return instanciaMockSingleton;
  }

  if (tipo === "CARREIRO") {
    if (!instanciaCarreiroSingleton || opcoes.carreiro) {
      instanciaCarreiroSingleton = new AdaptadorInventarioCarreiro(opcoes.carreiro);
    }
    return instanciaCarreiroSingleton;
  }

  // Modo AUTO: a fonte declarada pelo tenant manda.
  if (resolverTenantConfigurado().fonteDados === "sintetica") {
    if (!instanciaMockSingleton || opcoes.mock) {
      instanciaMockSingleton = new AdaptadorInventarioMock(opcoes.mock);
    }
    return instanciaMockSingleton;
  }

  const clienteDax = new ClienteDaxPowerBI(opcoes.carreiro?.configuracaoDax);
  if (clienteDax.possuiConfiguracaoAtiva() || opcoes.carreiro?.diretorioSnapshot) {
    if (!instanciaCarreiroSingleton || opcoes.carreiro) {
      instanciaCarreiroSingleton = new AdaptadorInventarioCarreiro({
        ...opcoes.carreiro,
        clienteDax,
      });
    }
    return instanciaCarreiroSingleton;
  }

  // Fallback para Mock
  if (!instanciaMockSingleton || opcoes.mock) {
    instanciaMockSingleton = new AdaptadorInventarioMock(opcoes.mock);
  }
  return instanciaMockSingleton;
}

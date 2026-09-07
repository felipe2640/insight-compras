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

export * from "./AdaptadorInventario";
export * from "./carreiro/adaptador-carreiro";
export * from "./carreiro/cliente-dax";
export * from "./carreiro/consultas-homologadas";
export * from "./carreiro/mapeador-dax";
export * from "./carreiro/cache-resiliente";
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
 * Modo AUTO (padrão):
 * - Se as credenciais do Power BI Fabric estiverem presentes no ambiente, retorna o Adaptador Carreiro.
 * - Caso contrário (desenvolvimento local, testes de carga, ambiente sem Azure Entra ID),
 *   faz fallback gracioso para o Adaptador Mock sintético com 25.000+ SKUs.
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

  // Modo AUTO: Detecção dinâmica de credenciais
  const clienteDax = new ClienteDaxPowerBI(opcoes.carreiro?.configuracaoDax);
  if (clienteDax.possuiConfiguracaoAtiva()) {
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

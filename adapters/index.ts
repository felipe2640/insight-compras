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
export * from "./capacidades";
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
 * A fonte de um cliente REAL não respondeu por falta de configuração.
 *
 * Isto é erro, e não o gatilho de um mock: servir dado sintético a quem decide
 * compra com ele foi o pior defeito que esta plataforma teve (ADR-0002).
 */
export class ErroFonteNaoConfigurada extends Error {
  readonly tenantId: string;
  readonly faltando: readonly string[];

  constructor(tenantId: string, faltando: readonly string[]) {
    super(
      `fonte de dados do cliente "${tenantId}" não está configurada; faltando: ${faltando.join(", ")}`
    );
    this.name = "ErroFonteNaoConfigurada";
    this.tenantId = tenantId;
    this.faltando = faltando;
  }
}

/**
 * Uma instância por TENANT.
 *
 * A chave já incluiu a configuração de lotes (`JSON.stringify`), e com isso
 * cada edição de múltiplos nas Configurações criava um adaptador novo, de
 * cache frio e circuit breaker zerado, deixando o anterior preso no mapa para
 * sempre. Múltiplo é regra do cliente, aplicada depois da carga; o adaptador
 * não precisa conhecê-lo.
 */
const mapaInstanciasAdaptadores = new Map<string, InventoryAdapter>();

export function limparInstanciasAdaptadores(): void {
  mapaInstanciasAdaptadores.clear();
}

/** Fora de produção, o snapshot local e o mock forçado continuam disponíveis. */
function ehAmbienteProducao(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

/**
 * Fábrica canônica do adaptador de inventário do TENANT.
 *
 * Quem decide é o cadastro (`tenant.fonte.adaptador`), nunca o que por acaso
 * está no ambiente. Fonte "sintetica" não toca a nuvem de ninguém; fonte real
 * sem credencial LANÇA, em vez de cair no mock.
 */
export function obterAdaptadorInventario(
  opcoes: OpcoesFabricaAdaptador = {}
): InventoryAdapter {
  const forcarMock = !ehAmbienteProducao() && process.env.USE_MOCK_ADAPTER === "true";
  const tipo = opcoes.tipo ?? (forcarMock ? "MOCK" : "AUTO");

  if (tipo === "MOCK") {
    return instanciaMock("MOCK_GLOBAL", opcoes);
  }

  if (tipo === "CARREIRO") {
    const chave = "CARREIRO_FORCADO";
    if (!mapaInstanciasAdaptadores.has(chave) || opcoes.carreiro) {
      mapaInstanciasAdaptadores.set(chave, new AdaptadorInventarioCarreiro(opcoes.carreiro));
    }
    return mapaInstanciasAdaptadores.get(chave)!;
  }

  const tenant =
    typeof opcoes.tenant === "string"
      ? obterConfiguracaoTenant(opcoes.tenant)
      : opcoes.tenant ?? resolverTenantConfigurado();

  if (tenant.fonte.adaptador === "sintetica") {
    return instanciaMock(`MOCK_${tenant.id}`, opcoes);
  }

  // Fonte real: a partir daqui, ou conecta, ou falha alto.
  const clienteDax = new ClienteDaxPowerBI(opcoes.carreiro?.configuracaoDax);
  const temSnapshotDev =
    !ehAmbienteProducao() &&
    Boolean(opcoes.carreiro?.diretorioSnapshot ?? localizarDiretorioSnapshot());

  if (!clienteDax.possuiConfiguracaoAtiva() && !temSnapshotDev) {
    throw new ErroFonteNaoConfigurada(tenant.id, clienteDax.configuracoesFaltando());
  }

  const chave = `FONTE_${tenant.id}`;
  if (!mapaInstanciasAdaptadores.has(chave) || opcoes.carreiro) {
    mapaInstanciasAdaptadores.set(
      chave,
      new AdaptadorInventarioCarreiro({
        ...opcoes.carreiro,
        clienteDax,
        filiais: tenant.filiais,
        nomeERP: tenant.fonte.nomeERP,
        classesNaoCompraveis: tenant.catalogo.classesNaoCompraveis,
      })
    );
  }
  return mapaInstanciasAdaptadores.get(chave)!;
}

function instanciaMock(chave: string, opcoes: OpcoesFabricaAdaptador): InventoryAdapter {
  if (!mapaInstanciasAdaptadores.has(chave) || opcoes.mock) {
    mapaInstanciasAdaptadores.set(chave, new AdaptadorInventarioMock(opcoes.mock));
  }
  return mapaInstanciasAdaptadores.get(chave)!;
}

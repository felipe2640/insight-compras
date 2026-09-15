/**
 * Parâmetros do motor com a calibração PUBLICADA sobreposta ao tenant.
 * Camada: Aplicação (src/lib/aprendizado) — server-only.
 *
 * O arquivo do tenant é o padrão. Se houver uma versão publicada pelo ciclo de
 * aprendizado, as margens e o fator dela prevalecem. Falha ao consultar o banco
 * cai no tenant — o cockpit nunca deixa de abrir por causa disso.
 */

import { ConfiguracaoTenant } from "@config/tenants/tipos";
import { OpcoesGeracaoMatriz } from "@/lib/cockpit/gerador-linhas-matriz";
import { montarOpcoesMatriz, obterTenantAtivo } from "@/lib/cockpit/opcoes-tenant";
import { carregarParametrosPublicados } from "./repositorio";
import { carregarMapaPrevisoesIa } from "@/lib/previsao-ia/repositorio-previsao-ia";

export async function montarOpcoesMatrizComPublicados(
  filialFocoId?: number,
  tenant: ConfiguracaoTenant = obterTenantAtivo()
): Promise<OpcoesGeracaoMatriz & { versaoParametros: string }> {
  const base = montarOpcoesMatriz(filialFocoId, tenant);
  const [publicados, mapaPrevisoesIa] = await Promise.all([
    carregarParametrosPublicados(tenant.id),
    carregarMapaPrevisoesIa(tenant.id),
  ]);

  const temIa = mapaPrevisoesIa && mapaPrevisoesIa.size > 0;
  const versaoBase = publicados ? publicados.versao : "arquivo do tenant";
  const versaoParametros = temIa
    ? `Previsão probabilística (${mapaPrevisoesIa.size} séries) + ${versaoBase}`
    : versaoBase;

  if (!publicados || !base.parametrosMotor) {
    return { ...base, mapaPrevisoesIa, versaoParametros };
  }
  return {
    ...base,
    mapaPrevisoesIa,
    parametrosMotor: {
      ...base.parametrosMotor,
      margens: publicados.margens,
      fatorCalibracao: publicados.fatorCalibracao,
    },
    versaoParametros,
  };
}

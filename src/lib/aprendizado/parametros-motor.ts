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

export async function montarOpcoesMatrizComPublicados(
  filialFocoId?: number,
  tenant: ConfiguracaoTenant = obterTenantAtivo()
): Promise<OpcoesGeracaoMatriz & { versaoParametros: string }> {
  const base = montarOpcoesMatriz(filialFocoId, tenant);
  const publicados = await carregarParametrosPublicados(tenant.id);
  if (!publicados || !base.parametrosMotor) {
    return { ...base, versaoParametros: "arquivo do tenant" };
  }
  return {
    ...base,
    parametrosMotor: {
      ...base.parametrosMotor,
      margens: publicados.margens,
      fatorCalibracao: publicados.fatorCalibracao,
    },
    versaoParametros: publicados.versao,
  };
}

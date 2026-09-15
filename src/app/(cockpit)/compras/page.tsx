import React from "react";
import { headers } from "next/headers";
import { obterAdaptadorInventario, RespostaCargaInventario } from "@adapters/index";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { montarOpcoesMatrizComPublicados } from "@/lib/aprendizado/parametros-motor";
import { CockpitPrincipal } from "@/components/cockpit/CockpitPrincipal";
import { obterUsuarioAtual, rotuloPapel } from "@/lib/autenticacao/servidor";
import { codificarGradeTabular } from "@/lib/cockpit/codificacao-tabular";
import { contarStatusGrade, separarAcionaveis } from "@/lib/cockpit/escopo-grade";
import { obterTenantAtivo } from "@/lib/cockpit/opcoes-tenant";

// A página lê a sessão (cookies), portanto é dinâmica por requisição; o cache de dados fica no adapter.
export const dynamic = "force-dynamic";

async function CarregarDadosCockpit() {
  const usuario = await obterUsuarioAtual();
  const tenantIdHeader = headers().get("x-tenant-id");
  const tenantId = tenantIdHeader ?? usuario?.tenantId;
  const tenant = obterTenantAtivo(tenantId);
  const adaptador = obterAdaptadorInventario({ tenant });

  /**
   * Loja que abre em foco: do CADASTRO do cliente.
   *
   * Obtida dinamicamente da configuração do tenant resolvido na requisição.
   */
  const filialFoco = tenant.parametrosMotor.filialFocoPadraoId;

  // Falha fechada: Comprador sem carteira enxerga ZERO fornecedores (grade vazia).
  // Gestor e admin continuam irrestritos (null).
  const ehComprador = usuario?.role === "COMPRADOR";
  const fornecedoresRaw = ehComprador
    ? (usuario.allowedSupplierIds ?? [])
    : (usuario?.allowedSupplierIds ?? null);

  const fornecedoresPermitidos: readonly number[] | null = !fornecedoresRaw
    ? null
    : Array.isArray(fornecedoresRaw)
    ? fornecedoresRaw
    : Array.from(fornecedoresRaw);

  const ehCompradorSemCarteira =
    ehComprador && (!fornecedoresPermitidos || fornecedoresPermitidos.length === 0);

  const carga: RespostaCargaInventario = ehCompradorSemCarteira
    ? {
        produtos: [],
        estoques: new Map(),
        historicos: new Map(),
        entradasHoje: [],
        similares: new Map(),
        metadados: {
          provedor: "MOCK_SINTETICO",
          totalSkusCarregados: 0,
          timestampCarga: new Date().toISOString(),
          emModoDegradado: false,
          latenciaMs: 0,
        },
      }
    : await adaptador.carregarInventarioCompleto({
        fornecedoresPermitidos,
        filialId: filialFoco,
        apenasComEstoqueOuVenda: true,
      });

  const linhas = converterParaLinhasCockpit(
    carga,
    await montarOpcoesMatrizComPublicados(filialFoco, tenant)
  );
  const { acionaveis } = separarAcionaveis(linhas);

  return (
    <CockpitPrincipal
      gradeInicial={codificarGradeTabular(acionaveis)}
      contagensCatalogo={contarStatusGrade(linhas)}
      filialFocoIdInicial={filialFoco}
      fornecedoresPermitidosInicial={fornecedoresPermitidos}
      usuarioSessao={
        usuario
          ? {
              id: usuario.id,
              nome: usuario.nome,
              usuario: usuario.email,
              papel: usuario.role,
              papelRotulo: rotuloPapel(usuario.role),
              allowedSupplierIds: fornecedoresPermitidos,
            }
          : null
      }
    />
  );
}

/**
 * A grade acionável inicial continua sendo resolvida no servidor. Ela garante
 * que uma falha na carga complementar do navegador nunca transforme o cockpit
 * em uma tabela vazia. As trocas de loja seguem aproveitando os caches do
 * servidor e das três grades recentes no cliente.
 */
export default function PaginaCockpitCompras() {
  return <CarregarDadosCockpit />;
}

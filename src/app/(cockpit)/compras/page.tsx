import React from "react";
import { redirect } from "next/navigation";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { montarOpcoesMatrizComPublicados } from "@/lib/aprendizado/parametros-motor";
import { CockpitPrincipal } from "@/components/cockpit/CockpitPrincipal";
import { PainelErroContexto } from "@/components/layout/PainelErroContexto";
import { rotuloPapel } from "@/lib/autenticacao/servidor";
import { codificarGradeTabular } from "@/lib/cockpit/codificacao-tabular";
import { contarStatusGrade, separarAcionaveis } from "@/lib/cockpit/escopo-grade";
import { ErroContexto, contextoDaPagina } from "@/lib/contexto/contexto-requisicao";
import { ehAmbienteProducao } from "@config/tenants";

// A página lê a sessão (cookies), portanto é dinâmica por requisição; o cache de dados fica no adapter.
export const dynamic = "force-dynamic";

async function CarregarDadosCockpit() {
  /**
   * Um único ponto resolve usuário, cliente e fonte, e NEGA quando divergem.
   *
   * Antes, esta página lia o cliente do cabeçalho antes da sessão e nunca
   * comparava os dois: numa instalação multi-cliente, `/compras?tenant=<cliente>`
   * abria a grade real para qualquer sessão, inclusive a de demonstração.
   * Usuário nulo também passava, e sem papel de comprador a carteira saía
   * irrestrita.
   */
  let contexto;
  try {
    contexto = await contextoDaPagina();
  } catch (erro) {
    if (erro instanceof ErroContexto) {
      if (erro.motivo === "nao_autenticado") redirect("/login");
      return (
        <PainelErroContexto
          motivo={erro.motivo}
          detalhe={erro.detalhe}
          mostrarDetalhe={!ehAmbienteProducao()}
        />
      );
    }
    throw erro;
  }

  const { usuario, tenant, filialFocoId } = contexto;

  // Falha fechada: Comprador sem carteira enxerga ZERO fornecedores (grade vazia).
  // Gestor e admin continuam irrestritos (null).
  const ehComprador = usuario.role === "COMPRADOR";
  const fornecedoresRaw = ehComprador
    ? (usuario.allowedSupplierIds ?? [])
    : (usuario.allowedSupplierIds ?? null);

  const fornecedoresPermitidos: readonly number[] | null = !fornecedoresRaw
    ? null
    : Array.isArray(fornecedoresRaw)
    ? fornecedoresRaw
    : Array.from(fornecedoresRaw);

  const ehCompradorSemCarteira =
    ehComprador && (!fornecedoresPermitidos || fornecedoresPermitidos.length === 0);

  let carga;
  try {
    carga = ehCompradorSemCarteira
      ? {
          produtos: [],
          estoques: new Map(),
          historicos: new Map(),
          entradasHoje: [],
          similares: new Map(),
          metadados: {
            // Grade vazia por RBAC: a fonte é a do cliente, não um mock.
            provedor: contexto.fonte.natureza === "sintetica"
              ? ("MOCK_SINTETICO" as const)
              : ("POWERBI_FABRIC_DAX" as const),
            totalSkusCarregados: 0,
            timestampCarga: new Date().toISOString(),
            emModoDegradado: false,
            latenciaMs: 0,
          },
        }
      : await contexto.carregarInventario({
          fornecedoresPermitidos,
          filialId: filialFocoId,
          apenasComEstoqueOuVenda: true,
        });
  } catch (erro) {
    // Fonte fora do ar não vira dado inventado nem stack trace (ADR-0002).
    console.error("[cockpit] falha ao carregar inventário:", erro);
    return (
      <PainelErroContexto
        motivo="fonte_indisponivel"
        detalhe={[String(erro instanceof Error ? erro.message : erro)]}
        mostrarDetalhe={!ehAmbienteProducao() || usuario.role === "ADMIN"}
      />
    );
  }

  const linhas = converterParaLinhasCockpit(
    carga,
    await montarOpcoesMatrizComPublicados(filialFocoId, tenant)
  );
  const { acionaveis } = separarAcionaveis(linhas);

  return (
    <CockpitPrincipal
      gradeInicial={codificarGradeTabular(acionaveis)}
      contagensCatalogo={contarStatusGrade(linhas)}
      filialFocoIdInicial={filialFocoId}
      fornecedoresPermitidosInicial={fornecedoresPermitidos}
      usuarioSessao={{
        id: usuario.id,
        nome: usuario.nome,
        usuario: usuario.email,
        papel: usuario.role,
        papelRotulo: rotuloPapel(usuario.role),
        allowedSupplierIds: fornecedoresPermitidos,
      }}
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

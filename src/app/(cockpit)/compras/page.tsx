import React from "react";
import { obterAdaptadorInventario } from "@adapters/index";
import { converterParaLinhasCockpit } from "@/lib/cockpit/gerador-linhas-matriz";
import { montarOpcoesMatrizComPublicados } from "@/lib/aprendizado/parametros-motor";
import { CockpitPrincipal } from "@/components/cockpit/CockpitPrincipal";
import { obterUsuarioAtual, rotuloPapel } from "@/lib/autenticacao/servidor";
import { codificarGradeTabular } from "@/lib/cockpit/codificacao-tabular";
import { contarStatusGrade, separarAcionaveis } from "@/lib/cockpit/escopo-grade";

// A página lê a sessão (cookies), portanto é dinâmica por requisição; o cache de dados fica no adapter.
export const dynamic = "force-dynamic";

async function CarregarDadosCockpit() {
  const usuario = await obterUsuarioAtual();
  const adaptador = obterAdaptadorInventario();
  const carga = await adaptador.carregarInventarioCompleto({
    fornecedoresPermitidos: null,
    filialId: 1,
    // O comprador decide sobre o que tem saldo ou saiu recentemente. Trazer o
    // catálogo inteiro enche a grade de item morto e atrasa a carga.
    apenasComEstoqueOuVenda: true,
  });
  // Parâmetros calibrados do tenant (Carreiro: fator 0,90 do backtest).
  const linhas = converterParaLinhasCockpit(carga, await montarOpcoesMatrizComPublicados(1));

  // A página entrega APENAS o que pede decisão hoje. O catálogo inteiro (19 mil
  // itens) chega em segundo plano pela /api/compras: mandá-lo aqui significava
  // 54 MB de HTML, porque o RSC serializa o dado duas vezes (SSR + hidratação).
  const { acionaveis } = separarAcionaveis(linhas);

  return (
    <CockpitPrincipal
      gradeInicial={codificarGradeTabular(acionaveis)}
      contagensCatalogo={contarStatusGrade(linhas)}
      filialFocoIdInicial={1}
      usuarioSessao={usuario ? { nome: usuario.nome, papelRotulo: rotuloPapel(usuario.role) } : null}
    />
  );
}

/**
 * SEM <Suspense> DE PROPÓSITO.
 *
 * Com um limite de Suspense em volta deste componente de servidor assíncrono, o
 * React servia o HTML mas NUNCA terminava de hidratar esta subárvore sozinho —
 * medido: 30 s sem interação e nenhum efeito rodava. A grade parecia pronta e
 * respondia a cliques (hidratação seletiva), mas nada que dependesse de
 * useEffect acontecia: nem a carga do catálogo completo, nem a sessão no rodapé
 * do menu. Tirar o limite resolveu — efeitos rodam em ~1,3 s.
 *
 * A página é `force-dynamic` e espera o servidor de qualquer forma, então o
 * esqueleto que o limite exibia comprava pouco e custava a interatividade.
 */
export default function PaginaCockpitCompras() {
  return <CarregarDadosCockpit />;
}

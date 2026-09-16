"use client";

/**
 * Carga progressiva da grade.
 * Camada: Aplicação (src/hooks) — cliente.
 *
 * O cockpit abre com as linhas ACIONÁVEIS, que vêm prontas do servidor, e busca
 * o catálogo completo em segundo plano. Motivo medido no catálogo da Rede
 * Carreiro: mandar as 19.118 linhas pela página gerava 54 MB de HTML — o RSC
 * serializa o dado duas vezes (uma no HTML do servidor, outra no payload de
 * hidratação) — e a grade só ficava utilizável depois de ~10 s.
 *
 * REGRAS
 * - O que já está na tela nunca pisca: o catálogo completo substitui a lista de
 *   uma vez, dentro de uma transição, com os ajustes do comprador preservados
 *   (eles moram em outro estado, indexados por SKU).
 * - Falha ao completar não quebra o cockpit: a grade segue com as acionáveis e
 *   o erro é dito na interface, com opção de tentar de novo.
 * - As contagens dos chips vêm do SERVIDOR desde o primeiro instante, sobre o
 *   catálogo inteiro. Nenhum número na tela depende do que já chegou.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import {
  PayloadGradeTabular,
  decodificarGradeTabular,
} from "@/lib/cockpit/codificacao-tabular";
import { ContagensStatusGrade } from "@/lib/cockpit/escopo-grade";

export type EstadoCatalogo = "somente_acionaveis" | "carregando" | "completo" | "falhou";

export interface RetornoGradeProgressiva {
  readonly itens: readonly LinhaCockpitMatriz[];
  readonly estadoCatalogo: EstadoCatalogo;
  readonly contagens: ContagensStatusGrade;
  readonly erro: string | null;
  readonly carregarCatalogo: () => void;
}

export interface OpcoesGradeProgressiva {
  readonly gradeInicial: PayloadGradeTabular;
  readonly contagensCatalogo: ContagensStatusGrade;
  readonly filialId: number;
  /** Injeção para teste. */
  readonly buscar?: typeof fetch;
  /** Desliga a busca automática (teste e Storybook). */
  readonly automatico?: boolean;
}

interface RespostaGrade {
  readonly sucesso?: boolean;
  readonly grade?: PayloadGradeTabular;
  readonly contagens?: ContagensStatusGrade;
  readonly mensagem?: string;
}

interface EntradaCacheGrade {
  readonly grade: PayloadGradeTabular;
  readonly contagens: ContagensStatusGrade;
}

const MAXIMO_LOJAS_EM_CACHE = 3;

export function useGradeProgressiva(opcoes: OpcoesGradeProgressiva): RetornoGradeProgressiva {
  const { gradeInicial, contagensCatalogo, filialId, buscar, automatico = true } = opcoes;

  const [itens, setItens] = useState<readonly LinhaCockpitMatriz[]>(() =>
    decodificarGradeTabular<LinhaCockpitMatriz>(gradeInicial)
  );
  const [estadoCatalogo, setEstadoCatalogo] = useState<EstadoCatalogo>("somente_acionaveis");
  const [contagens, setContagens] = useState<ContagensStatusGrade>(contagensCatalogo);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciarTransicao] = useTransition();
  const filialAnterior = useRef(filialId);
  // Cache limitado à vida deste cockpit: não persiste dados operacionais após
  // logout e evita manter as cinco grades grandes simultaneamente na memória.
  const cachePorFilial = useRef(new Map<number, EntradaCacheGrade>());

  // Se a loja em foco muda, o que está na tela não vale mais.
  useEffect(() => {
    // A carga inicial pertence somente à filial que veio do servidor. Ao trocar
    // de loja, retire imediatamente as linhas antigas enquanto a nova grade é
    // buscada; exibi-las com o novo nome de loja levaria a decisões incorretas.
    if (filialAnterior.current !== filialId) {
      filialAnterior.current = filialId;
      setItens([]);
      setContagens({ total: 0, pedir: 0, transferir: 0, ruptura: 0, zumbi: 0, sugestaoErp: 0 });
      setEstadoCatalogo("carregando");
      setErro(null);
    }
  }, [filialId]);

  useEffect(() => {
    setItens(decodificarGradeTabular<LinhaCockpitMatriz>(gradeInicial));
    setContagens(contagensCatalogo);
    setEstadoCatalogo("somente_acionaveis");
    setErro(null);
  }, [gradeInicial, contagensCatalogo]);

  const emVoo = useRef<AbortController | null>(null);

  const carregarCatalogo = useCallback(() => {
    if (emVoo.current) emVoo.current.abort();

    const entradaCache = cachePorFilial.current.get(filialId);
    if (entradaCache) {
      // Atualiza a ordem LRU; retornar a uma das três lojas recentes não toca a rede.
      cachePorFilial.current.delete(filialId);
      cachePorFilial.current.set(filialId, entradaCache);
      iniciarTransicao(() => {
        setItens(decodificarGradeTabular<LinhaCockpitMatriz>(entradaCache.grade));
        setContagens(entradaCache.contagens);
        setEstadoCatalogo("completo");
        setErro(null);
      });
      return;
    }

    const controle = new AbortController();
    emVoo.current = controle;
    setEstadoCatalogo("carregando");
    setErro(null);

    const requisicao = buscar ?? fetch;
    requisicao(`/api/compras?filialId=${filialId}&formato=tabular&escopo=todos`, {
      signal: controle.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error(`servidor respondeu ${resposta.status}`);
        return (await resposta.json()) as RespostaGrade;
      })
      .then((corpo) => {
        if (controle.signal.aborted) return;
        if (!corpo.grade) throw new Error(corpo.mensagem ?? "resposta sem a grade");
        const completo = decodificarGradeTabular<LinhaCockpitMatriz>(corpo.grade);
        const contagensResposta = corpo.contagens ?? contagensCatalogo;
        cachePorFilial.current.set(filialId, {
          grade: corpo.grade,
          contagens: contagensResposta,
        });
        while (cachePorFilial.current.size > MAXIMO_LOJAS_EM_CACHE) {
          const maisAntiga = cachePorFilial.current.keys().next().value;
          if (maisAntiga === undefined) break;
          cachePorFilial.current.delete(maisAntiga);
        }
        // Transição: a troca de 2 mil por 19 mil linhas não pode travar o clique
        // que o comprador está dando neste instante.
        iniciarTransicao(() => {
          setItens(completo);
          setContagens(contagensResposta);
          setEstadoCatalogo("completo");
        });
      })
      .catch((causa: unknown) => {
        if (controle.signal.aborted) return;
        setEstadoCatalogo("falhou");
        setErro(causa instanceof Error ? causa.message : "falha ao carregar o catálogo");
      })
      .finally(() => {
        if (emVoo.current === controle) emVoo.current = null;
      });
  }, [buscar, contagensCatalogo, filialId]);

  useEffect(() => {
    if (!automatico) return;
    carregarCatalogo();
    return () => {
      emVoo.current?.abort();
      emVoo.current = null;
    };
  }, [automatico, carregarCatalogo]);

  return { itens, estadoCatalogo, contagens, erro, carregarCatalogo };
}

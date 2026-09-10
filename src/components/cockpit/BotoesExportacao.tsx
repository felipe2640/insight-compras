"use client";

/**
 * Botões de exportação por modelo.
 * Camada: Interface (src/components/cockpit).
 *
 * O comprador exporta a mesma coisa todo dia. Um clique num botão com o nome do
 * que ele faz vale mais do que um diálogo com três escolhas. Os modelos de
 * fábrica do tenant já aparecem aqui no primeiro dia; os que o cliente salva
 * entram ao lado.
 *
 * O botão mostra quantas linhas vão sair ANTES do clique: exportar e descobrir
 * que o arquivo veio vazio é o pior desfecho possível.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, SlidersHorizontal, AlertTriangle } from "lucide-react";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import {
  ContextoExportacao,
  OpcoesCsv,
  baixarArquivoNoNavegador,
  filtrarPorEscopo,
  gerarArquivoExportacao,
} from "@/lib/exportacao";
import { ModeloExportacao, layoutDoModelo } from "@/lib/exportacao/modelos";
import { capturarSnapshotAprendizado } from "@/lib/aprendizado/captura-cliente";
import { cn } from "@/lib/utils";

export interface BotoesExportacaoProps {
  readonly itens: readonly LinhaCockpitMatriz[];
  readonly contexto: ContextoExportacao;
  readonly csvPadrao?: OpcoesCsv;
  readonly onAbrirConfiguracao: () => void;
  /** Muda quando um modelo é salvo, para a lista recarregar. */
  readonly versao?: number;
  readonly className?: string;
}

export function BotoesExportacao({
  itens,
  contexto,
  csvPadrao,
  onAbrirConfiguracao,
  versao = 0,
  className,
}: BotoesExportacaoProps) {
  const [modelos, setModelos] = useState<ModeloExportacao[]>([]);
  const [gerando, setGerando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch("/api/exportacao/modelos")
      .then((r) => (r.ok ? r.json() : null))
      .then((corpo: { modelos?: ModeloExportacao[] } | null) => {
        if (ativo && corpo?.modelos) setModelos(corpo.modelos);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [versao]);

  const contagemPorModelo = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const m of modelos) mapa.set(m.id, filtrarPorEscopo(itens, m.escopo).length);
    return mapa;
  }, [modelos, itens]);

  const exportar = useCallback(
    async (modelo: ModeloExportacao) => {
      setErro(null);
      const linhas = filtrarPorEscopo(itens, modelo.escopo);
      if (linhas.length === 0) {
        setErro(`"${modelo.nome}" não tem nenhuma linha para exportar agora.`);
        return;
      }
      setGerando(modelo.id);
      try {
        const arquivo = await gerarArquivoExportacao({
          itens,
          layout: layoutDoModelo(modelo),
          formato: modelo.formato,
          contexto: { ...contexto, dataReferencia: new Date() },
          csvPadrao,
        });
        baixarArquivoNoNavegador(arquivo);
        // "todos" é análise, não decisão de compra, e por isso não vira snapshot.
        if (modelo.escopo !== "todos") {
          capturarSnapshotAprendizado({
            itens: linhas,
            filialId: contexto.filialId,
            layoutId: modelo.id,
            formato: modelo.formato,
          });
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao gerar o arquivo.");
      } finally {
        setGerando(null);
      }
    },
    [itens, contexto, csvPadrao]
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {modelos.map((modelo) => {
        const quantas = contagemPorModelo.get(modelo.id) ?? 0;
        const vazio = quantas === 0;
        return (
          <button
            key={modelo.id}
            type="button"
            onClick={() => exportar(modelo)}
            disabled={gerando !== null || vazio}
            title={
              vazio
                ? `Nenhuma linha no escopo de "${modelo.nome}" agora`
                : `Exportar ${quantas} linha(s) em ${modelo.formato.toUpperCase()}`
            }
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
              vazio
                ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                : "border-[#D4AF37] bg-[#D4AF37] text-slate-900 hover:bg-[#c39f2f]"
            )}
          >
            {gerando === modelo.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span className="max-w-[160px] truncate">{modelo.nome}</span>
            <span
              className={cn(
                "rounded px-1 text-[10px] font-bold",
                vazio ? "bg-slate-200 text-slate-500" : "bg-slate-900/15"
              )}
            >
              {quantas}
            </span>
            <span className="text-[10px] uppercase opacity-70">{modelo.formato}</span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onAbrirConfiguracao}
        title="Escolher colunas, formato e salvar um modelo novo"
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Modelos
      </button>

      {erro && (
        <span role="alert" className="flex items-center gap-1 text-[11px] text-amber-700">
          <AlertTriangle className="h-3 w-3" />
          {erro}
        </span>
      )}
    </div>
  );
}

"use client";

/**
 * Diálogo de Exportação Configurável
 * Camada: Cockpit (src/components/cockpit)
 * 100% em Português do Brasil (pt-BR).
 *
 * O cliente define os layouts no tenant (colunas, rótulos, separadores). Aqui o
 * comprador escolhe, na hora: qual layout, qual formato (CSV / XLSX / PDF), se
 * exporta a grade filtrada ou só as linhas marcadas, e pode desligar colunas.
 * A escolha de colunas fica guardada no navegador por tenant + layout.
 */

import React, { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText, FileDown, Loader2, RotateCcw, BookmarkPlus, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import {
  CATALOGO_COLUNAS_EXPORTACAO,
  GRUPOS_COLUNAS_EXPORTACAO,
  ConfiguracaoExportacaoTenant,
  ContextoExportacao,
  FormatoExportacao,
  LayoutExportacao,
  baixarArquivoNoNavegador,
  filtrarPorEscopo,
  gerarArquivoExportacao,
  layoutPadraoDoTenant,
} from "@/lib/exportacao";
import { cn } from "@/lib/utils";
import { capturarSnapshotAprendizado } from "@/lib/aprendizado/captura-cliente";

export interface DialogExportacaoProps {
  readonly aberto: boolean;
  readonly onFechar: () => void;
  readonly itensFiltrados: readonly LinhaCockpitMatriz[];
  readonly itensSelecionados: readonly LinhaCockpitMatriz[];
  readonly configuracao: ConfiguracaoExportacaoTenant;
  readonly contexto: ContextoExportacao;
  /** Avisa o cockpit para recarregar os botões de modelo. */
  readonly onModeloSalvo?: () => void;
}

type OrigemLinhas = "filtrados" | "selecionados";

const ROTULO_FORMATO: Record<FormatoExportacao, { nome: string; Icone: typeof FileText; dica: string }> = {
  csv: { nome: "CSV", Icone: FileText, dica: "Texto separado; abre no Excel e importa no ERP" },
  xlsx: { nome: "Excel", Icone: FileSpreadsheet, dica: "Planilha com números formatados" },
  pdf: { nome: "PDF", Icone: FileDown, dica: "Para imprimir ou enviar ao fornecedor" },
};

function chaveArmazenamento(tenantId: string, layoutId: string): string {
  return `exportacao:${tenantId}:${layoutId}:colunas`;
}

function lerColunasSalvas(tenantId: string, layout: LayoutExportacao): Set<string> {
  try {
    const bruto = localStorage.getItem(chaveArmazenamento(tenantId, layout.id));
    if (!bruto) return new Set(layout.colunas);
    const lista = JSON.parse(bruto) as unknown;
    if (!Array.isArray(lista)) return new Set(layout.colunas);
    // Só mantém o que ainda existe no layout: se o cliente mudou a config, prevalece.
    const validas = lista.filter((id): id is string => typeof id === "string" && layout.colunas.includes(id));
    return validas.length > 0 ? new Set(validas) : new Set(layout.colunas);
  } catch {
    return new Set(layout.colunas);
  }
}

function salvarColunas(tenantId: string, layoutId: string, colunas: ReadonlySet<string>): void {
  try {
    localStorage.setItem(chaveArmazenamento(tenantId, layoutId), JSON.stringify([...colunas]));
  } catch {
    // armazenamento indisponível (modo privado etc.) — a exportação segue normalmente
  }
}

export function DialogExportacao({
  aberto,
  onFechar,
  itensFiltrados,
  itensSelecionados,
  configuracao,
  contexto,
  onModeloSalvo,
}: DialogExportacaoProps) {
  const layoutPadrao = useMemo(() => layoutPadraoDoTenant(configuracao), [configuracao]);

  const [layoutId, setLayoutId] = useState(layoutPadrao.id);
  const layout = useMemo(
    () => configuracao.layouts.find((l) => l.id === layoutId) ?? layoutPadrao,
    [configuracao, layoutId, layoutPadrao]
  );

  const [formato, setFormato] = useState<FormatoExportacao>(configuracao.formatoPadrao);
  const [origem, setOrigem] = useState<OrigemLinhas>("filtrados");
  const [colunas, setColunas] = useState<Set<string>>(() => new Set(layoutPadrao.colunas));
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Ao trocar de layout: recarrega colunas salvas e garante formato permitido.
  useEffect(() => {
    setColunas(lerColunasSalvas(contexto.tenantId, layout));
    setFormato((atual) =>
      layout.formatosPermitidos.includes(atual)
        ? atual
        : layout.formatosPermitidos.includes(configuracao.formatoPadrao)
          ? configuracao.formatoPadrao
          : layout.formatosPermitidos[0]
    );
    setErro(null);
  }, [layout, contexto.tenantId, configuracao.formatoPadrao]);

  // Sem linhas marcadas, a origem só pode ser a grade filtrada.
  useEffect(() => {
    if (itensSelecionados.length === 0 && origem === "selecionados") setOrigem("filtrados");
  }, [itensSelecionados.length, origem]);

  const itensBase = origem === "selecionados" ? itensSelecionados : itensFiltrados;
  const quantidadeLinhas = useMemo(
    () => filtrarPorEscopo(itensBase, layout.escopo).length,
    [itensBase, layout.escopo]
  );

  const colunasPorGrupo = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const id of layout.colunas) {
      const col = CATALOGO_COLUNAS_EXPORTACAO.get(id);
      if (!col) continue;
      const lista = mapa.get(col.grupo) ?? [];
      lista.push(id);
      mapa.set(col.grupo, lista);
    }
    return GRUPOS_COLUNAS_EXPORTACAO.filter((g) => mapa.has(g)).map((g) => [g, mapa.get(g)!] as const);
  }, [layout]);

  const alternarColuna = (id: string, marcada: boolean) => {
    setColunas((atual) => {
      const novo = new Set(atual);
      if (marcada) novo.add(id);
      else novo.delete(id);
      salvarColunas(contexto.tenantId, layout.id, novo);
      return novo;
    });
  };

  const restaurarPadrao = () => {
    const padrao = new Set(layout.colunas);
    setColunas(padrao);
    salvarColunas(contexto.tenantId, layout.id, padrao);
  };

  // --- salvar a escolha atual como modelo -------------------------------
  const [nomeModelo, setNomeModelo] = useState("");
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const [modeloSalvo, setModeloSalvo] = useState<string | null>(null);

  const salvarComoModelo = async () => {
    setErro(null);
    setModeloSalvo(null);
    if (nomeModelo.trim().length < 3) {
      setErro("Dê um nome de ao menos 3 letras ao modelo.");
      return;
    }
    if (colunas.size === 0) {
      setErro("Marque ao menos uma coluna antes de salvar o modelo.");
      return;
    }
    setSalvandoModelo(true);
    try {
      const r = await fetch("/api/exportacao/modelos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nomeModelo.trim(),
          escopo: layout.escopo,
          formato,
          // A ORDEM do layout manda: o ERP do cliente espera as colunas naquela
          // sequência, e um Set não guarda ordem.
          colunas: layout.colunas.filter((c) => colunas.has(c)),
          rotulosPersonalizados: layout.rotulosPersonalizados,
          csv: layout.csv,
          nomeArquivo: layout.nomeArquivo,
          tituloPdf: layout.tituloPdf,
        }),
      });
      const corpo = (await r.json()) as { erro?: string };
      if (!r.ok) {
        setErro(corpo.erro ?? "Não foi possível salvar o modelo.");
        return;
      }
      setModeloSalvo(nomeModelo.trim());
      setNomeModelo("");
      onModeloSalvo?.();
    } catch {
      setErro("Sem conexão com o servidor.");
    } finally {
      setSalvandoModelo(false);
    }
  };

  const exportar = async () => {
    setErro(null);
    if (colunas.size === 0) {
      setErro("Marque ao menos uma coluna.");
      return;
    }
    if (quantidadeLinhas === 0) {
      setErro("Nenhuma linha atende ao escopo deste layout com a origem escolhida.");
      return;
    }
    setGerando(true);
    try {
      const arquivo = await gerarArquivoExportacao({
        itens: itensBase,
        layout,
        formato,
        contexto: { ...contexto, dataReferencia: new Date() },
        colunasSelecionadas: colunas,
        csvPadrao: configuracao.csvPadrao,
      });
      baixarArquivoNoNavegador(arquivo);
      // Ciclo de aprendizado: grava decisão do comprador × sugestão do modelo.
      // Fire-and-forget — nunca atrasa nem quebra o download. "todos" é análise,
      // não decisão de compra, e por isso não vira snapshot.
      if (layout.escopo !== "todos") {
        capturarSnapshotAprendizado({
          itens: filtrarPorEscopo(itensBase, layout.escopo),
          filialId: contexto.filialId,
          layoutId: layout.id,
          formato,
        });
      }
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar o arquivo.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Exportar</DialogTitle>
          <DialogDescription>
            Layouts, colunas e formatos definidos para {contexto.nomeTenant}. Loja em foco:{" "}
            <span className="font-medium text-slate-700">{contexto.nomeLoja}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
          {/* Coluna esquerda: layout, formato, origem */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Layout</label>
              <select
                value={layoutId}
                onChange={(e) => setLayoutId(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                aria-label="Layout de exportação"
              >
                {configuracao.layouts.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
              {layout.descricao && <p className="mt-1 text-xs text-slate-500">{layout.descricao}</p>}
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase text-slate-500 mb-1">Formato</span>
              <div className="grid grid-cols-3 gap-2">
                {(["csv", "xlsx", "pdf"] as FormatoExportacao[]).map((f) => {
                  const permitido = layout.formatosPermitidos.includes(f);
                  const { nome, Icone, dica } = ROTULO_FORMATO[f];
                  return (
                    <button
                      key={f}
                      type="button"
                      disabled={!permitido}
                      onClick={() => setFormato(f)}
                      title={permitido ? dica : "Não disponível neste layout"}
                      aria-pressed={formato === f}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded border px-2 py-2 text-xs font-semibold transition-colors",
                        formato === f
                          ? "border-blue-600 bg-blue-50 text-blue-800"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                        !permitido && "cursor-not-allowed opacity-40"
                      )}
                    >
                      <Icone className="h-4 w-4" />
                      {nome}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase text-slate-500 mb-1">Linhas</span>
              <div className="space-y-1.5 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="origem" checked={origem === "filtrados"} onChange={() => setOrigem("filtrados")} />
                  Grade atual (filtros aplicados)
                </label>
                <label className={cn("flex items-center gap-2", itensSelecionados.length === 0 && "text-slate-400")}>
                  <input
                    type="radio"
                    name="origem"
                    disabled={itensSelecionados.length === 0}
                    checked={origem === "selecionados"}
                    onChange={() => setOrigem("selecionados")}
                  />
                  Somente marcadas ({itensSelecionados.length})
                </label>
              </div>
              <p className="mt-2 rounded bg-slate-50 border border-slate-200 px-2 py-1.5 text-xs text-slate-600">
                <span className="font-bold text-slate-900">{quantidadeLinhas.toLocaleString("pt-BR")}</span>{" "}
                linha(s) no arquivo — escopo &ldquo;{layout.escopo.replace(/_/g, " ")}&rdquo;
              </p>
            </div>
          </div>

          {/* Coluna direita: colunas */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase text-slate-500">
                Colunas ({colunas.size} de {layout.colunas.length})
              </span>
              <button
                type="button"
                onClick={restaurarPadrao}
                className="flex items-center gap-1 text-xs text-blue-700 hover:underline"
              >
                <RotateCcw className="h-3 w-3" /> Restaurar padrão do cliente
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded border border-slate-200 p-2 space-y-3">
              {colunasPorGrupo.map(([grupo, ids]) => (
                <div key={grupo}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">{grupo}</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {ids.map((id) => {
                      const col = CATALOGO_COLUNAS_EXPORTACAO.get(id)!;
                      const rotulo = layout.rotulosPersonalizados?.[id] ?? col.rotulo;
                      return (
                        <label key={id} className="flex items-center gap-2 text-sm text-slate-800">
                          <Checkbox
                            checked={colunas.has(id)}
                            onCheckedChange={(v) => alternarColuna(id, v === true)}
                            aria-label={rotulo}
                          />
                          <span className="truncate" title={rotulo !== col.rotulo ? `${rotulo} (${col.rotulo})` : rotulo}>
                            {rotulo}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {erro && (
          <p role="alert" className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <label className="flex-1 space-y-1 text-xs">
            <span className="font-semibold text-slate-700">Salvar esta escolha como modelo</span>
            <input
              value={nomeModelo}
              onChange={(e) => setNomeModelo(e.target.value)}
              placeholder="ex.: Pedido semanal Bosch"
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 outline-none focus:border-blue-500"
            />
            <span className="block text-[10px] text-slate-500">
              Vira um botão de um clique no cockpit, com as colunas e o formato de agora.
            </span>
          </label>
          <button
            type="button"
            onClick={salvarComoModelo}
            disabled={salvandoModelo}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {salvandoModelo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
            Salvar modelo
          </button>
          {modeloSalvo && (
            <span role="status" className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" />
              &quot;{modeloSalvo}&quot; salvo
            </span>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onFechar}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={exportar}
            disabled={gerando}
            className="flex items-center gap-2 rounded bg-primaria px-4 py-2 text-sm font-bold text-white hover:bg-primaria-hover disabled:opacity-60"
          >
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {gerando ? "Gerando…" : `Exportar ${ROTULO_FORMATO[formato].nome}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

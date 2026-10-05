"use client";

/**
 * Diálogo de Exportação e Gerenciamento Completo de Modelos (CRUD)
 * Camada: Cockpit (src/components/cockpit/DialogExportacao.tsx)
 * 100% em Português do Brasil (pt-BR).
 *
 * Permite ao comprador:
 * 1. Exportar a grade configurando layout, formato (CSV/XLSX/PDF) e colunas sob demanda.
 * 2. Criar novos modelos de exportação com colunas selecionadas.
 * 3. Renomear modelos existentes pela interface.
 * 4. Alterar colunas e formatos de modelos salvos.
 * 5. Excluir modelos customizados (modelos de fábrica são protegidos).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  FileDown,
  Loader2,
  RotateCcw,
  BookmarkPlus,
  Check,
  Pencil,
  Trash2,
  SlidersHorizontal,
  Bookmark,
  Layers,
  AlertTriangle,
  X,
  Plus,
} from "lucide-react";
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
import { ModeloExportacao, layoutDoModelo } from "@/lib/exportacao/modelos";
import { cn } from "@/lib/utils";
import { capturarSnapshotAprendizado } from "@/lib/aprendizado/captura-cliente";

export interface DialogExportacaoProps {
  readonly aberto: boolean;
  readonly onFechar: () => void;
  readonly itensFiltrados: readonly LinhaCockpitMatriz[];
  /** Catálogo carregado, sem busca, status ou filtros da grade. */
  readonly itensCatalogo?: readonly LinhaCockpitMatriz[];
  readonly itensSelecionados: readonly LinhaCockpitMatriz[];
  readonly configuracao: ConfiguracaoExportacaoTenant;
  readonly contexto: ContextoExportacao;
  /** Avisa o cockpit para recarregar os botões de modelo. */
  readonly onModeloSalvo?: () => void;
  readonly onExportado?: (itens: readonly LinhaCockpitMatriz[]) => void;
}

type OrigemLinhas = "filtrados" | "catalogo" | "selecionados";
type AbaDialogo = "exportar" | "modelos";

const ROTULO_FORMATO: Record<
  FormatoExportacao,
  { nome: string; Icone: typeof FileText; dica: string }
> = {
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
    const validas = lista.filter(
      (id): id is string => typeof id === "string" && CATALOGO_COLUNAS_EXPORTACAO.has(id)
    );
    return validas.length > 0 ? new Set(validas) : new Set(layout.colunas);
  } catch {
    return new Set(layout.colunas);
  }
}

function ordenarColunasSelecionadas(layout: LayoutExportacao, selecionadas: ReadonlySet<string>): string[] {
  const doLayout = layout.colunas.filter((id) => selecionadas.has(id));
  const adicionais = Array.from(CATALOGO_COLUNAS_EXPORTACAO.keys()).filter(
    (id) => selecionadas.has(id) && !layout.colunas.includes(id)
  );
  return [...doLayout, ...adicionais];
}

function salvarColunas(tenantId: string, layoutId: string, colunas: ReadonlySet<string>): void {
  try {
    localStorage.setItem(chaveArmazenamento(tenantId, layoutId), JSON.stringify([...colunas]));
  } catch {
    // Modo privado / indisponível
  }
}

export function DialogExportacao({
  aberto,
  onFechar,
  itensFiltrados,
  itensCatalogo = itensFiltrados,
  itensSelecionados,
  configuracao,
  contexto,
  onModeloSalvo,
  onExportado,
}: DialogExportacaoProps) {
  const layoutPadrao = useMemo(() => layoutPadraoDoTenant(configuracao), [configuracao]);

  // Aba ativa: Exportar vs Gerenciar Modelos
  const [abaAtiva, setAbaAtiva] = useState<AbaDialogo>("exportar");

  // Configuração da Exportação
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
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // Lista de Modelos Carregados da API
  const [modelos, setModelos] = useState<ModeloExportacao[]>([]);
  const [carregandoModelos, setCarregandoModelos] = useState(false);
  const [podeSalvar, setPodeSalvar] = useState(true);

  // Estado de Criação de Modelo
  const [nomeNovoModelo, setNomeNovoModelo] = useState("");
  const [salvandoModelo, setSalvandoModelo] = useState(false);

  // Estado de Edição de Modelo Existente (Alterar Colunas)
  const [modeloEmEdicao, setModeloEmEdicao] = useState<ModeloExportacao | null>(null);

  // Estado de Renomeação de Modelo
  const [modeloRenomeandoId, setModeloRenomeandoId] = useState<string | null>(null);
  const [nomeRenomeando, setNomeRenomeando] = useState("");
  const [salvandoRenomeacao, setSalvandoRenomeacao] = useState(false);

  // Estado de Exclusão de Modelo
  const [modeloExcluindoId, setModeloExcluindoId] = useState<string | null>(null);
  const [executandoExclusao, setExecutandoExclusao] = useState(false);

  /**
   * Recarrega a lista de modelos da API.
   */
  const recarregarModelos = useCallback(async () => {
    setCarregandoModelos(true);
    try {
      const r = await fetch("/api/exportacao/modelos");
      if (r.ok) {
        const corpo = (await r.json()) as {
          modelos?: ModeloExportacao[];
          podeSalvar?: boolean;
        };
        if (corpo.modelos) setModelos(corpo.modelos);
        if (typeof corpo.podeSalvar === "boolean") setPodeSalvar(corpo.podeSalvar);
      }
    } catch {
      // Falha de rede
    } finally {
      setCarregandoModelos(false);
    }
  }, []);

  useEffect(() => {
    if (aberto) {
      void recarregarModelos();
    }
  }, [aberto, recarregarModelos]);

  // Ao trocar de layout: restaura colunas e formato se não estiver editando modelo específico
  useEffect(() => {
    if (!modeloEmEdicao) {
      setColunas(lerColunasSalvas(contexto.tenantId, layout));
      setFormato((atual) =>
        layout.formatosPermitidos.includes(atual)
          ? atual
          : layout.formatosPermitidos.includes(configuracao.formatoPadrao)
          ? configuracao.formatoPadrao
          : layout.formatosPermitidos[0]
      );
    }
    setErro(null);
  }, [layout, contexto.tenantId, configuracao.formatoPadrao, modeloEmEdicao]);

  // Sem linhas marcadas, a origem cai para a grade filtrada
  useEffect(() => {
    if (itensSelecionados.length === 0 && origem === "selecionados") setOrigem("filtrados");
  }, [itensSelecionados.length, origem]);

  const itensBase =
    origem === "selecionados"
      ? itensSelecionados
      : origem === "catalogo"
        ? itensCatalogo
        : itensFiltrados;
  const escopoAtual = modeloEmEdicao ? modeloEmEdicao.escopo : layout.escopo;
  // Seleção manual e catálogo completo são modos de ANÁLISE: a escolha do
  // comprador prevalece sobre escopos operacionais como compra/transferência.
  const escopoEfetivo = origem === "filtrados" ? escopoAtual : "todos";
  const quantidadeLinhas = useMemo(
    () => filtrarPorEscopo(itensBase, escopoEfetivo).length,
    [itensBase, escopoEfetivo]
  );

  // Agrupamento de colunas disponíveis
  const colunasPorGrupo = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const id of CATALOGO_COLUNAS_EXPORTACAO.keys()) {
      const col = CATALOGO_COLUNAS_EXPORTACAO.get(id);
      if (!col) continue;
      const lista = mapa.get(col.grupo) ?? [];
      lista.push(id);
      mapa.set(col.grupo, lista);
    }
    return GRUPOS_COLUNAS_EXPORTACAO.filter((g) => mapa.has(g)).map(
      (g) => [g, mapa.get(g)!] as const
    );
  }, [layout]);

  const alternarColuna = (id: string, marcada: boolean) => {
    setColunas((atual) => {
      const novo = new Set(atual);
      if (marcada) novo.add(id);
      else novo.delete(id);
      if (!modeloEmEdicao) {
        salvarColunas(contexto.tenantId, layout.id, novo);
      }
      return novo;
    });
  };

  const restaurarPadrao = () => {
    const padrao = new Set(layout.colunas);
    setColunas(padrao);
    if (!modeloEmEdicao) {
      salvarColunas(contexto.tenantId, layout.id, padrao);
    }
  };

  // ==========================================================================
  // OPERAÇÕES DO CRUD DE MODELOS (CRIAR, RENOMEAR, EDITAR COLUNAS, EXCLUIR)
  // ==========================================================================

  /**
   * 1. Criar novo modelo com as colunas e formato atualmente selecionados.
   */
  const criarNovoModelo = async () => {
    setErro(null);
    setMensagemSucesso(null);

    const nome = nomeNovoModelo.trim();
    if (nome.length < 3) {
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
          nome,
          escopo: layout.escopo,
          formato,
          colunas: ordenarColunasSelecionadas(layout, colunas),
          rotulosPersonalizados: layout.rotulosPersonalizados,
          csv: layout.csv,
          nomeArquivo: layout.nomeArquivo,
          tituloPdf: layout.tituloPdf,
        }),
      });

      const corpo = (await r.json()) as { erro?: string; modelo?: ModeloExportacao };
      if (!r.ok) {
        setErro(corpo.erro ?? "Não foi possível salvar o novo modelo.");
        return;
      }

      setMensagemSucesso(`Modelo "${nome}" criado com sucesso!`);
      setNomeNovoModelo("");
      await recarregarModelos();
      onModeloSalvo?.();
    } catch {
      setErro("Sem conexão com o servidor.");
    } finally {
      setSalvandoModelo(false);
    }
  };

  /**
   * 2. Inicia o modo de edição de colunas de um modelo existente.
   */
  const iniciarEdicaoColunas = (m: ModeloExportacao) => {
    setErro(null);
    setMensagemSucesso(null);
    setModeloEmEdicao(m);
    setFormato(m.formato);
    setColunas(new Set(m.colunas));
    // Tenta sincronizar layout compatível
    const compat = configuracao.layouts.find((l) => l.escopo === m.escopo) ?? layoutPadrao;
    setLayoutId(compat.id);
    setAbaAtiva("exportar");
  };

  /**
   * 3. Salva as alterações de colunas e formato no modelo em edição.
   */
  const salvarAlteracoesColunas = async () => {
    if (!modeloEmEdicao) return;
    setErro(null);
    setMensagemSucesso(null);

    if (colunas.size === 0) {
      setErro("Um modelo precisa ter ao menos uma coluna selecionada.");
      return;
    }

    setSalvandoModelo(true);
    try {
      // Mantém a ordem original das colunas conhecidas
      const colunasFinais = ordenarColunasSelecionadas(layout, colunas);

      const r = await fetch("/api/exportacao/modelos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: modeloEmEdicao.id,
          nome: modeloEmEdicao.nome,
          escopo: modeloEmEdicao.escopo,
          formato,
          colunas: colunasFinais,
          rotulosPersonalizados: modeloEmEdicao.rotulosPersonalizados,
          csv: modeloEmEdicao.csv,
          nomeArquivo: modeloEmEdicao.nomeArquivo,
          tituloPdf: modeloEmEdicao.tituloPdf,
        }),
      });

      const corpo = (await r.json()) as { erro?: string };
      if (!r.ok) {
        setErro(corpo.erro ?? "Falha ao atualizar colunas do modelo.");
        return;
      }

      setMensagemSucesso(`Colunas do modelo "${modeloEmEdicao.nome}" atualizadas com sucesso!`);
      setModeloEmEdicao(null);
      await recarregarModelos();
      onModeloSalvo?.();
    } catch {
      setErro("Sem conexão com o servidor ao atualizar colunas.");
    } finally {
      setSalvandoModelo(false);
    }
  };

  const cancelarEdicaoColunas = () => {
    setModeloEmEdicao(null);
    setColunas(lerColunasSalvas(contexto.tenantId, layout));
  };

  /**
   * 4. Inicia ou cancela o modo de renomeação inline de um modelo.
   */
  const iniciarRenomeacao = (m: ModeloExportacao) => {
    setModeloRenomeandoId(m.id);
    setNomeRenomeando(m.nome);
    setErro(null);
  };

  const cancelarRenomeacao = () => {
    setModeloRenomeandoId(null);
    setNomeRenomeando("");
  };

  /**
   * 5. Confirma a renomeação do modelo.
   */
  const salvarRenomeacao = async (modeloOriginal: ModeloExportacao) => {
    const novoNome = nomeRenomeando.trim();
    if (novoNome.length < 3) {
      setErro("O novo nome deve ter ao menos 3 caracteres.");
      return;
    }
    if (novoNome === modeloOriginal.nome) {
      cancelarRenomeacao();
      return;
    }

    setSalvandoRenomeacao(true);
    setErro(null);
    try {
      const r = await fetch("/api/exportacao/modelos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: modeloOriginal.id,
          nome: novoNome,
          escopo: modeloOriginal.escopo,
          formato: modeloOriginal.formato,
          colunas: modeloOriginal.colunas,
          rotulosPersonalizados: modeloOriginal.rotulosPersonalizados,
          csv: modeloOriginal.csv,
          nomeArquivo: modeloOriginal.nomeArquivo,
          tituloPdf: modeloOriginal.tituloPdf,
        }),
      });

      const corpo = (await r.json()) as { erro?: string };
      if (!r.ok) {
        setErro(corpo.erro ?? "Falha ao renomear o modelo.");
        return;
      }

      setMensagemSucesso(`Modelo renomeado para "${novoNome}" com sucesso!`);
      cancelarRenomeacao();
      await recarregarModelos();
      onModeloSalvo?.();
    } catch {
      setErro("Sem conexão com o servidor ao renomear modelo.");
    } finally {
      setSalvandoRenomeacao(false);
    }
  };

  /**
   * 6. Exclui um modelo customizado salvo.
   */
  const excluirModeloCustomizado = async (id: string, nome: string) => {
    setExecutandoExclusao(true);
    setErro(null);
    try {
      const r = await fetch(`/api/exportacao/modelos?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const corpo = (await r.json()) as { erro?: string };
      if (!r.ok) {
        setErro(corpo.erro ?? "Falha ao excluir o modelo.");
        return;
      }

      setMensagemSucesso(`Modelo "${nome}" excluído com sucesso!`);
      setModeloExcluindoId(null);
      if (modeloEmEdicao?.id === id) {
        setModeloEmEdicao(null);
      }
      await recarregarModelos();
      onModeloSalvo?.();
    } catch {
      setErro("Sem conexão com o servidor ao excluir o modelo.");
    } finally {
      setExecutandoExclusao(false);
    }
  };

  /**
   * Exporta o arquivo diretamente.
   */
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
      const layoutEscolhido: LayoutExportacao = modeloEmEdicao
        ? layoutDoModelo(modeloEmEdicao)
        : layout;
      const layoutEfetivo: LayoutExportacao =
        origem === "filtrados" ? layoutEscolhido : { ...layoutEscolhido, escopo: "todos" };

      const arquivo = await gerarArquivoExportacao({
        itens: itensBase,
        layout: layoutEfetivo,
        formato,
        contexto: { ...contexto, dataReferencia: new Date() },
        colunasSelecionadas: colunas,
        csvPadrao: configuracao.csvPadrao,
      });

      baixarArquivoNoNavegador(arquivo);

      // Catálogo completo é análise. A seleção manual, porém, representa um
      // pedido quando o modelo escolhido tem escopo operacional.
      if (origem !== "catalogo" && escopoAtual !== "todos") {
        const itensExportados = filtrarPorEscopo(itensBase, escopoEfetivo);
        await capturarSnapshotAprendizado({
          itens: itensExportados,
          filialId: contexto.filialId,
          layoutId: layoutEfetivo.id,
          formato,
        });
        onExportado?.(itensExportados);
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Exportação &amp; Modelos de Dados
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Cliente: <strong>{contexto.nomeTenant}</strong> • Loja em foco:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {contexto.nomeLoja}
                </span>
              </DialogDescription>
            </div>

            {/* Alternador de Abas: Exportar vs Gerenciar Modelos */}
            <div className="flex items-center rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setAbaAtiva("exportar")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                  abaAtiva === "exportar"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                )}
              >
                <FileDown className="h-3.5 w-3.5" />
                Exportar Arquivo
              </button>

              <button
                type="button"
                onClick={() => setAbaAtiva("modelos")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                  abaAtiva === "modelos"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Gerenciar Modelos ({modelos.length})
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Notificações de Erro ou Sucesso */}
        {erro && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {erro}
          </p>
        )}

        {mensagemSucesso && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
          >
            <Check className="h-4 w-4 shrink-0" />
            {mensagemSucesso}
          </p>
        )}

        {/* ================================================================= */}
        {/* ABA 1: EXPORTAR ARQUIVO & SELEÇÃO DE COLUNAS                      */}
        {/* ================================================================= */}
        {abaAtiva === "exportar" && (
          <div className="space-y-4">
            {/* Banner de Edição de Modelo Ativo */}
            {modeloEmEdicao && (
              <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-amber-600" />
                  <span>
                    Você está editando as colunas e formato do modelo:{" "}
                    <strong>&ldquo;{modeloEmEdicao.nome}&rdquo;</strong>.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={salvarAlteracoesColunas}
                    disabled={salvandoModelo}
                    className="flex items-center gap-1 rounded bg-amber-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50"
                  >
                    {salvandoModelo ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Salvar Alterações
                  </button>
                  <button
                    type="button"
                    onClick={cancelarEdicaoColunas}
                    className="flex items-center gap-1 rounded border border-amber-300 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100"
                  >
                    <X className="h-3 w-3" />
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
              {/* Coluna esquerda: layout, formato, linhas */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Layout Base
                  </label>
                  <select
                    value={layoutId}
                    onChange={(e) => {
                      setLayoutId(e.target.value);
                      if (modeloEmEdicao) setModeloEmEdicao(null);
                    }}
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900"
                    aria-label="Layout de exportação"
                  >
                    {configuracao.layouts.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nome} ({l.escopo})
                      </option>
                    ))}
                  </select>
                  {layout.descricao && (
                    <p className="mt-1 text-[11px] text-slate-500">{layout.descricao}</p>
                  )}
                </div>

                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Formato de Exportação
                  </span>
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
                            "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors",
                            formato === f
                              ? "border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-200"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
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
                  <span className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Origem das Linhas
                  </span>
                  <div className="space-y-1.5 text-xs">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="origem"
                        checked={origem === "filtrados"}
                        onChange={() => setOrigem("filtrados")}
                      />
                      Grade atual com filtros aplicados
                    </label>
                    <label
                      className={cn(
                        "flex items-center gap-2",
                        itensSelecionados.length === 0 && "text-slate-400"
                      )}
                    >
                      <input
                        type="radio"
                        name="origem"
                        disabled={itensSelecionados.length === 0}
                        checked={origem === "selecionados"}
                        onChange={() => setOrigem("selecionados")}
                      />
                      Itens marcados para análise ({itensSelecionados.length})
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="origem"
                        checked={origem === "catalogo"}
                        onChange={() => setOrigem("catalogo")}
                      />
                      Catálogo completo, sem filtros ({itensCatalogo.length.toLocaleString("pt-BR")})
                    </label>
                  </div>
                  <p className="mt-2 rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {quantidadeLinhas.toLocaleString("pt-BR")}
                    </span>{" "}
                    linha(s) no arquivo — {origem === "filtrados"
                      ? <>escopo &ldquo;{escopoAtual.replace(/_/g, " ")}&rdquo;</>
                      : "análise sem restrição de status"}
                  </p>
                </div>
              </div>

              {/* Coluna direita: lista de colunas com checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold uppercase text-slate-500">
                    Colunas ({colunas.size} selecionada(s))
                  </span>
                  <button
                    type="button"
                    onClick={restaurarPadrao}
                    className="flex items-center gap-1 text-xs text-blue-700 hover:underline dark:text-blue-400"
                  >
                    <RotateCcw className="h-3 w-3" /> Restaurar padrão
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 space-y-3 dark:border-slate-800 dark:bg-slate-900">
                  {colunasPorGrupo.map(([grupo, ids]) => (
                    <div key={grupo}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        {grupo}
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {ids.map((id) => {
                          const col = CATALOGO_COLUNAS_EXPORTACAO.get(id)!;
                          const rotuloArquivo = layout.rotulosPersonalizados?.[id] ?? col.rotulo;
                          const rotulo = id === "sku" ? "Código do produto (SKU)" : rotuloArquivo;
                          return (
                            <label
                              key={id}
                              className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 hover:text-blue-600 cursor-pointer"
                            >
                              <Checkbox
                                checked={colunas.has(id)}
                                onCheckedChange={(v) => alternarColuna(id, v === true)}
                                aria-label={rotulo}
                              />
                              <span
                                className="truncate"
                                title={rotuloArquivo !== col.rotulo ? `${rotulo} — sairá como ${rotuloArquivo}` : rotulo}
                              >
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

            {/* Painel inferior: Salvar como Novo Modelo */}
            {!modeloEmEdicao && (
              <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                <label className="flex-1 space-y-1 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Salvar seleção de colunas e formato como Novo Modelo
                  </span>
                  <input
                    value={nomeNovoModelo}
                    onChange={(e) => setNomeNovoModelo(e.target.value)}
                    placeholder="ex.: Pedido Semanal Bosch (XLSX)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <span className="block text-[10px] text-slate-500">
                    Cria um botão dedicado de exportação de um clique no cockpit.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={criarNovoModelo}
                  disabled={salvandoModelo}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {salvandoModelo ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <BookmarkPlus className="h-3.5 w-3.5 text-blue-600" />
                  )}
                  Salvar Modelo
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* ABA 2: GERENCIAR MODELOS (CRUD COMPLETO)                          */}
        {/* ================================================================= */}
        {abaAtiva === "modelos" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <p>
                Modelos salvos aparecem na barra de ferramentas do cockpit para exportação rápida.
              </p>
              {!podeSalvar && (
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                  Modo Somente Leitura (permissão restrita)
                </span>
              )}
            </div>

            {carregandoModelos ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                <p className="mt-2 text-xs">Carregando modelos cadastrados...</p>
              </div>
            ) : modelos.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white py-10 text-center text-slate-400 dark:border-slate-800 dark:bg-slate-900">
                Nenhum modelo cadastrado no momento.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {modelos.map((m) => {
                  const isRenomeando = modeloRenomeandoId === m.id;
                  const isExcluindo = modeloExcluindoId === m.id;

                  return (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex-1 min-w-[240px]">
                        {/* Linha do Nome ou Input de Renomeação */}
                        {isRenomeando ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={nomeRenomeando}
                              onChange={(e) => setNomeRenomeando(e.target.value)}
                              className="rounded border border-blue-500 bg-white px-2 py-1 text-xs font-bold text-slate-900 outline-none dark:bg-slate-800 dark:text-white"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => salvarRenomeacao(m)}
                              disabled={salvandoRenomeacao}
                              className="rounded bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              {salvandoRenomeacao ? "..." : "Salvar"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelarRenomeacao}
                              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {m.nome}
                            </span>
                            {m.deFabrica ? (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                Padrão de Fábrica
                              </span>
                            ) : (
                              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                Personalizado
                              </span>
                            )}
                          </div>
                        )}

                        {/* Metadados do Modelo */}
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>
                            Formato: <strong className="uppercase font-mono">{m.formato}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Escopo: <strong>{m.escopo}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Colunas: <strong>{m.colunas.length}</strong>
                          </span>
                          {m.criadoEm && (
                            <>
                              <span>•</span>
                              <span>
                                Criado em: {new Date(m.criadoEm).toLocaleDateString("pt-BR")}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Ações do Modelo */}
                      <div className="flex items-center gap-2">
                        {/* Botão de Editar Colunas */}
                        <button
                          type="button"
                          onClick={() => iniciarEdicaoColunas(m)}
                          className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          title="Carregar e alterar colunas deste modelo"
                        >
                          <Layers className="h-3.5 w-3.5 text-blue-600" />
                          Editar Colunas
                        </button>

                        {/* Botão de Renomear (apenas para customizados) */}
                        {!m.deFabrica && !isRenomeando && (
                          <button
                            type="button"
                            onClick={() => iniciarRenomeacao(m)}
                            className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            title="Renomear este modelo"
                          >
                            <Pencil className="h-3.5 w-3.5 text-amber-600" />
                            Renomear
                          </button>
                        )}

                        {/* Botão de Exclusão (apenas para customizados) */}
                        {!m.deFabrica && (
                          <>
                            {isExcluindo ? (
                              <div className="flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2 py-0.5 dark:border-rose-800 dark:bg-rose-950/50">
                                <span className="text-[11px] font-bold text-rose-800 dark:text-rose-200">
                                  Excluir?
                                </span>
                                <button
                                  type="button"
                                  disabled={executandoExclusao}
                                  onClick={() => excluirModeloCustomizado(m.id, m.nome)}
                                  className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                                >
                                  {executandoExclusao ? "..." : "Sim"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setModeloExcluindoId(null)}
                                  className="rounded border border-rose-300 px-1.5 py-0.5 text-[10px] text-rose-800 hover:bg-rose-100"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setModeloExcluindoId(m.id)}
                                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1 text-slate-400 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-800 dark:bg-slate-800"
                                title="Excluir modelo customizado"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-2">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Fechar
          </button>

          {abaAtiva === "exportar" && (
            <button
              type="button"
              onClick={exportar}
              disabled={gerando}
              className="flex items-center gap-2 rounded-lg bg-primaria px-4 py-2 text-xs font-bold text-white hover:bg-primaria-hover disabled:opacity-60 shadow-sm"
            >
              {gerando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 text-secundaria" />
              )}
              {gerando ? "Gerando Arquivo…" : `Exportar ${ROTULO_FORMATO[formato].nome}`}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

/**
 * Comparativo modelo × comprador + painel de calibração.
 * Camada: Aplicação (src/components/aprendizado)
 *
 * O comprador registra POR QUE divergiu; o gestor simula a recalibração e, se
 * concordar, publica. Tabela primeiro — sem cards ocupando a primeira dobra.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Loader2, CheckCircle2, Upload } from "lucide-react";
import { MOTIVOS_DIVERGENCIA, TipoDivergencia, PropostaPerfil } from "@core/aprendizado";
import { cn } from "@/lib/utils";

type Item = {
  id: number;
  exportadoEm: string;
  usuario: string | null;
  sku: string | null;
  descricao: string | null;
  filialId: number | null;
  custo: number | null;
  qtdComprador: number;
  qtdModelo: number | null;
  qtdTransferenciaComprador: number | null;
  qtdTransferenciaModelo: number | null;
  perfil: string | null;
  elegivel: boolean;
  motivoInelegibilidade: string | null;
  divergencia: TipoDivergencia;
  feedback: { motivo: string; comentario: string | null } | null;
  confirmacao: { status: string; qtdEntrada: number; qtdTransferida: number } | null;
};

type Resposta = {
  configurado: boolean;
  itens: Item[];
  resumo: {
    total: number; igual: number; compradorMaior: number; compradorMenor: number;
    soModelo: number; semSugestao: number; comMotivo: number; confirmados: number;
  } | null;
};

type Simulacao = {
  configurado: boolean;
  linhasAprendizado?: number;
  vigente?: { margens: Record<string, number>; fatorCalibracao: number; versao: string };
  proposta?: PropostaPerfil[];
  margensPropostas?: Record<string, number>;
};

const ROTULO_DIVERGENCIA: Record<TipoDivergencia, { texto: string; classe: string }> = {
  igual: { texto: "Igual", classe: "bg-emerald-100 text-emerald-800" },
  comprador_maior: { texto: "Comprador +", classe: "bg-amber-100 text-amber-800" },
  comprador_menor: { texto: "Comprador −", classe: "bg-sky-100 text-sky-800" },
  so_modelo: { texto: "Só o modelo", classe: "bg-rose-100 text-rose-800" },
  sem_sugestao: { texto: "Sem sugestão", classe: "bg-slate-100 text-slate-600" },
};

const ROTULO_STATUS: Record<string, string> = {
  aguardando: "Aguardando", confirmado: "Confirmado", excedente: "Excedente",
  parcial: "Parcial", transferencia: "Transferência", nao_entrou: "Não entrou",
};

const PERFIL: Record<string, string> = {
  ALTO_GIRO: "Alto", MEDIO_GIRO: "Médio", BAIXO_GIRO_INTERMITENTE: "Baixo", SEM_HISTORICO_SUFICIENTE: "Sem hist.",
};

const CABECALHOS_GESTOR = { "Content-Type": "application/json" }; // identidade vem do cookie de sessão

export function ComparativoAprendizado({ nomesFiliais }: { nomesFiliais: Readonly<Record<number, string>> }) {
  const [dias, setDias] = useState("30");
  const [filial, setFilial] = useState("");
  const [fonte, setFonte] = useState("erp");
  const [divergencia, setDivergencia] = useState("");
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<number | null>(null);
  const [motivosLocais, setMotivosLocais] = useState<Record<number, string>>({});

  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);
  const [simulando, setSimulando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const q = new URLSearchParams({ dias, fonte });
      if (filial) q.set("filialId", filial);
      const r = await fetch(`/api/aprendizado/comparativo?${q}`, { headers: CABECALHOS_GESTOR });
      setDados((await r.json()) as Resposta);
    } catch {
      setErro("Não foi possível carregar o comparativo.");
    } finally {
      setCarregando(false);
    }
  }, [dias, filial, fonte]);

  useEffect(() => { void carregar(); }, [carregar]);

  const itens = useMemo(() => {
    const lista = dados?.itens ?? [];
    return divergencia ? lista.filter((i) => i.divergencia === divergencia) : lista;
  }, [dados, divergencia]);

  const salvarMotivo = async (itemId: number, motivo: string) => {
    setSalvando(itemId);
    setMotivosLocais((m) => ({ ...m, [itemId]: motivo }));
    try {
      const r = await fetch("/api/aprendizado/feedback", {
        method: "POST", headers: CABECALHOS_GESTOR, body: JSON.stringify({ itemId, motivo }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setErro("Não foi possível salvar o motivo.");
    } finally {
      setSalvando(null);
    }
  };

  const confirmarEntradas = async () => {
    setConfirmando(true); setMensagem(null);
    try {
      const r = await fetch("/api/aprendizado/confirmar?janela=10&dias=45", { method: "POST", headers: CABECALHOS_GESTOR });
      const j = await r.json();
      setMensagem(r.ok ? `Confirmação: ${j.itens} itens em ${j.consultas} consulta(s) — ${Object.entries(j.porStatus ?? {}).map(([k, v]) => `${ROTULO_STATUS[k] ?? k}: ${v}`).join(", ")}` : `Falha: ${j.erro ?? r.status}`);
      void carregar();
    } finally { setConfirmando(false); }
  };

  const simular = async () => {
    setSimulando(true); setMensagem(null);
    try {
      const r = await fetch("/api/aprendizado/calibrar?dias=60", { headers: CABECALHOS_GESTOR });
      setSimulacao((await r.json()) as Simulacao);
    } finally { setSimulando(false); }
  };

  const publicar = async () => {
    if (!window.confirm("Publicar as margens propostas? Isso muda o quanto o sistema manda comprar.")) return;
    setPublicando(true); setMensagem(null);
    try {
      const r = await fetch("/api/aprendizado/calibrar?dias=60", { method: "POST", headers: CABECALHOS_GESTOR });
      const j = await r.json();
      setMensagem(r.ok ? `Publicado — versão ${j.versao}. Perfis alterados: ${(j.perfisAlterados ?? []).join(", ")}.` : `Não publicado: ${j.motivo ?? j.erro ?? r.status}`);
      if (r.ok) void simular();
    } finally { setPublicando(false); }
  };

  if (dados && !dados.configurado) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Comparativos indisponíveis no momento.</p>
        <p className="mt-1">Tente novamente mais tarde. As exportações continuam disponíveis.</p>
      </div>
    );
  }

  const r = dados?.resumo;

  return (
    <div className="space-y-4">
      {/* Filtros + resumo numa faixa só */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-1 rounded-md bg-slate-100 p-0.5 border border-slate-200">
          <button
            type="button"
            onClick={() => setFonte("erp")}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-semibold transition-all",
              fonte === "erp"
                ? "bg-white text-blue-900 shadow-xs border border-blue-200"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Compras Reais ERP
          </button>
          <button
            type="button"
            onClick={() => setFonte("snapshot")}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-semibold transition-all",
              fonte === "snapshot"
                ? "bg-white text-slate-900 shadow-xs border border-slate-300"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Exportações Cockpit
          </button>
          <button
            type="button"
            onClick={() => setFonte("todos")}
            className={cn(
              "rounded px-2 py-1 text-xs font-semibold transition-all",
              fonte === "todos"
                ? "bg-white text-slate-900 shadow-xs border border-slate-300"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Todas
          </button>
        </div>

        <label className="text-xs text-slate-600">Período
          <select value={dias} onChange={(e) => setDias(e.target.value)} className="ml-1 rounded border border-slate-300 px-2 py-1 text-sm">
            {["7", "30", "60", "90"].map((d) => <option key={d} value={d}>{d} dias</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-600">Loja
          <select value={filial} onChange={(e) => setFilial(e.target.value)} className="ml-1 rounded border border-slate-300 px-2 py-1 text-sm">
            <option value="">Todas</option>
            {Object.entries(nomesFiliais).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-600">Divergência
          <select value={divergencia} onChange={(e) => setDivergencia(e.target.value)} className="ml-1 rounded border border-slate-300 px-2 py-1 text-sm">
            <option value="">Todas</option>
            {Object.entries(ROTULO_DIVERGENCIA).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
          </select>
        </label>
        {r && (
          <span className="ml-auto text-xs text-slate-600">
            <b>{r.total}</b> itens · igual <b>{r.igual}</b> · comprador + <b>{r.compradorMaior}</b> · comprador − <b>{r.compradorMenor}</b> · só modelo <b>{r.soModelo}</b> · com motivo <b>{r.comMotivo}</b> · confirmados <b>{r.confirmados}</b>
          </span>
        )}
        <button type="button" onClick={() => void carregar()} className="rounded border border-slate-300 p-1.5 hover:bg-slate-50" title="Atualizar">
          <RefreshCw className={cn("h-3.5 w-3.5", carregando && "animate-spin")} />
        </button>
      </div>

      {erro && <p role="alert" className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{erro}</p>}

      {/* Tabela */}
      <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-2">Exportado</th>
              <th className="px-2 py-2">SKU</th>
              <th className="px-2 py-2">Descrição</th>
              <th className="px-2 py-2">Loja</th>
              <th className="px-2 py-2">Perfil</th>
              <th className="px-2 py-2 text-right">Comprador</th>
              <th className="px-2 py-2 text-right">Modelo</th>
              <th className="px-2 py-2">Divergência</th>
              <th className="px-2 py-2">Entrada real</th>
              <th className="px-2 py-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-500">{carregando ? "Carregando…" : "Nenhum registro encontrado no período para a fonte selecionada."}</td></tr>
            )}
            {itens.map((i) => {
              const d = ROTULO_DIVERGENCIA[i.divergencia];
              const motivo = motivosLocais[i.id] ?? i.feedback?.motivo ?? "";
              return (
                <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-2 py-1.5 whitespace-nowrap text-slate-600">{new Date(i.exportadoEm).toLocaleDateString("pt-BR")}</td>
                  <td className="px-2 py-1.5 font-mono">{i.sku}</td>
                  <td className="px-2 py-1.5 max-w-[260px] truncate" title={i.descricao ?? ""}>{i.descricao}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{i.filialId ? nomesFiliais[i.filialId] ?? i.filialId : "—"}</td>
                  <td className="px-2 py-1.5">{i.perfil ? PERFIL[i.perfil] ?? i.perfil : "—"}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{i.qtdComprador}</td>
                  <td className="px-2 py-1.5 text-right" title={i.motivoInelegibilidade ?? undefined}>{i.qtdModelo ?? "—"}</td>
                  <td className="px-2 py-1.5"><span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", d.classe)}>{d.texto}</span></td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {i.confirmacao ? (
                      <span title={`compra ${i.confirmacao.qtdEntrada} · transferência ${i.confirmacao.qtdTransferida}`}>
                        {ROTULO_STATUS[i.confirmacao.status] ?? i.confirmacao.status}
                        {i.confirmacao.status !== "aguardando" && i.confirmacao.status !== "nao_entrou" && ` (${i.confirmacao.qtdEntrada + i.confirmacao.qtdTransferida})`}
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={motivo}
                      disabled={salvando === i.id || i.divergencia === "igual"}
                      onChange={(e) => e.target.value && void salvarMotivo(i.id, e.target.value)}
                      className={cn("rounded border px-1.5 py-1 text-xs", motivo ? "border-emerald-300 bg-emerald-50" : "border-slate-300 bg-white")}
                      aria-label={`Motivo da divergência do SKU ${i.sku}`}
                    >
                      <option value="">{i.divergencia === "igual" ? "—" : "Informar…"}</option>
                      <optgroup label="Comercial / Negócio (Não distorce a IA)">
                        {MOTIVOS_DIVERGENCIA.filter((m) => m.grupo === "comercial").map((m) => (
                          <option key={m.id} value={m.id}>{m.rotulo}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Calibração do Modelo de IA (Ajusta Algoritmo)">
                        {MOTIVOS_DIVERGENCIA.filter((m) => m.grupo === "calibracao").map((m) => (
                          <option key={m.id} value={m.id}>{m.rotulo}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Outros">
                        {MOTIVOS_DIVERGENCIA.filter((m) => m.grupo === "outro").map((m) => (
                          <option key={m.id} value={m.id}>{m.rotulo}</option>
                        ))}
                      </optgroup>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Calibração */}
      <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Calibração pelo desfecho real</h2>
          <span className="text-xs text-slate-500">confirma o que entrou → mede a margem necessária por perfil → propõe, com passo máximo de ±50% e mediana como alvo</span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => void confirmarEntradas()} disabled={confirmando} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60">
              {confirmando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Confirmar entradas (10 dias)
            </button>
            <button type="button" onClick={() => void simular()} disabled={simulando} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60">
              {simulando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Simular (60 dias)
            </button>
            <button type="button" onClick={() => void publicar()} disabled={publicando || !simulacao?.proposta?.some((p) => p.aplicavel)} className="flex items-center gap-1.5 rounded bg-primaria px-3 py-1.5 text-xs font-bold text-white hover:bg-primaria-hover disabled:opacity-50">
              {publicando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Publicar
            </button>
          </div>
        </div>

        {mensagem && <p className="rounded bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">{mensagem}</p>}

        {simulacao?.proposta && (
          <div className="overflow-auto">
            <p className="mb-2 text-xs text-slate-600">
              Vigente: versão <b>{simulacao.vigente?.versao}</b>, fator <b>{simulacao.vigente?.fatorCalibracao}</b> · {simulacao.linhasAprendizado} linhas de aprendizado
            </p>
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">Perfil</th><th className="px-2 py-1.5 text-right">Amostra</th>
                  <th className="px-2 py-1.5 text-right">Fora (piso)</th><th className="px-2 py-1.5 text-right">Fora (censurado)</th>
                  <th className="px-2 py-1.5 text-right">Cobertura atual</th><th className="px-2 py-1.5 text-right">q50 necessária</th>
                  <th className="px-2 py-1.5 text-right">Margem atual</th><th className="px-2 py-1.5 text-right">Proposta</th><th className="px-2 py-1.5">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {simulacao.proposta.map((p) => (
                  <tr key={p.perfil} className={cn("border-t border-slate-100", !p.aplicavel && "text-slate-400")}>
                    <td className="px-2 py-1.5 font-semibold">{PERFIL[p.perfil] ?? p.perfil}</td>
                    <td className="px-2 py-1.5 text-right">{p.amostra}</td>
                    <td className="px-2 py-1.5 text-right">{p.descartadasPiso}</td>
                    <td className="px-2 py-1.5 text-right">{p.descartadasCensuradas}</td>
                    <td className="px-2 py-1.5 text-right">{p.coberturaAtual === null ? "—" : `${(p.coberturaAtual * 100).toFixed(0)}%`}</td>
                    <td className="px-2 py-1.5 text-right">{p.q50 === null ? "—" : `${(p.q50 * 100).toFixed(0)}%`}</td>
                    <td className="px-2 py-1.5 text-right">{(p.margemAtual * 100).toFixed(0)}%</td>
                    <td className="px-2 py-1.5 text-right font-bold">{p.margemProposta === null ? "—" : `${(p.margemProposta * 100).toFixed(0)}%`}</td>
                    <td className="px-2 py-1.5 text-slate-600">{p.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

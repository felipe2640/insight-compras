"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
  Store,
  Layers,
  Mail,
  UserCheck,
  Building2,
  FileSpreadsheet,
} from "lucide-react";
import { Pedido, ItemPedido } from "@/lib/pedidos/tipos";
import { cn } from "@/lib/utils";

interface SupplierInfo {
  id: string;
  name: string;
  email?: string;
}

interface HubStatus {
  portalOrigin: string;
  applicationId: string;
  suppliers: SupplierInfo[];
  submissions: { externalId: string; quotationId?: string; state: string }[];
  drafts: { id: string; supplierExternalId: string; destinationId: string; state: string; items: Record<string, string>[] }[];
}

interface ItemComFilial extends ItemPedido {
  filialId: number;
  filialNome: string;
  pedidoId: number;
}

interface ModalCotacaoCompiladaHubProps {
  pedidos: Pedido[];
  nomesFiliais: Record<number, string>;
  onClose: () => void;
  onSucesso: (mensagem: string) => void;
}

function resolverNomeExibicao(f: { id: string; name: string; email?: string }): string {
  if (f.name && !f.name.startsWith("Fornecedor 2000") && f.name !== `Fornecedor ${f.id}`) {
    return f.name;
  }
  if (f.email) {
    const domain = f.email.split("@")[1]?.toLowerCase();
    if (domain) {
      const parts = domain.split(".")[0];
      if (parts && !["gmail", "hotmail", "outlook", "yahoo", "bol", "uol", "terra", "live"].includes(parts)) {
        return parts.charAt(0).toUpperCase() + parts.slice(1);
      }
    }
  }
  const idLimpo = f.id.replace(/^20+/, "");
  return f.name || `Fornecedor ${idLimpo || f.id}`;
}

export function ModalCotacaoCompiladaHub({
  pedidos,
  nomesFiliais,
  onClose,
  onSucesso,
}: ModalCotacaoCompiladaHubProps) {
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [hubStatus, setHubStatus] = useState<HubStatus | null>(null);
  const [itensCompilados, setItensCompilados] = useState<ItemComFilial[]>([]);

  // Fornecedores e e-mails
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [supplierEmails, setSupplierEmails] = useState<Record<string, string>>({});
  const [buscaFornecedor, setBuscaFornecedor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [feedbackEnvio, setFeedbackEnvio] = useState<string | null>(null);
  const [cotacaoEnviadaId, setCotacaoEnviadaId] = useState<string | null>(null);

  // Carregar itens dos pedidos selecionados e status do Cotação Hub
  useEffect(() => {
    let ativo = true;

    async function inicializar() {
      setCarregando(true);
      setErroCarregamento(null);

      try {
        // 1. Carregar status do Hub e lista de fornecedores com e-mails
        const rHub = await fetch("/api/cotacao-hub", { cache: "no-store" });
        const dadosHub: HubStatus = rHub.ok ? await rHub.json() : null;

        // 2. Carregar itens de cada um dos pedidos selecionados
        const buscasItens = pedidos.map(async (p) => {
          try {
            const r = await fetch(`/api/pedidos/historico?pedidoId=${p.id}`);
            if (!r.ok) return [];
            const corpo = (await r.json()) as { itens?: ItemPedido[] };
            const lista = corpo.itens ?? [];
            const filialId = p.filialId ?? 1;
            const filialNome = p.filialNome ?? nomesFiliais[filialId] ?? `Loja ${filialId}`;

            return lista.map((item) => ({
              ...item,
              filialId,
              filialNome,
              pedidoId: p.id,
            }));
          } catch {
            return [];
          }
        });

        const resultadosItens = await Promise.all(buscasItens);
        const todosItens: ItemComFilial[] = resultadosItens.flat();

        if (ativo) {
          setHubStatus(dadosHub);
          setItensCompilados(todosItens);
        }
      } catch (err) {
        if (ativo) {
          setErroCarregamento("Não foi possível carregar os dados dos pedidos ou da conexão do Cotação Hub.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void inicializar();

    return () => {
      ativo = false;
    };
  }, [pedidos, nomesFiliais]);

  // Lista de fornecedores associados aos pedidos
  const fornecedoresDosPedidos = useMemo(() => {
    const mapa = new Map<string, { id: string; name: string }>();

    for (const p of pedidos) {
      if (p.fornecedorId && p.fornecedorNome) {
        mapa.set(String(p.fornecedorId), {
          id: String(p.fornecedorId),
          name: p.fornecedorNome,
        });
      }
    }

    return Array.from(mapa.values());
  }, [pedidos]);

  // Todos os fornecedores disponíveis unificados
  const todosFornecedores = useMemo(() => {
    const mapa = new Map<string, { id: string; name: string; emailOrigem?: string; doPedido?: boolean }>();

    // 1. Fornecedores diretos dos pedidos
    for (const f of fornecedoresDosPedidos) {
      let emailOrigem: string | undefined;
      let idFinal = f.id;

      if (hubStatus?.suppliers) {
        const match = hubStatus.suppliers.find((s) => {
          if (s.id === f.id || Number(s.id) === Number(f.id)) return true;
          if (s.name && f.name && (s.name.toLowerCase().includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(s.name.toLowerCase()))) {
            return true;
          }
          return false;
        });
        if (match) {
          emailOrigem = match.email;
          idFinal = match.id;
        }
      }

      mapa.set(idFinal, {
        id: idFinal,
        name: f.name,
        emailOrigem,
        doPedido: true,
      });
    }

    // 2. Todos os demais fornecedores do Power BI / cadastro
    if (hubStatus?.suppliers) {
      for (const s of hubStatus.suppliers) {
        if (!mapa.has(s.id)) {
          mapa.set(s.id, {
            id: s.id,
            name: resolverNomeExibicao(s),
            emailOrigem: s.email,
            doPedido: false,
          });
        }
      }
    }

    return Array.from(mapa.values());
  }, [hubStatus, fornecedoresDosPedidos]);

  // Inicializar seleção e e-mails conhecidos
  useEffect(() => {
    if (todosFornecedores.length > 0) {
      setSupplierEmails((prev) => {
        const next = { ...prev };
        for (const f of todosFornecedores) {
          if (!next[f.id] && f.emailOrigem) {
            next[f.id] = f.emailOrigem;
          }
        }
        return next;
      });

      if (selectedSuppliers.length === 0) {
        // Pré-selecionar fornecedores vinculados aos pedidos ou os que já têm e-mail
        const dosPedidos = todosFornecedores.filter((f) => f.doPedido).map((f) => f.id);
        if (dosPedidos.length > 0) {
          setSelectedSuppliers(dosPedidos);
        } else {
          // Seleciona o primeiro fornecedor com e-mail cadastrado
          const primeiroComEmail = todosFornecedores.find((f) => f.emailOrigem && f.emailOrigem.includes("@"));
          if (primeiroComEmail) {
            setSelectedSuppliers([primeiroComEmail.id]);
          } else if (todosFornecedores[0]) {
            setSelectedSuppliers([todosFornecedores[0].id]);
          }
        }
      }
    }
  }, [todosFornecedores, selectedSuppliers.length]);

  // Fornecedores filtrados
  const fornecedoresFiltrados = useMemo(() => {
    if (!buscaFornecedor.trim()) return todosFornecedores;
    const termo = buscaFornecedor.toLowerCase().trim();
    return todosFornecedores.filter(
      (f) =>
        f.name.toLowerCase().includes(termo) ||
        (supplierEmails[f.id] ?? "").toLowerCase().includes(termo) ||
        f.id.includes(termo)
    );
  }, [todosFornecedores, buscaFornecedor, supplierEmails]);

  // Identificar fornecedores selecionados que faltam e-mail
  const fornecedoresFaltandoEmail = useMemo(() => {
    return selectedSuppliers
      .map((id) => todosFornecedores.find((f) => f.id === id))
      .filter((f): f is { id: string; name: string; emailOrigem?: string; doPedido?: boolean } => {
        if (!f) return false;
        const email = (supplierEmails[f.id] || "").trim();
        return !email || !email.includes("@");
      });
  }, [selectedSuppliers, todosFornecedores, supplierEmails]);

  // Agrupamento consolidado dos itens por SKU
  const itensConsolidados = useMemo(() => {
    const mapa = new Map<string, {
      sku: string;
      descricao: string;
      quantidadeTotal: number;
      porLoja: { filialId: number; filialNome: string; quantidade: number }[];
    }>();

    for (const it of itensCompilados) {
      const sku = it.sku || `PROD-${it.id}`;
      const qtd = it.qtdComprador || it.quantidade || 1;
      const desc = it.descricao || "Item sem descrição";

      if (!mapa.has(sku)) {
        mapa.set(sku, {
          sku,
          descricao: desc,
          quantidadeTotal: 0,
          porLoja: [],
        });
      }

      const registro = mapa.get(sku)!;
      registro.quantidadeTotal += qtd;
      registro.porLoja.push({
        filialId: it.filialId,
        filialNome: it.filialNome,
        quantidade: qtd,
      });
    }

    return Array.from(mapa.values());
  }, [itensCompilados]);

  // Totalizadores
  const totalLojas = new Set(pedidos.map((p) => p.filialId ?? 1)).size;
  const totalValorEstimado = itensCompilados.reduce((s, i) => s + (i.valorTotal || 0), 0);
  const totalUnidades = itensCompilados.reduce((s, i) => s + (i.qtdComprador || i.quantidade || 1), 0);

  // Desmarcar fornecedores sem e-mail
  const desmarcarSemEmail = () => {
    const idsSemEmail = new Set(fornecedoresFaltandoEmail.map((f) => f.id));
    setSelectedSuppliers((prev) => prev.filter((id) => !idsSemEmail.has(id)));
  };

  // Disparo da cotação compilada
  const enviarCotacao = async () => {
    if (fornecedoresFaltandoEmail.length > 0) {
      setFeedbackEnvio(`Preencha o e-mail ou desmarque os fornecedores sem e-mail: ${fornecedoresFaltandoEmail.map((f) => f.name).join(", ")}`);
      return;
    }

    if (selectedSuppliers.length === 0) {
      setFeedbackEnvio("Selecione ao menos um fornecedor para enviar a solicitação de cotação.");
      return;
    }

    setEnviando(true);
    setFeedbackEnvio(null);

    try {
      // 1. Mapear dados dos fornecedores
      const suppliersData = selectedSuppliers.map((id) => {
        const f = todosFornecedores.find((x) => x.id === id);
        return {
          id,
          name: f?.name || `Fornecedor ${id}`,
          email: (supplierEmails[id] || "").trim(),
        };
      });

      // 2. Mapear destinos
      const destinationsMap = new Map<string, { external_id: string; name: string; address: string }>();
      for (const p of pedidos) {
        const fid = String(p.filialId ?? 1);
        const fnome = p.filialNome ?? nomesFiliais[Number(fid)] ?? `Loja ${fid}`;
        destinationsMap.set(fid, {
          external_id: fid,
          name: fnome,
          address: `Filial ${fnome} - Rede Carreiro`,
        });
      }

      // 3. Mapear itens para envio
      // Cada item no Cotação Hub possui destination_external_id apontando para sua respectiva loja
      const itemsPayload = itensCompilados.map((it, idx) => {
        const skuNum = Number(it.sku?.replace(/\D/g, "")) || (it.id > 0 ? it.id : idx + 101);
        const qtd = it.qtdComprador || it.quantidade || 1;

        return {
          produtoId: skuNum,
          quantity: String(qtd),
          filialId: it.filialId,
          description: it.descricao || `Item ${it.sku}`,
        };
      });

      const externalId = crypto.randomUUID();
      const deadline = new Date(Date.now() + 24 * 3600_000).toISOString();

      const payload = {
        externalId,
        deadline,
        pedidoIds: pedidos.map((p) => p.id),
        supplierIds: [...selectedSuppliers].sort(),
        suppliersData,
        destinations: Array.from(destinationsMap.values()),
        items: itemsPayload,
      };

      const resp = await fetch("/api/cotacao-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resultado = await resp.json().catch(() => null);

      if (!resp.ok) {
        throw new Error(resultado?.erro || "Falha na comunicação com o Cotação Hub.");
      }

      setCotacaoEnviadaId(resultado?.quotationId || externalId);
      onSucesso(`Cotação compilada disparada com sucesso para ${selectedSuppliers.length} fornecedor(es)!`);
    } catch (err) {
      setFeedbackEnvio(err instanceof Error ? err.message : "Erro desconhecido ao enviar cotação.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Compilar Pedidos para Cotação Unificada — Cotação Hub
              </h2>
              <p className="text-xs text-slate-500">
                Junte pedidos de múltiplas lojas em uma única solicitação de compra para obter melhores preços.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {carregando ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium text-slate-700">
                Carregando itens dos {pedidos.length} pedidos e fornecedores com e-mails...
              </p>
              <p className="text-xs text-slate-400">
                Consultando dados no Power BI e base de homologação da Rede Carreiro.
              </p>
            </div>
          ) : erroCarregamento ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <p className="font-semibold">{erroCarregamento}</p>
                <p className="text-xs text-rose-600 mt-0.5">Verifique a conectividade com os serviços.</p>
              </div>
            </div>
          ) : cotacaoEnviadaId ? (
            /* Tela de Sucesso */
            <div className="py-10 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Cotação Enviada com Sucesso ao Cotação Hub!
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  A solicitação unificada foi disparada com sucesso. Os {pedidos.length} pedidos selecionados foram avançados para o estado <strong className="text-amber-800">"Enviado"</strong>.
                </p>
              </div>

              <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">ID da Cotação:</span>
                  <span className="font-mono font-bold text-slate-800">{cotacaoEnviadaId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fornecedores Notificados:</span>
                  <span className="font-semibold text-slate-800">{selectedSuppliers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lojas Atendidas:</span>
                  <span className="font-semibold text-slate-800">{totalLojas} loja(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Itens / Volume Físico:</span>
                  <span className="font-semibold text-slate-800">{itensConsolidados.length} SKUs ({totalUnidades} un)</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
                >
                  Concluir e Voltar aos Pedidos
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Feedback de erro/aviso */}
              {feedbackEnvio && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>{feedbackEnvio}</span>
                  </div>
                  {fornecedoresFaltandoEmail.length > 0 && (
                    <button
                      type="button"
                      onClick={desmarcarSemEmail}
                      className="shrink-0 rounded bg-amber-200/80 px-2 py-1 text-[11px] font-bold text-amber-950 hover:bg-amber-300 transition-colors"
                    >
                      Desmarcar fornecedores sem e-mail
                    </button>
                  )}
                </div>
              )}

              {/* Cards de Resumo da Compilação */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                    <Store className="h-3.5 w-3.5 text-blue-600" />
                    Lojas nos Pedidos
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-blue-950">{totalLojas}</span>
                    <span className="text-xs text-blue-700">loja(s) envolvida(s)</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {pedidos.map((p) => (
                      <span
                        key={p.id}
                        className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-blue-900 border border-blue-200/60 shadow-2xs"
                      >
                        {p.filialNome ?? (p.filialId ? nomesFiliais[p.filialId] ?? `Loja ${p.filialId}` : "—")} (#{p.id})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-indigo-600" />
                    Volume Consolidado
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-indigo-950">{itensConsolidados.length}</span>
                    <span className="text-xs text-indigo-700">SKUs distintos</span>
                  </div>
                  <p className="mt-1 text-[11px] text-indigo-800 font-medium">
                    Total de <strong>{totalUnidades.toLocaleString("pt-BR")}</strong> unidades físicas
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    Valor Estimado
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-emerald-950">
                      {totalValorEstimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-700">
                    Soma de custo dos pedidos selecionados
                  </p>
                </div>
              </div>

              {/* Sanfona / Lista de Itens Compilados por Loja */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                    Itens Consolidados para Cotação ({itensConsolidados.length} produtos)
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    O Cotação Hub enviará as quantidades discriminadas para cada filial de entrega
                  </span>
                </div>

                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/40 text-xs divide-y divide-slate-100">
                  {itensConsolidados.map((item) => (
                    <div key={item.sku} className="p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-white">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900">{item.sku}</span>
                          <span className="truncate text-slate-700 font-medium">{item.descricao}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-slate-500">
                          {item.porLoja.map((l, idx) => (
                            <span key={idx} className="rounded bg-slate-100 px-1.5 py-0.2 border border-slate-200">
                              {l.filialNome}: <strong className="text-slate-800">{l.quantidade} un</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0 text-right font-mono font-bold text-blue-700 sm:pl-3">
                        Total: {item.quantidadeTotal} un
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seleção de Fornecedores */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-blue-600" />
                      Fornecedores para Receber a Cotação ({selectedSuppliers.length} selecionados)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Selecione quais fornecedores e distribuidoras receberão o convite e o formulário de proposta.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {fornecedoresFaltandoEmail.length > 0 && (
                      <button
                        type="button"
                        onClick={desmarcarSemEmail}
                        className="rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-200 transition-colors"
                      >
                        ⚡ Desmarcar sem e-mail ({fornecedoresFaltandoEmail.length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedSuppliers([])}
                      className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                {/* Aviso claro sobre e-mails pendentes */}
                {fornecedoresFaltandoEmail.length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-2.5 text-xs text-amber-900 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Atenção:</strong> {fornecedoresFaltandoEmail.length} fornecedor(es) marcado(s) ainda não possui(em) e-mail informado abaixo. Digite o e-mail ou desmarque-os.
                      </span>
                    </div>
                  </div>
                )}

                {/* Busca de Fornecedores */}
                <div>
                  <input
                    type="text"
                    value={buscaFornecedor}
                    onChange={(e) => setBuscaFornecedor(e.target.value)}
                    placeholder="🔍 Buscar fornecedor por nome, e-mail ou código..."
                    className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Lista com Checkbox e Campo de E-mail */}
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {fornecedoresFiltrados.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-400">
                      Nenhum fornecedor encontrado no filtro.
                    </p>
                  ) : (
                    fornecedoresFiltrados.map((f) => {
                      const isSelected = selectedSuppliers.includes(f.id);
                      const email = supplierEmails[f.id] ?? "";
                      const emailValido = email.trim().length > 0 && email.includes("@");

                      return (
                        <div
                          key={f.id}
                          className={cn(
                            "rounded-lg border p-2.5 transition-all",
                            isSelected
                              ? "border-blue-300 bg-blue-50/30 shadow-2xs"
                              : "border-slate-200 bg-slate-50/40 opacity-70 hover:opacity-100"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) =>
                                  setSelectedSuppliers((curr) =>
                                    e.target.checked ? [...curr, f.id] : curr.filter((id) => id !== f.id)
                                  )
                                }
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-slate-900">{f.name}</span>
                              {f.doPedido && (
                                <span className="rounded-full bg-blue-100 px-2 py-0.2 text-[9px] font-bold text-blue-800">
                                  ⭐ Fornecedor do Pedido
                                </span>
                              )}
                            </label>

                            {f.emailOrigem && (
                              <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-800 flex items-center gap-1">
                                <Mail className="h-2.5 w-2.5" />
                                Power BI (AEMAIL)
                              </span>
                            )}
                          </div>

                          {isSelected && (
                            <div className="mt-2 pl-6">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
                                  E-mail de envio:
                                </span>
                                <input
                                  type="email"
                                  value={email}
                                  onChange={(e) =>
                                    setSupplierEmails((prev) => ({ ...prev, [f.id]: e.target.value }))
                                  }
                                  placeholder="contato@fornecedor.com.br"
                                  className={cn(
                                    "flex-1 rounded border px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500",
                                    !emailValido
                                      ? "border-rose-300 bg-rose-50/40 text-rose-900 placeholder:text-rose-400"
                                      : "border-slate-300 bg-white text-slate-900"
                                  )}
                                />
                              </div>
                              {!emailValido && (
                                <p className="mt-0.5 text-[10px] text-rose-600">
                                  ⚠️ E-mail obrigatório para envio do convite de cotação.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rodapé / Ações */}
        {!cotacaoEnviadaId && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
            <div className="text-xs text-slate-500">
              {fornecedoresFaltandoEmail.length > 0 ? (
                <span className="text-amber-800 font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  {fornecedoresFaltandoEmail.length} fornecedor(es) precisa(m) de e-mail.
                </span>
              ) : selectedSuppliers.length === 0 ? (
                <span>Selecione ao menos 1 fornecedor com e-mail.</span>
              ) : (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Tudo pronto para envio ({selectedSuppliers.length} fornecedores aptos).
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={enviando}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={enviarCotacao}
                disabled={
                  enviando ||
                  carregando ||
                  selectedSuppliers.length === 0 ||
                  fornecedoresFaltandoEmail.length > 0 ||
                  itensConsolidados.length === 0
                }
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm transition-all",
                  enviando ||
                  carregando ||
                  selectedSuppliers.length === 0 ||
                  fornecedoresFaltandoEmail.length > 0 ||
                  itensConsolidados.length === 0
                    ? "bg-slate-400 cursor-not-allowed opacity-60"
                    : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                )}
                title={
                  fornecedoresFaltandoEmail.length > 0
                    ? "Preencha ou desmarque os fornecedores sem e-mail para prosseguir"
                    : selectedSuppliers.length === 0
                    ? "Selecione ao menos 1 fornecedor"
                    : "Disparar cotação unificada"
                }
              >
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Disparando cotação unificada...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>
                      Disparar Cotação Unificada ({selectedSuppliers.length})
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

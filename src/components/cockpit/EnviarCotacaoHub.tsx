"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LinhaCockpitMatriz } from "@/tipos/cockpit";
import {
  fingerprintSelecao,
  marcasAceitasSugeridas,
  nomeExibicaoFornecedor,
  normalizarCodigoBase,
  parseMarcasAceitas,
  type ProdutoResolvido,
  type SupplierInfo,
} from "@/lib/cotacao-hub/payload";
import { AbrirNoHub } from "@/components/cotacao-hub/AbrirNoHub";

interface ItemEdicaoState {
  quantidade: number;
  description: string;
  requested_reference: string;
  requested_brand: string;
  accepted_brands: string;
  observacao?: string;
}


interface Status {
  portalOrigin: string;
  applicationId: string;
  suppliers: SupplierInfo[];
  units?: Record<string, string>;
  submissions: { externalId: string; quotationId?: string; state: string }[];
  drafts: { id: string; supplierExternalId: string; destinationId: string; state: string; items: Record<string, string>[] }[];
}


export function EnviarCotacaoHub({ itens, filialId }: { itens: readonly LinhaCockpitMatriz[]; filialId: number }) {
  const [status, setStatus] = useState<Status | null>(null);
  // Marca/referência dos itens vêm da própria grade; a resolução traz só as
  // MARCAS SIMILARES CADASTRADAS para os chips de marcas aceitas.
  const [produtosResolvidos, setProdutosResolvidos] = useState<Map<string, ProdutoResolvido> | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [supplierEmails, setSupplierEmails] = useState<Record<string, string>>({});
  const [searchFilter, setSearchFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [edicoes, setEdicoes] = useState<Record<number, ItemEdicaoState>>({});
  const [itemEmEdicao, setItemEmEdicao] = useState<number | null>(null);
  const [observacoesGerais, setObservacoesGerais] = useState("");
  const attempt = useRef<{ fingerprint: string; externalId: string; deadline: string }>();

  const toggleMarcaAlternativa = (produtoId: number, marca: string) => {
    setEdicoes(prev => {
      const ed = prev[produtoId];
      const list = parseMarcasAceitas(ed?.accepted_brands);
      const jaTem = list.some(m => m.toLowerCase() === marca.toLowerCase());
      const novaLista = jaTem
        ? list.filter(m => m.toLowerCase() !== marca.toLowerCase())
        : [...list, marca];
      return {
        ...prev,
        [produtoId]: {
          ...(ed ?? {
            quantidade: 1,
            description: "",
            requested_reference: "",
            requested_brand: "",
            accepted_brands: "",
          }),
          accepted_brands: novaLista.join(", "),
        },
      };
    });
  };

  const load = async () => {
    const response = await fetch("/api/cotacao-hub", { cache: "no-store" });
    if (!response.ok) throw new Error("Conexão indisponível neste ambiente.");
    const value: Status = await response.json();
    setStatus(value);
    return value;
  };

  useEffect(() => {
    let active = true;
    fetch("/api/cotacao-hub", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(value => {
        if (active && value) setStatus(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Extrai itens elegíveis com quantidade efetiva (sem converter 0 para 1)
  const valid = useMemo(() => {
    return itens
      .map(i => {
        const temCustom = Number.isSafeInteger(i.pedidoCustom) && i.pedidoCustom !== null && i.pedidoCustom !== undefined;
        const temSugestao = Number.isSafeInteger(i.sugestaoFinalCompra) && i.sugestaoFinalCompra !== null && i.sugestaoFinalCompra !== undefined;
        const qtd = temCustom
          ? Math.max(0, i.pedidoCustom)
          : temSugestao
            ? Math.max(0, i.sugestaoFinalCompra)
            : 0;
        return { item: i, quantidadeOriginal: qtd };
      })
      .filter(x => x.quantidadeOriginal > 0);
  }, [itens]);

  // Marcas aceitas: apenas as com similar CADASTRADO para cada item —
  // resolvidas na fonte por recorte (leve), não o catálogo inteiro.
  useEffect(() => {
    let ativo = true;
    const codigos = [
      ...new Set(
        valid
          .map(({ item }) => normalizarCodigoBase(item.produtoId || item.codigoSku))
          .filter((codigo) => codigo.length > 0),
      ),
    ].slice(0, 300);
    if (codigos.length === 0) {
      setProdutosResolvidos(new Map());
      return;
    }
    fetch("/api/cotacao-hub/resolver-produtos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigos }),
    })
      .then(async (resposta) => {
        const corpo = await resposta.json().catch(() => null);
        if (!resposta.ok) throw new Error(corpo?.erro ?? "Falha na resolução");
        return corpo as { produtos: ProdutoResolvido[] };
      })
      .then((corpo) => {
        if (!ativo) return;
        const mapa = new Map<string, ProdutoResolvido>();
        for (const produto of corpo.produtos ?? []) mapa.set(produto.codigo, produto);
        setProdutosResolvidos(mapa);
      })
      .catch(() => {
        // Chips são sugestão: sem resolução, o campo manual continua válido.
        if (ativo) setProdutosResolvidos(new Map());
      });
    return () => {
      ativo = false;
    };
  }, [valid]);

  // Sincroniza edições com os dados reais dos itens quando a lista mudar
  useEffect(() => {
    setEdicoes(prev => {
      const next = { ...prev };
      for (const { item, quantidadeOriginal } of valid) {
        if (!next[item.produtoId]) {
          next[item.produtoId] = {
            quantidade: quantidadeOriginal,
            description: item.descricao || "",
            requested_reference: item.referenciaFabricante || "",
            requested_brand: item.marca || "",
            accepted_brands: "",
          };
        }
      }
      return next;
    });
  }, [valid]);

  // Fornecedores vinculados diretamente aos itens selecionados (mapa por item)
  const fornecedoresPorItem = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const { item } of valid) {
      if (item.nomeFornecedor && !item.nomeFornecedor.includes("Sem Fornecedor Registrado")) {
        const id = String(item.fornecedorId ?? `item-${item.produtoId}`);
        map.set(id, { id, name: item.nomeFornecedor });
      }
    }
    return Array.from(map.values());
  }, [valid]);

  // Lista unificada de fornecedores
  const todosFornecedores = useMemo(() => {
    const map = new Map<string, { id: string; name: string; emailOrigem?: string; doItem?: boolean }>();

    // Primeiro insere os fornecedores dos itens com prioridade máxima de nome
    for (const f of fornecedoresPorItem) {
      // Tenta achar match de e-mail na lista do Power BI
      let emailOrigem: string | undefined;
      let matchedId = f.id;
      if (status?.suppliers) {
        const match = status.suppliers.find(s => {
          if (s.id === f.id || Number(s.id) === Number(f.id)) return true;
          if (s.name && f.name && (s.name.toLowerCase().includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(s.name.toLowerCase()))) return true;
          return false;
        });
        if (match) {
          emailOrigem = match.email;
          matchedId = match.id;
        }
      }
      map.set(matchedId, {
        id: matchedId,
        name: f.name,
        emailOrigem,
        doItem: true,
      });
    }

    // Depois adiciona os demais fornecedores do Power BI / config
    if (status?.suppliers) {
      for (const s of status.suppliers) {
        if (!map.has(s.id)) {
          map.set(s.id, {
            id: s.id,
            name: nomeExibicaoFornecedor(s),
            emailOrigem: s.email,
            doItem: false,
          });
        }
      }
    }

    return Array.from(map.values());
  }, [status, fornecedoresPorItem]);

  // Atualiza os e-mails e seleção inicial quando novos fornecedores são carregados
  useEffect(() => {
    if (todosFornecedores.length > 0) {
      setSupplierEmails(prev => {
        const next = { ...prev };
        for (const f of todosFornecedores) {
          if (!next[f.id] && f.emailOrigem) {
            next[f.id] = f.emailOrigem;
          }
        }
        return next;
      });

      if (selectedSuppliers.length === 0) {
        // Pré-seleciona APENAS os fornecedores vinculados aos itens selecionados!
        const dosItens = todosFornecedores.filter(f => f.doItem).map(f => f.id);
        if (dosItens.length > 0) {
          setSelectedSuppliers(dosItens);
        } else {
          // Se nenhum item tiver fornecedor específico, seleciona apenas o primeiro disponível
          const primeiro = todosFornecedores[0]?.id;
          if (primeiro) setSelectedSuppliers([primeiro]);
        }
      }
    }
  }, [todosFornecedores, selectedSuppliers.length]);

  // Fornecedores dos itens selecionados vs outros fornecedores
  const fornecedoresDosItens = useMemo(() => todosFornecedores.filter(f => f.doItem), [todosFornecedores]);
  const outrosFornecedores = useMemo(() => {
    const list = todosFornecedores.filter(f => !f.doItem);
    if (!searchFilter.trim()) return list;
    const term = searchFilter.toLowerCase().trim();
    return list.filter(f => f.name.toLowerCase().includes(term) || (supplierEmails[f.id] ?? "").toLowerCase().includes(term));
  }, [todosFornecedores, searchFilter, supplierEmails]);

  // Checagem de validação de e-mails para os fornecedores selecionados
  const fornecedoresFaltandoEmail = useMemo(() => {
    return selectedSuppliers
      .map(id => todosFornecedores.find(f => f.id === id))
      .filter((f): f is { id: string; name: string; emailOrigem?: string; doItem?: boolean } => {
        if (!f) return false;
        const email = (supplierEmails[f.id] || "").trim();
        return !email || !email.includes("@");
      });
  }, [selectedSuppliers, todosFornecedores, supplierEmails]);

  const send = async () => {
    if (fornecedoresFaltandoEmail.length > 0) {
      setMessage(`Por favor, preencha o e-mail de: ${fornecedoresFaltandoEmail.map(f => f.name).join(", ")}`);
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const suppliersData = selectedSuppliers.map(id => {
        const s = todosFornecedores.find(f => f.id === id);
        return {
          id,
          name: s?.name || `Fornecedor ${id}`,
          email: (supplierEmails[id] || "").trim(),
        };
      });

      const itemsPayload = valid.map(x => {
        const ed = edicoes[x.item.produtoId] ?? {
          quantidade: x.quantidadeOriginal,
          description: x.item.descricao || "",
          requested_reference: x.item.referenciaFabricante || "",
          requested_brand: x.item.marca || "",
          accepted_brands: "",
        };

        const acceptedList = parseMarcasAceitas(ed.accepted_brands);

        const qtdEfetiva = Math.max(1, Number(ed.quantidade) || x.quantidadeOriginal);

        // Descrição permanece a descrição: a observação (item + condições
        // gerais) viaja no campo próprio source_snapshot.observacao.
        const descFinal = (ed.description || x.item.descricao || "").trim().slice(0, 500);
        const observacao = [
          observacoesGerais.trim() ? `Condições gerais: ${observacoesGerais.trim()}` : null,
          ed.observacao?.trim() || null,
        ]
          .filter(Boolean)
          .join(" | ")
          .slice(0, 2000);

        return {
          produtoId: x.item.produtoId,
          quantity: String(qtdEfetiva),
          ...(descFinal ? { description: descFinal } : {}),
          ...(ed.requested_reference.trim() ? { requested_reference: ed.requested_reference.trim() } : {}),
          ...(ed.requested_brand.trim() ? { requested_brand: ed.requested_brand.trim() } : {}),
          ...(acceptedList.length > 0 ? { accepted_brands: acceptedList } : {}),
          ...(observacao ? { observacao } : {}),
        };
      }).sort((a, b) => a.produtoId - b.produtoId);

      const selection = {
        filialId,
        supplierIds: [...selectedSuppliers].sort(),
        suppliersData,
        items: itemsPayload,
      };

      // Mesma tentativa mantém ID/prazo/corpo; qualquer edição muda o
      // fingerprint canônico e gera um novo externalId — a chave anterior
      // nunca é reutilizada silenciosamente com outro payload.
      const fingerprint = fingerprintSelecao(selection);
      if (attempt.current?.fingerprint !== fingerprint) {
        attempt.current = {
          fingerprint,
          externalId: crypto.randomUUID(),
          deadline: new Date(Date.now() + 24 * 3600_000).toISOString(),
        };
      }

      const response = await fetch("/api/cotacao-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...selection,
          externalId: attempt.current.externalId,
          deadline: attempt.current.deadline,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.erro || "O envio não foi concluído. Revise a conexão e tente novamente.");
      }

      await load();
      setMessage("✅ Cotação enviada com sucesso! Os fornecedores selecionados receberão os convites por e-mail com link e código de acesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha no envio da cotação.");
    } finally {
      setBusy(false);
    }
  };

  const renderCardFornecedor = (f: { id: string; name: string; emailOrigem?: string; doItem?: boolean }) => {
    const isSelected = selectedSuppliers.includes(f.id);
    const email = supplierEmails[f.id] ?? "";
    const emailPreenchido = email.trim().length > 0 && email.includes("@");

    return (
      <div
        key={f.id}
        className={`p-3 rounded-lg border transition-colors ${
          isSelected ? "border-blue-400 bg-blue-50/40 shadow-xs" : "border-slate-200 bg-slate-50/50 opacity-75"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={e =>
                setSelectedSuppliers(curr =>
                  e.target.checked ? [...curr, f.id] : curr.filter(id => id !== f.id)
                )
              }
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="font-semibold text-sm text-slate-900">
              {f.name}
            </span>
            {f.doItem && (
              <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                ⭐ Fornecedor do Item
              </span>
            )}
          </label>

          {f.emailOrigem && (
            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium">
              ✓ Power BI (AEMAIL)
            </span>
          )}
        </div>

        {isSelected && (
          <div className="mt-2.5 pl-6.5">
            <div className="flex items-center gap-2">
              <label htmlFor={`email-${f.id}`} className="text-xs text-slate-600 font-medium whitespace-nowrap">
                E-mail para cotação:
              </label>
              <input
                id={`email-${f.id}`}
                type="email"
                value={email}
                onChange={e => {
                  const val = e.target.value;
                  setSupplierEmails(prev => ({ ...prev, [f.id]: val }));
                }}
                placeholder="exemplo@fornecedor.com.br"
                className={`text-xs w-full px-2.5 py-1.5 rounded border ${
                  !emailPreenchido
                    ? "border-rose-300 bg-rose-50/30 text-rose-900 placeholder:text-rose-400"
                    : "border-slate-300 bg-white text-slate-900"
                } focus:outline-none focus:ring-1 focus:ring-blue-500`}
              />
            </div>
            {!emailPreenchido && (
              <p className="text-[11px] text-rose-600 mt-1">
                ⚠️ Preencha o e-mail deste fornecedor para enviar o convite.
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="text-slate-800">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!status) load().catch(() => {});
        }}
        className="rounded bg-white px-3 py-1.5 font-semibold text-slate-800 shadow-sm hover:bg-slate-100 transition-colors flex items-center gap-1.5"
        title="Enviar itens diretamente para cotação no Cotação Hub"
      >
        <span>✉️</span>
        <span>Enviar para cotação</span>
      </button>

      {open && (
        <section
          className="fixed inset-x-4 top-12 z-50 mx-auto max-w-3xl max-h-[90vh] overflow-auto rounded-xl bg-white p-5 shadow-2xl border border-slate-200"
          aria-label="Prévia da cotação"
        >
          <div className="flex justify-between items-center mb-4 border-b pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Disparo de Cotação — Cotação Hub</h2>
              <p className="text-xs text-slate-500">Envio de solicitações de cotação por e-mail com recebimento automático de propostas</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-slate-700 font-bold px-2 py-1 text-lg rounded hover:bg-slate-100"
            >
              ✕
            </button>
          </div>

          {!status ? (
            <div className="py-8 text-center">
              <div className="inline-block animate-spin text-2xl mb-2">🔄</div>
              <p className="text-slate-600 mb-3 font-medium">Carregando fornecedores e dados da conexão...</p>
              <button
                type="button"
                onClick={() => load().catch(e => setMessage(e instanceof Error ? e.message : "Falha ao conectar"))}
                className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm hover:bg-blue-700"
              >
                Tentar reconectar
              </button>
            </div>
          ) : (
            <>
              {/* Resumo dos Itens Selecionados com Edição */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-sm text-slate-800">
                    {valid.length} {valid.length === 1 ? "item selecionado" : "itens selecionados"} para a Loja {filialId}
                  </span>
                  <span className="text-xs text-slate-500">
                    Prazo de resposta: 24 horas
                  </span>
                </div>
                {valid.length === 0 ? (
                  <p className="text-xs text-rose-600 mt-1">
                    Nenhum item com quantidade de compra selecionado na tabela. Selecione itens ou ajuste as quantidades na grade do Cockpit.
                  </p>
                ) : (
                  <div className="mt-2 max-h-64 overflow-y-auto rounded border bg-white p-2 text-xs divide-y divide-slate-100 space-y-1">
                    {valid.map(({ item, quantidadeOriginal }) => {
                      const ed = edicoes[item.produtoId] ?? {
                        quantidade: quantidadeOriginal,
                        description: item.descricao || "",
                        requested_reference: item.referenciaFabricante || "",
                        requested_brand: item.marca || "",
                        accepted_brands: "",
                      };
                      const unidade = status?.units?.[String(item.produtoId)] || status?.units?.["default"] || "UN";
                      const isEditing = itemEmEdicao === item.produtoId;

                      const marcaExibida = ed.requested_brand || item.marca || "";
                      const refExibida = ed.requested_reference || item.referenciaFabricante || "";

                      return (
                        <div key={item.produtoId} className="p-2.5 bg-white space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-slate-900 font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[11px] border border-slate-200">
                                  {item.codigoSku}
                                </span>
                                <span className="font-semibold text-slate-800">{ed.description || item.descricao}</span>
                                {item.nomeFornecedor && (
                                  <span className="text-blue-700 font-medium text-[11px]">({item.nomeFornecedor})</span>
                                )}
                              </div>

                              {/* Badges de Atributos em Destaque */}
                              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                {marcaExibida ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                                    🏷️ Marca: <strong>{marcaExibida}</strong>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                    ⚠️ Marca não informada
                                  </span>
                                )}

                                {refExibida ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-300">
                                    🔢 Ref: <strong>{refExibida}</strong>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                    ⚠️ Ref. não informada
                                  </span>
                                )}

                                {ed.accepted_brands && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-800 border border-purple-200">
                                    ✅ Aceita: <strong>{ed.accepted_brands}</strong>
                                  </span>
                                )}

                                {ed.observacao && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    💬 Obs: <strong>{ed.observacao}</strong>
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-bold text-blue-700 whitespace-nowrap bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-xs">
                                {ed.quantidade} {unidade}
                              </span>
                              <button
                                type="button"
                                onClick={() => setItemEmEdicao(isEditing ? null : item.produtoId)}
                                className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                                  isEditing
                                    ? "bg-slate-200 text-slate-800 hover:bg-slate-300"
                                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-xs"
                                }`}
                                title={isEditing ? "Fechar edição" : "Editar item para cotação"}
                              >
                                {isEditing ? "✕ Fechar" : "✏️ Ajustar Marca / Ref."}
                              </button>
                            </div>
                          </div>

                          {isEditing && (
                            <div className="mt-2.5 p-3 bg-blue-50/40 rounded-lg border border-blue-200 space-y-3 text-xs">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                    Marca Solicitada (Preferencial)
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Ex: Gates, Bosch, Dayco..."
                                    value={ed.requested_brand}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setEdicoes(prev => ({
                                        ...prev,
                                        [item.produtoId]: { ...prev[item.produtoId], requested_brand: val },
                                      }));
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                    Referência do Fabricante / Código de Fábrica
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Ex: K015433XS, 10098, CT488..."
                                    value={ed.requested_reference}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setEdicoes(prev => ({
                                        ...prev,
                                        [item.produtoId]: { ...prev[item.produtoId], requested_reference: val },
                                      }));
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                              </div>

                              {/* Seleção rápida de marcas alternativas aceitas */}
                              <div className="rounded-md border border-slate-200 bg-white p-2.5 space-y-1.5">
                                <label className="block text-[11px] font-semibold text-slate-700">
                                  Marcas aceitas com similar cadastrado (clique para marcar ou desmarcar):
                                </label>
                                {(() => {
                                  const sugestoes = marcasAceitasSugeridas(
                                    produtosResolvidos?.get(normalizarCodigoBase(item.produtoId)),
                                    ed.requested_brand,
                                  );
                                  if (sugestoes.length === 0) {
                                    return (
                                      <p className="text-[11px] text-slate-500">
                                        Nenhuma marca similar cadastrada para este item — digite manualmente apenas se
                                        aceitar outra marca por decisão própria.
                                      </p>
                                    );
                                  }
                                  return (
                                    <div className="flex flex-wrap gap-1.5">
                                      {sugestoes.map((marca) => {
                                        const list = parseMarcasAceitas(ed.accepted_brands).map((s) => s.toLowerCase());
                                        const selecionada = list.includes(marca.toLowerCase());
                                        return (
                                          <button
                                            key={marca}
                                            type="button"
                                            onClick={() => toggleMarcaAlternativa(item.produtoId, marca)}
                                            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                                              selecionada
                                                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                                : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                                            }`}
                                          >
                                            {selecionada ? `✓ ${marca}` : `+ ${marca}`}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                                <input
                                  type="text"
                                  placeholder="Outras marcas alternativas (separadas por vírgula)..."
                                  value={ed.accepted_brands}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setEdicoes(prev => ({
                                      ...prev,
                                      [item.produtoId]: { ...prev[item.produtoId], accepted_brands: val },
                                    }));
                                  }}
                                  className="w-full px-2.5 py-1 rounded border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>

                              {/* Observação comercial do item */}
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  Observação Comercial do Item
                                </label>
                                <input
                                  type="text"
                                  placeholder="Ex: Produto de primeira linha, embalagem original de fábrica..."
                                  value={ed.observacao || ""}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setEdicoes(prev => ({
                                      ...prev,
                                      [item.produtoId]: { ...prev[item.produtoId], observacao: val },
                                    }));
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-blue-200/60">
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Descrição na cotação</label>
                                  <input
                                    type="text"
                                    value={ed.description}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setEdicoes(prev => ({
                                        ...prev,
                                        [item.produtoId]: { ...prev[item.produtoId], description: val },
                                      }));
                                    }}
                                    className="w-full px-2 py-1 rounded border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Quantidade ({unidade})</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={ed.quantidade}
                                    onChange={e => {
                                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                      setEdicoes(prev => ({
                                        ...prev,
                                        [item.produtoId]: { ...prev[item.produtoId], quantidade: val },
                                      }));
                                    }}
                                    className="w-full px-2 py-1 rounded border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Observações Gerais da Cotação */}
              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 space-y-1.5 shadow-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    📝 Observações Gerais da Cotação (opcional)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Instruções comerciais para os fornecedores: condições de pagamento, prazo de entrega ou faturamento.
                </p>
                <textarea
                  rows={2}
                  value={observacoesGerais}
                  onChange={e => setObservacoesGerais(e.target.value)}
                  placeholder="Ex: Faturamento 28/35/42 ddl. Frete CIF. Entregas até as 17h."
                  className="w-full text-xs p-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900"
                />
              </div>

              {/* Seção 1: Fornecedores dos Itens */}
              {fornecedoresDosItens.length > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1.5">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Fornecedor(es) dos Produtos Selecionados
                    </h3>
                    <span className="text-xs text-slate-500">
                      {fornecedoresDosItens.filter(f => selectedSuppliers.includes(f.id)).length} de {fornecedoresDosItens.length} marcado(s)
                    </span>
                  </div>
                  <div className="space-y-2">
                    {fornecedoresDosItens.map(f => renderCardFornecedor(f))}
                  </div>
                </div>
              )}

              {/* Seção 2: Demais fornecedores cadastrados da conexão (white-label: rótulos vêm do tenant) */}
              <div className="mb-4 rounded-lg border border-slate-200 p-3 bg-white">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Outros Fornecedores Cadastrados ({selectedSuppliers.length} marcados no total)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Adicione outras distribuidoras para disputar a cotação e buscar menores preços.
                    </p>
                  </div>
                  <div className="text-xs space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSuppliers([])}
                      className="text-slate-500 hover:underline"
                    >
                      Limpar seleção
                    </button>
                  </div>
                </div>

                <div className="mb-2">
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    placeholder="🔍 Buscar fornecedor por nome ou e-mail..."
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {outrosFornecedores.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2 text-center">Nenhum fornecedor encontrado no filtro.</p>
                  ) : (
                    outrosFornecedores.map(f => renderCardFornecedor(f))
                  )}
                </div>
              </div>

              {/* Aviso claro sobre e-mails pendentes */}
              {fornecedoresFaltandoEmail.length > 0 && (
                <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 flex items-center justify-between gap-2 shadow-xs">
                  <div>
                    <strong>Atenção:</strong> {fornecedoresFaltandoEmail.length} fornecedor(es) selecionado(s) não possui(em) e-mail informado:{" "}
                    <span className="font-semibold">{fornecedoresFaltandoEmail.map(f => f.name).join(", ")}</span>.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const idsFaltando = new Set(fornecedoresFaltandoEmail.map(f => f.id));
                      setSelectedSuppliers(prev => prev.filter(id => !idsFaltando.has(id)));
                    }}
                    className="shrink-0 rounded bg-amber-200 px-2 py-1 text-[11px] font-bold text-amber-950 hover:bg-amber-300 transition-colors"
                  >
                    ⚡ Desmarcar sem e-mail
                  </button>
                </div>
              )}

              {/* Ações */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || !valid.length || !selectedSuppliers.length || fornecedoresFaltandoEmail.length > 0}
                    onClick={send}
                    title={
                      fornecedoresFaltandoEmail.length > 0
                        ? `Preencha o e-mail de: ${fornecedoresFaltandoEmail.map(f => f.name).join(", ")}`
                        : !selectedSuppliers.length
                        ? "Selecione ao menos um fornecedor"
                        : !valid.length
                        ? "Nenhum item com quantidade selecionado"
                        : "Confirmar envio da cotação"
                    }
                    className="rounded bg-blue-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
                  >
                    {busy ? (
                      <>
                        <span className="inline-block animate-spin">🔄</span>
                        <span>Disparando cotação…</span>
                      </>
                    ) : (
                      <>
                        <span>✉️</span>
                        <span>Confirmar e enviar cotação ({selectedSuppliers.length})</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => load().catch(() => setMessage("Não foi possível atualizar o retorno."))}
                    className="rounded border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Atualizar status
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800"
                >
                  Fechar
                </button>
              </div>
            </>
          )}

          {message && (
            <div
              role="status"
              className={`mt-4 p-3 rounded-lg text-sm font-medium border ${
                message.startsWith("✅")
                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                  : "bg-rose-50 text-rose-900 border-rose-200"
              }`}
            >
              {message}
            </div>
          )}

          {/* Histórico de Cotações Enviadas */}
          {status && status.submissions.length > 0 && (
            <div className="mt-5 border-t pt-3">
              <h3 className="font-semibold text-sm text-slate-800 mb-1">Cotações enviadas recentemente</h3>
              <ul className="text-xs text-slate-600 space-y-1">
                {status.submissions.map(s => (
                  <li key={s.externalId} className="flex items-center gap-1.5 flex-wrap">
                    <span>{s.state === "sent" ? "✅ Enviada" : "⏳ Pendente"}</span>
                    <span>—</span>
                    <span className="font-mono text-slate-700">{s.quotationId || s.externalId}</span>
                    {s.quotationId && (
                      <AbrirNoHub
                        portalOrigin={status.portalOrigin}
                        applicationId={status.applicationId}
                        quotationId={s.quotationId}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Rascunhos de Menores Preços */}
          {status && status.drafts.filter(d => d.state === "review").length > 0 && (
            <div className="mt-5 border-t pt-3">
              <h3 className="font-semibold text-sm text-slate-800 mb-2">Propostas Vencedoras (Menores Preços)</h3>
              {status.drafts
                .filter(d => d.state === "review")
                .map(d => (
                  <article key={d.id} className="my-2 border rounded-lg p-3 text-xs bg-emerald-50/50 border-emerald-200">
                    <h4 className="font-bold text-emerald-900">
                      Fornecedor {d.supplierExternalId} · Filial {d.destinationId}
                    </h4>
                    <ul className="my-1.5 divide-y divide-emerald-100">
                      {d.items.map((i: any) => (
                        <li key={i.external_id} className="py-1 flex justify-between">
                          <span>{i.description}</span>
                          <span className="font-semibold text-emerald-800">
                            {i.acquisition_quantity} {i.requested_unit} · R$ {i.unit_price}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-emerald-700 text-[11px] mt-1">
                      Propostas computadas pelo Cotação Hub prontas para emissão no ERP.
                    </p>
                  </article>
                ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

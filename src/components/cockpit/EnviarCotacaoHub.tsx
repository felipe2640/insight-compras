"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LinhaCockpitMatriz } from "@/tipos/cockpit";

interface SupplierInfo {
  id: string;
  name: string;
  email?: string;
}

interface Status {
  portalOrigin: string;
  applicationId: string;
  suppliers: SupplierInfo[];
  submissions: { externalId: string; quotationId?: string; state: string }[];
  drafts: { id: string; supplierExternalId: string; destinationId: string; state: string; items: Record<string, string>[] }[];
}

export function EnviarCotacaoHub({ itens, filialId }: { itens: readonly LinhaCockpitMatriz[]; filialId: number }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [supplierEmails, setSupplierEmails] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const attempt = useRef<{ fingerprint: string; externalId: string; deadline: string }>();

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

  // Extrai itens elegíveis com quantidade efetiva
  const valid = useMemo(() => {
    return itens
      .map(i => {
        const qtd = (Number.isSafeInteger(i.pedidoCustom) && i.pedidoCustom > 0)
          ? i.pedidoCustom
          : (Number.isSafeInteger(i.sugestaoFinalCompra) && i.sugestaoFinalCompra > 0)
            ? i.sugestaoFinalCompra
            : (itens.length <= 50 ? 1 : 0);
        return { item: i, quantidade: qtd };
      })
      .filter(x => x.quantidade > 0);
  }, [itens]);

  // Fornecedores vinculados aos itens selecionados
  const fornecedoresDosItens = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const { item } of valid) {
      if (item.fornecedorId) {
        const id = String(item.fornecedorId);
        map.set(id, { id, name: item.nomeFornecedor || `Fornecedor ${id}` });
      }
    }
    return Array.from(map.values());
  }, [valid]);

  // Lista unificada de fornecedores
  const todosFornecedores = useMemo(() => {
    const map = new Map<string, { id: string; name: string; emailOrigem?: string; doItem?: boolean }>();
    if (status?.suppliers) {
      for (const s of status.suppliers) {
        map.set(s.id, { id: s.id, name: s.name, emailOrigem: s.email });
      }
    }
    for (const f of fornecedoresDosItens) {
      const existing = map.get(f.id);
      if (existing) {
        map.set(f.id, { ...existing, doItem: true });
      } else {
        map.set(f.id, { id: f.id, name: f.name, doItem: true });
      }
    }
    return Array.from(map.values());
  }, [status, fornecedoresDosItens]);

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
        // Se houver fornecedores associados aos itens, pré-seleciona eles; senão todos
        const dosItens = todosFornecedores.filter(f => f.doItem).map(f => f.id);
        if (dosItens.length > 0) {
          setSelectedSuppliers(dosItens);
        } else {
          setSelectedSuppliers(todosFornecedores.map(f => f.id));
        }
      }
    }
  }, [todosFornecedores, selectedSuppliers.length]);

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

      const selection = {
        filialId,
        supplierIds: [...selectedSuppliers].sort(),
        suppliersData,
        items: valid
          .map(x => ({ produtoId: x.item.produtoId, quantity: String(x.quantidade) }))
          .sort((a, b) => a.produtoId - b.produtoId),
      };

      const fingerprint = JSON.stringify(selection);
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
          className="fixed inset-x-4 top-14 z-50 mx-auto max-w-3xl max-h-[88vh] overflow-auto rounded-xl bg-white p-5 shadow-2xl border border-slate-200"
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
              <p className="text-slate-600 mb-3 font-medium">Conectando ao Cotação Hub e consultando cadastro...</p>
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
              {/* Resumo dos Itens */}
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
                  <div className="mt-2 max-h-36 overflow-y-auto rounded border bg-white p-2 text-xs divide-y divide-slate-100">
                    {valid.map(({ item, quantidade }) => (
                      <div key={item.produtoId} className="py-1 flex justify-between items-center">
                        <span className="truncate pr-2">
                          <strong className="text-slate-900">{item.codigoSku}</strong> — {item.descricao}
                          {item.nomeFornecedor && <span className="text-slate-400 text-[11px] ml-1">({item.nomeFornecedor})</span>}
                        </span>
                        <span className="font-bold text-blue-700 whitespace-nowrap">{quantidade} un</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de Fornecedores e E-mails */}
              <fieldset className="my-4 rounded-lg border border-slate-200 p-3 bg-white">
                <div className="flex justify-between items-center mb-2">
                  <legend className="px-1 text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Fornecedores e E-mails para Envio ({selectedSuppliers.length} selecionados)
                  </legend>
                  <div className="text-xs space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSuppliers(todosFornecedores.map(f => f.id))}
                      className="text-blue-600 hover:underline"
                    >
                      Marcar todos
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSuppliers([])}
                      className="text-slate-500 hover:underline"
                    >
                      Desmarcar todos
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mb-3">
                  Os convites de cotação com links seguros serão disparados para os endereços abaixo. Você pode editar ou preencher o e-mail caso necessário.
                </p>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {todosFornecedores.map(f => {
                    const isSelected = selectedSuppliers.includes(f.id);
                    const email = supplierEmails[f.id] ?? "";
                    const emailPreenchido = email.trim().length > 0 && email.includes("@");

                    return (
                      <div
                        key={f.id}
                        className={`p-2.5 rounded border transition-colors ${
                          isSelected ? "border-blue-300 bg-blue-50/30" : "border-slate-200 bg-slate-50/50 opacity-70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={e =>
                                setSelectedSuppliers(curr =>
                                  e.target.checked ? [...curr, f.id] : curr.filter(id => id !== f.id)
                                )
                              }
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-medium text-sm text-slate-800">
                              {f.name}
                            </span>
                            {f.doItem && (
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                                Do item
                              </span>
                            )}
                          </label>

                          {f.emailOrigem && (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                              ✓ Power BI (AEMAIL)
                            </span>
                          )}
                        </div>

                        {isSelected && (
                          <div className="mt-2 pl-6">
                            <div className="flex items-center gap-2">
                              <label htmlFor={`email-${f.id}`} className="text-xs text-slate-600 font-medium whitespace-nowrap">
                                E-mail:
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
                                ⚠️ E-mail obrigatório para o envio do convite.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              {/* Ações */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || !valid.length || !selectedSuppliers.length || fornecedoresFaltandoEmail.length > 0}
                    onClick={send}
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
                        <span>Confirmar e enviar cotação</span>
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
                  <li key={s.externalId} className="flex items-center gap-1.5">
                    <span>{s.state === "sent" ? "✅ Enviada" : "⏳ Pendente"}</span>
                    <span>—</span>
                    <span className="font-mono text-slate-700">{s.quotationId || s.externalId}</span>
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

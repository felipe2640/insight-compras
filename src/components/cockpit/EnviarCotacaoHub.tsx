"use client";
import { useEffect, useRef, useState } from "react";
import type { LinhaCockpitMatriz } from "@/tipos/cockpit";

interface Status {
  portalOrigin: string; applicationId: string; suppliers: { id: string; name: string }[];
  submissions: { externalId: string; quotationId?: string; state: string }[];
  drafts: { id: string; supplierExternalId: string; destinationId: string; state: string; items: Record<string, string>[] }[];
}
export function EnviarCotacaoHub({ itens, filialId }: { itens: readonly LinhaCockpitMatriz[]; filialId: number }) {
  const [status, setStatus] = useState<Status | null>(null), [open, setOpen] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const attempt = useRef<{ fingerprint: string; externalId: string; deadline: string }>();
  const load = async () => {
    const response = await fetch("/api/cotacao-hub", { cache: "no-store" });
    if (!response.ok) throw new Error("Conexão indisponível neste ambiente.");
    const value: Status = await response.json(); setStatus(value); return value;
  };
  useEffect(() => { let active = true; fetch("/api/cotacao-hub", { cache: "no-store" })
    .then(r => r.ok ? r.json() : null).then(value => { if (active) setStatus(value); }).catch(() => {});
    return () => { active = false; }; }, []);
  useEffect(() => {
    if (status?.suppliers && status.suppliers.length > 0 && selectedSuppliers.length === 0) {
      setSelectedSuppliers(status.suppliers.map(s => s.id));
    }
  }, [status]);

  const valid = itens.filter(i => Number.isSafeInteger(i.pedidoCustom) && i.pedidoCustom > 0);
  const send = async () => {
    setBusy(true); setMessage("");
    try {
      const selection = { filialId, supplierIds: [...selectedSuppliers].sort(),
        items: valid.map(i => ({ produtoId: i.produtoId, quantity: String(i.pedidoCustom) })).sort((a,b) => a.produtoId - b.produtoId) };
      const fingerprint = JSON.stringify(selection);
      if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint,
        externalId: crypto.randomUUID(), deadline: new Date(Date.now() + 24 * 3600_000).toISOString() };
      const response = await fetch("/api/cotacao-hub", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...selection, externalId: attempt.current.externalId, deadline: attempt.current.deadline }) });
      if (!response.ok) throw new Error("O envio não foi concluído. Revise a conexão e tente novamente; o mesmo envio será retomado.");
      await load(); setMessage("Cotação enviada com sucesso! Os fornecedores selecionados receberão os convites por e-mail.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha no envio."); }
    finally { setBusy(false); }
  };
  return <div className="text-slate-800">
    <button type="button" onClick={() => { setOpen(!open); if (!status) load().catch(() => {}); }}
      className="rounded bg-white px-3 py-1.5 font-semibold text-slate-800 shadow-sm hover:bg-slate-100 transition-colors"
      title="Enviar a seleção diretamente para cotação">
      Enviar para cotação
    </button>
    {open && <section className="fixed inset-x-4 top-16 z-50 mx-auto max-w-3xl max-h-[85vh] overflow-auto rounded-xl bg-white p-5 shadow-2xl border border-slate-200" aria-label="Prévia da cotação">
      <div className="flex justify-between items-center mb-4 border-b pb-3">
        <h2 className="text-lg font-bold text-slate-900">Conferir envio para cotação</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-700 font-bold px-2 py-1">✕</button>
      </div>

      {!status ? (
        <div className="py-6 text-center">
          <p className="text-slate-600 mb-3">Conectando ao Cotação Hub...</p>
          <button type="button" onClick={() => load().catch(e => setMessage(e instanceof Error ? e.message : "Falha ao conectar"))} className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm">Tentar reconectar</button>
        </div>
      ) : (
        <>
          <p className="font-medium text-slate-700">{valid.length} {valid.length === 1 ? "item selecionado" : "itens selecionados"} para a loja {filialId}.</p>
          {valid.length !== itens.length && <p className="text-xs text-amber-700 mt-1">Itens sem quantidade de pedido foram excluídos. Apenas compras efetivas serão enviadas.</p>}
          
          <div className="my-3 max-h-40 overflow-y-auto rounded border bg-slate-50 p-2 text-xs">
            <ul>{valid.map(i => <li key={i.produtoId} className="py-0.5 border-b border-slate-100 last:border-0">{i.codigoSku} — {i.descricao}: <strong className="text-blue-700">{i.pedidoCustom} un</strong></li>)}</ul>
          </div>

          <fieldset className="my-4 rounded border p-3">
            <legend className="px-1 text-xs font-semibold text-slate-700 uppercase">Fornecedores convidados para cotar</legend>
            <div className="space-y-1.5 mt-1">
              {status.suppliers.map(s => <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer" key={s.id}>
                <input type="checkbox" checked={selectedSuppliers.includes(s.id)} onChange={e => setSelectedSuppliers(current => e.target.checked ? [...current,s.id] : current.filter(id => id !== s.id))} />
                <span>{s.name}</span>
              </label>)}
            </div>
          </fieldset>

          <div className="flex items-center gap-2 pt-2 border-t">
            <button type="button" disabled={busy || !valid.length || !selectedSuppliers.length} onClick={send} className="rounded bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50 hover:bg-blue-800 transition-colors">
              {busy ? "Enviando cotação…" : "Confirmar envio para cotação"}
            </button>
            <button type="button" onClick={() => load().catch(() => setMessage("Não foi possível atualizar o retorno."))} className="rounded border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Atualizar status
            </button>
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
              Fechar
            </button>
          </div>
        </>
      )}

      {message && <p role="status" className="mt-3 p-2 rounded bg-slate-100 text-sm font-medium text-slate-800">{message}</p>}

      {status && status.submissions.length > 0 && (
        <div className="mt-5 border-t pt-3">
          <h3 className="font-semibold text-sm text-slate-800 mb-1">Cotações enviadas</h3>
          <ul className="text-xs text-slate-600 space-y-1">
            {status.submissions.map(s => <li key={s.externalId}>{s.state === "sent" ? "✅ Enviada" : "⏳ Pendente"} — {s.quotationId || s.externalId}</li>)}
          </ul>
        </div>
      )}

      {status && status.drafts.filter(d => d.state === "review").length > 0 && (
        <div className="mt-5 border-t pt-3">
          <h3 className="font-semibold text-sm text-slate-800 mb-2">Rascunhos com menores preços aprovados</h3>
          {status.drafts.filter(d => d.state === "review").map(d => <article key={d.id} className="my-2 border rounded p-2 text-xs bg-emerald-50/50 border-emerald-200">
            <h4 className="font-bold text-emerald-900">Fornecedor {d.supplierExternalId} · destino {d.destinationId}</h4>
            <ul className="my-1">{d.items.map(i => <li key={i.external_id}>{i.description}: {i.acquisition_quantity} {i.requested_unit} · <strong>R$ {i.unit_price}</strong></li>)}</ul>
            <p className="text-emerald-700">Confira as condições antes de emitir o pedido no ERP.</p>
          </article>)}
        </div>
      )}
    </section>}
  </div>;
}

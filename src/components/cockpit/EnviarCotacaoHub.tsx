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
      await load(); setMessage("Cotação enviada. Os fornecedores receberão os convites.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha no envio."); }
    finally { setBusy(false); }
  };
  return <div className="text-slate-800">
    <button type="button" onClick={() => setOpen(!open)} disabled={!status}
      className="rounded bg-white px-3 py-1.5 font-semibold disabled:opacity-50"
      title={status ? "Enviar a seleção diretamente para cotação" : "Conexão indisponível neste ambiente"}>Enviar para cotação</button>
    {open && status && <section className="fixed inset-x-4 top-16 z-50 mx-auto max-w-3xl max-h-[85vh] overflow-auto rounded-xl bg-white p-5 shadow-xl" aria-label="Prévia da cotação">
      <h2 className="font-bold">Conferir envio para cotação</h2>
      <p>{valid.length} itens selecionados para a loja {filialId}.</p>
      {valid.length !== itens.length && <p>Itens com quantidade zero ou inválida foram excluídos. Transferências não serão enviadas.</p>}
      <ul>{valid.map(i => <li key={i.produtoId}>{i.codigoSku} — {i.descricao}: {i.pedidoCustom}</li>)}</ul>
      <fieldset><legend>Fornecedores convidados</legend>{status.suppliers.map(s => <label className="block" key={s.id}>
        <input type="checkbox" checked={selectedSuppliers.includes(s.id)} onChange={e => setSelectedSuppliers(current => e.target.checked ? [...current,s.id] : current.filter(id => id !== s.id))} /> {s.name}
      </label>)}</fieldset>
      <button type="button" disabled={busy || !valid.length || !selectedSuppliers.length} onClick={send} className="rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50">{busy ? "Enviando…" : "Confirmar envio"}</button>
      <button type="button" onClick={() => load().catch(() => setMessage("Não foi possível atualizar o retorno."))} className="px-3 py-2">Atualizar respostas</button>
      <button type="button" onClick={() => setOpen(false)} className="px-3 py-2">Fechar</button>
      <p role="status">{message}</p>
      <h3 className="font-semibold">Cotações enviadas</h3>
      <ul>{status.submissions.map(s => <li key={s.externalId}>{s.state === "sent" ? "Enviada" : "Envio pendente"} — {s.quotationId || s.externalId}</li>)}</ul>
      <h3 className="font-semibold">Rascunhos para compra</h3>
      {status.drafts.filter(d => d.state === "review").map(d => <article key={d.id} className="my-2 border p-2">
        <h4>Fornecedor {d.supplierExternalId} · destino {d.destinationId}</h4>
        <ul>{d.items.map(i => <li key={i.external_id}>{i.description}: {i.acquisition_quantity} {i.requested_unit} · R$ {i.unit_price}</li>)}</ul>
        <p>Confira as condições da decisão antes de enviar o pedido.</p>
      </article>)}
    </section>}
  </div>;
}

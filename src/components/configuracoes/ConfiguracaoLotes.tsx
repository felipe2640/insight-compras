"use client";

import React, { useEffect, useState } from "react";
import type { ConfiguracaoLotesTenant } from "@config/tenants/tipos";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

export function ConfiguracaoLotes({ padrao }: { readonly padrao: ConfiguracaoLotesTenant }) {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoLotesTenant>(padrao);
  const [podeEditar, setPodeEditar] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sku, setSku] = useState("");
  const [multiplo, setMultiplo] = useState(1);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/configuracoes/lotes")
      .then(async (r) => {
        if (!r.ok) throw new Error("Não foi possível carregar a configuração.");
        return r.json() as Promise<{ configuracao: ConfiguracaoLotesTenant; podeEditar: boolean }>;
      })
      .then((r) => { setConfiguracao(r.configuracao); setPodeEditar(r.podeEditar); })
      .catch((e: unknown) => setMensagem(e instanceof Error ? e.message : "Falha ao carregar."))
      .finally(() => setCarregando(false));
  }, []);

  const definirFonte = (campo: "usarErp" | "usarHistorico" | "usarVocabulario", valor: boolean) =>
    setConfiguracao((atual) => ({ ...atual, [campo]: valor }));

  const adicionar = () => {
    const codigo = sku.trim();
    if (!codigo || !Number.isInteger(multiplo) || multiplo < 1) {
      setMensagem("Informe um código e um múltiplo inteiro a partir de 1.");
      return;
    }
    setConfiguracao((atual) => ({ ...atual, multiplosPorSku: { ...atual.multiplosPorSku, [codigo]: multiplo } }));
    setSku(""); setMultiplo(1); setMensagem(null);
  };

  const remover = (codigo: string) => setConfiguracao((atual) => {
    const proximos = { ...atual.multiplosPorSku };
    delete proximos[codigo];
    return { ...atual, multiplosPorSku: proximos };
  });

  const salvar = async () => {
    setSalvando(true); setMensagem(null);
    try {
      const r = await fetch("/api/configuracoes/lotes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(configuracao) });
      const corpo = (await r.json()) as { erro?: string; configuracao?: ConfiguracaoLotesTenant };
      if (!r.ok) throw new Error(corpo.erro ?? "Não foi possível salvar.");
      if (corpo.configuracao) setConfiguracao(corpo.configuracao);
      setMensagem("Configuração salva. Ela será aplicada na próxima carga da grade.");
    } catch (e) { setMensagem(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setSalvando(false); }
  };

  if (carregando) return <p className="text-slate-500">Carregando configuração de múltiplos…</p>;
  const fontes = [
    ["usarErp", "Cadastro do ERP", "Múltiplo informado no cadastro do produto."],
    ["usarHistorico", "Histórico de vendas", "Padrão consistente nas quantidades vendidas."],
    ["usarVocabulario", "Descrição do produto", "Inferência pelo nome da peça como último recurso."],
  ] as const;

  return <div className="space-y-3">
    <div className="grid gap-2 sm:grid-cols-3">{fontes.map(([campo, titulo, descricao]) =>
      <label key={campo} className="flex gap-2 rounded-lg border border-slate-200 p-2.5">
        <input type="checkbox" checked={configuracao[campo]} disabled={!podeEditar} onChange={(e) => definirFonte(campo, e.target.checked)} />
        <span><strong className="block text-slate-800">{titulo}</strong><span className="text-[11px] text-slate-500">{descricao}</span></span>
      </label>)}</div>
    <div>
      <p className="mb-1 font-semibold text-slate-800">Exceções por código do produto</p>
      <p className="mb-2 text-[11px] text-slate-500">A exceção tem prioridade. Use 1 para marcar o item como avulso.</p>
      {podeEditar && <div className="mb-2 flex flex-wrap gap-2">
        <input aria-label="Código do produto" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Código/SKU" className="rounded border border-slate-300 px-2 py-1.5" />
        <input aria-label="Múltiplo de compra" type="number" min="1" max="999" value={multiplo} onChange={(e) => setMultiplo(Number(e.target.value))} className="w-24 rounded border border-slate-300 px-2 py-1.5" />
        <button type="button" onClick={adicionar} className="flex items-center gap-1 rounded bg-slate-800 px-3 py-1.5 font-semibold text-white"><Plus className="h-3.5 w-3.5" />Adicionar</button>
      </div>}
      <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200">
        {Object.entries(configuracao.multiplosPorSku).length === 0 ? <p className="p-3 text-slate-500">Nenhuma exceção cadastrada.</p> :
          Object.entries(configuracao.multiplosPorSku).sort().map(([codigo, valor]) => <div key={codigo} className="flex items-center justify-between border-t border-slate-100 px-3 py-1.5 first:border-0">
            <span className="font-mono font-semibold">{codigo}</span><span className="ml-auto mr-4">{valor}x</span>
            {podeEditar && <button type="button" onClick={() => remover(codigo)} aria-label={`Remover ${codigo}`} className="text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>)}
      </div>
    </div>
    {mensagem && <p role="status" className="text-xs text-blue-700">{mensagem}</p>}
    {podeEditar && <button type="button" onClick={salvar} disabled={salvando} className="flex items-center gap-1.5 rounded bg-blue-700 px-3 py-1.5 font-semibold text-white disabled:opacity-60">{salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Salvar configuração</button>}
  </div>;
}

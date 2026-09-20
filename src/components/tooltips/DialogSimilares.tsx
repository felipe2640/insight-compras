"use client";

import React, { useEffect, useCallback, useState } from "react";
import { PropsDialogSimilares } from "@/tipos/cockpit";
import { cn } from "@/lib/utils";

export function DialogSimilares({
  aberto,
  onOpenChange,
  produtoPrincipalCodigo,
  produtoPrincipalDescricao,
  similares = [],
}: PropsDialogSimilares) {
  const [periodoVendas, setPeriodoVendas] = useState<30 | 60 | 90>(30);
  // Fecha ao pressionar Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && aberto) {
        onOpenChange(false);
      }
    },
    [aberto, onOpenChange]
  );

  useEffect(() => {
    if (aberto) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [aberto, handleKeyDown]);

  if (!aberto) return null;

  const totalSaldoRede = similares.reduce((acc, cur) => acc + cur.saldoFisicoDisponivelRede, 0);
  const obterVendasPeriodo = (indice: number): number | null => {
    const similar = similares[indice];
    if (periodoVendas === 30) return similar.vendasLojaAvaliacao30dias ?? null;
    if (periodoVendas === 60) return similar.vendasLojaAvaliacao60dias ?? null;
    return similar.vendasLojaAvaliacao90dias ?? null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={() => onOpenChange(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-similares-titulo"
        className="relative w-full max-w-4xl rounded-lg border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 text-xs font-bold">
                ✨
              </span>
              <h2 id="dialog-similares-titulo" className="text-base font-bold text-slate-900 dark:text-white">
                Peças Similares Intercambiáveis
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Item analisado: <strong className="font-mono text-slate-800 dark:text-slate-200">{produtoPrincipalCodigo}</strong> — {produtoPrincipalDescricao}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Fechar diálogo de peças similares"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo / Tabela de Similares */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 mb-2">
            <span>
              Encontrados <strong className="font-bold text-purple-700 dark:text-purple-300">{similares.length}</strong> itens intercambiáveis da mesma aplicação
            </span>
            <span className="rounded bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-800 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
              Saldo Total na Rede: <strong className="font-mono">{totalSaldoRede} un</strong>
            </span>
            <label className="ml-auto flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
              Vendas na loja:
              <select
                aria-label="Período de vendas na loja de avaliação"
                value={periodoVendas}
                onChange={(evento) => setPeriodoVendas(Number(evento.target.value) as 30 | 60 | 90)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value={30}>30 dias</option>
                <option value={60}>60 dias</option>
                <option value={90}>90 dias</option>
              </select>
            </label>
          </div>

          {similares.length > 0 ? (
            <div className="max-h-80 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5">Código SKU</th>
                    <th className="p-2.5">Descrição</th>
                    <th className="p-2.5">Marca</th>
                    <th className="p-2.5 text-right">Estoque na loja</th>
                    <th className="p-2.5 text-right">Vendidos ({periodoVendas}d)</th>
                    <th className="p-2.5 text-right">Saldo Rede</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {similares.map((sim, idx) => (
                    <tr key={`${sim.produtoIdSimilar}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                      <td className="p-2.5 font-mono font-medium text-slate-900 dark:text-slate-100">
                        {sim.codigoSkuSimilar}
                      </td>
                      <td className="p-2.5 text-slate-700 dark:text-slate-300">
                        {sim.descricaoSimilar}
                      </td>
                      <td className="p-2.5">
                        <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {sim.marcaSimilar}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-200">
                        {sim.saldoFisicoLojaAvaliacao === null || sim.saldoFisicoLojaAvaliacao === undefined
                          ? "—"
                          : `${sim.saldoFisicoLojaAvaliacao} un`}
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-blue-700 dark:text-blue-300">
                        {obterVendasPeriodo(idx) === null ? "—" : `${obterVendasPeriodo(idx)} un`}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        <span className={sim.saldoFisicoDisponivelRede > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>
                          {sim.saldoFisicoDisponivelRede} un
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              Nenhuma peça similar com saldo positivo cadastrada para esta aplicação veicular.
            </div>
          )}
        </div>

        {/* Rodapé informativo */}
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <p className="text-[11px] text-slate-400 max-w-md">
            Itens intercambiáveis cobrem a mesma necessidade mecânica. Se o saldo somado na rede cobrir o horizonte, novas compras externas devem ser evitadas.
          </p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md bg-slate-900 px-4 py-1.5 font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

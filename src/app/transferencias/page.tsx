"use client";

/**
 * Plano de transferência — o que cada loja precisa MANDAR.
 *
 * Mesma conta do cockpit: a loja em foco é o DESTINO, e o balanceamento escolhe
 * a doadora com maior sobra real. Aqui a leitura é invertida de propósito: em
 * vez de "o que falta aqui", mostra "o que sai de cada loja", que é a ordem de
 * serviço de quem vai separar a mercadoria.
 *
 * Antes esta tela tinha três linhas fixas no código. Agora vem do mesmo motor.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Loader2,
  AlertTriangle,
  PackageCheck,
  Store,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";
import { decodificarGradeTabular, PayloadGradeTabular } from "@/lib/cockpit/codificacao-tabular";
import { NOMES_FILIAIS_CARREIRO } from "@adapters/carreiro/mapeador-dax";
import { cn } from "@/lib/utils";

const LOJAS = Object.entries(NOMES_FILIAIS_CARREIRO).map(([id, nome]) => ({
  id: Number(id),
  nome,
}));

export default function PaginaTransferencias() {
  const [destino, setDestino] = useState(1);
  const [linhas, setLinhas] = useState<LinhaCockpitMatriz[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/compras?filialId=${destino}&formato=tabular&escopo=todos`);
      if (!r.ok) {
        setErro(r.status === 401 ? "Sessão expirada." : `Servidor respondeu ${r.status}.`);
        setLinhas([]);
        return;
      }
      const corpo = (await r.json()) as { grade?: PayloadGradeTabular };
      if (!corpo.grade) {
        setErro("Resposta sem a grade.");
        return;
      }
      setLinhas(decodificarGradeTabular<LinhaCockpitMatriz>(corpo.grade));
    } catch {
      setErro("Sem conexão com o servidor.");
    } finally {
      setCarregando(false);
    }
  }, [destino]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const porOrigem = useMemo(() => {
    const grupos = new Map<
      string,
      { origemNome: string; itens: LinhaCockpitMatriz[]; unidades: number; valor: number }
    >();
    for (const l of linhas) {
      const qtd = l.quantidadeTransferenciaSugerida ?? 0;
      const origem = l.filialOrigemTransferenciaNome;
      if (qtd <= 0 || !origem) continue;
      const g = grupos.get(origem) ?? { origemNome: origem, itens: [], unidades: 0, valor: 0 };
      g.itens.push(l);
      g.unidades += qtd;
      g.valor += qtd * (l.precoCusto ?? 0);
      grupos.set(origem, g);
    }
    return Array.from(grupos.values()).sort((a, b) => b.unidades - a.unidades);
  }, [linhas]);

  const totalUnidades = porOrigem.reduce((s, g) => s + g.unidades, 0);
  const nomeDestino = LOJAS.find((l) => l.id === destino)?.nome ?? `Loja ${destino}`;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 border-b border-[#D4AF37]/30 bg-[#0F2B5C] px-4 py-2.5 text-white shadow-md">
          <h1 className="flex items-center gap-2 text-sm font-semibold">
            <ArrowLeftRight className="h-4 w-4 text-[#D4AF37]" />
            Transferências
          </h1>
          <p className="text-xs text-white/70">
            O que cada loja precisa mandar para <strong>{nomeDestino}</strong>. A doadora só
            entra se mantiver o próprio giro coberto.
          </p>
        </header>

        <div className="mx-auto w-full max-w-[1200px] space-y-3 p-4 text-xs">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
            <label className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Loja que recebe</span>
              <select
                value={destino}
                onChange={(e) => setDestino(Number(e.target.value))}
                className="rounded border border-slate-300 px-2 py-1 font-semibold outline-none focus:border-blue-500"
              >
                {LOJAS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </label>
            <span className="ml-auto text-slate-500">
              {carregando
                ? "calculando..."
                : `${porOrigem.length} loja(s) doadora(s) • ${totalUnidades.toLocaleString("pt-BR")} un`}
            </span>
          </div>

          {erro && (
            <p role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {erro}
            </p>
          )}

          {carregando ? (
            <p className="py-10 text-center text-slate-400">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </p>
          ) : porOrigem.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white py-10 text-center text-slate-400 shadow-sm">
              Nenhuma transferência sugerida para {nomeDestino}. Toda necessidade vira compra,
              ou nenhuma outra loja tem sobra depois de cobrir o próprio giro.
            </p>
          ) : (
            porOrigem.map((grupo) => (
              <div
                key={grupo.origemNome}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-indigo-50/60 px-3 py-2">
                  <span className="flex items-center gap-2 font-semibold text-indigo-900">
                    <Store className="h-4 w-4" />
                    {grupo.origemNome}
                    <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-slate-700">{nomeDestino}</span>
                  </span>
                  <span className="flex items-center gap-3 font-mono text-indigo-900">
                    <span>{grupo.itens.length} item(ns)</span>
                    <span className="font-bold">{grupo.unidades} un</span>
                    <span>
                      {grupo.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-2 py-1 text-left">SKU</th>
                        <th className="px-2 py-1 text-left">Descrição</th>
                        <th className="px-2 py-1 text-left">Marca</th>
                        <th className="px-2 py-1 text-right">Enviar</th>
                        <th className="px-2 py-1 text-right">Saldo origem</th>
                        <th className="px-2 py-1 text-right">Sobra após</th>
                        <th className="px-2 py-1 text-right">Falta no destino</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.itens.map((i) => {
                        const enviar = i.quantidadeTransferenciaSugerida ?? 0;
                        const sobraApos = (i.sobraRealOrigemTransferencia ?? 0) - enviar;
                        return (
                          <tr key={i.codigoSku} className="border-t border-slate-100">
                            <td className="px-2 py-1 font-mono text-slate-700">{i.codigoSku}</td>
                            <td className="px-2 py-1 text-slate-600">
                              <span className="block max-w-[300px] truncate" title={i.descricao}>
                                {i.descricao}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-slate-600">{i.marca || "—"}</td>
                            <td className="px-2 py-1 text-right font-mono font-bold text-indigo-800">
                              {enviar}
                            </td>
                            <td className="px-2 py-1 text-right font-mono text-slate-600">
                              {i.saldoOrigemTransferencia}
                            </td>
                            <td
                              className={cn(
                                "px-2 py-1 text-right font-mono",
                                sobraApos < 0 ? "font-bold text-rose-700" : "text-slate-600"
                              )}
                              title="Sobra da doadora depois de enviar, já descontado o giro dela"
                            >
                              {sobraApos}
                            </td>
                            <td className="px-2 py-1 text-right font-mono text-slate-600">
                              {i.necessidadeDestinoTransferencia}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

          <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600 shadow-sm">
            <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              Transferência vem antes de compra: mover o que já está na rede não gasta caixa. A
              doadora só cede o que sobra depois de garantir a própria cobertura, e por isso
              &quot;Sobra após&quot; nunca deveria ficar negativa.
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}

"use client";

/**
 * Filtro tipado no cabeçalho da coluna.
 * Camada: Interface (src/components/ui) — genérico, serve a qualquer grade.
 *
 * O operador oferecido depende do TIPO da coluna (meta.variante): texto não tem
 * "maior que", número não tem "começa com". A regra em si mora em
 * lib/cockpit/filtros-coluna, testada sem React.
 *
 * Aplica no botão, não a cada tecla: com 19 mil linhas, refiltrar a cada
 * caractere trava a digitação.
 */

import React, { useMemo, useState } from "react";
import type { Header } from "@tanstack/react-table";
import { Filter, FilterX, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  FiltroColuna,
  OPERADORES_POR_VARIANTE,
  OPERADORES_SEM_VALOR,
  OperadorFiltro,
  filtroEstaCompleto,
  operadorPadraoDaVariante,
} from "@/lib/cockpit/filtros-coluna";
import { lerFiltroDaColuna, varianteDaColuna } from "@/lib/cockpit/filtro-tanstack";
import { cn } from "@/lib/utils";

const LIMITE_OPCOES_SELECAO = 300;

export function FiltroColunaPopover<TData>({ header }: { header: Header<TData, unknown> }) {
  const coluna = header.column;
  const meta = coluna.columnDef.meta as { label?: string } | undefined;
  const rotulo = meta?.label ?? coluna.id;
  const variante = varianteDaColuna(coluna.columnDef.meta);
  const filtroAtual = lerFiltroDaColuna(coluna.getFilterValue());

  const [aberto, setAberto] = useState(false);
  const [operador, setOperador] = useState<OperadorFiltro>(
    filtroAtual?.operador ?? operadorPadraoDaVariante(variante)
  );
  const [valor, setValor] = useState<string>(String(filtroAtual?.valor ?? ""));
  const [valor2, setValor2] = useState<string>(String(filtroAtual?.valor2 ?? ""));
  const [valores, setValores] = useState<Set<string>>(new Set(filtroAtual?.valores ?? []));
  const [buscaOpcao, setBuscaOpcao] = useState("");

  const operadores = OPERADORES_POR_VARIANTE[variante];
  const pedeValor = !OPERADORES_SEM_VALOR.includes(operador);
  const pedeLista = operador === "eUmDe" || operador === "naoEUmDe";
  const pedeSegundo = operador === "entre";

  // Só calcula a lista de opções quando o popover abre: em 19 mil linhas isso não
  // pode acontecer a cada render da grade.
  const opcoes = useMemo(() => {
    if (!aberto || !pedeLista) return [] as Array<[string, number]>;
    const mapa = coluna.getFacetedUniqueValues?.();
    if (!mapa) return [];
    return Array.from(mapa.entries())
      .filter(([v]) => v !== null && v !== undefined && String(v).trim() !== "")
      .map(([v, n]) => [String(v), n] as [string, number])
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .slice(0, LIMITE_OPCOES_SELECAO);
  }, [aberto, pedeLista, coluna]);

  const opcoesVisiveis = useMemo(() => {
    if (!buscaOpcao) return opcoes;
    const b = buscaOpcao.toLowerCase();
    return opcoes.filter(([v]) => v.toLowerCase().includes(b));
  }, [opcoes, buscaOpcao]);

  function aoAbrir(novo: boolean) {
    if (novo) {
      const atual = lerFiltroDaColuna(coluna.getFilterValue());
      setOperador(atual?.operador ?? operadorPadraoDaVariante(variante));
      setValor(atual?.valor === null || atual?.valor === undefined ? "" : String(atual.valor));
      setValor2(atual?.valor2 === null || atual?.valor2 === undefined ? "" : String(atual.valor2));
      setValores(new Set(atual?.valores ?? []));
      setBuscaOpcao("");
    }
    setAberto(novo);
  }

  function aplicar() {
    const novo: FiltroColuna = {
      operador,
      valor: pedeValor && !pedeLista ? valor : undefined,
      valor2: pedeSegundo ? valor2 : undefined,
      valores: pedeLista ? Array.from(valores) : undefined,
    };
    coluna.setFilterValue(filtroEstaCompleto(novo) ? novo : undefined);
    setAberto(false);
  }

  function limpar() {
    coluna.setFilterValue(undefined);
    setAberto(false);
  }

  const ativo = filtroEstaCompleto(filtroAtual);

  return (
    <Popover open={aberto} onOpenChange={aoAbrir}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filtrar ${rotulo}`}
          title={`Filtrar ${rotulo}`}
          className={cn(
            // Visível sempre, mesmo apagado: um filtro que só aparece no hover é
            // um filtro que o comprador não descobre.
            "shrink-0 rounded p-0.5 transition-colors",
            ativo
              ? "text-blue-600 opacity-100"
              : "text-slate-400 opacity-50 hover:bg-slate-200 hover:text-slate-700 hover:opacity-100 focus:opacity-100 dark:hover:bg-slate-700"
          )}
        >
          <Filter className={cn("h-3 w-3", ativo && "fill-blue-600/20")} />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 space-y-2 p-2 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1 dark:border-slate-800">
          <span className="truncate font-semibold text-slate-800 dark:text-white">{rotulo}</span>
          {ativo && (
            <button
              type="button"
              onClick={limpar}
              className="flex items-center gap-1 text-[11px] text-rose-600 hover:underline"
            >
              <FilterX className="h-3 w-3" />
              Limpar
            </button>
          )}
        </div>

        <select
          value={operador}
          onChange={(e) => setOperador(e.target.value as OperadorFiltro)}
          className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          aria-label="Operador do filtro"
        >
          {operadores.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </select>

        {pedeLista && (
          <div className="space-y-1">
            <input
              type="text"
              value={buscaOpcao}
              onChange={(e) => setBuscaOpcao(e.target.value)}
              placeholder="Buscar valor..."
              className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
            />
            <div className="max-h-40 space-y-0.5 overflow-y-auto pr-1">
              {opcoesVisiveis.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-slate-400">Nenhum valor</p>
              ) : (
                opcoesVisiveis.map(([opcao, quantas]) => {
                  const marcado = valores.has(opcao);
                  return (
                    <label
                      key={opcao}
                      className="flex cursor-pointer items-center justify-between rounded px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                            marcado
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                          )}
                        >
                          {marcado && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                        </span>
                        <span className="truncate" title={opcao}>
                          {opcao}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={marcado}
                        onChange={() =>
                          setValores((antes) => {
                            const proximo = new Set(antes);
                            if (proximo.has(opcao)) proximo.delete(opcao);
                            else proximo.add(opcao);
                            return proximo;
                          })
                        }
                      />
                      <span className="ml-1 shrink-0 font-mono text-[10px] text-slate-400">{quantas}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        {pedeValor && !pedeLista && (
          <div className="flex items-center gap-1.5">
            <input
              type={variante === "numero" ? "text" : variante === "data" ? "date" : "text"}
              inputMode={variante === "numero" ? "decimal" : undefined}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && aplicar()}
              placeholder={variante === "numero" ? "0" : "valor"}
              aria-label={`Valor do filtro de ${rotulo}`}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {pedeSegundo && (
              <>
                <span className="shrink-0 text-slate-400">e</span>
                <input
                  type={variante === "data" ? "date" : "text"}
                  inputMode={variante === "numero" ? "decimal" : undefined}
                  value={valor2}
                  onChange={(e) => setValor2(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && aplicar()}
                  aria-label={`Segundo valor do filtro de ${rotulo}`}
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="h-6 bg-blue-600 px-3 text-[11px] text-white hover:bg-blue-700"
            onClick={aplicar}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

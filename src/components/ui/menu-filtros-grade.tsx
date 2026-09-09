"use client";

/**
 * Construtor central de filtros da grade — o "Filtrar" da barra de menus.
 * Camada: Interface (src/components/ui).
 *
 * Portado do diário (data-grid-filter-menu). Em vez de caçar coluna por coluna,
 * o comprador monta a pergunta inteira num lugar só e lê de uma vez tudo o que
 * está filtrando: «Onde Marca contém bosch E Custo é maior que 50». Cada linha
 * pode trocar de coluna, de operador e de valor, ou sair.
 *
 * Divide o mesmo estado (`columnFilters`) com o funil do cabeçalho e com os
 * chips acima da grade: mexer em um lugar aparece nos outros três.
 *
 * O que NÃO veio do diário, de propósito: arrastar para reordenar. Os filtros
 * são todos "E", então a ordem não muda resultado nenhum — seria peso de
 * dependência sem ganho para quem compra.
 *
 * Atalho: Ctrl/Cmd + Shift + F abre e fecha.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Column, ColumnFiltersState, Table } from "@tanstack/react-table";
import { ListFilter, Plus, Trash2, ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SeletorValoresFacetados } from "@/components/ui/seletor-valores-facetados";
import {
  FiltroColuna,
  OPERADORES_POR_VARIANTE,
  OPERADORES_SEM_VALOR,
  OperadorFiltro,
  VarianteColuna,
} from "@/lib/cockpit/filtros-coluna";
import { opcoesFacetadasDaColuna, varianteDaColuna } from "@/lib/cockpit/filtro-tanstack";
import {
  ColunaFiltravel,
  FiltroAtivo,
  adicionarFiltro,
  atualizarFiltro,
  colunasDisponiveis,
  conectivoDaLinha,
  contarFiltrosAplicaveis,
  removerFiltro,
  trocarColunaDoFiltro,
} from "@/lib/cockpit/menu-filtros";
import { cn } from "@/lib/utils";

const ESPERA_DIGITACAO_MS = 300;
const TECLAS_REMOVER = ["backspace", "delete"];

export function MenuFiltrosGrade<TData>({ table }: { table: Table<TData> }) {
  const [aberto, setAberto] = useState(false);
  const filtros = table.getState().columnFilters as unknown as FiltroAtivo[];

  const colunas: ColunaFiltravel[] = useMemo(() => {
    return table
      .getAllLeafColumns()
      .filter((c) => {
        const meta = c.columnDef.meta as { variante?: string } | undefined;
        return Boolean(meta?.variante) && c.getCanFilter();
      })
      .map((c) => {
        const meta = c.columnDef.meta as { label?: string; variante?: string } | undefined;
        return {
          id: c.id,
          rotulo: meta?.label ?? c.id,
          variante: varianteDaColuna(c.columnDef.meta),
        };
      });
  }, [table]);

  const definir = useCallback(
    (proximos: FiltroAtivo[]) => table.setColumnFilters(proximos as unknown as ColumnFiltersState),
    [table]
  );

  const aoAdicionar = useCallback(
    () => definir(adicionarFiltro(filtros, colunas)),
    [definir, filtros, colunas]
  );
  const aoLimpar = useCallback(() => table.resetColumnFilters(), [table]);

  // Ctrl/Cmd + Shift + F, como no diário. Ignora quando o foco está num campo.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      const alvo = evento.target;
      if (
        alvo instanceof HTMLInputElement ||
        alvo instanceof HTMLTextAreaElement ||
        alvo instanceof HTMLSelectElement
      ) {
        return;
      }
      if (evento.key.toLowerCase() === "f" && (evento.ctrlKey || evento.metaKey) && evento.shiftKey) {
        evento.preventDefault();
        setAberto((antes) => !antes);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const aplicaveis = contarFiltrosAplicaveis(filtros);
  const semColunaLivre = colunasDisponiveis(colunas, filtros).length === 0;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-xs font-medium"
          title="Filtrar (Ctrl+Shift+F)"
        >
          <ListFilter className="h-3.5 w-3.5 text-slate-500" />
          Filtrar
          {aplicaveis > 0 && (
            <Badge
              variant="secondary"
              className="h-4 rounded px-1 text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
            >
              {aplicaveis}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[560px] max-w-[92vw] space-y-3 p-3 text-xs">
        <div>
          <h4 className="font-semibold text-slate-800 dark:text-white">
            {filtros.length > 0 ? "Filtrar por" : "Nenhum filtro aplicado"}
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {filtros.length > 0
              ? "Todas as condições valem ao mesmo tempo."
              : "Adicione condições para reduzir a grade."}
          </p>
        </div>

        {filtros.length > 0 && (
          <ul className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {filtros.map((filtro, indice) => (
              <LinhaFiltro
                key={filtro.id}
                filtro={filtro}
                indice={indice}
                colunas={colunas}
                disponiveis={colunasDisponiveis(colunas, filtros, filtro.id)}
                coluna={table.getColumn(filtro.id)}
                aoTrocarColuna={(nova) => definir(trocarColunaDoFiltro(filtros, filtro.id, nova))}
                aoMudar={(mudancas) => definir(atualizarFiltro(filtros, filtro.id, mudancas))}
                aoRemover={() => definir(removerFiltro(filtros, filtro.id))}
              />
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
          <Button
            size="sm"
            className="h-7 gap-1 bg-blue-600 px-2.5 text-[11px] text-white hover:bg-blue-700"
            onClick={aoAdicionar}
            disabled={semColunaLivre}
            title={semColunaLivre ? "Todas as colunas já têm filtro" : undefined}
          >
            <Plus className="h-3 w-3" />
            Adicionar filtro
          </Button>
          {filtros.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2.5 text-[11px] text-rose-600"
              onClick={aoLimpar}
            >
              <Trash2 className="h-3 w-3" />
              Limpar filtros
            </Button>
          )}
          <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400">
            {table.getFilteredRowModel().rows.length.toLocaleString("pt-BR")} de{" "}
            {table.getPreFilteredRowModel().rows.length.toLocaleString("pt-BR")} linhas
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------

interface LinhaFiltroProps<TData> {
  readonly filtro: FiltroAtivo;
  readonly indice: number;
  readonly colunas: readonly ColunaFiltravel[];
  readonly disponiveis: readonly ColunaFiltravel[];
  readonly coluna: Column<TData, unknown> | undefined;
  readonly aoTrocarColuna: (nova: ColunaFiltravel) => void;
  readonly aoMudar: (mudancas: Partial<FiltroColuna>) => void;
  readonly aoRemover: () => void;
}

function LinhaFiltro<TData>({
  filtro,
  indice,
  colunas,
  disponiveis,
  coluna,
  aoTrocarColuna,
  aoMudar,
  aoRemover,
}: LinhaFiltroProps<TData>) {
  const definicao = colunas.find((c) => c.id === filtro.id);
  const variante: VarianteColuna = definicao?.variante ?? "texto";
  const operador = filtro.value.operador;
  const pedeValor = !OPERADORES_SEM_VALOR.includes(operador);
  const pedeLista = operador === "eUmDe" || operador === "naoEUmDe";
  const pedeSegundo = operador === "entre";

  const [seletorColunaAberto, setSeletorColunaAberto] = useState(false);
  const [seletorValoresAberto, setSeletorValoresAberto] = useState(false);

  const selecionados = useMemo(() => new Set(filtro.value.valores ?? []), [filtro.value.valores]);
  const opcoes = useMemo(
    () => (seletorValoresAberto && coluna ? opcoesFacetadasDaColuna(coluna) : []),
    [seletorValoresAberto, coluna]
  );

  function aoTeclarNaLinha(evento: React.KeyboardEvent<HTMLLIElement>) {
    const alvo = evento.target;
    if (alvo instanceof HTMLInputElement || alvo instanceof HTMLSelectElement) return;
    if (seletorColunaAberto || seletorValoresAberto) return;
    if (TECLAS_REMOVER.includes(evento.key.toLowerCase())) {
      evento.preventDefault();
      aoRemover();
    }
  }

  return (
    <li tabIndex={-1} className="flex items-center gap-1.5" onKeyDown={aoTeclarNaLinha}>
      <span className="w-10 shrink-0 text-right text-[11px] text-slate-400">
        {conectivoDaLinha(indice)}
      </span>

      {/* Coluna */}
      <Popover open={seletorColunaAberto} onOpenChange={setSeletorColunaAberto}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-32 shrink-0 justify-between px-2 text-[11px] font-normal"
          >
            <span className="truncate">{definicao?.rotulo ?? filtro.id}</span>
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-52 p-1">
          <ListaDeColunas
            colunas={disponiveis}
            selecionada={filtro.id}
            aoEscolher={(nova) => {
              aoTrocarColuna(nova);
              setSeletorColunaAberto(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {/* Operador */}
      <select
        value={operador}
        onChange={(e) => aoMudar({ operador: e.target.value as OperadorFiltro })}
        aria-label={`Operador do filtro de ${definicao?.rotulo ?? filtro.id}`}
        className="h-7 w-36 shrink-0 rounded border border-slate-200 bg-white px-1.5 text-[11px] outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      >
        {OPERADORES_POR_VARIANTE[variante].map((o) => (
          <option key={o.id} value={o.id}>
            {o.rotulo}
          </option>
        ))}
      </select>

      {/* Valor */}
      {pedeLista ? (
        <Popover open={seletorValoresAberto} onOpenChange={setSeletorValoresAberto}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 justify-between px-2 text-[11px] font-normal"
            >
              <span className="truncate">
                {selecionados.size === 0
                  ? "escolher valores"
                  : Array.from(selecionados).slice(0, 2).join(", ") +
                    (selecionados.size > 2 ? ` +${selecionados.size - 2}` : "")}
              </span>
              <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <SeletorValoresFacetados
              opcoes={opcoes}
              selecionados={selecionados}
              onAlternar={(valor) => {
                const proximo = new Set(selecionados);
                if (proximo.has(valor)) proximo.delete(valor);
                else proximo.add(valor);
                aoMudar({ valores: Array.from(proximo) });
              }}
            />
          </PopoverContent>
        </Popover>
      ) : pedeValor ? (
        <div className="flex flex-1 items-center gap-1">
          <CampoValor
            variante={variante}
            valor={filtro.value.valor}
            rotulo={`Valor do filtro de ${definicao?.rotulo ?? filtro.id}`}
            aoConfirmar={(v) => aoMudar({ valor: v })}
          />
          {pedeSegundo && (
            <>
              <span className="shrink-0 text-slate-400">e</span>
              <CampoValor
                variante={variante}
                valor={filtro.value.valor2}
                rotulo={`Segundo valor do filtro de ${definicao?.rotulo ?? filtro.id}`}
                aoConfirmar={(v) => aoMudar({ valor2: v })}
              />
            </>
          )}
        </div>
      ) : (
        <span className="flex-1 text-[11px] text-slate-400">sem valor</span>
      )}

      <button
        type="button"
        onClick={aoRemover}
        aria-label={`Remover filtro de ${definicao?.rotulo ?? filtro.id}`}
        className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function ListaDeColunas({
  colunas,
  selecionada,
  aoEscolher,
}: {
  readonly colunas: readonly ColunaFiltravel[];
  readonly selecionada: string;
  readonly aoEscolher: (coluna: ColunaFiltravel) => void;
}) {
  const [busca, setBusca] = useState("");
  const visiveis = useMemo(() => {
    if (!busca) return colunas;
    const b = busca.toLowerCase();
    return colunas.filter((c) => c.rotulo.toLowerCase().includes(b));
  }, [colunas, busca]);

  return (
    <div className="space-y-1">
      <input
        type="text"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Procurar coluna..."
        aria-label="Procurar coluna"
        className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
      />
      <div className="max-h-56 space-y-0.5 overflow-y-auto">
        {visiveis.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-slate-400">Nenhuma coluna</p>
        ) : (
          visiveis.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => aoEscolher(c)}
              className={cn(
                "flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                c.id === selecionada && "bg-blue-50 font-semibold text-blue-800 dark:bg-blue-950/40"
              )}
            >
              <span className="truncate">{c.rotulo}</span>
              <span className="ml-2 shrink-0 text-[10px] uppercase text-slate-400">{c.variante}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Campo de valor com espera: só empurra para a tabela 300 ms depois da última
 * tecla. Sem isso, cada caractere refiltra 19 mil linhas e a digitação engasga.
 */
function CampoValor({
  variante,
  valor,
  rotulo,
  aoConfirmar,
}: {
  readonly variante: VarianteColuna;
  readonly valor: string | number | null | undefined;
  readonly rotulo: string;
  readonly aoConfirmar: (valor: string) => void;
}) {
  const externo = valor === null || valor === undefined ? "" : String(valor);
  const [local, setLocal] = useState(externo);
  const ultimoExterno = useRef(externo);

  // Mudou por fora (funil do cabeçalho, troca de coluna): o campo acompanha.
  useEffect(() => {
    if (externo !== ultimoExterno.current) {
      ultimoExterno.current = externo;
      setLocal(externo);
    }
  }, [externo]);

  useEffect(() => {
    if (local === ultimoExterno.current) return;
    const id = setTimeout(() => {
      ultimoExterno.current = local;
      aoConfirmar(local);
    }, ESPERA_DIGITACAO_MS);
    return () => clearTimeout(id);
  }, [local, aoConfirmar]);

  return (
    <input
      type={variante === "data" ? "date" : "text"}
      inputMode={variante === "numero" ? "decimal" : undefined}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      placeholder={variante === "numero" ? "0" : "valor"}
      aria-label={rotulo}
      className="h-7 w-full min-w-0 rounded border border-slate-200 bg-white px-2 text-[11px] outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
    />
  );
}

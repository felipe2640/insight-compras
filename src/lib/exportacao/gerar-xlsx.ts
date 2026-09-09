/**
 * Gerador XLSX (SheetJS) — retorna os bytes do arquivo.
 * Camada: Aplicação (src/lib/exportacao)
 *
 * Números saem como NÚMERO (não texto), com formato de célula por tipo, para o
 * comprador poder somar e filtrar direto no Excel. Texto sai como texto, então
 * "000363" continua "000363".
 */

import * as XLSX from "xlsx";
import { TabelaExportacao, TipoValorColuna } from "./tipos";

const FORMATO_CELULA: Partial<Record<TipoValorColuna, string>> = {
  inteiro: "0",
  decimal: "0.00",
  moeda: '"R$" #,##0.00',
  percentual: "0.0",
};

export interface OpcoesXlsx {
  readonly nomePlanilha?: string;
}

/** Nome de planilha no Excel: máx. 31 caracteres, sem : \ / ? * [ ] */
function sanitizarNomePlanilha(nome: string): string {
  const limpo = nome.replace(/[:\\/?*[\]]/g, " ").trim();
  return (limpo.length > 0 ? limpo : "Exportacao").slice(0, 31);
}

export function gerarXlsx(tabela: TabelaExportacao, opcoes: OpcoesXlsx = {}): Uint8Array {
  const dados: (string | number | null)[][] = [
    [...tabela.cabecalhos],
    ...tabela.linhas.map((l) => [...l]),
  ];

  const planilha = XLSX.utils.aoa_to_sheet(dados);

  // Formato de célula por coluna (a partir da 2ª linha; a 1ª é o cabeçalho)
  tabela.tipos.forEach((tipo, col) => {
    const formato = FORMATO_CELULA[tipo];
    if (!formato) return;
    for (let lin = 1; lin <= tabela.linhas.length; lin += 1) {
      const ref = XLSX.utils.encode_cell({ r: lin, c: col });
      const celula = planilha[ref];
      if (celula && typeof celula.v === "number") {
        celula.t = "n";
        celula.z = formato;
      }
    }
  });

  // Largura das colunas: o maior conteúdo, com teto para não virar uma faixa.
  planilha["!cols"] = tabela.cabecalhos.map((cab, col) => {
    let maior = cab.length;
    for (const linha of tabela.linhas) {
      const v = linha[col];
      if (v !== null && v !== undefined) maior = Math.max(maior, String(v).length);
    }
    return { wch: Math.min(60, Math.max(8, maior + 2)) };
  });

  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    pasta,
    planilha,
    sanitizarNomePlanilha(opcoes.nomePlanilha ?? "Exportacao")
  );

  const saida = XLSX.write(pasta, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Uint8Array(saida);
}

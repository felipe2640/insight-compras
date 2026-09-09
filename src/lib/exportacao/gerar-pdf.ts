/**
 * Gerador PDF (jsPDF + autoTable) — retorna os bytes do arquivo.
 * Camada: Aplicação (src/lib/exportacao)
 *
 * Paisagem A4, cabeçalho com cliente / loja / data / total de itens, tabela
 * com colunas numéricas alinhadas à direita e rodapé com paginação.
 * As bibliotecas são importadas sob demanda para não pesar o bundle do cockpit
 * em quem só exporta CSV.
 */

import { formatarValorTexto } from "./formatar-valor";
import { ContextoExportacao, TabelaExportacao, TipoValorColuna } from "./tipos";

export interface OpcoesPdf {
  readonly titulo: string;
  readonly contexto: ContextoExportacao;
  readonly separadorDecimal?: "," | ".";
  readonly corCabecalho?: [number, number, number];
}

const TIPOS_NUMERICOS: ReadonlySet<TipoValorColuna> = new Set([
  "inteiro",
  "decimal",
  "moeda",
  "percentual",
]);

function formatarDataHora(data: Date): string {
  const dd = String(data.getDate()).padStart(2, "0");
  const mm = String(data.getMonth() + 1).padStart(2, "0");
  const hh = String(data.getHours()).padStart(2, "0");
  const mi = String(data.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${data.getFullYear()} ${hh}:${mi}`;
}

export async function gerarPdf(tabela: TabelaExportacao, opcoes: OpcoesPdf): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const separadorDecimal = opcoes.separadorDecimal ?? ",";
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const larguraPagina = doc.internal.pageSize.getWidth();

  // Cabeçalho
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(opcoes.titulo, 14, 14);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const ctx = opcoes.contexto;
  const subtitulo = [
    ctx.nomeTenant,
    `Loja: ${ctx.nomeLoja}`,
    `Gerado em ${formatarDataHora(ctx.dataReferencia)}`,
    `${tabela.linhas.length} item(ns)`,
    ctx.usuario ? `Por: ${ctx.usuario}` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");
  doc.text(subtitulo, 14, 20);

  const corpo = tabela.linhas.map((linha) =>
    linha.map((valor, idx) =>
      formatarValorTexto(valor, tabela.tipos[idx] ?? "texto", { separadorDecimal })
    )
  );

  const estilosColuna: Record<number, { halign: "left" | "right" | "center" }> = {};
  tabela.tipos.forEach((tipo, idx) => {
    estilosColuna[idx] = { halign: TIPOS_NUMERICOS.has(tipo) ? "right" : "left" };
  });

  autoTable(doc, {
    startY: 25,
    head: [[...tabela.cabecalhos]],
    body: corpo,
    styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: {
      fillColor: opcoes.corCabecalho ?? [15, 43, 92],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: estilosColuna,
    margin: { left: 14, right: 14 },
    didDrawPage: (dados) => {
      const pagina = `Página ${dados.pageNumber}`;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(pagina, larguraPagina - 14, doc.internal.pageSize.getHeight() - 6, {
        align: "right",
      });
    },
  });

  return new Uint8Array(doc.output("arraybuffer"));
}

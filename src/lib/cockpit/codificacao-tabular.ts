/**
 * Codificação tabular do payload da grade.
 * Camada: Aplicação (src/lib/cockpit) — puro; roda no servidor e no navegador.
 *
 * POR QUÊ ISTO EXISTE
 * A linha da grade tem 94 campos. Serializada como lista de objetos, o NOME de
 * cada chave é repetido uma vez por linha. Medido no catálogo da Rede Carreiro
 * (19.118 itens): 35 MB de um payload de 48,4 MB — 72% — eram só nomes de chave.
 * No formato tabular (um cabeçalho + uma lista de valores por linha) o mesmo
 * conteúdo cabe em 15,1 MB, sem perder nenhum campo.
 *
 * `undefined` É PRESERVADO
 * JSON não representa `undefined` — dentro de um array ele vira `null`. A
 * diferença importa aqui: um `secaoId` AUSENTE não é o mesmo que uma seção nula,
 * e o cockpit já trata "não medido ≠ zero" em outros pontos. Os buracos vão numa
 * lista esparsa de pares [linha, campo], que é minúscula (93 pares no catálogo
 * inteiro) e faz o ida-e-volta ser exato.
 */

export const VERSAO_PAYLOAD_TABULAR = 1 as const;

export interface PayloadGradeTabular {
  readonly versao: typeof VERSAO_PAYLOAD_TABULAR;
  /** Nomes dos campos, na ordem em que aparecem em cada linha de `valores`. */
  readonly campos: readonly string[];
  /** Uma lista de valores por linha, alinhada a `campos`. */
  readonly valores: readonly (readonly unknown[])[];
  /** Pares [índice da linha, índice do campo] cujo valor original era `undefined`. */
  readonly buracos: readonly (readonly [number, number])[];
  readonly total: number;
}

export const PAYLOAD_TABULAR_VAZIO: PayloadGradeTabular = {
  versao: VERSAO_PAYLOAD_TABULAR,
  campos: [],
  valores: [],
  buracos: [],
  total: 0,
};

/**
 * Objetos -> tabular. Os campos são a união das chaves de todas as linhas, na
 * ordem em que aparecem pela primeira vez; linhas que não tenham uma chave
 * viram buraco (`undefined`), não `null`.
 */
export function codificarGradeTabular<T extends object>(
  linhas: readonly T[]
): PayloadGradeTabular {
  if (linhas.length === 0) return PAYLOAD_TABULAR_VAZIO;

  const campos: string[] = [];
  const indicePorCampo = new Map<string, number>();
  for (const linha of linhas) {
    for (const chave of Object.keys(linha)) {
      if (!indicePorCampo.has(chave)) {
        indicePorCampo.set(chave, campos.length);
        campos.push(chave);
      }
    }
  }

  const valores: unknown[][] = new Array(linhas.length);
  const buracos: [number, number][] = [];

  for (let i = 0; i < linhas.length; i++) {
    const registro = linhas[i] as Record<string, unknown>;
    const linhaValores: unknown[] = new Array(campos.length);
    for (let j = 0; j < campos.length; j++) {
      const valor = registro[campos[j]];
      if (valor === undefined) {
        linhaValores[j] = null;
        buracos.push([i, j]);
      } else {
        linhaValores[j] = valor;
      }
    }
    valores[i] = linhaValores;
  }

  return { versao: VERSAO_PAYLOAD_TABULAR, campos, valores, buracos, total: linhas.length };
}

/** Tabular -> objetos. Inverso exato de `codificarGradeTabular`. */
export function decodificarGradeTabular<T>(payload: PayloadGradeTabular): T[] {
  if (!payload || payload.total === 0 || payload.campos.length === 0) return [];

  const { campos, valores } = payload;
  const buracosPorLinha = new Map<number, Set<number>>();
  for (const [i, j] of payload.buracos ?? []) {
    let doLinha = buracosPorLinha.get(i);
    if (!doLinha) {
      doLinha = new Set();
      buracosPorLinha.set(i, doLinha);
    }
    doLinha.add(j);
  }

  const saida: T[] = new Array(valores.length);
  for (let i = 0; i < valores.length; i++) {
    const linhaValores = valores[i];
    const doLinha = buracosPorLinha.get(i);
    const registro: Record<string, unknown> = {};
    for (let j = 0; j < campos.length; j++) {
      // Campo marcado como buraco fica AUSENTE do objeto: `chave in obj` é falso,
      // exatamente como estava antes de codificar.
      if (doLinha?.has(j)) continue;
      registro[campos[j]] = linhaValores[j];
    }
    saida[i] = registro as T;
  }
  return saida;
}

/** Une dois payloads com o mesmo cabeçalho (usado na carga em duas etapas). */
export function ehMesmoCabecalho(a: PayloadGradeTabular, b: PayloadGradeTabular): boolean {
  if (a.campos.length !== b.campos.length) return false;
  return a.campos.every((campo, i) => campo === b.campos[i]);
}

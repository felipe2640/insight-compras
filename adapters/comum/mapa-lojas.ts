/**
 * Mapa de Lojas da Fonte de Dados
 * Camada: Adapters / comum
 * 100% em Português do Brasil (pt-BR).
 *
 * Traduz o identificador de loja que a FONTE devolve para o `filialId` do
 * CADASTRO do cliente. É comum a qualquer fonte real, e substitui a
 * adivinhação que vivia no mapeador da Carreiro: prefixo de GUID, código
 * numérico e regex de cidade, terminando em `?? 1` — isto é, toda loja
 * desconhecida virava a MATRIZ, misturando estoque de lojas diferentes.
 *
 * Regras:
 * 1. comparação EXATA, normalizando só caixa e espaço (o resto é adivinhação);
 * 2. valor não declarado é LOJA NÃO MAPEADA: a linha é descartada e o fato fica
 *    registrado em `metadados.lojasNaoMapeadas` para o gestor ver e corrigir;
 * 3. uma loja nova no ERP nunca derruba a carga das outras.
 */

import type { FilialCadastradaTenant } from "@config/tenants/tipos";
import { normalizarIdentificadorFonte } from "@config/tenants/esquema";
import type { LojaNaoMapeada } from "../AdaptadorInventario";

export interface MapaLojasFonte {
  /** Filiais ativas do cadastro, na ordem cadastrada. */
  readonly filiaisAtivas: readonly FilialCadastradaTenant[];
  /** Traduz um valor da fonte em filialId, ou `null` se não for reconhecido. */
  resolver(valor: unknown): number | null;
  /** Como esta loja é exibida ao usuário. */
  nomeExibicao(filialId: number): string;
  /** Identificador a usar ao FILTRAR a fonte por esta loja. */
  identificadorDeFiltro(filialId: number): string | undefined;
  /** Registra um valor não reconhecido (uma vez por linha descartada). */
  registrarNaoMapeada(valor: unknown): void;
  /** Lojas que a fonte devolveu e o cadastro não reconhece. */
  naoMapeadas(): readonly LojaNaoMapeada[];
}

export function criarMapaLojasFonte(
  filiais: readonly FilialCadastradaTenant[]
): MapaLojasFonte {
  const ativas = filiais.filter((f) => f.ativa);
  const porIdentificador = new Map<string, number>();
  const nomes = new Map<number, string>();
  const filtroPorFilial = new Map<number, string>();

  for (const filial of ativas) {
    nomes.set(filial.filialId, filial.nome);
    const identificadores = filial.identificadoresFonte ?? [];
    for (const identificador of identificadores) {
      porIdentificador.set(normalizarIdentificadorFonte(identificador), filial.filialId);
    }
    // O primeiro identificador declarado é o que vai para o filtro da consulta.
    // Verificado na Carreiro: o GUID do CADEMP está em TODAS as tabelas e não
    // muda quando alguém renomeia a loja no ERP — ao contrário do nome fantasia.
    if (identificadores.length > 0) {
      filtroPorFilial.set(filial.filialId, identificadores[0]);
    }
    if (filial.nomeFonte) {
      porIdentificador.set(normalizarIdentificadorFonte(filial.nomeFonte), filial.filialId);
    }
  }

  const naoMapeadas = new Map<string, number>();

  return {
    filiaisAtivas: ativas,

    resolver(valor: unknown): number | null {
      if (valor === null || valor === undefined) return null;

      const texto = String(valor).trim();
      if (texto.length === 0) return null;

      const direto = porIdentificador.get(normalizarIdentificadorFonte(texto));
      if (direto !== undefined) return direto;

      /**
       * Valor puramente numérico só é aceito quando corresponde a uma filial
       * cadastrada. Serve ao dado que já passou por aqui (snapshot normalizado,
       * gerador sintético), nunca para adivinhar identificador de ERP: na
       * Carreiro nenhuma tabela devolve o número solto.
       */
      if (/^\d+$/.test(texto)) {
        const numero = Number(texto);
        if (nomes.has(numero)) return numero;
      }

      return null;
    },

    nomeExibicao(filialId: number): string {
      return nomes.get(filialId) ?? `Filial ${filialId}`;
    },

    identificadorDeFiltro(filialId: number): string | undefined {
      return filtroPorFilial.get(filialId);
    },

    registrarNaoMapeada(valor: unknown): void {
      const chave = String(valor ?? "").trim() || "(vazio)";
      naoMapeadas.set(chave, (naoMapeadas.get(chave) ?? 0) + 1);
    },

    naoMapeadas(): readonly LojaNaoMapeada[] {
      return Array.from(naoMapeadas.entries()).map(([identificador, linhasDescartadas]) => ({
        identificador,
        linhasDescartadas,
      }));
    },
  };
}

/**
 * Funções Criptográficas de Integridade SHA-256 (Tamper-Evident Hash Chain)
 * Camada: Aplicação / Auditoria (src/lib/auditoria/criptografia.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { createHash } from "crypto";
import { AuditoriaPedido } from "./tipos";

export function calcularHashRegistro(
  dados: Omit<AuditoriaPedido, "hashIntegridade">
): string {
  const cargaUtil = JSON.stringify({
    id: dados.id,
    timestamp: dados.timestamp,
    tenantId: dados.tenantId,
    compradorId: dados.compradorId,
    filialId: dados.filialId,
    produtoId: dados.produtoId,
    codigoSku: dados.codigoSku,
    quantidadeSugerida: dados.quantidadeSugeridaSistema,
    quantidadeDigitada: dados.quantidadeDigitadaComprador,
    divergencia: dados.divergenciaQuantidade,
    tipoAcao: dados.tipoAcao,
    hashAnterior: dados.hashRegistroAnterior,
  });

  return createHash("sha256").update(cargaUtil).digest("hex");
}

export function validarCadeiaAuditoria(registros: readonly AuditoriaPedido[]): {
  valida: boolean;
  indiceInvalido?: number;
  motivo?: string;
} {
  for (let i = 0; i < registros.length; i++) {
    const atual = registros[i];

    // Verifica integridade do próprio hash do registro
    const { hashIntegridade, ...resto } = atual;
    const hashEsperado = calcularHashRegistro(resto);
    if (hashIntegridade !== hashEsperado) {
      return {
        valida: false,
        indiceInvalido: i,
        motivo: `Hash inválido no registro ${atual.id}. Conteúdo foi adulterado.`,
      };
    }

    // Verifica encadeamento com o registro anterior
    if (i > 0) {
      const anterior = registros[i - 1];
      if (atual.hashRegistroAnterior !== anterior.hashIntegridade) {
        return {
          valida: false,
          indiceInvalido: i,
          motivo: `Quebra de cadeia: o registro ${atual.id} não aponta para o hash do registro ${anterior.id}.`,
        };
      }
    } else {
      if (atual.hashRegistroAnterior !== "GENESIS_HASH") {
        return {
          valida: false,
          indiceInvalido: 0,
          motivo: "Registro inicial não possui o hash gênesis correto.",
        };
      }
    }
  }

  return { valida: true };
}

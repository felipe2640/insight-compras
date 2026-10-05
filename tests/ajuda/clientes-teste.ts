/**
 * Clientes de teste: o de referência e o MÍNIMO.
 *
 * O cliente mínimo existe porque a suíte só conhecia um cliente rico: 5 lojas
 * começando em 1, todas as capacidades de ERP, nenhum campo faltando. Era
 * exatamente o oposto do que aparece no onboarding de um cliente novo, e por
 * isso `?? 1`, capacidade ausente e loja fora do cadastro nunca eram testados.
 */

import type { ConfiguracaoTenant, FilialCadastradaTenant } from "@config/tenants/tipos";
import { TENANT_DEMONSTRACAO } from "@config/tenants/demonstracao";

/** Identificadores reais conferidos ao vivo no CADEMP em 17/09/2026. */
export const FILIAIS_FONTE_REAL: readonly FilialCadastradaTenant[] = [
  {
    filialId: 1,
    nome: "Loja Matriz",
    codigo: "MATRIZ",
    tipo: "matriz",
    ativa: true,
    nomeFonte: "LOJA MATRIZ",
    identificadoresFonte: ["1|e2adc241-50f7-4dcd-9527-423080cd8c5c"],
  },
  {
    filialId: 2,
    nome: "Loja Norte",
    codigo: "NORTE",
    tipo: "filial",
    ativa: true,
    nomeFonte: "LOJA NORTE",
    identificadoresFonte: ["1|cd87703f-0d8c-447e-9bdf-5c1d790f587b"],
  },
  {
    filialId: 3,
    nome: "Loja Sul",
    codigo: "SUL",
    tipo: "filial",
    ativa: true,
    nomeFonte: "LOJA SUL",
    identificadoresFonte: ["1|a5172ddc-0dd0-4f8e-bb0d-5018183d4457"],
  },
  {
    filialId: 4,
    nome: "Loja Leste",
    codigo: "LESTE",
    tipo: "filial",
    ativa: true,
    nomeFonte: "LOJA LESTE",
    identificadoresFonte: ["1|c9432abf-af64-40d2-abe3-21124f49b2ae"],
  },
  {
    filialId: 5,
    nome: "Loja Oeste",
    codigo: "OESTE",
    tipo: "filial",
    ativa: true,
    nomeFonte: "LOJA OESTE",
    identificadoresFonte: ["1|d624d502-59a4-4ab2-910b-99ae9bf7462a"],
  },
];

/**
 * Cliente mínimo: 2 lojas, ids 7 e 9 (nenhuma é a 1), sem capacidade de ERP.
 *
 * Os ids fora do 1 são o ponto: qualquer `?? 1` remanescente produz um número
 * plausível e errado, e só um cliente assim expõe isso.
 */
export const FILIAIS_MINIMAS: readonly FilialCadastradaTenant[] = [
  {
    filialId: 7,
    nome: "Unidade Sete",
    codigo: "SETE",
    tipo: "matriz",
    ativa: true,
    nomeFonte: "UNIDADE SETE",
    identificadoresFonte: ["9|aaaa1111-2222-3333-4444-555566667777"],
  },
  {
    filialId: 9,
    nome: "Unidade Nove",
    codigo: "NOVE",
    tipo: "filial",
    ativa: true,
    nomeFonte: "UNIDADE NOVE",
    identificadoresFonte: ["9|bbbb1111-2222-3333-4444-555566667777"],
  },
];

export function tenantMinimo(
  sobrescritas: Partial<ConfiguracaoTenant> = {}
): ConfiguracaoTenant {
  return {
    ...TENANT_DEMONSTRACAO,
    id: "minimo",
    nome: "Cliente Mínimo",
    razaoSocial: "Cliente Mínimo Ltda",
    subdominioPrincipal: "minimo.insightdireto.com.br",
    subdominiosValidos: ["minimo"],
    customDomain: undefined,
    filiais: FILIAIS_MINIMAS,
    /**
     * Cliente que ainda não usa nada do ciclo de compras do ERP. O cadastro
     * DESLIGA as capacidades; a fonte continua capaz, e é assim que um cliente
     * novo entra sem que ninguém mexa em código.
     */
    fonte: {
      adaptador: "sintetica",
      capacidadesDesligadas: [
        "pedidosERP",
        "cotacoesERP",
        "entradasConfirmadas",
        "sugestoesErp",
      ],
    },
    parametrosMotor: {
      ...TENANT_DEMONSTRACAO.parametrosMotor,
      filialFocoPadraoId: 7,
    },
    ...sobrescritas,
  };
}

export function tenantSinteticoCompleto(
  sobrescritas: Partial<ConfiguracaoTenant> = {}
): ConfiguracaoTenant {
  return { ...TENANT_DEMONSTRACAO, ...sobrescritas };
}

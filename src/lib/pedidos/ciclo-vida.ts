/**
 * Máquina de Estados e Regras de Transição do Ciclo de Vida de Pedidos
 * Camada: Aplicação / Pedidos (src/lib/pedidos/ciclo-vida.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { StatusPedido, TransicaoPedido, FLUXO_STATUS_PEDIDO } from "./tipos";

export const ROTULOS_STATUS: Record<StatusPedido, string> = {
  exportado: "Exportado",
  enviado: "Enviado ao Fornecedor",
  confirmado: "Confirmado pelo Fornecedor",
  recebido: "Recebido no Estoque",
};

export const DESCRICOES_STATUS: Record<StatusPedido, string> = {
  exportado: "Pedido gerado no cockpit e exportado pelo comprador.",
  enviado: "Pedido formalmente transmitido ao fornecedor.",
  confirmado: "Fornecedor confirmou faturamento e prazo de entrega.",
  recebido: "Mercadoria entregue e conferida no estoque da loja.",
};

export function obterProximoStatus(atual: StatusPedido): StatusPedido | null {
  const indice = FLUXO_STATUS_PEDIDO.indexOf(atual);
  if (indice === -1 || indice >= FLUXO_STATUS_PEDIDO.length - 1) {
    return null;
  }
  return FLUXO_STATUS_PEDIDO[indice + 1];
}

export function obterStatusAnterior(atual: StatusPedido): StatusPedido | null {
  const indice = FLUXO_STATUS_PEDIDO.indexOf(atual);
  if (indice <= 0) {
    return null;
  }
  return FLUXO_STATUS_PEDIDO[indice - 1];
}

export function validarTransicaoStatus(
  atual: StatusPedido,
  novo: StatusPedido
): { valido: boolean; motivo?: string } {
  if (atual === novo) {
    return {
      valido: false,
      motivo: `O pedido já se encontra no estado '${ROTULOS_STATUS[atual]}'.`,
    };
  }

  const proximoEsperado = obterProximoStatus(atual);
  if (novo !== proximoEsperado) {
    return {
      valido: false,
      motivo: `Transição inválida: pedido está em '${ROTULOS_STATUS[atual]}' e deve transitar para '${
        proximoEsperado ? ROTULOS_STATUS[proximoEsperado] : "nenhum"
      }', não para '${ROTULOS_STATUS[novo]}'.`,
    };
  }

  return { valido: true };
}

export function criarRegistroTransicao(params: {
  de: StatusPedido;
  para: StatusPedido;
  responsavel: string;
  observacao?: string | null;
  dataHora?: string;
}): TransicaoPedido {
  return {
    de: params.de,
    para: params.para,
    dataHora: params.dataHora ?? new Date().toISOString(),
    responsavel: params.responsavel,
    observacao: params.observacao ?? null,
  };
}

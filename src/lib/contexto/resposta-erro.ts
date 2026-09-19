/**
 * Tradução de ErroContexto para resposta HTTP
 * Camada: Aplicação (src/lib/contexto)
 * 100% em Português do Brasil (pt-BR).
 *
 * Uma tradução só, para toda rota responder igual: sessão ausente é 401,
 * cliente divergente é 403 seco, configuração incompleta é 503. O detalhe
 * técnico (variáveis faltando) nunca sai em produção.
 */

import { NextResponse } from "next/server";
import { ErroContexto } from "./contexto-requisicao";
import { ehAmbienteProducao } from "@config/tenants";

const STATUS: Record<ErroContexto["motivo"], number> = {
  nao_autenticado: 401,
  tenant_divergente: 403,
  tenant_desconhecido: 404,
  configuracao_incompleta: 503,
  fonte_indisponivel: 503,
};

const MENSAGENS: Record<ErroContexto["motivo"], string> = {
  nao_autenticado: "não autenticado",
  tenant_divergente: "acesso negado a este cliente",
  tenant_desconhecido: "cliente não encontrado",
  configuracao_incompleta: "instalação com configuração incompleta",
  fonte_indisponivel: "fonte de dados indisponível",
};

export function respostaErroContexto(erro: ErroContexto): NextResponse {
  const corpo: Record<string, unknown> = {
    sucesso: false,
    erro: MENSAGENS[erro.motivo],
    motivo: erro.motivo,
  };

  if (!ehAmbienteProducao() && erro.detalhe && erro.detalhe.length > 0) {
    corpo.detalhe = erro.detalhe;
  }

  return NextResponse.json(corpo, { status: STATUS[erro.motivo] });
}

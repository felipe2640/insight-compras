/**
 * Painel de Erro de Contexto (403, configuração incompleta, fonte fora do ar)
 * Camada: Apresentação (src/components/layout)
 * 100% em Português do Brasil (pt-BR).
 *
 * Uma tela para os erros que impedem o cockpit de abrir, com a ação certa em
 * cada caso. O detalhe técnico (nome de variável de ambiente que falta) só
 * aparece para ADMIN ou fora de produção: é informação de infraestrutura, não
 * recado para o comprador.
 */

import React from "react";
import type { MotivoErroContexto } from "@/lib/contexto/contexto-requisicao";

export interface PainelErroContextoProps {
  readonly motivo: MotivoErroContexto;
  readonly detalhe?: readonly string[];
  readonly mostrarDetalhe: boolean;
}

const TEXTOS: Record<
  MotivoErroContexto,
  { titulo: string; explicacao: string; acao?: { rotulo: string; href: string } }
> = {
  nao_autenticado: {
    titulo: "Sessão encerrada",
    explicacao: "Entre novamente para continuar.",
    acao: { rotulo: "Ir para o login", href: "/login" },
  },
  tenant_divergente: {
    titulo: "Acesso negado a este cliente",
    explicacao:
      "Sua sessão pertence a outra rede. Saia e entre novamente na rede que você quer acessar.",
    acao: { rotulo: "Sair e entrar novamente", href: "/login?sair=1" },
  },
  tenant_desconhecido: {
    titulo: "Cliente não encontrado",
    explicacao: "O endereço usado não corresponde a nenhuma rede cadastrada.",
  },
  configuracao_incompleta: {
    titulo: "Configuração incompleta",
    explicacao:
      "Esta instalação ainda não está pronta para operar. Fale com o suporte do Insight Direto.",
  },
  fonte_indisponivel: {
    titulo: "Fonte de dados indisponível",
    explicacao:
      "Não foi possível consultar os dados da rede agora. Nenhum número é exibido para não induzir uma compra errada.",
    acao: { rotulo: "Tentar de novo", href: "" },
  },
};

export function PainelErroContexto({
  motivo,
  detalhe,
  mostrarDetalhe,
}: PainelErroContextoProps): React.ReactElement {
  const texto = TEXTOS[motivo];

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-8 space-y-4 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{texto.titulo}</h1>
        <p className="text-sm text-slate-600">{texto.explicacao}</p>

        {mostrarDetalhe && detalhe && detalhe.length > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs uppercase tracking-wide text-amber-700 mb-1">
              Detalhe técnico
            </p>
            <ul className="text-xs font-mono text-amber-900 space-y-0.5">
              {detalhe.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {texto.acao && texto.acao.href && (
          <a
            href={texto.acao.href}
            className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {texto.acao.rotulo}
          </a>
        )}
      </div>
    </main>
  );
}

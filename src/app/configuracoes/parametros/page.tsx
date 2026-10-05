/**
 * Parâmetros de compra — o que o motor está usando AGORA.
 *
 * Antes esta tela tinha sliders com números soltos, sem ligação com o motor:
 * mexer não mudava a sugestão de nada. O que vale é o arquivo do tenant, e
 * sobre ele pode haver uma calibração PUBLICADA pelo ciclo de aprendizado. A
 * tela mostra os dois e diz qual está valendo.
 *
 * Mudar margem por aqui, na mão, seria contornar a calibração que aprende com o
 * desfecho real. Quem quiser mudar publica pela tela Modelo × Comprador.
 */

import React from "react";
import Link from "next/link";
import { Sliders, FileCode2, GraduationCap } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { obterTenantAtivo } from "@/lib/cockpit/opcoes-tenant";
import { obterUsuarioAtual, rotuloPapel } from "@/lib/autenticacao/servidor";
import { carregarParametrosPublicados } from "@/lib/aprendizado/repositorio";
import { PerfilRotatividade } from "@core/dominio";
import { ConfiguracaoLotes } from "@/components/configuracoes/ConfiguracaoLotes";

export const dynamic = "force-dynamic";

const ROTULO_PERFIL: Record<string, string> = {
  ALTO_GIRO: "Alto giro",
  MEDIO_GIRO: "Médio giro",
  BAIXO_GIRO_INTERMITENTE: "Baixo giro / intermitente",
  SEM_HISTORICO_SUFICIENTE: "Sem histórico suficiente",
};

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export default async function PaginaParametros() {
  const usuario = await obterUsuarioAtual();
  const tenant = obterTenantAtivo(usuario?.tenantId);
  const motor = tenant.parametrosMotor.motor;
  const publicados = usuario ? await carregarParametrosPublicados(usuario.tenantId) : null;

  const perfis = Object.keys(motor.horizontes) as PerfilRotatividade[];
  const margensEmUso = publicados?.margens ?? motor.margens;
  const fatorEmUso = publicados?.fatorCalibracao ?? motor.fatorCalibracao;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <AppSidebar
        usuario={usuario ? { nome: usuario.nome, papelRotulo: rotuloPapel(usuario.role) } : null}
      />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 border-b border-secundaria/30 bg-primaria px-4 py-2.5 text-white shadow-md">
          <h1 className="flex items-center gap-2 text-sm font-semibold">
            <Sliders className="h-4 w-4 text-secundaria" />
            Parâmetros de Compra
          </h1>
          <p className="text-xs text-white/70">
            Em uso: <strong>{publicados ? `calibração ${publicados.versao}` : "configuração atual"}</strong>
          </p>
        </header>

        <div className="mx-auto w-full max-w-[1000px] space-y-3 p-4 text-xs">
          <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600 shadow-sm">
            <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              A previsão considera <code className="rounded bg-slate-100 px-1">consumo diário × horizonte × (1 + margem)</code>,
              arredondada para o lote, com piso pela mediana da linha de venda, e depois
              multiplicada pelo fator de calibração. Esses valores podem ser substituídos por
              uma calibração publicada.
            </span>
          </p>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-3 py-2 font-semibold text-slate-800">
              Horizonte e margem por perfil de giro
            </div>
            <table className="w-full">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-1.5 text-left">Perfil</th>
                  <th className="px-3 py-1.5 text-right">Horizonte</th>
                  <th className="px-3 py-1.5 text-right">Margem padrão</th>
                  <th className="px-3 py-1.5 text-right">Margem em uso</th>
                </tr>
              </thead>
              <tbody>
                {perfis.map((p) => {
                  const doArquivo = motor.margens[p];
                  const emUso = margensEmUso[p];
                  const mudou = doArquivo !== emUso;
                  return (
                    <tr key={p} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 font-semibold text-slate-800">
                        {ROTULO_PERFIL[p] ?? p}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-700">
                        {motor.horizontes[p]} dias
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-500">
                        {pct(doArquivo)}
                      </td>
                      <td
                        className={
                          mudou
                            ? "px-3 py-1.5 text-right font-mono font-bold text-blue-700"
                            : "px-3 py-1.5 text-right font-mono text-slate-700"
                        }
                        title={mudou ? "Substituída por calibração publicada" : undefined}
                      >
                        {pct(emUso)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="mb-1 font-semibold text-slate-800">Calibração</p>
              <dl className="space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <dt>Fator em uso</dt>
                  <dd className="font-mono font-bold text-slate-900">{fatorEmUso.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Origem do piso</dt>
                  <dd className="font-mono">{motor.origemPiso}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Lead time padrão</dt>
                  <dd className="font-mono">{tenant.parametrosMotor.leadTimePadraoDias} dias</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="mb-1 font-semibold text-slate-800">Elegibilidade</p>
              <p className="mb-1 text-slate-600">
                Um item só recebe sugestão depois de provar recorrência.
              </p>
              <dl className="space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <dt>Notas distintas (mín.)</dt>
                  <dd className="font-mono">{motor.elegibilidade.minimoNotasDistintas}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Meses ativos em 12m (mín.)</dt>
                  <dd className="font-mono">{motor.elegibilidade.minimoMesesAtivos}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="mb-1 font-semibold text-slate-800">Redução por governança de margem</p>
            <p className="mb-2 text-slate-600">
              Quando o BI do cliente manda REDUZIR, o corte é proporcional ao quanto a margem
              que o item entregou ficou abaixo da margem com que ele foi precificado.
            </p>
            <dl className="space-y-1 text-slate-600">
              <div className="flex justify-between">
                <dt>Meta única da rede</dt>
                <dd className="font-mono">
                  {motor.reducaoGovernanca.margemAlvoRede === null
                    ? "não usa (alvo por item)"
                    : pct(motor.reducaoGovernanca.margemAlvoRede)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Piso do corte</dt>
                <dd className="font-mono">{pct(motor.reducaoGovernanca.pisoFator)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Item sem custo lançado</dt>
                <dd className="font-mono">{pct(motor.reducaoGovernanca.fatorSemMargem)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="mb-1 font-semibold text-slate-800">Múltiplos de compra</p>
            <ConfiguracaoLotes padrao={tenant.parametrosMotor.lotes} />
          </div>

          <p className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-900">
            <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              As margens não se editam na mão aqui: elas são aprendidas com o que de fato
              entrou depois de cada pedido. Simule e publique em{" "}
              <Link href="/aprendizado" className="font-semibold underline">
                Modelo × Comprador
              </Link>
              .
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}

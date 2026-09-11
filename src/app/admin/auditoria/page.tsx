import React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { servicoAuditoriaPadrao } from "@/lib/auditoria";
import { validarCadeiaAuditoria } from "@/lib/auditoria/repositorio-auditoria";
import { obterConfiguracaoTenant, resolverTenantConfigurado, TENANT_PADRAO } from "@config/tenants";

export const dynamic = "force-dynamic";

export default async function PaginaAuditoriaGestor() {
  const headersList = headers();
  const tenantIdHeader = headersList.get("x-tenant-id");
  const tenant = tenantIdHeader
    ? (obterConfiguracaoTenant(tenantIdHeader) || TENANT_PADRAO)
    : resolverTenantConfigurado();
  const tenantId = tenant.id;

  const [trilha, kpis] = await Promise.all([
    servicoAuditoriaPadrao.consultarTrilha({ tenantId }),
    servicoAuditoriaPadrao.calcularKpisGerenciais(tenantId),
  ]);

  const statusCadeia = validarCadeiaAuditoria(trilha);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      <AppSidebar />

      <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Header Institucional */}
      <header
        className="text-white shadow-md border-b bg-[var(--cor-primaria)] border-[var(--cor-secundaria)]/30"
        style={{ backgroundColor: "var(--cor-primaria)", borderBottomColor: "rgba(var(--cor-secundaria-rgb), 0.3)" }}
      >
        <div className="max-w-[1920px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/compras"
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1 rounded text-xs transition-colors flex items-center gap-1.5"
            >
              ← Voltar ao Cockpit
            </Link>
            <span
              className="text-sm font-black text-[var(--cor-secundaria)]"
              style={{ color: "var(--cor-secundaria)" }}
            >
              {tenant.nome.toUpperCase()}
            </span>
            <span className="text-slate-400 text-xs">|</span>
            <span className="text-xs text-slate-200">
              Painel de Governança e Auditoria Imutável de Pedidos
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/40 px-2.5 py-1 rounded">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 font-semibold">
                {statusCadeia.valida
                  ? "Cadeia SHA-256 Íntegra (Tamper-Evident)"
                  : "Alerta de Adulteração na Cadeia!"}
              </span>
            </div>
            <span
              className="text-xs text-[var(--cor-secundaria)] font-semibold"
              style={{ color: "var(--cor-secundaria)" }}
            >
              {tenant.assinatura?.texto || "Powered by iNSIGHT D"}
            </span>
          </div>
        </div>
      </header>

      {/* Painel de KPIs Gerenciais */}
      <main className="max-w-[1920px] mx-auto p-4 w-full flex-1 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Total Registros */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-slate-500 font-medium uppercase text-[10px]">
              Total de Ações Auditadas
            </span>
            <div className="text-2xl font-black text-slate-800 mt-1">
              {kpis.totalRegistros}
            </div>
            <span className="text-[11px] text-slate-400">Trilha 100% Criptográfica</span>
          </div>

          {/* Taxa de Aderência */}
          <div className="bg-white p-4 rounded-lg border border-emerald-200 bg-emerald-50/30 shadow-sm">
            <span className="text-emerald-800 font-semibold uppercase text-[10px]">
              Aderência ao Motor Numérico
            </span>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {kpis.taxaAderenciaMotorPercentual}%
            </div>
            <span className="text-[11px] text-emerald-600">
              {kpis.totalConformes} pedidos sem divergência
            </span>
          </div>

          {/* Sobrecompras Manuais */}
          <div className="bg-white p-4 rounded-lg border border-amber-200 bg-amber-50/30 shadow-sm">
            <span className="text-amber-800 font-semibold uppercase text-[10px]">
              Sobrecompras Manuais
            </span>
            <div className="text-2xl font-black text-amber-700 mt-1">
              {kpis.totalSobrecompras}
            </div>
            <span className="text-[11px] text-amber-600">Ajustes acima da sugestão</span>
          </div>

          {/* Impacto Financeiro Sobrecompra */}
          <div className="bg-white p-4 rounded-lg border border-rose-200 bg-rose-50/30 shadow-sm">
            <span className="text-rose-800 font-semibold uppercase text-[10px]">
              Impacto de Capital em Sobrecompras
            </span>
            <div className="text-2xl font-black text-rose-700 mt-1">
              R$ {kpis.impactoFinanceiroTotalSobrecompra.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-rose-600">Capital adicional alocado</span>
          </div>

          {/* Subcompras / Cortes */}
          <div className="bg-white p-4 rounded-lg border border-blue-200 bg-blue-50/30 shadow-sm">
            <span className="text-blue-800 font-semibold uppercase text-[10px]">
              Cortes ou Subcompras
            </span>
            <div className="text-2xl font-black text-blue-700 mt-1">
              {kpis.totalSubcompras}
            </div>
            <span className="text-[11px] text-blue-600">Reduções pelo comprador</span>
          </div>
        </div>

        {/* Tabela da Trilha de Auditoria */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Histórico Rastreável de Ordens de Compra & Overrides
              </h2>
              <p className="text-xs text-slate-500">
                Cada ação do comprador é imutavelmente assinada com SHA-256 encadeado ao registro anterior.
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Total: <strong>{trilha.length}</strong> registros
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3">Comprador</th>
                  <th className="p-3">Filial</th>
                  <th className="p-3">SKU & Descrição</th>
                  <th className="p-3 text-right">Sugestão Motor</th>
                  <th className="p-3 text-right">Pedido Final</th>
                  <th className="p-3 text-right">Divergência</th>
                  <th className="p-3 text-right">Impacto (R$)</th>
                  <th className="p-3">Classificação</th>
                  <th className="p-3">Justificativa</th>
                  <th className="p-3">Hash SHA-256</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trilha.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400">
                      Nenhum pedido ou alteração manual registrada nesta sessão ainda.
                    </td>
                  </tr>
                ) : (
                  trilha.map((reg) => {
                    const isSobre = reg.classificacaoDivergencia === "SOBRECOMPRA";
                    const isSub = reg.classificacaoDivergencia === "SUBCOMPRA" || reg.classificacaoDivergencia === "ZERAMENTO_MANUAL";

                    return (
                      <tr key={reg.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-slate-500 whitespace-nowrap">
                          {new Date(reg.timestamp).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-3 font-medium text-slate-800">
                          {reg.compradorNome}
                        </td>
                        <td className="p-3 text-slate-600">{reg.filialNome}</td>
                        <td className="p-3">
                          <span className="font-mono font-bold text-slate-800 block">
                            {reg.codigoSku}
                          </span>
                          <span className="text-slate-500 truncate block max-w-xs">
                            {reg.descricaoProduto}
                          </span>
                        </td>
                        <td className="p-3 text-right font-medium text-slate-700">
                          {reg.quantidadeSugeridaSistema} un
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          {reg.quantidadeDigitadaComprador} un
                        </td>
                        <td
                          className={`p-3 text-right font-bold ${
                            isSobre
                              ? "text-rose-600"
                              : isSub
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {reg.divergenciaQuantidade > 0 ? `+${reg.divergenciaQuantidade}` : reg.divergenciaQuantidade} un
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-700">
                          R$ {reg.impactoFinanceiroDivergencia.toFixed(2)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isSobre
                                ? "bg-rose-100 text-rose-800"
                                : isSub
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {reg.classificacaoDivergencia}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 italic max-w-xs truncate">
                          {reg.justificativaOverride || "—"}
                        </td>
                        <td className="p-3 font-mono text-[10px] text-slate-400 max-w-[120px] truncate" title={reg.hashIntegridade}>
                          {reg.hashIntegridade.slice(0, 10)}...
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}

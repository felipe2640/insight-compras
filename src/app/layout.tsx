import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import {
  obterConfiguracaoTenant,
  resolverTenantConfigurado,
} from "@config/tenants";
import { gerarStringCssVarsInline } from "@config/tenants/tipos";
import { ProvedorTenant } from "@/lib/cockpit/contexto-tenant";

export const metadata: Metadata = {
  title: "Insight Direto — Copiloto de Inteligência e Decisão de Compras",
  description:
    "Plataforma de Inteligência e Decisão de Compras de Autopeças",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // O middleware já resolveu o tenant (query > subdomínio > domínio > cookie >
  // TENANT_ATIVO) e o anunciou no cabeçalho. Sem cabeçalho — render fora do
  // middleware — vale a mesma regra de sempre: a variável de ambiente, e na
  // falta dela a DEMONSTRAÇÃO.
  const tenantIdHeader = headers().get("x-tenant-id");
  const tenant = tenantIdHeader
    ? obterConfiguracaoTenant(tenantIdHeader) || resolverTenantConfigurado()
    : resolverTenantConfigurado();
  const inlineCssVars = gerarStringCssVarsInline(tenant);

  // A calibração do cliente fica no servidor; o navegador recebe só a identidade.
  const { parametrosMotor: _parametrosMotor, ...tenantCliente } = tenant;

  return (
    <html lang="pt-BR">
      <head>
        <style
          dangerouslySetInnerHTML={{ __html: `:root { ${inlineCssVars} }` }}
        />
        <link
          rel="icon"
          href={tenant.identidadeVisual.favicon || "/favicon.ico"}
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <ProvedorTenant tenant={tenantCliente}>{children}</ProvedorTenant>
      </body>
    </html>
  );
}

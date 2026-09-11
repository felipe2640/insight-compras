import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { obterConfiguracaoTenant, resolverTenantConfigurado, TENANT_PADRAO } from "@config/tenants";
import { gerarStringCssVarsInline } from "@config/tenants/tipos";

export const metadata: Metadata = {
  title: "iNSIGHT D — Copiloto de Inteligência e Decisão de Compras",
  description: "Plataforma White-Label de Inteligência e Decisão de Compras de Autopeças",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = headers();
  const tenantIdHeader = headersList.get("x-tenant-id");
  const tenant = tenantIdHeader
    ? (obterConfiguracaoTenant(tenantIdHeader) || TENANT_PADRAO)
    : resolverTenantConfigurado();
  const inlineCssVars = gerarStringCssVarsInline(tenant);

  return (
    <html lang="pt-BR" style={{ ...({} as any) }}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `:root { ${inlineCssVars} }` }} />
        <link rel="icon" href={tenant.identidadeVisual.favicon || "/favicon.ico"} />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

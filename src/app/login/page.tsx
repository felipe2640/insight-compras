/**
 * Entrada da plataforma.
 *
 * A página é do SERVIDOR porque só ele sabe qual provedor de autenticação está
 * ativo. Isso importa para uma coisa: quando a instalação sobe sem credenciais
 * de nuvem, ela roda em modo demonstração com contas internas — e a tela
 * precisa DIZER quais são. Um mostruário que ninguém consegue abrir não mostra
 * nada, e adivinhar usuário não é trabalho de quem está avaliando o produto.
 */

import React from "react";
import { headers } from "next/headers";
import { Info } from "lucide-react";
import { FormularioLogin } from "./formulario-login";
import { idProvedorConfigurado } from "@/lib/autenticacao";
import { USUARIOS_DEMO } from "@/lib/autenticacao/provedores/demo";
import { naturezaTenant } from "@config/tenants";
import { obterTenantAtivo } from "@/lib/cockpit/opcoes-tenant";

export const dynamic = "force-dynamic";

export default function PaginaLogin() {
  /**
   * A tabela de contas e senhas acompanha o provedor de demonstração.
   *
   * Ela só aparece onde ele de fato autentica: no tenant de DEMONSTRAÇÃO. Na
   * instalação de um cliente o provedor recusa, e publicar as senhas seria
   * pior que inútil. Estava amarrada a NODE_ENV, o que escondia a tabela no
   * mostruário publicado — e, junto com a trava do provedor, deixava o
   * visitante diante de um login em que era impossível entrar.
   */
  const tenantIdHeader = headers().get("x-tenant-id");
  const tenant = obterTenantAtivo(tenantIdHeader);
  const modoDemonstracao =
    idProvedorConfigurado() === "demo" && naturezaTenant(tenant) === "sintetica";
  const senhaDemo = process.env.DEMO_SENHA ?? "demo";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 p-4">
      <React.Suspense fallback={<div className="w-full max-w-md h-72 rounded-2xl bg-white animate-pulse" />}>
        <FormularioLogin />
      </React.Suspense>

      {modoDemonstracao && (
        <div className="w-full max-w-md rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
          <p className="mb-1.5 flex items-center gap-1.5 font-semibold">
            <Info className="h-3.5 w-3.5" />
            Ambiente de demonstração
          </p>
          <p className="mb-2 text-[11px] leading-snug">
            Sem banco de autenticação configurado, a plataforma roda com contas internas e
            dados sintéticos. Nenhuma informação aqui é de cliente real.
          </p>
          <table className="w-full">
            <thead className="text-[10px] uppercase tracking-wide text-sky-700">
              <tr>
                <th className="py-0.5 text-left">Usuário</th>
                <th className="py-0.5 text-left">Senha</th>
                <th className="py-0.5 text-left">Enxerga</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {USUARIOS_DEMO.map((u) => (
                <tr key={u.id} className="border-t border-sky-200/70">
                  <td className="py-0.5 font-bold">{u.usuario}</td>
                  <td className="py-0.5">{senhaDemo}</td>
                  <td className="py-0.5 font-sans">
                    {u.papel === "ADMIN"
                      ? "tudo, inclusive cadastro de usuários"
                      : u.papel === "GESTOR"
                        ? "a rede inteira e a calibração"
                        : "apenas a carteira dele"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] leading-snug text-sky-800">
            Ambiente: <strong>{tenant.nome}</strong>.
          </p>
        </div>
      )}
    </div>
  );
}

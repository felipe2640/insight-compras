import React from "react";
import { headers } from "next/headers";
import { CockpitPrincipal } from "@/components/cockpit/CockpitPrincipal";
import { obterUsuarioAtual, rotuloPapel } from "@/lib/autenticacao/servidor";
import { obterTenantAtivo } from "@/lib/cockpit/opcoes-tenant";

// A página lê a sessão (cookies), portanto é dinâmica por requisição; o cache de dados fica no adapter.
export const dynamic = "force-dynamic";

async function CarregarDadosCockpit() {
  const usuario = await obterUsuarioAtual();
  const tenantIdHeader = headers().get("x-tenant-id");
  const tenantId = tenantIdHeader ?? usuario?.tenantId;
  const tenant = obterTenantAtivo(tenantId);

  /**
   * Loja que abre em foco: do CADASTRO do cliente.
   *
   * Obtida dinamicamente da configuração do tenant resolvido na requisição.
   */
  const filialFoco = tenant.parametrosMotor.filialFocoPadraoId;

  // Falha fechada: Comprador sem carteira enxerga ZERO fornecedores (grade vazia).
  // Gestor e admin continuam irrestritos (null).
  const ehComprador = usuario?.role === "COMPRADOR";
  const fornecedoresRaw = ehComprador
    ? (usuario.allowedSupplierIds ?? [])
    : (usuario?.allowedSupplierIds ?? null);

  const fornecedoresPermitidos: readonly number[] | null = !fornecedoresRaw
    ? null
    : Array.isArray(fornecedoresRaw)
    ? fornecedoresRaw
    : Array.from(fornecedoresRaw);

  return (
    <CockpitPrincipal
      filialFocoIdInicial={filialFoco}
      fornecedoresPermitidosInicial={fornecedoresPermitidos}
      usuarioSessao={
        usuario
          ? {
              id: usuario.id,
              nome: usuario.nome,
              usuario: usuario.email,
              papel: usuario.role,
              papelRotulo: rotuloPapel(usuario.role),
              allowedSupplierIds: fornecedoresPermitidos,
            }
          : null
      }
    />
  );
}

/**
 * O servidor entrega o shell após validar a sessão, sem bloquear a navegação
 * pela consulta do inventário. A grade é preenchida pela API no navegador: o
 * usuário sai imediatamente do login e acompanha o carregamento no cockpit.
 * Isso também elimina a antiga carga duplicada (SSR e API logo em seguida).
 */
export default function PaginaCockpitCompras() {
  return <CarregarDadosCockpit />;
}

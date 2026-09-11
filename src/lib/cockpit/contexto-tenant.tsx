"use client";

/**
 * Identidade do cliente ativo para os componentes de NAVEGADOR.
 * Camada: Aplicação / Cockpit.
 *
 * POR QUE ISTO EXISTE
 * `TENANT_ATIVO` é uma variável de servidor. Componentes client que a liam
 * direto (`obterTenantAtivo()` no topo do módulo) recebiam `undefined` no
 * navegador — o Next só injeta no pacote do cliente o que tem prefixo
 * `NEXT_PUBLIC_`. O resultado era uma divergência silenciosa: o servidor
 * renderizava "Rede Carreiro Autopeças" e o navegador re-renderizava "Rede
 * Demonstração" por cima, quebrando a hidratação da página inteira e exibindo
 * nomes de loja genéricos sobre dados reais do cliente.
 *
 * Agora quem resolve é o servidor, uma vez, no layout raiz; o navegador apenas
 * recebe. Uma decisão, um lugar — e nenhuma build precisa ser refeita por
 * cliente, como aconteceria com um `NEXT_PUBLIC_TENANT_ATIVO`.
 *
 * O que NÃO atravessa: `parametrosMotor`. A calibração é o ativo do cliente,
 * nasce do histórico dele e o motor roda no servidor. Não há por que ela viajar
 * até o navegador.
 */

import React, { createContext, useContext, useMemo } from "react";
import { ConfiguracaoTenant } from "@config/tenants/tipos";

/** O tenant como o navegador precisa conhecê-lo: sem os parâmetros do motor. */
export type TenantCliente = Omit<ConfiguracaoTenant, "parametrosMotor">;

const ContextoTenant = createContext<TenantCliente | null>(null);

export function ProvedorTenant({
  tenant,
  children,
}: {
  tenant: TenantCliente;
  children: React.ReactNode;
}) {
  return <ContextoTenant.Provider value={tenant}>{children}</ContextoTenant.Provider>;
}

/**
 * O cliente que esta instalação atende.
 *
 * Lança se usado fora do provedor: um nome de loja errado na tela é pior do que
 * um erro visível em desenvolvimento — foi exatamente o silêncio que deixou o
 * cockpit exibir "Loja Matriz" sobre o estoque real da rede.
 */
export function useTenantAtivo(): TenantCliente {
  const tenant = useContext(ContextoTenant);
  if (!tenant) {
    throw new Error(
      "useTenantAtivo() fora de <ProvedorTenant>. O layout raiz precisa envolver a árvore."
    );
  }
  return tenant;
}

/** Mapa filialId -> nome, do cadastro do tenant. */
export function useNomesFiliais(): Readonly<Record<number, string>> {
  const tenant = useTenantAtivo();
  return useMemo(() => {
    const mapa: Record<number, string> = {};
    for (const filial of tenant.filiais) {
      mapa[filial.filialId] = filial.nome;
    }
    return mapa;
  }, [tenant]);
}

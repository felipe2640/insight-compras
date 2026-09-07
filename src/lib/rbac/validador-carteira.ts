/**
 * Validador de Carteira e Regras de Negócio de Autorização (Server-Side)
 * Camada: Aplicação / Segurança (src/lib/rbac/validador-carteira.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { UsuarioAutenticado } from "./tipos";
import { ErroAcessoNegado, ErroViolacaoTenant } from "./tipos";
import { FiltroCargaInventario } from "@adapters/AdaptadorInventario";

/**
 * Normaliza uma coleção de fornecedores (Set ou Array) para um ReadonlySet<number> seguro para consultas O(1).
 */
export function normalizarSetFornecedores(
  fornecedores: ReadonlySet<number> | readonly number[] | null | undefined
): ReadonlySet<number> | null {
  if (fornecedores === null || fornecedores === undefined) return null;
  if (fornecedores instanceof Set) return fornecedores;
  return new Set(fornecedores);
}

/**
 * Valida se um usuário tem permissão para operar sobre um fornecedor específico.
 */
export function verificarAcessoFornecedor(
  usuario: UsuarioAutenticado,
  fornecedorId: number
): boolean {
  if (usuario.role === "GESTOR" || usuario.role === "ADMIN") {
    return true;
  }
  const setPermitidos = normalizarSetFornecedores(usuario.allowedSupplierIds);
  if (!setPermitidos) return false;
  return setPermitidos.has(fornecedorId);
}

/**
 * Valida e converte o filtro de inventário solicitado para um filtro estritamente seguro.
 * Se o comprador tentar solicitar fornecedores fora de sua carteira, lança ErroAcessoNegado (403).
 */
export function aplicarGuardrailInventarioServerSide(
  usuario: UsuarioAutenticado,
  filtroSolicitado: Partial<FiltroCargaInventario> = {}
): FiltroCargaInventario {
  // 1. Gestor ou Admin: permissão total
  if (usuario.role === "GESTOR" || usuario.role === "ADMIN") {
    return {
      fornecedoresPermitidos: filtroSolicitado.fornecedoresPermitidos ?? null,
      secaoId: filtroSolicitado.secaoId,
      apenasComEstoqueOuVenda: filtroSolicitado.apenasComEstoqueOuVenda,
      filialId: filtroSolicitado.filialId,
    };
  }

  // 2. Comprador: restrição estrita
  const setPermitidos = normalizarSetFornecedores(usuario.allowedSupplierIds);
  const listaPermitidos = Array.from(setPermitidos ?? []);

  if (listaPermitidos.length === 0) {
    throw new ErroAcessoNegado("Comprador sem nenhum fornecedor associado à sua carteira.");
  }

  // Se o cliente solicitou fornecedores específicos na query, todos devem estar em sua carteira
  if (filtroSolicitado.fornecedoresPermitidos && filtroSolicitado.fornecedoresPermitidos.length > 0) {
    for (const fId of filtroSolicitado.fornecedoresPermitidos) {
      if (!setPermitidos!.has(fId)) {
        throw new ErroAcessoNegado(
          `Tentativa de acesso não autorizada ao fornecedor ${fId}. Fornecedor fora da sua carteira homologada.`,
          fId,
          listaPermitidos
        );
      }
    }
    return {
      ...filtroSolicitado,
      fornecedoresPermitidos: filtroSolicitado.fornecedoresPermitidos,
    };
  }

  // Por padrão, se não informou fornecedor específico, restringe a toda a carteira do comprador
  return {
    ...filtroSolicitado,
    fornecedoresPermitidos: listaPermitidos,
  };
}

/**
 * Valida se um conjunto de itens de pedido pertence integralmente à carteira do comprador.
 * Lança ErroAcessoNegado se houver qualquer item fora da alçada.
 */
export function validarItensPedidoServerSide(
  usuario: UsuarioAutenticado,
  itens: readonly { fornecedorId: number; codigoSku: string }[]
): void {
  if (usuario.role === "GESTOR" || usuario.role === "ADMIN") {
    return;
  }

  const setPermitidos = normalizarSetFornecedores(usuario.allowedSupplierIds);
  const listaPermitidos = Array.from(setPermitidos ?? []);

  for (const item of itens) {
    if (!setPermitidos || !setPermitidos.has(item.fornecedorId)) {
      throw new ErroAcessoNegado(
        `O SKU ${item.codigoSku} pertence ao fornecedor ${item.fornecedorId}, que está fora da sua carteira de compras.`,
        item.fornecedorId,
        listaPermitidos
      );
    }
  }
}

/**
 * Garante que o usuário autenticado pertença ao tenant da requisição.
 */
export function validarTenantContexto(usuario: UsuarioAutenticado, tenantIdAlvo: string): void {
  if (usuario.tenantId !== tenantIdAlvo) {
    throw new ErroViolacaoTenant(
      `Usuário do tenant '${usuario.tenantId}' tentou operar sobre o tenant '${tenantIdAlvo}'.`
    );
  }
}

/**
 * Bloqueia compradores de acessar rotas e relatórios exclusivos de gestão.
 */
export function garantirAcessoGerencial(usuario: UsuarioAutenticado): void {
  if (usuario.role !== "GESTOR" && usuario.role !== "ADMIN") {
    throw new ErroAcessoNegado(
      "Acesso Negado: O Painel e Logs de Auditoria são restritos a Gestores e Administradores."
    );
  }
}

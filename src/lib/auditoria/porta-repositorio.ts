/**
 * Contratos e Porta de Persistência da Trilha de Auditoria
 * Camada: Aplicação / Auditoria (src/lib/auditoria/porta-repositorio.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { AuditoriaPedido, FiltrosConsultaAuditoria } from "./tipos";
import { UsuarioAutenticado } from "../rbac/tipos";

export type IdProvedorAuditoria = "supabase" | "memoria";

export interface RepositorioAuditoria {
  readonly id: string;
  adicionarRegistro(registro: AuditoriaPedido): Promise<void>;
  obterUltimoRegistro(tenantId: string): Promise<AuditoriaPedido | null>;
  consultar(filtros: FiltrosConsultaAuditoria): Promise<readonly AuditoriaPedido[]>;
  obterTodos(tenantId: string): Promise<readonly AuditoriaPedido[]>;
  limpar(tenantId?: string): void | Promise<void>;
}

export interface ParametrosRegistroPedido {
  readonly usuario: UsuarioAutenticado;
  readonly produtoId: number;
  readonly codigoSku: string;
  readonly descricaoProduto?: string;
  readonly fornecedorId: number;
  readonly nomeFornecedor?: string;
  readonly filialId: number;
  readonly filialNome?: string;
  readonly quantidadeSugerida: number;
  readonly quantidadeDigitada: number;
  readonly precoCusto: number;
  readonly justificativaOverride?: string | null;
}

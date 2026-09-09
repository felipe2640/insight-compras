/**
 * PORTA de autenticação — o contrato que a plataforma exige de QUALQUER provedor.
 * Camada: Aplicação (src/lib/autenticacao). Sem dependência de nuvem.
 *
 * Regra white-label: a plataforma não sabe se por trás há Supabase, Firebase,
 * Cognito, Google Identity ou Vercel. Ela só conhece esta interface. Trocar de
 * provedor = escrever um arquivo em `provedores/` e apontar AUTH_PROVIDER.
 *
 * O que a plataforma precisa de um provedor:
 *  - entrar(e-mail, senha)  -> sessão com token opaco
 *  - validar(token)         -> quem é o usuário (ou null)
 *  - renovar(tokenRenovacao)-> sessão nova (ou null)
 *  - sair(token)            -> revoga
 * O TOKEN é opaco para a plataforma: ela só o guarda no cookie e devolve.
 */

import type { PapelUsuario, UsuarioAutenticado } from "@/lib/rbac/tipos";
import { ErroNaoAutenticado } from "@/lib/rbac/tipos";

export type IdProvedorAutenticacao = "supabase" | "demo";

export interface CredenciaisLogin {
  readonly email: string;
  readonly senha: string;
  /** Tenant resolvido pelo middleware (subdomínio/cookie). O usuário precisa pertencer a ele. */
  readonly tenantId: string;
}

export interface SessaoAutenticada {
  readonly provedor: IdProvedorAutenticacao;
  readonly usuario: UsuarioAutenticado;
  /** Token opaco do provedor (JWT no Supabase, assinado localmente no demo). */
  readonly token: string;
  readonly tokenRenovacao: string | null;
  /** Instante de expiração em epoch ms. */
  readonly expiraEm: number;
}

export interface ProvedorAutenticacao {
  readonly id: IdProvedorAutenticacao;
  entrar(credenciais: CredenciaisLogin): Promise<SessaoAutenticada>;
  validar(token: string, tenantId: string): Promise<UsuarioAutenticado | null>;
  renovar(tokenRenovacao: string, tenantId: string): Promise<SessaoAutenticada | null>;
  sair(token: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Administração de usuários (lado servidor, chave privilegiada)
// ---------------------------------------------------------------------------

export interface NovoUsuario {
  readonly email: string;
  readonly senha: string;
  readonly nome: string;
  readonly papel: PapelUsuario;
  readonly tenantId: string;
  /** null = carteira irrestrita (gestor/admin). */
  readonly fornecedores: readonly number[] | null;
}

export interface UsuarioCadastrado {
  readonly id: string;
  readonly email: string;
  readonly nome: string;
  readonly papel: PapelUsuario;
  readonly tenantId: string;
  readonly fornecedores: readonly number[] | null;
  readonly criadoEm: string;
}

export interface AdministradorUsuarios {
  criarUsuario(novo: NovoUsuario): Promise<UsuarioCadastrado>;
  listarUsuarios(tenantId: string): Promise<UsuarioCadastrado[]>;
}

// ---------------------------------------------------------------------------
// Erros e normalização do perfil (compartilhados por todos os provedores)
// ---------------------------------------------------------------------------

export class ErroCredenciaisInvalidas extends ErroNaoAutenticado {
  constructor() {
    super("E-mail ou senha inválidos.");
    this.name = "ErroCredenciaisInvalidas";
  }
}

export class ErroProvedorIndisponivel extends Error {
  constructor(provedor: string, detalhe: string) {
    super(`Provedor de autenticação "${provedor}" indisponível: ${detalhe}`);
    this.name = "ErroProvedorIndisponivel";
  }
}

const PAPEIS: readonly PapelUsuario[] = ["COMPRADOR", "GESTOR", "ADMIN"];

export function normalizarPapel(valor: unknown): PapelUsuario | null {
  if (typeof valor !== "string") return null;
  const maiusculo = valor.trim().toUpperCase();
  return (PAPEIS as readonly string[]).includes(maiusculo) ? (maiusculo as PapelUsuario) : null;
}

/** Aceita array numérico, array de strings numéricas ou "1,2,3". Vazio/null = irrestrito. */
export function normalizarFornecedores(valor: unknown): number[] | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const lista = Array.isArray(valor) ? valor : typeof valor === "string" ? valor.split(",") : [];
  const ids = lista
    .map((v) => (typeof v === "number" ? v : parseInt(String(v).trim(), 10)))
    .filter((n) => Number.isInteger(n) && n > 0);
  return ids.length > 0 ? Array.from(new Set(ids)) : null;
}

/** Monta o usuário canônico a partir dos atributos que qualquer provedor consegue devolver. */
export function montarUsuarioAutenticado(atributos: {
  readonly id: string;
  readonly email: string;
  readonly nome: unknown;
  readonly papel: unknown;
  readonly tenantId: unknown;
  readonly fornecedores: unknown;
}, tenantEsperado: string): UsuarioAutenticado | null {
  const papel = normalizarPapel(atributos.papel);
  if (!papel) return null;
  if (typeof atributos.tenantId !== "string" || atributos.tenantId !== tenantEsperado) return null;
  const fornecedores = normalizarFornecedores(atributos.fornecedores);
  return {
    id: atributos.id,
    email: atributos.email,
    nome: typeof atributos.nome === "string" && atributos.nome.trim() ? atributos.nome.trim() : atributos.email,
    role: papel,
    // Comprador sem carteira definida não enxerga nada (falha fechada); gestor/admin é irrestrito.
    allowedSupplierIds: papel === "COMPRADOR" ? fornecedores ?? [] : fornecedores,
    tenantId: tenantEsperado,
  };
}

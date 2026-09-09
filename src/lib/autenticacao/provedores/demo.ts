/**
 * Provedor DEMO — sem nuvem. Usuários fixos, token assinado localmente (HMAC).
 * Camada: Aplicação (src/lib/autenticacao/provedores). Edge-safe (WebCrypto).
 *
 * Para quê: testes automatizados, ambiente sem credenciais e demonstração
 * offline. NÃO é para produção: a senha é única e vem de DEMO_SENHA.
 */

import type { UsuarioAutenticado, PapelUsuario } from "@/lib/rbac/tipos";
import {
  CredenciaisLogin,
  ErroCredenciaisInvalidas,
  ProvedorAutenticacao,
  SessaoAutenticada,
  montarUsuarioAutenticado,
} from "../porta";
import { base64UrlCodificar, base64UrlDecodificar } from "../sessao";

interface UsuarioDemo {
  readonly id: string;
  readonly email: string;
  readonly nome: string;
  readonly papel: PapelUsuario;
  readonly fornecedores: readonly number[] | null;
}

export const USUARIOS_DEMO: readonly UsuarioDemo[] = [
  { id: "demo-gestor", email: "gestor@demo", nome: "Gestor Demonstração", papel: "GESTOR", fornecedores: null },
  { id: "demo-admin", email: "admin@demo", nome: "Administrador Demonstração", papel: "ADMIN", fornecedores: null },
  { id: "demo-comprador", email: "comprador@demo", nome: "Comprador Demonstração", papel: "COMPRADOR", fornecedores: null },
];

const DURACAO_SESSAO_MS = 12 * 3600 * 1000;
const SEGREDO_PADRAO_DEV = "insight-demo-segredo-somente-desenvolvimento";

interface CargaToken {
  readonly sub: string;
  readonly email: string;
  readonly nome: string;
  readonly papel: PapelUsuario;
  readonly tenantId: string;
  readonly fornecedores: readonly number[] | null;
  readonly exp: number;
}

async function assinar(segredo: string, dados: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(dados));
  return base64UrlCodificar(String.fromCharCode(...new Uint8Array(assinatura)));
}

function igualConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface OpcoesProvedorDemo {
  readonly senha?: string;
  readonly segredo?: string;
  readonly usuarios?: readonly UsuarioDemo[];
  readonly agora?: () => number;
}

export class ProvedorAutenticacaoDemo implements ProvedorAutenticacao {
  readonly id = "demo" as const;
  private readonly senha: string;
  private readonly segredo: string;
  private readonly usuarios: readonly UsuarioDemo[];
  private readonly agora: () => number;

  constructor(opcoes: OpcoesProvedorDemo = {}) {
    this.senha = opcoes.senha ?? process.env.DEMO_SENHA ?? "demo";
    this.segredo = opcoes.segredo ?? process.env.AUTH_SECRET ?? SEGREDO_PADRAO_DEV;
    this.usuarios = opcoes.usuarios ?? USUARIOS_DEMO;
    this.agora = opcoes.agora ?? (() => Date.now());
  }

  async entrar(credenciais: CredenciaisLogin): Promise<SessaoAutenticada> {
    const usuario = this.usuarios.find((u) => u.email.toLowerCase() === credenciais.email.trim().toLowerCase());
    if (!usuario || credenciais.senha !== this.senha) {
      throw new ErroCredenciaisInvalidas();
    }
    const exp = this.agora() + DURACAO_SESSAO_MS;
    const carga: CargaToken = { sub: usuario.id, ...usuario, tenantId: credenciais.tenantId, exp };
    const cargaCodificada = base64UrlCodificar(JSON.stringify(carga));
    const token = `${cargaCodificada}.${await assinar(this.segredo, cargaCodificada)}`;
    const usuarioAutenticado = montarUsuarioAutenticado(
      { id: usuario.id, email: usuario.email, nome: usuario.nome, papel: usuario.papel, tenantId: credenciais.tenantId, fornecedores: usuario.fornecedores },
      credenciais.tenantId
    )!;
    return { provedor: "demo", usuario: usuarioAutenticado, token, tokenRenovacao: null, expiraEm: exp };
  }

  async validar(token: string, tenantId: string): Promise<UsuarioAutenticado | null> {
    const [cargaCodificada, assinatura] = token.split(".");
    if (!cargaCodificada || !assinatura) return null;
    const esperada = await assinar(this.segredo, cargaCodificada);
    if (!igualConstante(esperada, assinatura)) return null;
    const json = base64UrlDecodificar(cargaCodificada);
    if (!json) return null;
    let carga: CargaToken;
    try {
      carga = JSON.parse(json) as CargaToken;
    } catch {
      return null;
    }
    if (typeof carga.exp !== "number" || carga.exp <= this.agora()) return null;
    return montarUsuarioAutenticado(
      { id: carga.sub, email: carga.email, nome: carga.nome, papel: carga.papel, tenantId: carga.tenantId, fornecedores: carga.fornecedores },
      tenantId
    );
  }

  async renovar(): Promise<SessaoAutenticada | null> {
    return null; // demo não renova: expira e pede login de novo
  }

  async sair(): Promise<void> {
    // token sem estado: expira sozinho
  }
}

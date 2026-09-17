/**
 * Provedor DEMO — sem nuvem. Usuários configuráveis em memória, token assinado localmente (HMAC).
 * Camada: Aplicação (src/lib/autenticacao/provedores). Edge-safe (WebCrypto).
 *
 * Para quê: testes automatizados, ambiente sem credenciais e demonstração
 * offline. NÃO é para produção: a senha padrão vem de DEMO_SENHA.
 *
 * Implementa ProvedorAutenticacao e AdministradorUsuarios.
 */

import type { UsuarioAutenticado, PapelUsuario } from "@/lib/rbac/tipos";
import {
  AdministradorUsuarios,
  CredenciaisLogin,
  ErroCredenciaisInvalidas,
  ErroProvedorIndisponivel,
  ErroUsuarioDesativado,
  NovoUsuario,
  ProvedorAutenticacao,
  SessaoAutenticada,
  UsuarioCadastrado,
  montarUsuarioAutenticado,
  normalizarNomeUsuario,
  normalizarFornecedores,
} from "../porta";
import { base64UrlCodificar, base64UrlDecodificar } from "../sessao";
import {
  TENANT_PADRAO,
  buscarConfiguracaoTenant,
  naturezaTenant,
  resolverTenantConfigurado,
} from "@config/tenants";

/**
 * Tenant do ambiente, ou `null` quando não há um configurado.
 *
 * O provedor demo é o de DESENVOLVIMENTO e mostruário: ele não pode explodir
 * na montagem só porque a instalação ainda não declarou TENANT_ATIVO — quem
 * cobra isso é a validação de ambiente, com mensagem própria.
 */
function tenantDoAmbienteOuNulo() {
  try {
    return process.env.TENANT_ATIVO?.trim() ? resolverTenantConfigurado() : null;
  } catch {
    return null;
  }
}

export interface UsuarioDemo {
  readonly id: string;
  readonly usuario: string;
  readonly nome: string;
  readonly papel: PapelUsuario;
  readonly fornecedores: readonly number[] | null;
  readonly tenantId?: string;
  readonly ativo?: boolean;
  readonly criadoEm?: string;
}

export const USUARIOS_DEMO: readonly UsuarioDemo[] = [
  { id: "demo-gestor", usuario: "gestor", nome: "Gestor Demonstração", papel: "GESTOR", fornecedores: null, ativo: true },
  { id: "demo-admin", usuario: "admin", nome: "Administrador Demonstração", papel: "ADMIN", fornecedores: null, ativo: true },
  { id: "demo-comprador", usuario: "comprador", nome: "Comprador Demonstração", papel: "COMPRADOR", fornecedores: null, ativo: true },
];

const DURACAO_SESSAO_MS = 12 * 3600 * 1000;
const SEGREDO_PADRAO_DEV = "insight-demo-segredo-somente-desenvolvimento";

interface CargaToken {
  readonly sub: string;
  readonly usuario: string;
  readonly nome: string;
  readonly papel: PapelUsuario;
  readonly tenantId: string;
  readonly fornecedores: readonly number[] | null;
  readonly exp: number;
}

interface UsuarioDemoInterno {
  id: string;
  usuario: string;
  nome: string;
  papel: PapelUsuario;
  fornecedores: readonly number[] | null;
  tenantId: string;
  ativo: boolean;
  criadoEm: string;
  senha: string;
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

export class ProvedorAutenticacaoDemo implements ProvedorAutenticacao, AdministradorUsuarios {
  readonly id = "demo" as const;
  private readonly senhaPadrao: string;
  private readonly segredo: string;
  private readonly agora: () => number;
  private readonly usuariosInternos = new Map<string, UsuarioDemoInterno>();

  constructor(opcoes: OpcoesProvedorDemo = {}) {
    this.senhaPadrao = opcoes.senha ?? process.env.DEMO_SENHA ?? "demo";
    this.segredo = opcoes.segredo ?? process.env.AUTH_SECRET ?? SEGREDO_PADRAO_DEV;
    this.agora = opcoes.agora ?? (() => Date.now());

    const baseUsuarios = opcoes.usuarios ?? USUARIOS_DEMO;
    for (const u of baseUsuarios) {
      this.usuariosInternos.set(u.id, {
        id: u.id,
        usuario: u.usuario,
        nome: u.nome,
        papel: u.papel,
        fornecedores: u.fornecedores,
        tenantId: u.tenantId ?? (tenantDoAmbienteOuNulo() ?? TENANT_PADRAO).id,
        ativo: u.ativo ?? true,
        criadoEm: u.criadoEm ?? "2026-09-01T00:00:00.000Z",
        senha: this.senhaPadrao,
      });
    }
  }

  private buscarUsuarioPorIdentificador(idOuNome: string): UsuarioDemoInterno | undefined {
    const busca = idOuNome.trim().toLowerCase();
    const porId = this.usuariosInternos.get(idOuNome);
    if (porId) return porId;
    for (const u of this.usuariosInternos.values()) {
      if (u.usuario.toLowerCase() === busca || u.id.toLowerCase() === busca) {
        return u;
      }
    }
    return undefined;
  }

  async entrar(credenciais: CredenciaisLogin): Promise<SessaoAutenticada> {
    /**
     * Contas de demonstração só entram no tenant de DEMONSTRAÇÃO.
     *
     * O risco real nunca foi "produção": era a instalação de um CLIENTE subir
     * com contas internas de senha "demo", uma delas ADMIN, para quem chegasse
     * na URL — e isso acontece por OMISSÃO, bastando faltar a variável do
     * Supabase no ambiente, porque a seleção de provedor cai em "demo" sozinha.
     *
     * Amarrar a trava em NODE_ENV pegava junto o que ela não devia pegar: o
     * mostruário publicado, cujo propósito é justamente deixar qualquer um
     * entrar e olhar. Medido no deploy: a plataforma subia em "Rede
     * Demonstração", com dado sintético e nome de rede nenhum, e ainda assim
     * recusava o login — ninguém conseguia ver a demonstração.
     *
     * Quem decide é a NATUREZA do tenant. Sintética, entra; cliente real, não
     * entra — em produção ou fora dela.
     *
     * A checagem olhava só o tenant do AMBIENTE. Numa instalação multi-cliente
     * (sem TENANT_ATIVO), isso resolvia para a demonstração e o login demo era
     * aceito para QUALQUER tenant pedido no cabeçalho, inclusive um cliente
     * real. Agora vale o tenant DA REQUISIÇÃO, e o do ambiente por cima dele.
     */
    const tenantPedido = buscarConfiguracaoTenant(credenciais.tenantId);
    if (!tenantPedido || naturezaTenant(tenantPedido) !== "sintetica") {
      throw new ErroProvedorIndisponivel(
        "demo",
        "contas de demonstração não entram na instalação de um cliente; configure SUPABASE_URL e SUPABASE_ANON_KEY."
      );
    }

    const tenantDoAmbiente = tenantDoAmbienteOuNulo();
    if (tenantDoAmbiente && naturezaTenant(tenantDoAmbiente) !== "sintetica") {
      throw new ErroProvedorIndisponivel(
        "demo",
        "esta instalação atende um cliente real; contas de demonstração não entram."
      );
    }

    const nome = String(credenciais.usuario ?? "").trim().toLowerCase();
    const usuario = this.buscarUsuarioPorIdentificador(nome);
    if (!usuario || credenciais.senha !== usuario.senha) {
      throw new ErroCredenciaisInvalidas();
    }
    if (!usuario.ativo) {
      throw new ErroUsuarioDesativado();
    }
    const exp = this.agora() + DURACAO_SESSAO_MS;
    const carga: CargaToken = {
      sub: usuario.id,
      usuario: usuario.usuario,
      nome: usuario.nome,
      papel: usuario.papel,
      tenantId: credenciais.tenantId,
      fornecedores: usuario.fornecedores,
      exp,
    };
    const cargaCodificada = base64UrlCodificar(JSON.stringify(carga));
    const token = `${cargaCodificada}.${await assinar(this.segredo, cargaCodificada)}`;
    const usuarioAutenticado = montarUsuarioAutenticado(
      {
        id: usuario.id,
        usuario: usuario.usuario,
        nome: usuario.nome,
        papel: usuario.papel,
        tenantId: credenciais.tenantId,
        fornecedores: usuario.fornecedores,
      },
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

    const usuario = this.buscarUsuarioPorIdentificador(carga.sub);
    // Se o usuário foi desativado ou removido, o token não valida mais (revogação imediata)
    if (usuario && !usuario.ativo) {
      return null;
    }

    return montarUsuarioAutenticado(
      {
        id: carga.sub,
        usuario: carga.usuario,
        nome: carga.nome,
        papel: carga.papel,
        tenantId: carga.tenantId,
        fornecedores: carga.fornecedores,
      },
      tenantId
    );
  }

  async renovar(): Promise<SessaoAutenticada | null> {
    return null; // demo não renova: expira e pede login de novo
  }

  async sair(): Promise<void> {
    // token sem estado: expira sozinho
  }

  async alterarSenha(usuarioId: string, senhaAtual: string, novaSenha: string): Promise<void> {
    if (!novaSenha || novaSenha.length < 8) {
      throw new Error("A nova senha deve conter no mínimo 8 caracteres.");
    }
    const usuario = this.buscarUsuarioPorIdentificador(usuarioId);
    if (!usuario) {
      throw new ErroCredenciaisInvalidas("Usuário não encontrado.");
    }
    if (usuario.senha !== senhaAtual) {
      throw new ErroCredenciaisInvalidas("Senha atual incorreta.");
    }
    usuario.senha = novaSenha;
  }

  async desativarUsuario(usuarioId: string): Promise<void> {
    const usuario = this.buscarUsuarioPorIdentificador(usuarioId);
    if (!usuario) {
      throw new Error("Usuário não encontrado.");
    }
    usuario.ativo = false;
  }

  async reativarUsuario(usuarioId: string): Promise<void> {
    const usuario = this.buscarUsuarioPorIdentificador(usuarioId);
    if (!usuario) {
      throw new Error("Usuário não encontrado.");
    }
    usuario.ativo = true;
  }

  async criarUsuario(novo: NovoUsuario): Promise<UsuarioCadastrado> {
    const usuarioNormalizado = normalizarNomeUsuario(novo.usuario);
    if (!usuarioNormalizado) {
      throw new Error(
        "nome de usuário inválido: use de 3 a 30 caracteres, minúsculas, números, ponto, hífen ou sublinhado."
      );
    }
    if (!novo.senha || novo.senha.length < 8) {
      throw new Error("A senha deve conter no mínimo 8 caracteres.");
    }
    const existente = this.buscarUsuarioPorIdentificador(usuarioNormalizado);
    if (existente) {
      throw new Error(`Usuário "${usuarioNormalizado}" já cadastrado.`);
    }

    const id = `demo-${usuarioNormalizado}-${Date.now()}`;
    const criadoEm = new Date(this.agora()).toISOString();
    const novoInterno: UsuarioDemoInterno = {
      id,
      usuario: usuarioNormalizado,
      nome: novo.nome.trim() || usuarioNormalizado,
      papel: novo.papel,
      tenantId: novo.tenantId,
      fornecedores: normalizarFornecedores(novo.fornecedores),
      ativo: true,
      criadoEm,
      senha: novo.senha,
    };
    this.usuariosInternos.set(id, novoInterno);

    return {
      id: novoInterno.id,
      usuario: novoInterno.usuario,
      nome: novoInterno.nome,
      papel: novoInterno.papel,
      tenantId: novoInterno.tenantId,
      fornecedores: novoInterno.fornecedores,
      criadoEm: novoInterno.criadoEm,
      ativo: novoInterno.ativo,
    };
  }

  async listarUsuarios(tenantId: string): Promise<UsuarioCadastrado[]> {
    const tenantConfiguradoId = (tenantDoAmbienteOuNulo() ?? TENANT_PADRAO).id;
    return Array.from(this.usuariosInternos.values())
      .filter(
        (u) =>
          !tenantId ||
          u.tenantId === tenantId ||
          tenantId === tenantConfiguradoId ||
          tenantId === "demonstracao" ||
          tenantId === "demo"
      )
      .map((u) => ({
        id: u.id,
        usuario: u.usuario,
        nome: u.nome,
        papel: u.papel,
        tenantId: u.tenantId,
        fornecedores: u.fornecedores,
        criadoEm: u.criadoEm,
        ativo: u.ativo,
      }));
  }
}

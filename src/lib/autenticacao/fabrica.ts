/**
 * Fábrica do provedor de autenticação. Edge-safe.
 * Camada: Aplicação (src/lib/autenticacao).
 *
 * Seleção:
 *   AUTH_PROVIDER=supabase | demo   (explícito)
 *   ausente -> supabase se SUPABASE_URL + SUPABASE_ANON_KEY existem, senão demo.
 *
 * Para plugar outra nuvem (Firebase, Cognito, Vercel...): implementar
 * ProvedorAutenticacao em provedores/<nome>.ts e registrar aqui.
 */

import { AdministradorUsuarios, ErroProvedorIndisponivel, IdProvedorAutenticacao, ProvedorAutenticacao } from "./porta";
import { ProvedorAutenticacaoDemo } from "./provedores/demo";
import { ProvedorAutenticacaoSupabase, lerConfiguracaoSupabaseAuth, supabaseAuthConfigurado } from "./provedores/supabase";

export function idProvedorConfigurado(): IdProvedorAutenticacao {
  const forcado = process.env.AUTH_PROVIDER?.trim().toLowerCase();
  if (forcado === "demo") return "demo";
  if (forcado === "supabase") return "supabase";
  return supabaseAuthConfigurado() ? "supabase" : "demo";
}

const instancias = new Map<IdProvedorAutenticacao, ProvedorAutenticacao>();

export function obterProvedorAutenticacao(id: IdProvedorAutenticacao = idProvedorConfigurado()): ProvedorAutenticacao {
  const existente = instancias.get(id);
  if (existente) return existente;

  let provedor: ProvedorAutenticacao;
  if (id === "supabase") {
    const cfg = lerConfiguracaoSupabaseAuth();
    if (!cfg) throw new ErroProvedorIndisponivel("supabase", "defina SUPABASE_URL e SUPABASE_ANON_KEY.");
    provedor = new ProvedorAutenticacaoSupabase(cfg);
  } else {
    provedor = new ProvedorAutenticacaoDemo();
  }
  instancias.set(id, provedor);
  return provedor;
}

export function obterAdministradorUsuarios(): AdministradorUsuarios {
  const provedor = obterProvedorAutenticacao();
  return provedor as unknown as AdministradorUsuarios;
}

/** Só para testes: zera as instâncias após mudar env. */
export function limparInstanciasProvedores(): void {
  instancias.clear();
}
